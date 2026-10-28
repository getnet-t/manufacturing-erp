
const pool = require("../config/database");
const { withTransaction } = require("../utils/transaction");

async function createInspection({
  companyId,
  inspectionNumber,
  inspectionType,
  productId,
  quantityInspected,
  inspectorId,
  supplierId = null,
  purchaseOrderId = null,
  goodsReceiptId = null,
  productionOrderId = null,
  productionOutputId = null,
  batchId = null,
  warehouseId = null,
  inspectionDate = null,
  notes = null,
}) {
  const result = await pool.query(
    `INSERT INTO quality_inspections (
       company_id,
       inspection_number,
       inspection_type,
       product_id,
       quantity_inspected,
       inspector_id,
       supplier_id,
       purchase_order_id,
       goods_receipt_id,
       production_order_id,
       production_output_id,
       batch_id,
       warehouse_id,
       inspection_date,
       notes
     )
     VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8,
       $9, $10, $11, $12, $13, COALESCE($14::date, CURRENT_DATE), $15
     )
     RETURNING *`,
    [
      companyId,
      inspectionNumber,
      inspectionType,
      productId,
      quantityInspected,
      inspectorId,
      supplierId,
      purchaseOrderId,
      goodsReceiptId,
      productionOrderId,
      productionOutputId,
      batchId,
      warehouseId,
      inspectionDate,
      notes,
    ]
  );

  return result.rows[0];
}

async function getInspections({ companyId, status = null }) {
  const result = await pool.query(
    `SELECT qi.*,
  p.sku,
 p.name AS product_name
     FROM quality_inspections qi
     JOIN products p ON p.id = qi.product_id
     WHERE qi.company_id = $1
       AND ($2::varchar IS NULL OR qi.status = $2)
     ORDER BY qi.created_at DESC, qi.id DESC`,
    [companyId, status]
  );

  return result.rows;
}

async function getInspectionById({ companyId, inspectionId }) {
  const result = await pool.query(
    `SELECT qi.*,
            p.sku,
            p.name AS product_name
     FROM quality_inspections qi
     JOIN products p
       ON p.id = qi.product_id
      AND p.company_id = qi.company_id
     WHERE qi.company_id = $1
       AND qi.id = $2`,
    [companyId, inspectionId]
  );

  if (!result.rows.length) {
    return null;
  }

  const inspection = result.rows[0];

  const results = await pool.query(
    `SELECT *
     FROM quality_inspection_results
     WHERE quality_inspection_id = $1
     ORDER BY id ASC`,
    [inspectionId]
  );

  inspection.results = results.rows;

  return inspection;
}

