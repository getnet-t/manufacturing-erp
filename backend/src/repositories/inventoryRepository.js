
async function getProductForReceipt(client, companyId, productId) {
  const result = await client.query(
    `SELECT id, company_id, sku, name, product_type,
            base_uom_id, is_purchased, track_batch,
            track_expiry, status
     FROM products
     WHERE id = $1 AND company_id = $2
     FOR UPDATE`,
    [productId, companyId]
  );
  return result.rows[0] || null;
}


async function getWarehouseForReceipt(client, companyId, warehouseId) {
  const result = await client.query(
    `
      SELECT
        w.id,
        w.factory_id,
        w.code,
        w.name,
        w.warehouse_type,
        w.status
      FROM warehouses w
      INNER JOIN factories f
        ON f.id = w.factory_id
      WHERE w.id = $1
        AND f.company_id = $2
        AND w.status = 'ACTIVE'
        AND f.status = 'ACTIVE'
      FOR UPDATE OF w
    `,
    [warehouseId, companyId]
  );

  if (result.rows.length === 0) {
    throw new Error(
      "Warehouse not found, inactive, or does not belong to this company"
    );
  }

  return result.rows[0];
}


async function createInventoryTransaction(client, {
  companyId,
  documentNo,
  transactionDate,
}) {
  const result = await client.query(
    `INSERT INTO inventory_transactions (
       company_id, document_no, transaction_type,
       status, transaction_date
     )
     VALUES ($1, $2, 'PURCHASE_RECEIPT', 'DRAFT', $3)
     RETURNING id, company_id, document_no,
               transaction_type, status, transaction_date`,
    [companyId, documentNo, transactionDate]
  );
  return result.rows[0];
}

async function createInventoryMovementLine(client, {
  transactionId,
  productId,
  warehouseId,
  locationId = null,
  quantity,
  unitCost,
}) {
  const result = await client.query(
    `INSERT INTO inventory_movement_lines (
       inventory_transaction_id, product_id, warehouse_id,
       location_id, quantity_delta, unit_cost,
       value_delta, movement_direction
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'IN')
     RETURNING id, inventory_transaction_id, product_id,
               warehouse_id, quantity_delta, unit_cost, value_delta`,
    [
      transactionId,
      productId,
      warehouseId,
      locationId,
      quantity,
      unitCost,
      quantity * unitCost,
    ]
  );
  return result.rows[0];
}

async function getDraftReceiptForPosting(client, companyId, transactionId) {
  const result = await client.query(
    `SELECT id, company_id, document_no, transaction_type, status
     FROM inventory_transactions
     WHERE id = $1
       AND company_id = $2
       AND transaction_type = 'PURCHASE_RECEIPT'
     FOR UPDATE`,
    [transactionId, companyId]
  );

  return result.rows[0] || null;
}

async function getReceiptLinesForPosting(client, transactionId) {
  const result = await client.query(
    `SELECT
       ml.id AS movement_line_id,
       ml.product_id,
       ml.warehouse_id,
       ml.location_id,
       ml.quantity_delta,
       ml.unit_cost,
       d.batch_no,
       d.supplier_batch_no,
       d.manufactured_at,
       d.expires_at
     FROM inventory_movement_lines ml
     LEFT JOIN inventory_receipt_line_details d
       ON d.movement_line_id = ml.id
     WHERE ml.inventory_transaction_id = $1
     ORDER BY ml.id
     FOR UPDATE OF ml`,
    [transactionId]
  );

  return result.rows;
}



async function createProductionIssueTransaction(client, {
  companyId,
  documentNo,
  transactionDate,
  productionOrderId = null,
}) {
  const result = await client.query(
    `INSERT INTO inventory_transactions (
       company_id,
       document_no,
       transaction_type,
       status,
       transaction_date,
       source_document_type,
       source_document_id
     )
     VALUES (
       $1, $2, 'PRODUCTION_ISSUE', 'DRAFT', $3,
       CASE WHEN $4::bigint IS NULL
         THEN NULL
         ELSE 'PRODUCTION_ORDER'
       END,
       $4
     )
     RETURNING id, company_id, document_no,
               transaction_type, status, transaction_date,
               source_document_type, source_document_id`,
    [companyId, documentNo, transactionDate, productionOrderId]
  );

  return result.rows[0];
}



