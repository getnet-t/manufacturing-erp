
const { withTransaction } = require("../utils/transaction");

async function createDraftProductionOutput({
  companyId,
  productionOrderId,
  outputNumber,
  outputDate,
  warehouseId,
  createdBy,
}) {
  return withTransaction(async (client) => {
    const orderResult = await client.query(
      `SELECT id, company_id, product_id, warehouse_id, status,
              planned_quantity, produced_quantity, rejected_quantity
       FROM production_orders
       WHERE id = $1 AND company_id = $2
       FOR UPDATE`,
      [productionOrderId, companyId]
    );

    const order = orderResult.rows[0];

    if (!order) {
      throw new Error("Production order not found");
    }

    if (!["RELEASED", "IN_PROGRESS"].includes(order.status)) {
      throw new Error(
        "Production output requires a released or in-progress order"
      );
    }

    if (Number(order.warehouse_id) !== Number(warehouseId)) {
      throw new Error(
        "Output warehouse must match the production order warehouse"
      );
    }

    const warehouseResult = await client.query(
      `SELECT w.id
       FROM warehouses w
       JOIN factories f ON f.id = w.factory_id
       WHERE w.id = $1
         AND f.company_id = $2
         AND w.status = 'ACTIVE'
         AND f.status = 'ACTIVE'
       FOR UPDATE OF w`,
      [warehouseId, companyId]
    );

    if (!warehouseResult.rowCount) {
      throw new Error("Active warehouse not found in this company");
    }

    const result = await client.query(
      `INSERT INTO production_outputs (
         company_id,
         production_order_id,
         warehouse_id,
         output_number,
         output_date,
         status,
         created_by
       )
       VALUES ($1, $2, $3, $4, $5, 'DRAFT', $6)
       RETURNING *`,
      [
        companyId,
        productionOrderId,
        warehouseId,
        outputNumber,
        outputDate,
        createdBy,
      ]
    );

    return result.rows[0];
  });
}

async function addProductionOutputLine({
  companyId,
  outputId,
  productId,
  batchNo,
  quantity,
  qualityStatus,
}) {
  return withTransaction(async (client) => {
    const outputResult = await client.query(
      `SELECT
         o.id,
         o.company_id,
         o.production_order_id,
         o.status AS output_status,
         o.warehouse_id,
         po.product_id AS order_product_id,
         po.status AS order_status
       FROM production_outputs o
       JOIN production_orders po
         ON po.id = o.production_order_id
        AND po.company_id = o.company_id
       WHERE o.id = $1
         AND o.company_id = $2
       FOR UPDATE OF o, po`,
      [outputId, companyId]
    );

    const output = outputResult.rows[0];

    if (!output) {
      throw new Error("Production output not found");
    }

    if (output.output_status !== "DRAFT") {
      throw new Error("Only draft production outputs can be changed");
    }

    if (!["RELEASED", "IN_PROGRESS"].includes(output.order_status)) {
      throw new Error("Production order is not available for output");
    }

    if (Number(productId) !== Number(output.order_product_id)) {
      throw new Error(
        "Output product must match the production order finished product"
      );
    }

    const productResult = await client.query(
      `SELECT id, track_batch, status
       FROM products
       WHERE id = $1 AND company_id = $2
       FOR UPDATE`,
      [productId, companyId]
    );

    const product = productResult.rows[0];

    if (!product || product.status !== "ACTIVE") {
      throw new Error("Active finished product not found");
    }

    let validBatchNo = null;

    if (product.track_batch) {
      if (
        typeof batchNo !== "string" ||
        !batchNo.trim() ||
        batchNo.trim().length > 100
      ) {
        throw new Error(
          "A valid batch number is required for this product"
        );
      }

      validBatchNo = batchNo.trim();
    } else if (
      batchNo !== undefined &&
      batchNo !== null &&
      batchNo !== ""
    ) {
      throw new Error(
        "Batch number must not be supplied for an untracked product"
      );
    }

    const result = await client.query(
      `INSERT INTO production_output_lines (
         production_output_id,
         product_id,
         batch_id,
         batch_no,
         quantity,
         unit_cost,
         total_cost,
         quality_status
       )
       VALUES ($1, $2, NULL, $3, $4, 0, 0, $5)
       RETURNING *`,
      [
        outputId,
        productId,
        validBatchNo,
        quantity,
        qualityStatus,
      ]
    );

    return result.rows[0];
  });
}