async function addInspectionResult({
  companyId,
  inspectionId,
  parameterName,
  parameterCode = null,
  specification = null,
  targetValue = null,
  actualValue = null,
  unit = null,
  resultStatus,
  measuredNumericValue = null,
  lowerLimit = null,
  upperLimit = null,
  notes = null,
}) {
  return withTransaction(async (client) => {
    const inspection = await client.query(
      `SELECT id, status
       FROM quality_inspections
       WHERE id = $1 AND company_id = $2
       FOR UPDATE`,
      [inspectionId, companyId]
    );

    if (!inspection.rowCount) {
      throw new Error("Quality inspection not found");
    }

    if (["PASSED", "FAILED", "PARTIALLY_PASSED", "CANCELLED"].includes(
      inspection.rows[0].status
    )) {
      throw new Error("Results cannot be added to a finalized inspection");
    }

    const result = await client.query(
      `INSERT INTO quality_inspection_results (
         quality_inspection_id,
         parameter_name,
         parameter_code,
         specification,
         target_value,
         actual_value,
         unit,
         result_status,
         measured_numeric_value,
         lower_limit,
         upper_limit,
         notes
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        inspectionId,
        parameterName,
        parameterCode,
        specification,
        targetValue,
        actualValue,
        unit,
        resultStatus,
        measuredNumericValue,
        lowerLimit,
        upperLimit,
        notes,
      ]
    );

    if (inspection.rows[0].status === "PENDING") {
      await client.query(
        `UPDATE quality_inspections
         SET status = 'IN_PROGRESS', updated_at = NOW()
         WHERE id = $1 AND company_id = $2`,
        [inspectionId, companyId]
      );
    }

    return result.rows[0];
  });
}

async function approveInspection({
  companyId,
  inspectionId,
  approverId,
  approvalNotes = null,
  quantityAccepted,
  quantityRejected,
}) {
  return withTransaction(async (client) => {
    const inspectionResult = await client.query(
      `SELECT *
       FROM quality_inspections
       WHERE id = $1 AND company_id = $2
       FOR UPDATE`,
      [inspectionId, companyId]
    );

    if (!inspectionResult.rowCount) {
      throw new Error("Quality inspection not found");
    }

    const inspection = inspectionResult.rows[0];

    if (!["PENDING", "IN_PROGRESS"].includes(inspection.status)) {
      throw new Error("Only pending or in-progress inspections can be approved");
    }

    if (
      inspection.inspector_id != null &&
      String(inspection.inspector_id) === String(approverId)
    ) {
      throw new Error("The inspector cannot approve their own inspection");
    }

    const accepted = Number(quantityAccepted);
    const rejected = Number(quantityRejected);
    const inspected = Number(inspection.quantity_inspected);

    if (
      quantityAccepted === undefined ||
      quantityRejected === undefined ||
      !Number.isFinite(accepted) ||
      !Number.isFinite(rejected) ||
      accepted < 0 ||
      rejected < 0 ||
      accepted + rejected !== inspected
    ) {
      throw new Error(
        "Accepted and rejected quantities must be non-negative and sum exactly to the inspected quantity"
      );
    }

    const results = await client.query(
      `SELECT result_status
       FROM quality_inspection_results
       WHERE quality_inspection_id = $1`,
      [inspectionId]
    );

    if (!results.rowCount) {
      throw new Error("Add inspection test results before approval");
    }

    const hasFailure = results.rows.some(
      (row) => row.result_status === "FAIL"
    );

    const hasWarning = results.rows.some(
      (row) => row.result_status === "WARNING"
    );

    const hasUntested = results.rows.some(
      (row) => row.result_status === "NOT_TESTED"
    );

    const allPassed = results.rows.every(
      (row) => row.result_status === "PASS"
    );

    let finalStatus;
    let inspectionResultValue;

    if (hasFailure) {
      finalStatus = "FAILED";
      inspectionResultValue = "FAIL";

      if (accepted !== 0 || rejected !== inspected) {
        throw new Error(
          "A failed inspection must reject the entire inspected quantity"
        );
      }
    } else if (allPassed && accepted === inspected && rejected === 0) {
      finalStatus = "PASSED";
      inspectionResultValue = "PASS";
    } else {
      finalStatus = "PARTIALLY_PASSED";
      inspectionResultValue = "PARTIAL";

      if (accepted <= 0 || rejected <= 0) {
        throw new Error(
          "A partial inspection requires both accepted and rejected quantities greater than zero"
        );
      }

      if (allPassed) {
        throw new Error(
          "All tests passed; use a full acceptance or record the actual failed or unresolved tests before partial approval"
        );
      }

      if (!hasWarning && !hasUntested) {
        throw new Error(
          "Partial approval requires a warning or unresolved test result"
        );
      }
    }

    const updated = await client.query(
      `UPDATE quality_inspections
       SET status = $1,
           inspection_result = $2,
           quantity_accepted = $3,
           quantity_rejected = $4,
           approved_by = $5,
           approved_at = NOW(),
           approval_notes = $6,
           updated_at = NOW()
       WHERE id = $7
         AND company_id = $8
         AND status IN ('PENDING', 'IN_PROGRESS')
       RETURNING *`,
      [
        finalStatus,
        inspectionResultValue,
        accepted,
        rejected,
        approverId,
        approvalNotes ? String(approvalNotes).trim() : null,
        inspectionId,
        companyId,
      ]
    );

    if (!updated.rowCount) {
      throw new Error("Quality inspection approval failed");
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
        approverId,
        "QUALITY_INSPECTION_APPROVED",
        "quality_inspections",
        inspectionId,
        JSON.stringify({
          status: inspection.status,
          inspection_result: inspection.inspection_result,
          quantity_accepted: inspection.quantity_accepted,
          quantity_rejected: inspection.quantity_rejected,
        }),
        JSON.stringify({
          status: finalStatus,
          inspection_result: inspectionResultValue,
          quantity_accepted: accepted,
          quantity_rejected: rejected,
          approved_by: approverId,
          approved_at: updated.rows[0].approved_at,
        }),
      ]
    );

    return updated.rows[0];
  });
}


module.exports = {
  createInspection,
  getInspections,
  getInspectionById,
  addInspectionResult,
  approveInspection,
};
