
const { withTransaction } = require("../utils/transaction");

const inventoryRepository = require("../repositories/inventoryRepository");

async function testInventoryTransaction() {
  return withTransaction(async (client) => {
    const result = await client.query(
      "SELECT current_database() AS database_name, NOW() AS server_time"
    );
    return result.rows[0];
  });
}

async function createPurchaseReceipt({
  companyId,
  userId,
  documentNo,
  transactionDate,
  productId,
  warehouseId,
  locationId = null,
  quantity,
  unitCost,
  batchNo = null,
  supplierBatchNo = null,
  manufacturedAt = null,
  expiresAt = null,
}) {
  const qty = Number(quantity);
  const cost = Number(unitCost);

  if (!companyId || !userId || !documentNo ||
      !productId || !warehouseId) {
    throw new Error("Required receipt fields are missing");
  }

  if (!Number.isFinite(qty) || qty <= 0) {
    throw new Error("Quantity must be greater than zero");
  }

  if (!Number.isFinite(cost) || cost < 0) {
    throw new Error("Unit cost cannot be negative");
  }

  if (batchNo !== null &&
      (typeof batchNo !== "string" || !batchNo.trim())) {
    throw new Error("Batch number must be a non-empty string");
  }

  return withTransaction(async (client) => {
    const product = await inventoryRepository.getProductForReceipt(
      client, companyId, productId
    );

    if (!product || product.status !== "ACTIVE") {
      throw new Error("Active product not found in this company");
    }

    if (!product.is_purchased) {
      throw new Error("This product is not configured for purchasing");
    }

    if (product.track_batch && !batchNo) {
      throw new Error("A batch number is required for this product");
    }

    if (product.track_expiry && !expiresAt) {
      throw new Error("An expiry date is required for this product");
    }

    const warehouse = await inventoryRepository.getWarehouseForReceipt(
      client, companyId, warehouseId
    );

    if (!warehouse) {
      throw new Error("Active warehouse not found in this company");
    }

    if (
      locationId !== null &&
      locationId !== undefined
    ) {
      const locationResult = await client.query(
        `SELECT id
         FROM warehouse_locations
         WHERE id = $1 AND warehouse_id = $2
           AND status = 'ACTIVE'
         FOR UPDATE`,
        [locationId, warehouseId]
      );

      if (!locationResult.rows.length) {
        throw new Error("Active location not found in this warehouse");
      }
    }



if (product.track_batch && !batchNo) {
  throw new Error("A batch number is required for this product");
}

if (product.track_expiry && !expiresAt) {
  throw new Error("An expiry date is required for this product");
}

    const transaction =
      await inventoryRepository.createInventoryTransaction(client, {
        companyId,
        documentNo: documentNo.trim(),
        transactionDate: transactionDate || new Date().toISOString().slice(0, 10),
      });

    const movement =
      await inventoryRepository.createInventoryMovementLine(client, {
        transactionId: transaction.id,
        productId,
        warehouseId,
        locationId,
        quantity: qty,
        unitCost: cost,
      });

await client.query(
  `INSERT INTO inventory_receipt_line_details (
     movement_line_id,
     batch_no,
     supplier_batch_no,
     manufactured_at,
     expires_at
   )
   VALUES ($1, $2, $3, $4, $5)`,
  [
    movement.id,
    batchNo ? batchNo.trim() : null,
    supplierBatchNo || null,
    manufacturedAt || null,
    expiresAt || null,
  ]
);
    return {
      transaction,
      movement,

    };
  });
}

