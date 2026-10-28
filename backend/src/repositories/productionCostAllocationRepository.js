
const { withTransaction } = require("../utils/transaction");

const VALID_COST_TYPES = [
  "MATERIAL",
  "LABOR",
  "OVERHEAD",
  "SUBCONTRACTING",
  "OTHER",
  "VARIANCE",
];

async function createAllocation({
  companyId,
  productionCostEntryId,
  productionOutputId,
  allocatedAmount,
  notes,
  createdBy,
}) {
  return withTransaction(async (client) => {
    const amount = Number(allocatedAmount);
    const costEntryId = Number(productionCostEntryId);

    if (!Number.isSafeInteger(costEntryId) || costEntryId <= 0) {
      throw new Error("Valid production cost entry ID is required");
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Allocated amount must be greater than zero");
    }

    const entryResult = await client.query(
      `SELECT pce.id, pce.production_order_id, pce.cost_type,
              pce.amount, pce.approval_status, po.company_id,
              po.status AS order_status
       FROM production_cost_entries pce
       JOIN production_orders po ON po.id = pce.production_order_id
       WHERE pce.id = $1 AND po.company_id = $2
       FOR UPDATE OF pce`,
      [costEntryId, companyId]
    );

    if (!entryResult.rowCount) {
      throw new Error("Production cost entry is not available");
    }

    const entry = entryResult.rows[0];

    if (entry.approval_status !== "APPROVED") {
      throw new Error("Only approved production costs can be allocated");
    }

    if (!["RELEASED", "IN_PROGRESS"].includes(entry.order_status)) {
      throw new Error("Costs can only be allocated to active production orders");
    }

    const costType = String(entry.cost_type).toUpperCase();

    if (!VALID_COST_TYPES.includes(costType)) {
      throw new Error("Unsupported production cost type");
    }

    let outputId = null;

    if (
      productionOutputId !== undefined &&
      productionOutputId !== null &&
      productionOutputId !== ""
    ) {
      outputId = Number(productionOutputId);

      if (!Number.isSafeInteger(outputId) || outputId <= 0) {
        throw new Error("Valid production output ID is required");
      }

      const outputResult = await client.query(
        `SELECT id
         FROM production_outputs
         WHERE id = $1
           AND company_id = $2
           AND production_order_id = $3
           AND status = 'DRAFT'
         FOR UPDATE`,
        [outputId, companyId, entry.production_order_id]
      );

      if (!outputResult.rowCount) {
        throw new Error("A matching draft production output was not found");
      }
    }

    const allocatedResult = await client.query(
      `SELECT COALESCE(SUM(allocated_amount), 0) AS total
       FROM production_cost_allocations
       WHERE production_cost_entry_id = $1
         AND approval_status IN ('PENDING', 'APPROVED')`,
      [costEntryId]
    );

    const alreadyAllocated = Number(allocatedResult.rows[0].total);
    const sourceAmount = Number(entry.amount);

    if (alreadyAllocated + amount > sourceAmount + 0.000001) {
      throw new Error(
        "Allocation exceeds the unallocated amount of the approved cost entry"
      );
    }

    const result = await client.query(
      `INSERT INTO production_cost_allocations (
         production_order_id,
         production_output_id,
         production_cost_entry_id,
         cost_type,
         allocated_amount,
         allocation_date,
         notes,
         approval_status,
         created_by
       )
       VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, $6, 'PENDING', $7)
       RETURNING *`,
      [
        entry.production_order_id,
        outputId,
        costEntryId,
        costType,
        amount,
        notes ? String(notes).trim() : null,
        createdBy,
      ]
    );

    return result.rows[0];
  });
}

async function approveAllocation({
  companyId,
  allocationId,
  approverId,
  approvalNotes = null,
}) {
  return withTransaction(async (client) => {
    const result = await client.query(
      `SELECT a.id, a.approval_status,
              a.production_cost_entry_id,
              a.created_by AS allocation_created_by,
              pce.created_by AS cost_created_by
       FROM production_cost_allocations a
       JOIN production_orders po ON po.id = a.production_order_id
       JOIN production_cost_entries pce
         ON pce.id = a.production_cost_entry_id
       WHERE a.id = $1 AND po.company_id = $2
       FOR UPDATE OF a`,
      [allocationId, companyId]
    );

    if (!result.rowCount) {
      throw new Error("Production cost allocation is not available");
    }

    const allocation = result.rows[0];

    if (allocation.approval_status !== "PENDING") {
      throw new Error("Only pending cost allocations can be approved");
    }

    if (
      (allocation.allocation_created_by != null &&
        String(allocation.allocation_created_by) === String(approverId)) ||
      (allocation.cost_created_by != null &&
        String(allocation.cost_created_by) === String(approverId))
    ) {
      throw new Error("You cannot approve your own allocation or cost entry");
    }

    const updated = await client.query(
      `UPDATE production_cost_allocations
       SET approval_status = 'APPROVED',
           approved_by = $1,
           approved_at = NOW(),
           approval_notes = $2
       WHERE id = $3 AND approval_status = 'PENDING'
       RETURNING *`,
      [
        approverId,
        approvalNotes ? String(approvalNotes).trim() : null,
        allocationId,
      ]
    );

    if (!updated.rowCount) {
      throw new Error("Cost allocation approval failed");
    }

    return updated.rows[0];
  });
}

module.exports = {
  createAllocation,
  approveAllocation,
};