async function postProductionOutput({ companyId, outputId, userId }) {
  return withTransaction(async (client) => {
    // 1. Lock the output and its production order.
    const outputResult = await client.query(
      `SELECT
         o.id,
         o.company_id,
         o.production_order_id,
         o.warehouse_id,
         o.output_number,
         o.output_date,
         o.status AS output_status,
         po.product_id,
         po.status AS order_status
       FROM production_outputs o
       JOIN production_orders po
         ON po.id = o.production_order_id
        AND po.company_id = o.company_id
       WHERE o.id = $1
         AND o.company_id = $2
       FOR UPDATE OF o, po`,
      [outputId, companyId]
    );

    const output = outputResult.rows[0];

    if (!output) {
      throw new Error("Production output not found");
    }

    if (output.output_status !== "DRAFT") {
      throw new Error("Only draft production outputs can be posted");
    }

    if (!["RELEASED", "IN_PROGRESS"].includes(output.order_status)) {
      throw new Error("Production order is not available for output");
    }

    // 2. Lock and validate every output line.
    const linesResult = await client.query(
      `SELECT
         id,
         product_id,
         batch_id,
         batch_no,
         quantity,
         unit_cost,
         total_cost,
         quality_status
       FROM production_output_lines
       WHERE production_output_id = $1
       ORDER BY id
       FOR UPDATE`,
      [outputId]
    );

    const lines = linesResult.rows;

    if (lines.length === 0) {
      throw new Error("Cannot post an output without lines");
    }

    for (const line of lines) {
      if (Number(line.product_id) !== Number(output.product_id)) {
        throw new Error("Output product does not match the production order");
      }

      if (line.quality_status !== "ACCEPTED") {
        throw new Error(
          "Only accepted output lines can be posted by this operation"
        );
      }

      if (
        Number(line.quantity) <= 0 ||
        Number(line.unit_cost) <= 0 ||
        Number(line.total_cost) <= 0
      ) {
        throw new Error(
          "Cannot post output: valid positive production costing is required"
        );
      }

      // Require a passed inspection for this output and product.
      const qcResult = await client.query(
        `SELECT id
         FROM quality_inspections
         WHERE company_id = $1
           AND production_output_id = $2
           AND product_id = $3
           AND inspection_type = 'PRODUCTION_OUTPUT'
           AND status = 'PASSED'
           AND inspection_result = 'PASS'
           AND quantity_inspected >= $4
           AND quantity_accepted >= $4
         LIMIT 1
         FOR UPDATE`,
        [
          companyId,
          outputId,
          line.product_id,
          line.quantity,
        ]
      );

      if (!qcResult.rowCount) {
        throw new Error(
          "Cannot post output: a passed QC inspection covering the output quantity is required"
        );
      }
    }

    // 3. Create a finished-goods inventory transaction.
    // This is an IN transaction; it does not issue raw materials.
    const transactionResult = await client.query(
      `INSERT INTO inventory_transactions (
         company_id,
         document_no,
         transaction_type,
         status,
         source_document_type,
         source_document_id,
         transaction_date
       )
       VALUES (
         $1, $2, 'PRODUCTION_OUTPUT', 'DRAFT',
         'PRODUCTION_OUTPUT', $3, $4
       )
       RETURNING id`,
      [
        companyId,
        output.output_number,
        output.id,
        output.output_date,
      ]
    );

    const transactionId = transactionResult.rows[0].id;

    // 4. Receive accepted finished goods into stock.
    for (const line of lines) {
      const productResult = await client.query(
        `SELECT id, track_batch, status
         FROM products
         WHERE id = $1 AND company_id = $2
         FOR UPDATE`,
        [line.product_id, companyId]
      );

      const product = productResult.rows[0];

      if (!product || product.status !== "ACTIVE") {
        throw new Error("Active finished product not found");
      }

      let batchId = line.batch_id;

           if (product.track_batch) {
        if (!line.batch_no) {
          throw new Error("A batch number is required for finished goods");
        }

        if (!batchId) {
          // Try to create a new batch without modifying an existing one.
          const insertBatchResult = await client.query(
            `INSERT INTO inventory_batches (
               company_id,
               product_id,
               batch_no,
               manufactured_at,
               status
             )
             VALUES ($1, $2, $3, $4, 'AVAILABLE')
             ON CONFLICT (company_id, product_id, batch_no)
             DO NOTHING
             RETURNING id, status`,
            [
              companyId,
              line.product_id,
              line.batch_no,
              output.output_date,
            ]
          );

          if (insertBatchResult.rowCount > 0) {
            batchId = insertBatchResult.rows[0].id;
          } else {
            // The batch already exists; lock it and validate it.
            const existingBatchResult = await client.query(
              `SELECT id, status
               FROM inventory_batches
               WHERE company_id = $1
                 AND product_id = $2
                 AND batch_no = $3
               FOR UPDATE`,
              [companyId, line.product_id, line.batch_no]
            );

            const existingBatch = existingBatchResult.rows[0];

            if (!existingBatch) {
              throw new Error(
                "Finished-goods batch could not be found after insert conflict"
              );
            }

            if (existingBatch.status !== "AVAILABLE") {
              throw new Error(
                "Finished-goods batch is not available for receipt"
              );
            }

            batchId = existingBatch.id;
          }
        } else {
          // A batch already linked to this output line must match the product.
          const linkedBatchResult = await client.query(
            `SELECT id, status, batch_no
             FROM inventory_batches
             WHERE id = $1
               AND company_id = $2
               AND product_id = $3
             FOR UPDATE`,
            [batchId, companyId, line.product_id]
          );

          const linkedBatch = linkedBatchResult.rows[0];

          if (
            !linkedBatch ||
            linkedBatch.status !== "AVAILABLE" ||
            linkedBatch.batch_no !== line.batch_no
          ) {
            throw new Error(
              "Linked finished-goods batch is invalid or unavailable"
            );
          }
        }
      }

      const quantity = Number(line.quantity);
      const unitCost = Number(line.unit_cost);
      const totalCost = quantity * unitCost;

      // IN movement: positive quantity and positive inventory value.
      const movementResult = await client.query(
        `INSERT INTO inventory_movement_lines (
           inventory_transaction_id,
           product_id,
           warehouse_id,
           quantity_delta,
           unit_cost,
           value_delta,
           movement_direction
         )
         VALUES ($1, $2, $3, $4, $5, $6, 'IN')
         RETURNING id`,
        [
          transactionId,
          line.product_id,
          output.warehouse_id,
          quantity,
          unitCost,
          totalCost,
        ]
      );

      const movementLineId = movementResult.rows[0].id;

      if (product.track_batch) {
        await client.query(
          `INSERT INTO inventory_batch_movements (
             movement_line_id, batch_id, quantity
           )
           VALUES ($1, $2, $3)`,
          [movementLineId, batchId, quantity]
        );
      }

      // Update stock for the finished product only.
      await client.query(
        `INSERT INTO inventory_balances (
           company_id, product_id, warehouse_id,
           on_hand_qty, reserved_qty
         )
         VALUES ($1, $2, $3, $4, 0)
         ON CONFLICT (company_id, product_id, warehouse_id)
         DO UPDATE SET
           on_hand_qty =
             inventory_balances.on_hand_qty + EXCLUDED.on_hand_qty,
           updated_at = NOW()`,
        [companyId, line.product_id, output.warehouse_id, quantity]
      );

      // Update moving weighted-average inventory valuation.
      await client.query(
        `INSERT INTO inventory_valuation_balances (
           company_id, product_id, on_hand_qty,
           inventory_value, average_cost, last_valuation_at
         )
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (company_id, product_id)
         DO UPDATE SET
           average_cost =
             (
               inventory_valuation_balances.inventory_value
               + EXCLUDED.inventory_value
             )
             /
             NULLIF(
               inventory_valuation_balances.on_hand_qty
               + EXCLUDED.on_hand_qty,
               0
             ),
           on_hand_qty =
             inventory_valuation_balances.on_hand_qty
             + EXCLUDED.on_hand_qty,
           inventory_value =
             inventory_valuation_balances.inventory_value
             + EXCLUDED.inventory_value,
           last_valuation_at = NOW(),
           updated_at = NOW()`,
        [
          companyId,
          line.product_id,
          quantity,
          totalCost,
          unitCost,
        ]
      );

      await client.query(
        `UPDATE production_output_lines
         SET batch_id = $1,
             inventory_movement_line_id = $2,
             total_cost = $3
         WHERE id = $4`,
        [batchId, movementLineId, totalCost, line.id]
      );
    }

    // 5. Mark the inventory transaction as posted.
    await client.query(
      `UPDATE inventory_transactions
       SET status = 'POSTED',
           posted_by = $1,
           posted_at = NOW()
       WHERE id = $2
         AND status = 'DRAFT'`,
      [userId, transactionId]
    );

    // 6. Mark the production output as posted.
const postedResult = await client.query(
  `UPDATE production_outputs
   SET status = 'POSTED',
       inventory_transaction_id = $1,
       posted_by = $2,
       posted_at = NOW()
   WHERE id = $3
     AND company_id = $4
     AND status = 'DRAFT'
   RETURNING *`,
  [transactionId, userId, outputId, companyId]
);

  if (!postedResult.rowCount) {
  throw new Error(
    "Production output could not be posted; it may no longer be in DRAFT status"
  );
}

return postedResult.rows[0];
  });
}
async function calculateProductionOutputCost({
  companyId,
  outputId,
}) {
  return withTransaction(async (client) => {
    const outputResult = await client.query(
      `SELECT
         o.id,
         o.production_order_id,
         o.status AS output_status,
         po.planned_quantity,
         po.bom_version_id,
         po.product_id AS finished_product_id
       FROM production_outputs o
       JOIN production_orders po
         ON po.id = o.production_order_id
        AND po.company_id = o.company_id
       WHERE o.id = $1
         AND o.company_id = $2
       FOR UPDATE OF o, po`,
      [outputId, companyId]
    );

    const output = outputResult.rows[0];

    if (!output) {
      throw new Error("Production output not found");
    }

    if (output.output_status !== "DRAFT") {
      throw new Error("Only DRAFT production outputs can be costed");
    }

    const otherOutputs = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM production_outputs
       WHERE company_id = $1
         AND production_order_id = $2
         AND id <> $3
         AND status <> 'CANCELLED'`,
      [companyId, output.production_order_id, outputId]
    );

    if (otherOutputs.rows[0].count > 0) {
      throw new Error(
        "Costing is blocked: this order has other outputs. Cost allocation must be reconciled first."
      );
    }

    const linesResult = await client.query(
      `SELECT id, product_id, quantity
       FROM production_output_lines
       WHERE production_output_id = $1
       FOR UPDATE`,
      [outputId]
    );

    if (!linesResult.rowCount) {
      throw new Error("Production output has no lines");
    }

    const outputQuantity = linesResult.rows.reduce(
      (sum, line) => sum + Number(line.quantity),
      0
    );

    if (!Number.isFinite(outputQuantity) || outputQuantity <= 0) {
      throw new Error("Invalid production output quantity");
    }

    for (const line of linesResult.rows) {
      if (
        Number(line.product_id) !==
        Number(output.finished_product_id)
      ) {
        throw new Error(
          "Output line product does not match the production order"
        );
      }
    }

    const bomResult = await client.query(
      `SELECT
         bc.component_product_id,
         bc.quantity_required,
         bc.scrap_percent
       FROM bom_components bc
       WHERE bc.bom_version_id = $1`,
      [output.bom_version_id]
    );

    if (!bomResult.rowCount) {
      throw new Error("No BOM components found for this production order");
    }

    const issuedResult = await client.query(
      `SELECT
         ml.product_id,
         SUM(ABS(ml.quantity_delta)) AS issued_quantity,
         SUM(ABS(ml.value_delta)) AS issued_value
       FROM inventory_transactions it
       JOIN inventory_movement_lines ml
         ON ml.inventory_transaction_id = it.id
       WHERE it.company_id = $1
         AND it.source_document_type = 'PRODUCTION_ORDER'
         AND it.source_document_id = $2
         AND it.transaction_type = 'PRODUCTION_ISSUE'
         AND it.status = 'POSTED'
AND ml.movement_direction = 'OUT'
AND NOT EXISTS (
  SELECT 1
  FROM inventory_transactions reversal
  WHERE reversal.reversal_of_transaction_id = it.id
)
       GROUP BY ml.product_id`,
      [companyId, output.production_order_id]
    );

    const issuedByProduct = new Map(
      issuedResult.rows.map((row) => [
        Number(row.product_id),
        {
          quantity: Number(row.issued_quantity),
          value: Number(row.issued_value),
        },
      ])
    );

    const requiredByProduct = new Map();

for (const component of bomResult.rows) {
  const productId = Number(component.component_product_id);

  const requiredQuantity =
    outputQuantity *
    Number(component.quantity_required) *
    (1 + Number(component.scrap_percent) / 100);

  requiredByProduct.set(
    productId,
    (requiredByProduct.get(productId) || 0) + requiredQuantity
  );
}

for (const [productId, issued] of issuedByProduct) {
  if (!requiredByProduct.has(productId)) {
    throw new Error(
      `Unexpected material issue for product ${productId}: this product is not in the output BOM`
    );
  }
}

for (const [productId, requiredQuantity] of requiredByProduct) {
  const issued = issuedByProduct.get(productId);
  const issuedQuantity = issued ? issued.quantity : 0;

  if (
    Math.abs(issuedQuantity - requiredQuantity) > 0.000001
  ) {
    throw new Error(
      `Material quantity mismatch for product ${productId}: required ${requiredQuantity.toFixed(6)}, issued ${issuedQuantity.toFixed(6)}. Complete or reconcile material issues before costing.`
    );
  }
}

    const allocationResult = await client.query(
     `SELECT COALESCE(SUM(a.allocated_amount), 0) AS allocated_cost
FROM production_cost_allocations a
JOIN production_cost_entries e
  ON e.id = a.production_cost_entry_id
 AND e.production_order_id = a.production_order_id
WHERE a.production_output_id = $1
  AND a.production_order_id = $2
  AND a.approval_status = 'APPROVED'
  AND e.approval_status = 'APPROVED'`
[outputId, output.production_order_id]
 );

    const approvedAllocatedCost = Number(
      allocationResult.rows[0].allocated_cost
    );

        const materialCost = [...requiredByProduct.keys()].reduce(
      (sum, productId) => {
        const issued = issuedByProduct.get(productId);

        if (!issued || issued.quantity <= 0) {
          throw new Error(
            "Unable to determine posted material cost"
          );
        }

        return sum + issued.value;
      },
      0
    );

    const totalCost = materialCost + approvedAllocatedCost;
    const unitCost = totalCost / outputQuantity;

    if (
      !Number.isFinite(unitCost) ||
      !Number.isFinite(totalCost) ||
      unitCost <= 0 ||
      totalCost <= 0
    ) {
      throw new Error("Calculated production cost is invalid");
    }

    for (const line of linesResult.rows) {
      const lineQuantity = Number(line.quantity);
      const lineTotalCost = unitCost * lineQuantity;

      await client.query(
        `UPDATE production_output_lines
         SET unit_cost = $1,
             total_cost = $2
         WHERE id = $3
           AND production_output_id = $4`,
        [unitCost, lineTotalCost, line.id, outputId]
      );
    }

    return {
      outputId: Number(outputId),
      outputQuantity,
      materialCost: Number(materialCost.toFixed(2)),
      approvedAllocatedCost: Number(
        approvedAllocatedCost.toFixed(2)
      ),
      totalCost: Number(totalCost.toFixed(2)),
      unitCost: Number(unitCost.toFixed(6)),
      status: "DRAFT",
    };
  });
}
module.exports = {
  createDraftProductionOutput,
  addProductionOutputLine,
  postProductionOutput,
 calculateProductionOutputCost,
};