async function postPurchaseReceipt({ companyId, userId, transactionId }) {
  if (!companyId || !userId || !transactionId) {
    throw new Error("Required posting fields are missing");
  }

  return withTransaction(async (client) => {
    // 1. Lock and validate the receipt.
    const receipt =
      await inventoryRepository.getDraftReceiptForPosting(
        client,
        companyId,
        transactionId
      );

    if (!receipt) {
      throw new Error("Purchase receipt not found");
    }
    if (receipt.status !== "DRAFT") {
      throw new Error("Only draft receipts can be posted");
    }

    // 2. Lock and load its lines.
    const lines =
      await inventoryRepository.getReceiptLinesForPosting(
        client,
        transactionId
      );

    if (!lines.length) {
      throw new Error("Cannot post a receipt without lines");
    }

    for (const line of lines) {
      const qty = Number(line.quantity_delta);
      const cost = Number(line.unit_cost);

      if (!Number.isFinite(qty) || qty <= 0 ||
          !Number.isFinite(cost) || cost < 0) {
        throw new Error("Receipt line has invalid quantity or cost");
      }

      // 3. Validate the product and warehouse again at posting time.
      const productResult = await client.query(
        `SELECT id, is_purchased, track_batch, track_expiry, status
         FROM products
         WHERE id = $1 AND company_id = $2
         FOR UPDATE`,
        [line.product_id, companyId]
      );

      const product = productResult.rows[0];

      if (!product || product.status !== "ACTIVE") {
        throw new Error("Active product not found in this company");
      }

      if (!product.is_purchased) {
        throw new Error("This product is not configured for purchasing");
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
  [line.warehouse_id, companyId]
);



      if (!warehouseResult.rows.length) {
        throw new Error("Active warehouse not found in this company");
      }

      // 4. Create or reuse the batch only when posting.
      if (product.track_batch) {
        if (!line.batch_no || !line.batch_no.trim()) {
          throw new Error("A batch number is required for this product");
        }

        if (product.track_expiry && !line.expires_at) {
          throw new Error("An expiry date is required for this product");
        }

        const batchResult = await client.query(
          `INSERT INTO inventory_batches (
             company_id, product_id, batch_no,
             supplier_batch_no, manufactured_at, expires_at, status
           )
           VALUES ($1, $2, $3, $4, $5, $6, 'AVAILABLE')
           ON CONFLICT (company_id, product_id, batch_no)
           DO UPDATE SET
             supplier_batch_no = COALESCE(
               EXCLUDED.supplier_batch_no,
               inventory_batches.supplier_batch_no
             ),
             manufactured_at = COALESCE(
               EXCLUDED.manufactured_at,
               inventory_batches.manufactured_at
             ),
             expires_at = COALESCE(
               EXCLUDED.expires_at,
               inventory_batches.expires_at
             ),
             updated_at = CURRENT_TIMESTAMP
           WHERE inventory_batches.status = 'AVAILABLE'
           RETURNING id`,
          [
            companyId,
            line.product_id,
            line.batch_no.trim(),
            line.supplier_batch_no,
            line.manufactured_at,
            line.expires_at,
          ]
        );

        if (!batchResult.rows.length) {
          throw new Error("Batch exists but is not available for receipt");
        }

        await client.query(
          `INSERT INTO inventory_batch_movements (
             movement_line_id, batch_id, quantity
           )
           VALUES ($1, $2, $3)`,
          [line.movement_line_id, batchResult.rows[0].id, qty]
        );
      }

      // 5. Increase stock in the destination warehouse.
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
           updated_at = CURRENT_TIMESTAMP`,
        [companyId, line.product_id, line.warehouse_id, qty]
      );

      // 6. Update company-wide moving weighted-average valuation.
      // PostgreSQL performs the calculations using NUMERIC values.

await client.query(
  `INSERT INTO inventory_valuation_balances (
     company_id, product_id, on_hand_qty,
     inventory_value, average_cost, last_valuation_at
   )
   VALUES (
     $1, $2, $3::NUMERIC, $3::NUMERIC * $4::NUMERIC,
     $4::NUMERIC, CURRENT_TIMESTAMP
   )
   ON CONFLICT (company_id, product_id)
   DO UPDATE SET
     average_cost = CASE
       WHEN inventory_valuation_balances.on_hand_qty
              + EXCLUDED.on_hand_qty = 0
       THEN 0
       ELSE (
         inventory_valuation_balances.inventory_value
           + EXCLUDED.inventory_value
       ) / (
         inventory_valuation_balances.on_hand_qty
           + EXCLUDED.on_hand_qty
       )
     END,
     inventory_value =
       inventory_valuation_balances.inventory_value
         + EXCLUDED.inventory_value,
     on_hand_qty =
       inventory_valuation_balances.on_hand_qty
         + EXCLUDED.on_hand_qty,
     last_valuation_at = CURRENT_TIMESTAMP,
     updated_at = CURRENT_TIMESTAMP`,
  [companyId, line.product_id, qty, cost]
);

    }

    // 7. Mark the receipt posted only after all stock updates succeed.
    const postedResult = await client.query(
      `UPDATE inventory_transactions
       SET status = 'POSTED',
           posted_at = CURRENT_TIMESTAMP,
           posted_by = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
         AND company_id = $2
         AND status = 'DRAFT'
       RETURNING id, document_no, status, posted_at, posted_by`,
      [transactionId, companyId, userId]
    );

    if (!postedResult.rows.length) {
      throw new Error("Receipt could not be posted");
    }

    return {
      receipt: postedResult.rows[0],
      linesPosted: lines.length,
    };
  });
}


async function createProductionIssue({
  companyId,
  userId,
  documentNo,
  transactionDate,
  productId,
  warehouseId,
  locationId = null,
  quantity,
  productionOrderId = null,
}) {
  const qty = Number(quantity);
  const linkedToProductionOrder =
    productionOrderId !== null &&
    productionOrderId !== undefined &&
    productionOrderId !== "";

  const orderId = linkedToProductionOrder
    ? Number(productionOrderId)
    : null;

  if (
    !companyId ||
    !userId ||
    !documentNo ||
    !String(documentNo).trim() ||
    !productId ||
    !warehouseId
  ) {
    throw new Error("Required production issue fields are missing");
  }

  if (
    !Number.isFinite(qty) ||
    qty <= 0
  ) {
    throw new Error("Issue quantity must be greater than zero");
  }

  if (
    linkedToProductionOrder &&
    (!Number.isSafeInteger(orderId) || orderId <= 0)
  ) {
    throw new Error("Invalid production order ID");
  }

  return withTransaction(async (client) => {
    const product = await inventoryRepository.getProductForReceipt(
      client,
      companyId,
      productId
    );

    if (!product || product.status !== "ACTIVE") {
      throw new Error("Active product not found in this company");
    }

    if (!product.track_batch) {
      throw new Error(
        "This initial production issue workflow requires a batch-tracked product"
      );
    }

    const warehouse = await inventoryRepository.getWarehouseForReceipt(
      client,
      companyId,
      warehouseId
    );

    if (!warehouse) {
      throw new Error("Active warehouse not found in this company");
    }

    if (locationId !== null && locationId !== undefined) {
      const locationResult = await client.query(
        `SELECT id
         FROM warehouse_locations
         WHERE id = $1
           AND warehouse_id = $2
           AND status = 'ACTIVE'
         FOR UPDATE`,
        [locationId, warehouseId]
      );

      if (!locationResult.rows.length) {
        throw new Error("Active location not found in this warehouse");
      }
    }

    let allocations = [];

    if (linkedToProductionOrder) {
      const productionOrder =
        await inventoryRepository.getProductionOrderForIssue(client, {
          companyId,
          productionOrderId: orderId,
        });

      if (
        !productionOrder ||
        !["RELEASED", "IN_PROGRESS"].includes(productionOrder.status)
      ) {
        throw new Error(
          "Production order not found or is not released"
        );
      }

      if (
        Number(productionOrder.warehouse_id) !== Number(warehouseId)
      ) {
        throw new Error(
          "Production issue warehouse does not match production order"
        );
      }

      allocations =
        await inventoryRepository.getProductionOrderAllocationsForIssue(
          client,
          {
            companyId,
            productionOrderId: orderId,
            productId,
            warehouseId,
          }
        );

      const remainingReserved = allocations.reduce(
        (sum, allocation) =>
          sum + Number(allocation.remaining_reserved_quantity || 0),
        0
      );

      if (remainingReserved + 0.000001 < qty) {
        throw new Error(
          `Insufficient remaining production allocation for product ${productId}`
        );
      }

      if (
        allocations.some((allocation) => allocation.batch_id === null)
      ) {
        throw new Error(
          "Production order allocation has no batch for a batch-tracked product"
        );
      }
    }

    const balance = await inventoryRepository.getAvailableStockForIssue(
      client,
      companyId,
      productId,
      warehouseId
    );

    if (!balance) {
      throw new Error(
        `Insufficient available stock for product ${productId}`
      );
    }

    if (linkedToProductionOrder) {
      if (Number(balance.on_hand_qty) < qty) {
        throw new Error(
          `Insufficient physical stock for production order product ${productId}`
        );
      }
    } else if (Number(balance.available_qty) < qty) {
      throw new Error(
        "Insufficient available stock for this issue"
      );
    }

    const batches =
      await inventoryRepository.getAvailableBatchesForIssue(
        client,
        companyId,
        productId,
        warehouseId
      );

    if (linkedToProductionOrder) {
      const physicalByBatch = new Map(
        batches.map((batch) => [
          String(batch.id),
          Number(batch.available_quantity || 0),
        ])
      );

      let usableAllocatedQty = 0;

      for (const allocation of allocations) {
        const batchKey = String(allocation.batch_id);
        const physicalQty = physicalByBatch.get(batchKey) || 0;
        const reservedQty = Number(
          allocation.remaining_reserved_quantity || 0
        );
        const usableQty = Math.min(physicalQty, reservedQty);

        usableAllocatedQty += usableQty;
        physicalByBatch.set(batchKey, physicalQty - usableQty);
      }

      if (usableAllocatedQty + 0.000001 < qty) {
        throw new Error(
          `Insufficient remaining production allocation for product ${productId}`
        );
      }
    } else {
      const totalBatchQty = batches.reduce(
        (sum, batch) =>
          sum + Number(batch.available_quantity || 0),
        0
      );

      if (totalBatchQty < qty) {
        throw new Error("Insufficient available batch quantity");
      }
    }

    const transaction =
      await inventoryRepository.createProductionIssueTransaction(client, {
        companyId,
        documentNo: documentNo.trim(),
        transactionDate:
          transactionDate || new Date().toISOString().slice(0, 10),
        productionOrderId: orderId,
      });

    await inventoryRepository.createProductionIssueMovementLine(client, {
      transactionId: transaction.id,
      productId,
      warehouseId,
      locationId,
      quantity: qty,
      unitCost: 0,
    });

    return {
      transaction,
      productId,
      warehouseId,
      locationId,
      quantity: qty,
      productionOrderId: orderId,
      status: "DRAFT",
    };
  });
}


async function getAvailableBatchesForIssue(
  client,
  companyId,
  productId,
  warehouseId
) {
  const result = await client.query(
    `SELECT
       b.id,
       b.batch_no,
       b.status,
       b.manufactured_at,
       b.expires_at,
       COALESCE(
         SUM(
           CASE
             WHEN it.status = 'POSTED'
                  AND ml.movement_direction = 'IN'
               THEN bm.quantity
             WHEN it.status = 'POSTED'
                  AND ml.movement_direction = 'OUT'
               THEN -bm.quantity
             ELSE 0
           END
         ),
         0
       ) AS available_quantity
     FROM inventory_batches b
     LEFT JOIN inventory_batch_movements bm
       ON bm.batch_id = b.id
     LEFT JOIN inventory_movement_lines ml
       ON ml.id = bm.movement_line_id
      AND ml.warehouse_id = $3
     LEFT JOIN inventory_transactions it
       ON it.id = ml.inventory_transaction_id
     WHERE b.company_id = $1
       AND b.product_id = $2
       AND b.status = 'AVAILABLE'
       AND (b.expires_at IS NULL OR b.expires_at >= CURRENT_DATE)
     GROUP BY
       b.id,
       b.batch_no,
       b.status,
       b.manufactured_at,
       b.expires_at
     HAVING COALESCE(
       SUM(
         CASE
           WHEN it.status = 'POSTED'
                AND ml.movement_direction = 'IN'
             THEN bm.quantity
           WHEN it.status = 'POSTED'
                AND ml.movement_direction = 'OUT'
             THEN -bm.quantity
           ELSE 0
         END
       ),
       0
     ) > 0
     ORDER BY b.expires_at ASC NULLS LAST, b.id ASC`,
    [companyId, productId, warehouseId]
  );

  return result.rows;
}


async function postProductionIssue({ companyId, userId, transactionId }) {
  if (!companyId || !userId || !transactionId) {
    throw new Error("Company, user, and transaction IDs are required");
  }

  return withTransaction(async (client) => {
    const transaction =
      await inventoryRepository.getDraftProductionIssueForPosting(
        client,
        companyId,
        transactionId
      );

    if (!transaction || transaction.status !== "DRAFT") {
      throw new Error("Production issue not found or is not a draft");
    }

    const isProductionOrderIssue =
      transaction.source_document_type === "PRODUCTION_ORDER";

    let productionOrder = null;

    if (isProductionOrderIssue) {
      if (!transaction.source_document_id) {
        throw new Error("Production issue has no production order ID");
      }

      productionOrder =
        await inventoryRepository.getProductionOrderForIssue(client, {
          companyId,
          productionOrderId: transaction.source_document_id,
        });

      if (
        !productionOrder ||
        !["RELEASED", "IN_PROGRESS"].includes(productionOrder.status)
      ) {
        throw new Error(
          "Production order not found or is not released"
        );
      }
    } else if (transaction.source_document_id) {
      throw new Error("Unsupported production issue source document");
    }

    const lines =
      await inventoryRepository.getProductionIssueLinesForPosting(
        client,
        transactionId
      );

    if (!lines.length) {
      throw new Error("Production issue has no movement lines");
    }

    const results = [];

    for (const line of lines) {
      const quantity = Math.abs(Number(line.quantity_delta));

      if (
        line.movement_direction !== "OUT" ||
        !Number.isFinite(quantity) ||
        quantity <= 0
      ) {
        throw new Error("Invalid production issue movement line");
      }

      if (
        isProductionOrderIssue &&
        Number(line.warehouse_id) !== Number(productionOrder.warehouse_id)
      ) {
        throw new Error(
          "Production issue warehouse does not match production order"
        );
      }

      const balance =
        await inventoryRepository.getAvailableStockForIssue(
          client,
          companyId,
          line.product_id,
          line.warehouse_id
        );

      if (!balance) {
        throw new Error(
          `Insufficient available stock for product ${line.product_id}`
        );
      }

      let allocations = [];
      let batches = [];
      const batchQuantities = new Map();

      if (isProductionOrderIssue) {
        allocations =
          await inventoryRepository.getProductionOrderAllocationsForIssue(
            client,
            {
              companyId,
              productionOrderId: transaction.source_document_id,
              productId: line.product_id,
              warehouseId: line.warehouse_id,
            }
          );

        const remainingReserved = allocations.reduce(
          (sum, allocation) =>
            sum + Number(allocation.remaining_reserved_quantity || 0),
          0
        );

        if (remainingReserved + 0.000001 < quantity) {
          throw new Error(
            `Insufficient remaining production allocation for product ${line.product_id}`
          );
        }

        if (Number(balance.on_hand_qty) < quantity) {
          throw new Error(
            `Insufficient physical stock for production order product ${line.product_id}`
          );
        }

        batches =
          await inventoryRepository.getAvailableBatchesForIssue(
            client,
            companyId,
            line.product_id,
            line.warehouse_id
          );

        for (const batch of batches) {
          batchQuantities.set(
            String(batch.id),
            Number(batch.available_quantity || 0)
          );
        }

        for (const allocation of allocations) {
          if (allocation.batch_id === null) {
            throw new Error(
              "Production order allocation has no batch for a batch-tracked product"
            );
          }
        }
      } else {
        if (Number(balance.available_qty) < quantity) {
          throw new Error(
            `Insufficient available stock for product ${line.product_id}`
          );
        }

        batches =
          await inventoryRepository.getAvailableBatchesForIssue(
            client,
            companyId,
            line.product_id,
            line.warehouse_id
          );

        const totalBatchQuantity = batches.reduce(
          (sum, batch) =>
            sum + Number(batch.available_quantity || 0),
          0
        );

        if (totalBatchQuantity < quantity) {
          throw new Error(
            `Insufficient available batch quantity for product ${line.product_id}`
          );
        }
      }

      const valuationResult = await client.query(
        `SELECT on_hand_qty, inventory_value, average_cost
         FROM inventory_valuation_balances
         WHERE company_id = $1
           AND product_id = $2
         FOR UPDATE`,
        [companyId, line.product_id]
      );

      if (!valuationResult.rows.length) {
        throw new Error(
          `Inventory valuation not found for product ${line.product_id}`
        );
      }

      const valuation = valuationResult.rows[0];
      const valuationQty = Number(valuation.on_hand_qty);
      const inventoryValue = Number(valuation.inventory_value);
      const averageCost = Number(valuation.average_cost);

      if (
        valuationQty < quantity ||
        averageCost < 0 ||
        inventoryValue < 0
      ) {
        throw new Error("Insufficient inventory valuation quantity");
      }

      const issueValue = Math.min(
        inventoryValue,
        Number((quantity * averageCost).toFixed(4))
      );

      await inventoryRepository.updateProductionIssueMovementLine(client, {
        movementLineId: line.movement_line_id,
        unitCost: averageCost,
        valueDelta: issueValue,
      });

      let remaining = quantity;

      if (isProductionOrderIssue) {
        for (const allocation of allocations) {
          if (remaining <= 0.000001) break;

          const batchKey = String(allocation.batch_id);
          const physicalAvailable = batchQuantities.get(batchKey) || 0;
          const allocationRemaining = Number(
            allocation.remaining_reserved_quantity || 0
          );

          const batchQuantity = Math.min(
            remaining,
            allocationRemaining,
            physicalAvailable
          );

          if (batchQuantity <= 0) continue;

          await inventoryRepository.createProductionIssueBatchMovement(
            client,
            {
              movementLineId: line.movement_line_id,
              batchId: allocation.batch_id,
              quantity: batchQuantity,
            }
          );

          await inventoryRepository.updateProductionOrderAllocationIssued(
            client,
            {
              allocationId: allocation.allocation_id,
              quantity: batchQuantity,
            }
          );

          batchQuantities.set(
            batchKey,
            physicalAvailable - batchQuantity
          );

          remaining -= batchQuantity;
        }
      } else {
        for (const batch of batches) {
          if (remaining <= 0.000001) break;

          const available = Number(batch.available_quantity || 0);
          const batchQuantity = Math.min(remaining, available);

          if (batchQuantity <= 0) continue;

          await inventoryRepository.createProductionIssueBatchMovement(
            client,
            {
              movementLineId: line.movement_line_id,
              batchId: batch.id,
              quantity: batchQuantity,
            }
          );

          remaining -= batchQuantity;
        }
      }

      if (remaining > 0.000001) {
        throw new Error(
          isProductionOrderIssue
            ? "Unable to issue the full quantity from reserved production batches"
            : "Unable to allocate the requested quantity to batches"
        );
      }

      await inventoryRepository.updateInventoryBalanceForIssue(client, {
        companyId,
        productId: line.product_id,
        warehouseId: line.warehouse_id,
        quantity,
        consumeReserved: isProductionOrderIssue,
      });

      await inventoryRepository.updateInventoryValuationForIssue(client, {
        companyId,
        productId: line.product_id,
        quantity,
        issueValue,
      });

      results.push({
        movementLineId: line.movement_line_id,
        productId: line.product_id,
        warehouseId: line.warehouse_id,
        quantity,
        unitCost: averageCost,
        issueValue,
      });
    }

    const posted =
      await inventoryRepository.markProductionIssueAsPosted(client, {
        transactionId,
        userId,
      });

    return {
      transaction: posted,
      issuedLines: results,
    };
  });
}

async function reverseProductionIssue({ companyId, userId, transactionId }) {
  if (!companyId || !userId || !transactionId) {
    throw new Error("Company, user, and transaction IDs are required");
  }

  return withTransaction(async (client) => {
    const original =
      await inventoryRepository.getProductionIssueForReversal(client, {
        companyId,
        transactionId,
      });

    if (!original) {
      throw new Error("Production issue not found");
    }

    if (
      original.transaction_type !== "PRODUCTION_ISSUE" ||
      original.status !== "POSTED" ||
      original.source_document_type !== "PRODUCTION_ORDER" ||
      !original.source_document_id
    ) {
      throw new Error(
        "Only a posted production-order issue can be reversed"
      );
    }

    const productionOrder =
      await inventoryRepository.getProductionOrderForIssue(client, {
        companyId,
        productionOrderId: original.source_document_id,
      });

    if (!productionOrder) {
      throw new Error("Original production order was not found");
    }

    const duplicate = await client.query(
      `SELECT id
       FROM inventory_transactions
       WHERE reversal_of_transaction_id = $1
       LIMIT 1`,
      [transactionId]
    );

    if (duplicate.rows.length) {
      throw new Error("This production issue has already been reversed");
    }

    const lines =
      await inventoryRepository.getProductionIssueLinesForReversal(client, {
        transactionId,
      });

    if (!lines.length) {
      throw new Error("Production issue has no movement lines");
    }

    const preparedLines = [];

    for (const line of lines) {
      const quantity = Math.abs(Number(line.quantity_delta));
      const unitCost = Number(line.unit_cost);
      const value = Number(line.value_delta);
      const batches = Array.isArray(line.batches) ? line.batches : [];

      if (
        line.movement_direction !== "OUT" ||
        !Number.isFinite(quantity) ||
        quantity <= 0 ||
        !Number.isFinite(unitCost) ||
        unitCost < 0 ||
        !Number.isFinite(value) ||
        value < 0
      ) {
        throw new Error("Invalid original production issue movement line");
      }

      if (
        Number(line.warehouse_id) !== Number(productionOrder.warehouse_id)
      ) {
        throw new Error(
          "Original issue warehouse does not match its production order"
        );
      }

      if (!batches.length) {
        throw new Error(
          "Cannot reverse an issue line without its original batch movements"
        );
      }

      const batchTotal = batches.reduce(
        (sum, batch) => sum + Number(batch.quantity),
        0
      );

      if (
        batches.some(
          (batch) =>
            !batch.batch_id ||
            !Number.isFinite(Number(batch.quantity)) ||
            Number(batch.quantity) <= 0
        ) ||
        Math.abs(batchTotal - quantity) > 0.000001
      ) {
        throw new Error(
          "Original batch quantities do not match the issue quantity"
        );
      }

      preparedLines.push({
        line,
        quantity,
        unitCost,
        value,
        batches,
      });
    }

    const documentNo = `REV-${original.document_no}`;

    if (documentNo.length > 100) {
      throw new Error("Reversal document number exceeds 100 characters");
    }

    const reversal =
      await inventoryRepository.createProductionIssueReversalTransaction(
        client,
        {
          companyId,
          documentNo,
          transactionDate: original.transaction_date,
          userId,
          originalTransactionId: transactionId,
        }
      );

    const reversedLines = [];

    for (const item of preparedLines) {
      const { line, quantity, unitCost, value, batches } = item;

      const reversalLine =
        await inventoryRepository.createProductionIssueReversalMovementLine(
          client,
          {
            transactionId: reversal.id,
            productId: line.product_id,
            warehouseId: line.warehouse_id,
            locationId: line.location_id,
            quantity,
            unitCost,
            value,
          }
        );

      for (const batch of batches) {
        const batchId = Number(batch.batch_id);
        const batchQuantity = Number(batch.quantity);

        const allocation =
          await inventoryRepository.getProductionIssueAllocationForReversal(
            client,
            {
              companyId,
              productionOrderId: original.source_document_id,
              productId: line.product_id,
              warehouseId: line.warehouse_id,
              batchId,
            }
          );

        await inventoryRepository.reduceProductionOrderAllocationIssuedForReversal(
          client,
          {
            allocationId: allocation.allocation_id,
            quantity: batchQuantity,
          }
        );

        await inventoryRepository.createProductionIssueBatchMovement(
          client,
          {
            movementLineId: reversalLine.id,
            batchId,
            quantity: batchQuantity,
          }
        );
      }

      await inventoryRepository.restoreInventoryBalanceForProductionIssueReversal(
        client,
        {
          companyId,
          productId: line.product_id,
          warehouseId: line.warehouse_id,
          quantity,
        }
      );

      await inventoryRepository.restoreInventoryValuationForProductionIssueReversal(
        client,
        {
          companyId,
          productId: line.product_id,
          quantity,
          value,
        }
      );

      reversedLines.push({
        originalMovementLineId: line.movement_line_id,
        reversalMovementLineId: reversalLine.id,
        productId: line.product_id,
        warehouseId: line.warehouse_id,
        quantity,
        unitCost,
        value,
      });
    }

    await client.query(
      `INSERT INTO audit_logs (
         company_id,
         user_id,
         action,
         entity_type,
         entity_id,
         old_values,
         new_values
       )
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)`,
      [
        companyId,
        userId,
        "PRODUCTION_ISSUE_REVERSED",
        "inventory_transactions",
        reversal.id,
        JSON.stringify({
          original_transaction_id: original.id,
          original_document_no: original.document_no,
          original_status: original.status,
          original_transaction_type: original.transaction_type,
        }),
        JSON.stringify({
          reversal_transaction_id: reversal.id,
          reversal_document_no: reversal.document_no,
          reversal_of_transaction_id: transactionId,
          reversal_status: reversal.status,
          reversed_by: userId,
          reversed_lines: reversedLines,
        }),
      ]
    );

    return {
      originalTransactionId: transactionId,
      reversalTransaction: reversal,
      reversedLines,
    };
  });
}
module.exports = {
  testInventoryTransaction,
  createPurchaseReceipt,
  postPurchaseReceipt,
  createProductionIssue,
  getAvailableBatchesForIssue,
  postProductionIssue,
reverseProductionIssue,
};