async function getDraftProductionIssueForPosting(
  client,
  companyId,
  transactionId
) {
  const result = await client.query(
    `SELECT
       id,
       company_id,
       document_no,
       transaction_type,
       status,
       source_document_type,
  source_document_id
     FROM inventory_transactions
     WHERE id = $1
       AND company_id = $2
       AND transaction_type = 'PRODUCTION_ISSUE'
     FOR UPDATE`,
    [transactionId, companyId]
  );

  return result.rows[0] || null;
}

async function createProductionIssueMovementLine(client, {
  transactionId,
  productId,
  warehouseId,
  locationId = null,
  quantity,
  unitCost,
}) {
  const issueQuantity = Math.abs(Number(quantity));
  const cost = Number(unitCost);

  if (!Number.isFinite(issueQuantity) || issueQuantity <= 0) {
    throw new Error("Issue quantity must be greater than zero");
  }

  if (!Number.isFinite(cost) || cost < 0) {
    throw new Error("Unit cost must be zero or greater");
  }

  const result = await client.query(
    `INSERT INTO inventory_movement_lines (
       inventory_transaction_id,
       product_id,
       warehouse_id,
       location_id,
       quantity_delta,
       unit_cost,
       value_delta,
       movement_direction
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'OUT')
     RETURNING id, inventory_transaction_id, product_id,
               warehouse_id, quantity_delta, unit_cost,
               value_delta, movement_direction`,
    [
      transactionId,
      productId,
      warehouseId,
      locationId,
      -issueQuantity,
      cost,
      issueQuantity * cost,
    ]
  );

  return result.rows[0];
}

async function getProductionIssueLinesForPosting(client, transactionId) {
  const result = await client.query(
    `SELECT
       ml.id AS movement_line_id,
       ml.product_id,
       ml.warehouse_id,
       ml.location_id,
       ml.quantity_delta,
       ml.unit_cost,
       ml.value_delta,
       ml.movement_direction
     FROM inventory_movement_lines ml
     WHERE ml.inventory_transaction_id = $1
     ORDER BY ml.id
     FOR UPDATE OF ml`,
    [transactionId]
  );

  return result.rows;
}


