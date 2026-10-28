
const { withTransaction } = require("../utils/transaction");

const VALID_COST_TYPES = [
  "MATERIAL",
  "LABOR",
  "OVERHEAD",
  "SUBCONTRACTING",
  "OTHER",
];

async function createCostEntry({
  companyId,
  productionOrderId,
  costType,
  description,
  amount,
  sourceDocumentType = null,
  sourceDocumentId = null,
 createdBy,
}) {
  return withTransaction(async (client) => {
    // Lock and verify the order belongs to this company.
    const orderResult = await client.query(
      `SELECT id, status
       FROM production_orders
       WHERE id = $1
         AND company_id = $2
       FOR UPDATE`,
      [productionOrderId, companyId]
    );

    if (!orderResult.rowCount) {
      throw new Error("Production order is not available");
    }

    if (
      !["RELEASED", "IN_PROGRESS"].includes(
        orderResult.rows[0].status
      )
    ) {
      throw new Error(
        "Production cost can only be added to a released or in-progress order"
      );
    }

    const normalizedType = String(costType || "").toUpperCase();
    const normalizedAmount = Number(amount);

    if (!VALID_COST_TYPES.includes(normalizedType)) {
      throw new Error("Invalid production cost type");
    }

    if (
      !Number.isFinite(normalizedAmount) ||
      normalizedAmount <= 0
    ) {
      throw new Error("Production cost amount must be greater than zero");
    }

    if (!description || !String(description).trim()) {
      throw new Error("Production cost description is required");
    }

    const result = await client.query(
  `INSERT INTO production_cost_entries (
     production_order_id,
     cost_type,
     description,
     amount,
     source_document_type,
     source_document_id,
     approval_status,
     created_by
   )
   VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', $7)
   RETURNING *`,
  [
    productionOrderId,
    normalizedType,
    String(description).trim(),
    normalizedAmount,
    sourceDocumentType,
    sourceDocumentId,
    createdBy,
  ]
);

    return result.rows[0];
  });
}

async function approveCostEntry({
  companyId,
  costEntryId,
  approverId,
  approvalNotes = null,
}) {
  return withTransaction(async (client) => {
    const result = await client.query(
      `SELECT
         pce.id,
         pce.approval_status,
         pce.created_by,
         po.company_id
       FROM production_cost_entries pce
       JOIN production_orders po
         ON po.id = pce.production_order_id
       WHERE pce.id = $1
         AND po.company_id = $2
       FOR UPDATE OF pce`,
      [costEntryId, companyId]
    );

    if (!result.rowCount) {
      throw new Error("Production cost entry is not available");
    }

    const entry = result.rows[0];

    if (entry.approval_status !== "PENDING") {
      throw new Error("Only pending production costs can be approved");
    }

    if (
      entry.created_by != null &&
      String(entry.created_by) === String(approverId)
    ) {
      throw new Error("You cannot approve your own production cost");
    }

    const updated = await client.query(
      `UPDATE production_cost_entries
       SET approval_status = 'APPROVED',
           approved_by = $1,
           approved_at = NOW(),
           approval_notes = $2
       WHERE id = $3
         AND approval_status = 'PENDING'
       RETURNING *`,
      [
        approverId,
        approvalNotes ? String(approvalNotes).trim() : null,
        costEntryId,
      ]
    );

    if (!updated.rowCount) {
      throw new Error("Production cost approval failed");
    }

    return updated.rows[0];
  });
}

module.exports = {
  createCostEntry,
  approveCostEntry,
};