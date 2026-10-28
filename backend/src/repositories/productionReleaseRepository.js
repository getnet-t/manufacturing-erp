
const { withTransaction } = require("../utils/transaction");

async function releaseProductionOrder(orderId, companyId, userId) {
  return withTransaction(async (client) => {
    // Lock the order so two requests cannot release it simultaneously.
    const orderResult = await client.query(
      `SELECT
         po.id,
         po.company_id,
         po.product_id,
         po.warehouse_id,
         po.bom_version_id,
         po.planned_quantity,
         po.status,
         bv.status AS bom_status,
         b.product_id AS bom_product_id
       FROM production_orders po
       JOIN bom_versions bv ON bv.id = po.bom_version_id
       JOIN boms b ON b.id = bv.bom_id
       WHERE po.id = $1
         AND po.company_id = $2
         AND b.company_id = po.company_id
       FOR UPDATE OF po`,
      [orderId, companyId]
    );

    if (orderResult.rowCount === 0) {
      throw new Error("Production order not found");
    }

    const order = orderResult.rows[0];

    if (order.status !== "PLANNED") {
      throw new Error("Only planned production orders can be released");
    }

    if (
      order.bom_status !== "ACTIVE" ||
      Number(order.bom_product_id) !== Number(order.product_id)
    ) {
      throw new Error("Production order requires an active matching BOM");
    }

    // Read the BOM requirements.
    const componentsResult = await client.query(
      `SELECT
         bc.component_product_id,
         bc.quantity_required,
         bc.scrap_percent,
         p.sku,
         p.name,
         p.track_batch,
         p.status AS product_status
       FROM bom_components bc
       JOIN products p
         ON p.id = bc.component_product_id
        AND p.company_id = $2
       WHERE bc.bom_version_id = $1
       ORDER BY bc.sequence_no, bc.id`,
      [order.bom_version_id, companyId]
    );

    if (componentsResult.rowCount === 0) {
      throw new Error("Active BOM has no components");
    }

    const allocations = [];

    for (const component of componentsResult.rows) {
      if (component.product_status !== "ACTIVE") {
        throw new Error(
          `BOM component ${component.sku} is not active`
        );
      }

      const required =
        Number(order.planned_quantity) *
        Number(component.quantity_required) *
        (1 + Number(component.scrap_percent) / 100);

      if (!Number.isFinite(required) || required <= 0) {
        throw new Error(
          `Invalid material requirement for ${component.sku}`
        );
      }

      // Lock the product's warehouse balance.
      const balanceResult = await client.query(
        `SELECT id, on_hand_qty, reserved_qty
         FROM inventory_balances
         WHERE company_id = $1
           AND product_id = $2
           AND warehouse_id = $3
         FOR UPDATE`,
        [
          companyId,
          component.component_product_id,
          order.warehouse_id,
        ]
      );

      if (balanceResult.rowCount === 0) {
        throw new Error(
          `No inventory balance exists for ${component.sku}`
        );
      }

      const balance = balanceResult.rows[0];
      const available =
        Number(balance.on_hand_qty) - Number(balance.reserved_qty);

      if (available + 0.0000001 < required) {
        throw new Error(
          `Insufficient available stock for ${component.sku}. ` +
          `Required: ${required}; available: ${available}`
        );
      }

      const componentAllocations = [];

      if (component.track_batch) {
        // Lock eligible batches in expiry-first order.
        const batchesResult = await client.query(
          `SELECT id, batch_no
           FROM inventory_batches
           WHERE company_id = $1
             AND product_id = $2
             AND status = 'AVAILABLE'
             AND (expires_at IS NULL OR expires_at >= CURRENT_DATE)
           ORDER BY expires_at ASC NULLS LAST, id ASC
           FOR UPDATE`,
          [companyId, component.component_product_id]
        );

        let remaining = required;

        for (const batch of batchesResult.rows) {
          // Calculate posted physical stock for this batch and warehouse.
          const physicalResult = await client.query(
            `SELECT COALESCE(
               SUM(
                 CASE
                   WHEN ml.movement_direction = 'IN'
                     THEN bm.quantity
                   WHEN ml.movement_direction = 'OUT'
                     THEN -bm.quantity
                   ELSE 0
                 END
               ), 0
             ) AS physical_quantity
             FROM inventory_batch_movements bm
             JOIN inventory_movement_lines ml
               ON ml.id = bm.movement_line_id
             JOIN inventory_transactions it
               ON it.id = ml.inventory_transaction_id
             WHERE bm.batch_id = $1
               AND ml.warehouse_id = $2
               AND it.company_id = $3
               AND it.status = 'POSTED'`,
            [batch.id, order.warehouse_id, companyId]
          );

          // Exclude material already reserved by other active production orders.
          const reservedResult = await client.query(
            `SELECT COALESCE(
               SUM(GREATEST(a.reserved_quantity - a.issued_quantity, 0)),
               0
             ) AS reserved_quantity
             FROM production_order_allocations a
             JOIN production_orders po
               ON po.id = a.production_order_id
             WHERE a.batch_id = $1
               AND a.warehouse_id = $2
               AND po.company_id = $3
               AND po.status IN ('RELEASED', 'IN_PROGRESS')
               AND po.id <> $4`,
            [batch.id, order.warehouse_id, companyId, order.id]
          );

          const batchAvailable =
            Number(physicalResult.rows[0].physical_quantity) -
            Number(reservedResult.rows[0].reserved_quantity);

          if (batchAvailable <= 0) {
            continue;
          }

          const quantity = Math.min(remaining, batchAvailable);

          if (quantity > 0) {
            componentAllocations.push({
              componentProductId: component.component_product_id,
              warehouseId: order.warehouse_id,
              batchId: batch.id,
              quantity,
            });

            remaining -= quantity;
          }

          if (remaining <= 0.0000001) {
            remaining = 0;
            break;
          }
        }

        if (remaining > 0.0000001) {
          throw new Error(
            `Insufficient available batch stock for ${component.sku}. ` +
            `Short by: ${remaining}`
          );
        }
      } else {
        componentAllocations.push({
          componentProductId: component.component_product_id,
          warehouseId: order.warehouse_id,
          batchId: null,
          quantity: required,
        });
      }

      // Reserve stock without reducing on-hand quantity.
      const updateResult = await client.query(
        `UPDATE inventory_balances
         SET reserved_qty = reserved_qty + $1,
             updated_at = NOW()
         WHERE id = $2
           AND reserved_qty + $1 <= on_hand_qty
         RETURNING id`,
        [required, balance.id]
      );

      if (updateResult.rowCount !== 1) {
        throw new Error(
          `Stock changed while reserving ${component.sku}; try again`
        );
      }

      allocations.push(...componentAllocations);
    }

    // Store the allocation for each batch (or one unbatched allocation).
    for (const allocation of allocations) {
      await client.query(
        `INSERT INTO production_order_allocations (
           production_order_id,
           component_product_id,
           warehouse_id,
           batch_id,
           required_quantity,
           reserved_quantity,
           issued_quantity
         )
         VALUES ($1, $2, $3, $4, $5, $5, 0)`,
        [
          order.id,
          allocation.componentProductId,
          allocation.warehouseId,
          allocation.batchId,
          allocation.quantity,
        ]
      );
    }

    const updateOrderResult = await client.query(
      `UPDATE production_orders
       SET status = 'RELEASED'
       WHERE id = $1
         AND company_id = $2
         AND status = 'PLANNED'
       RETURNING id, production_order_number, status`,
      [order.id, companyId]
    );

    if (updateOrderResult.rowCount !== 1) {
      throw new Error("Production order could not be released");
    }

    return {
      order: updateOrderResult.rows[0],
      allocations,
    };
  });
}

module.exports = { releaseProductionOrder };