async function getAvailableStockForIssue(
  client,
  companyId,
  productId,
  warehouseId
) {
  const result = await client.query(
    `SELECT
       ib.on_hand_qty,
       ib.reserved_qty,
       (ib.on_hand_qty - ib.reserved_qty) AS available_qty
     FROM inventory_balances ib
     WHERE ib.company_id = $1
       AND ib.product_id = $2
       AND ib.warehouse_id = $3
     FOR UPDATE`,
    [companyId, productId, warehouseId]
  );

  return result.rows[0] || null;
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
     ORDER BY
  b.expires_at ASC NULLS LAST,
  b.id ASC`,
    [companyId, productId, warehouseId]
  );

  return result.rows;
}


async function getProductionOrderAllocationsForIssue(
  client,
  { companyId, productionOrderId, productId, warehouseId }
) {
  const result = await client.query(
    `SELECT
       poa.id AS allocation_id,
       poa.production_order_id,
       poa.component_product_id,
       poa.warehouse_id,
       poa.batch_id,
       poa.required_quantity,
       poa.reserved_quantity,
       poa.issued_quantity,
       GREATEST(
         poa.reserved_quantity - poa.issued_quantity,
         0
       ) AS remaining_reserved_quantity
     FROM production_order_allocations poa
     JOIN production_orders po
       ON po.id = poa.production_order_id
      AND po.company_id = $1
     WHERE poa.production_order_id = $2
       AND poa.component_product_id = $3
       AND poa.warehouse_id = $4
       AND po.status IN ('RELEASED', 'IN_PROGRESS')
       AND poa.reserved_quantity > poa.issued_quantity
     ORDER BY poa.batch_id NULLS LAST, poa.id
     FOR UPDATE OF poa`,
    [companyId, productionOrderId, productId, warehouseId]
  );

  return result.rows;
}

async function updateProductionOrderAllocationIssued(
  client,
  { allocationId, quantity }
) {
  const result = await client.query(
    `UPDATE production_order_allocations
     SET issued_quantity = issued_quantity + $1
     WHERE id = $2
       AND issued_quantity + $1 <= reserved_quantity
     RETURNING
       id,
       production_order_id,
       component_product_id,
       warehouse_id,
       batch_id,
       reserved_quantity,
       issued_quantity`,
    [quantity, allocationId]
  );

  if (!result.rows.length) {
    throw new Error(
      "Issue quantity exceeds the remaining production order allocation"
    );
  }

  return result.rows[0];
}

async function getProductionOrderForIssue(
  client,
  { companyId, productionOrderId }
) {
  const result = await client.query(
    `SELECT
       id,
       company_id,
       production_order_number,
       status,
       warehouse_id,
       product_id
     FROM production_orders
     WHERE id = $1
       AND company_id = $2
     FOR UPDATE`,
    [productionOrderId, companyId]
  );

  return result.rows[0] || null;
}

async function getBatchAvailableQuantity(
  client,
  companyId,
  productId,
  batchId
) {
  const result = await client.query(
    `SELECT
       b.id AS batch_id,
       b.batch_no,
       b.status,
       COALESCE(
         SUM(
           CASE
             WHEN ml.movement_direction = 'IN'
               THEN bm.quantity
             WHEN ml.movement_direction = 'OUT'
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
     LEFT JOIN inventory_transactions it
       ON it.id = ml.inventory_transaction_id
      AND it.status = 'POSTED'
     WHERE b.company_id = $1
       AND b.product_id = $2
       AND b.id = $3
     GROUP BY b.id, b.batch_no, b.status`,
    [companyId, productId, batchId]
  );

  return result.rows[0] || null;
}

async function updateProductionIssueMovementLine(
  client,
  { movementLineId, unitCost, valueDelta }
) {
  const result = await client.query(
    `UPDATE inventory_movement_lines
     SET unit_cost = $1,
         value_delta = $2
     WHERE id = $3
       AND movement_direction = 'OUT'
     RETURNING *`,
    [unitCost, valueDelta, movementLineId]
  );

  if (!result.rows.length) {
    throw new Error("Production issue movement line not found");
  }

  return result.rows[0];
}

async function updateInventoryBalanceForIssue(
  client,
  {
    companyId,
    productId,
    warehouseId,
    quantity,
    consumeReserved = false,
  }
) {
  const result = await client.query(
    `UPDATE inventory_balances
     SET on_hand_qty = on_hand_qty - $1,
         reserved_qty = CASE
           WHEN $5 THEN reserved_qty - $1
           ELSE reserved_qty
         END,
         updated_at = NOW()
     WHERE company_id = $2
       AND product_id = $3
       AND warehouse_id = $4
       AND on_hand_qty >= $1
       AND (
         ($5 AND reserved_qty >= $1)
         OR
         (NOT $5 AND on_hand_qty - reserved_qty >= $1)
       )
     RETURNING *`,
    [
      quantity,
      companyId,
      productId,
      warehouseId,
      consumeReserved,
    ]
  );

  if (!result.rows.length) {
    throw new Error(
      consumeReserved
        ? "Insufficient reserved stock to complete production issue"
        : "Insufficient available stock to complete production issue"
    );
  }

  return result.rows[0];
}

async function updateInventoryValuationForIssue(
  client,
  { companyId, productId, quantity, issueValue }
) {
  const result = await client.query(
    `UPDATE inventory_valuation_balances
     SET on_hand_qty = on_hand_qty - $1,
         inventory_value = inventory_value - $2,
         average_cost = CASE
           WHEN on_hand_qty - $1 = 0 THEN 0
           ELSE (inventory_value - $2) / (on_hand_qty - $1)
         END,
         updated_at = NOW()
     WHERE company_id = $3
       AND product_id = $4
       AND on_hand_qty >= $1
       AND inventory_value >= $2
     RETURNING *`,
    [quantity, issueValue, companyId, productId]
  );

  if (!result.rows.length) {
    throw new Error(
      "Insufficient inventory valuation balance to complete production issue"
    );
  }

  return result.rows[0];
}
async function markProductionIssueAsPosted(
  client,
  { transactionId, userId }
) {
  const result = await client.query(
    `UPDATE inventory_transactions
     SET status = 'POSTED',
         posted_by = $1,
         posted_at = NOW()
     WHERE id = $2
       AND transaction_type = 'PRODUCTION_ISSUE'
       AND status = 'DRAFT'
     RETURNING *`,
    [userId, transactionId]
  );

  if (!result.rows.length) {
    throw new Error(
      "Production issue not found or is not in draft status"
    );
  }

  return result.rows[0];
}
async function createProductionIssueBatchMovement(
  client,
  { movementLineId, batchId, quantity }
) {
  const issueQuantity = Number(quantity);

  if (!Number.isFinite(issueQuantity) || issueQuantity <= 0) {
    throw new Error("Batch issue quantity must be greater than zero");
  }

  const result = await client.query(
    `INSERT INTO inventory_batch_movements (
       movement_line_id,
       batch_id,
       quantity
     )
     VALUES ($1, $2, $3)
     RETURNING *`,
    [movementLineId, batchId, issueQuantity]
  );

  return result.rows[0];
}

async function getProductionIssueForReversal(
  client,
  { companyId, transactionId }
) {
  const result = await client.query(
    `SELECT
       id,
       company_id,
       document_no,
       transaction_type,
       status,
       source_document_type,
       source_document_id,
       transaction_date
     FROM inventory_transactions
     WHERE id = $1
       AND company_id = $2
     FOR UPDATE`,
    [transactionId, companyId]
  );

  return result.rows[0] || null;
}

async function getProductionIssueLinesForReversal(
  client,
  { transactionId }
) {
  const result = await client.query(
    `SELECT
       ml.id AS movement_line_id,
       ml.product_id,
       ml.warehouse_id,
       ml.location_id,
       ml.quantity_delta,
       ml.unit_cost,
       ml.value_delta,
       ml.movement_direction,
       COALESCE(
         (
           SELECT json_agg(
             json_build_object(
               'batch_id', bm.batch_id,
               'quantity', bm.quantity
             )
             ORDER BY bm.batch_id
           )
           FROM inventory_batch_movements bm
           WHERE bm.movement_line_id = ml.id
         ),
         '[]'::json
       ) AS batches
     FROM inventory_movement_lines ml
     WHERE ml.inventory_transaction_id = $1
     ORDER BY ml.id
     FOR UPDATE OF ml`,
    [transactionId]
  );

  return result.rows;
}


async function createProductionIssueReversalTransaction(
  client,
  {
    companyId,
    documentNo,
    transactionDate,
    userId,
    originalTransactionId,
  }
) {
  const result = await client.query(
    `INSERT INTO inventory_transactions (
       company_id,
       document_no,
       transaction_type,
       status,
       source_document_type,
       source_document_id,
       transaction_date,
       posted_at,
       posted_by,
       idempotency_key,
       reversal_of_transaction_id
     )
     VALUES (
       $1, $2, 'STOCK_ADJUSTMENT', 'POSTED',
       'PRODUCTION_ISSUE_REVERSAL', $3, $4,
       NOW(), $5, $6, $3
     )
     RETURNING *`,
    [
      companyId,
      documentNo,
      originalTransactionId,
      transactionDate,
      userId,
      `PRODUCTION_ISSUE_REVERSAL:${originalTransactionId}`,
    ]
  );

  return result.rows[0];
}

async function createProductionIssueReversalMovementLine(
  client,
  {
    transactionId,
    productId,
    warehouseId,
    locationId = null,
    quantity,
    unitCost,
    value,
  }
) {
  const qty = Number(quantity);
  const cost = Number(unitCost);
  const lineValue = Number(value);

  if (!Number.isFinite(qty) || qty <= 0) {
    throw new Error("Reversal quantity must be greater than zero");
  }

  if (!Number.isFinite(cost) || cost < 0) {
    throw new Error("Reversal unit cost cannot be negative");
  }

  if (!Number.isFinite(lineValue) || lineValue < 0) {
    throw new Error("Reversal value cannot be negative");
  }

  const result = await client.query(
    `INSERT INTO inventory_movement_lines (
       inventory_transaction_id,
       product_id,
       warehouse_id,
       location_id,
       quantity_delta,
       unit_cost,
       value_delta,
       movement_direction
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'IN')
     RETURNING *`,
    [
      transactionId,
      productId,
      warehouseId,
      locationId,
      qty,
      cost,
      lineValue,
    ]
  );

  return result.rows[0];
}


async function restoreInventoryBalanceForProductionIssueReversal(
  client,
  { companyId, productId, warehouseId, quantity }
) {
  const result = await client.query(
    `UPDATE inventory_balances
     SET on_hand_qty = on_hand_qty + $1,
         reserved_qty = reserved_qty + $1,
         updated_at = NOW()
     WHERE company_id = $2
       AND product_id = $3
       AND warehouse_id = $4
       AND reserved_qty + $1 <= on_hand_qty + $1
     RETURNING *`,
    [quantity, companyId, productId, warehouseId]
  );

  if (!result.rows.length) {
    throw new Error(
      "Inventory balance not found or invalid when restoring reversed issue"
    );
  }

  return result.rows[0];
}

async function restoreInventoryValuationForProductionIssueReversal(
  client,
  { companyId, productId, quantity, value }
) {
  const result = await client.query(
    `UPDATE inventory_valuation_balances
     SET on_hand_qty = on_hand_qty + $1,
         inventory_value = inventory_value + $2,
         average_cost = CASE
           WHEN on_hand_qty + $1 = 0 THEN 0
           ELSE (inventory_value + $2) / (on_hand_qty + $1)
         END,
         updated_at = NOW()
     WHERE company_id = $3
       AND product_id = $4
     RETURNING *`,
    [quantity, value, companyId, productId]
  );

  if (!result.rows.length) {
    throw new Error(
      "Inventory valuation balance not found when restoring reversed issue"
    );
  }

  return result.rows[0];
}


async function getProductionIssueAllocationForReversal(
  client,
  {
    companyId,
    productionOrderId,
    productId,
    warehouseId,
    batchId,
  }
) {
  const result = await client.query(
    `SELECT
       poa.id AS allocation_id,
       poa.production_order_id,
       poa.component_product_id,
       poa.warehouse_id,
       poa.batch_id,
       poa.reserved_quantity,
       poa.issued_quantity
     FROM production_order_allocations poa
     JOIN production_orders po
       ON po.id = poa.production_order_id
      AND po.company_id = $1
     WHERE poa.production_order_id = $2
       AND poa.component_product_id = $3
       AND poa.warehouse_id = $4
       AND poa.batch_id IS NOT DISTINCT FROM $5
     FOR UPDATE OF poa`,
    [companyId, productionOrderId, productId, warehouseId, batchId]
  );

  if (result.rows.length !== 1) {
    throw new Error(
      "Expected exactly one production allocation for the original issue batch"
    );
  }

  return result.rows[0];
}

async function reduceProductionOrderAllocationIssuedForReversal(
  client,
  { allocationId, quantity }
) {
  const result = await client.query(
    `UPDATE production_order_allocations
     SET issued_quantity = issued_quantity - $1
     WHERE id = $2
       AND issued_quantity >= $1
     RETURNING *`,
    [quantity, allocationId]
  );

  if (!result.rows.length) {
    throw new Error(
      "Cannot reverse issue: allocation issued quantity is insufficient"
    );
  }

  return result.rows[0];
}

module.exports = {
  getProductForReceipt,
  getWarehouseForReceipt,
  createInventoryTransaction,
  createInventoryMovementLine,
  getDraftReceiptForPosting,
  getReceiptLinesForPosting,
  createProductionIssueTransaction,
  getDraftProductionIssueForPosting,
  createProductionIssueMovementLine,
  getProductionIssueLinesForPosting,
  getAvailableStockForIssue,
  getAvailableBatchesForIssue,
  getBatchAvailableQuantity,
  updateProductionIssueMovementLine,
  updateInventoryBalanceForIssue,
  updateInventoryValuationForIssue,
  markProductionIssueAsPosted,
  createProductionIssueBatchMovement,
  getProductionOrderAllocationsForIssue,
    updateProductionOrderAllocationIssued,
  getProductionOrderForIssue,
  getProductionIssueForReversal,
  getProductionIssueLinesForReversal,
  createProductionIssueReversalTransaction,
  createProductionIssueReversalMovementLine,
  restoreInventoryBalanceForProductionIssueReversal,
  restoreInventoryValuationForProductionIssueReversal,
    getProductionIssueAllocationForReversal,
  reduceProductionOrderAllocationIssuedForReversal,
  };
