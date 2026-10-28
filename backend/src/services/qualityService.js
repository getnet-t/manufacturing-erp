
const qualityRepository = require("../repositories/qualityRepository");

function requirePositiveNumber(value, fieldName) {
  const number = Number(value);

  if (value === undefined || value === null || value === "" ||
      !Number.isFinite(number) || number <= 0) {
    throw new Error(`${fieldName} must be a positive number`);
  }

  return number;
}

function requireId(value, fieldName) {
  const number = Number(value);

  if (!Number.isSafeInteger(number) || number <= 0) {
    throw new Error(`${fieldName} must be a valid positive ID`);
  }

  return number;
}

async function createInspection({ companyId, userId, data }) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Inspection data is required");
  }

  const allowedTypes = [
    "PURCHASE_RECEIPT",
    "PRODUCTION_OUTPUT",
    "SALES_RETURN",
    "STOCK",
  ];

  const inspectionType = String(data.inspectionType || "").trim();

  if (!allowedTypes.includes(inspectionType)) {
    throw new Error("Invalid inspection type");
  }

  const inspectionNumber = String(data.inspectionNumber || "").trim();

  if (!inspectionNumber) {
    throw new Error("Inspection number is required");
  }

  return qualityRepository.createInspection({
    companyId: requireId(companyId, "Company ID"),
    inspectionNumber,
    inspectionType,
    productId: requireId(data.productId, "Product ID"),
    quantityInspected: requirePositiveNumber(
      data.quantityInspected,
      "Quantity inspected"
    ),
    inspectorId: userId,
    supplierId: data.supplierId ? requireId(data.supplierId, "Supplier ID") : null,
    purchaseOrderId: data.purchaseOrderId
      ? requireId(data.purchaseOrderId, "Purchase order ID")
      : null,
    goodsReceiptId: data.goodsReceiptId
      ? requireId(data.goodsReceiptId, "Goods receipt ID")
      : null,
    productionOrderId: data.productionOrderId
      ? requireId(data.productionOrderId, "Production order ID")
      : null,
    productionOutputId: data.productionOutputId
      ? requireId(data.productionOutputId, "Production output ID")
      : null,
    batchId: data.batchId ? requireId(data.batchId, "Batch ID") : null,
    warehouseId: data.warehouseId
      ? requireId(data.warehouseId, "Warehouse ID")
      : null,
    inspectionDate: data.inspectionDate || null,
    notes: data.notes == null ? null : String(data.notes).trim(),
  });
}

async function getInspections({ companyId, status = null }) {
  if (status != null && status !== "") {
    const allowedStatuses = [
      "PENDING",
      "IN_PROGRESS",
      "PASSED",
      "FAILED",
      "PARTIALLY_PASSED",
      "CANCELLED",
    ];

    if (!allowedStatuses.includes(status)) {
      throw new Error("Invalid inspection status filter");
    }
  }

  return qualityRepository.getInspections({
    companyId: requireId(companyId, "Company ID"),
    status: status || null,
  });
}

async function getInspectionById({ companyId, inspectionId }) {
  const id = requireId(inspectionId, "Inspection ID");

  const inspection = await qualityRepository.getInspectionById({
    companyId: requireId(companyId, "Company ID"),
    inspectionId: id,
  });

  if (!inspection) {
    throw new Error("Quality inspection not found");
  }

  return inspection;
}

async function addInspectionResult({
  companyId,
  inspectionId,
  data,
}) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Inspection result data is required");
  }

  const parameterName = String(data.parameterName || "").trim();

  if (!parameterName) {
    throw new Error("Parameter name is required");
  }

  const allowedResults = ["PASS", "FAIL", "WARNING", "NOT_TESTED"];
  const resultStatus = String(data.resultStatus || "").trim();

  if (!allowedResults.includes(resultStatus)) {
    throw new Error("Invalid inspection result status");
  }

  const optionalNumeric = (value, name) => {
    if (value === undefined || value === null || value === "") {
      return null;
    }

    const number = Number(value);

    if (!Number.isFinite(number)) {
      throw new Error(`${name} must be numeric`);
    }

    return number;
  };

  const lowerLimit = optionalNumeric(data.lowerLimit, "Lower limit");
  const upperLimit = optionalNumeric(data.upperLimit, "Upper limit");

  if (
    lowerLimit !== null &&
    upperLimit !== null &&
    upperLimit < lowerLimit
  ) {
    throw new Error("Upper limit cannot be below lower limit");
  }

  return qualityRepository.addInspectionResult({
    companyId: requireId(companyId, "Company ID"),
    inspectionId: requireId(inspectionId, "Inspection ID"),
    parameterName,
    parameterCode: data.parameterCode || null,
    specification: data.specification || null,
    targetValue: data.targetValue == null ? null : String(data.targetValue),
    actualValue: data.actualValue == null ? null : String(data.actualValue),
    unit: data.unit || null,
    resultStatus,
    measuredNumericValue: optionalNumeric(
      data.measuredNumericValue,
      "Measured numeric value"
    ),
    lowerLimit,
    upperLimit,
    notes: data.notes == null ? null : String(data.notes).trim(),
  });
}

async function approveInspection({
  companyId,
  inspectionId,
  approverId,
  data,
}) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Approval data is required");
  }

  const quantityAccepted = requirePositiveOrZero(
    data.quantityAccepted,
    "Accepted quantity"
  );
  const quantityRejected = requirePositiveOrZero(
    data.quantityRejected,
    "Rejected quantity"
  );

  return qualityRepository.approveInspection({
    companyId: requireId(companyId, "Company ID"),
    inspectionId: requireId(inspectionId, "Inspection ID"),
    approverId: requireId(approverId, "Approver ID"),
    approvalNotes: data.approvalNotes == null
      ? null
      : String(data.approvalNotes).trim(),
    quantityAccepted,
    quantityRejected,
  });
}

function requirePositiveOrZero(value, fieldName) {
  if (value === undefined || value === null || value === "") {
    throw new Error(`${fieldName} is required`);
  }

  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    throw new Error(`${fieldName} must be zero or greater`);
  }

  return number;
}

module.exports = {
  createInspection,
  getInspections,
  getInspectionById,
  addInspectionResult,
  approveInspection,
};
