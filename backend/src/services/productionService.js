const productionReleaseRepository = require("../repositories/productionReleaseRepository");
const productionRepository = require("../repositories/productionRepository");
const productionOutputRepository = require("../repositories/productionOutputRepository");
const productionCostRepository = require("../repositories/productionCostRepository");
const productionCostAllocationRepository = require("../repositories/productionCostAllocationRepository");
function validateId(value, fieldName) {
  const id = Number(value);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error(`Invalid ${fieldName}`);
  }

  return id;
}

async function listProductionOrders(companyId) {
  const validCompanyId = validateId(companyId, "company ID");
  return productionRepository.listProductionOrders(validCompanyId);
}

async function getProductionOrder(orderId, companyId) {
  const validOrderId = validateId(orderId, "production order ID");
  const validCompanyId = validateId(companyId, "company ID");

  const order = await productionRepository.getProductionOrderById(
    validOrderId,
    validCompanyId
  );

  if (!order) {
    throw new Error("Production order not found");
  }

  return order;
}

async function createProductionOrder(input, companyId, userId) {
  const validCompanyId = validateId(companyId, "company ID");

  const factoryId = validateId(input.factoryId, "factory ID");
  const warehouseId = validateId(input.warehouseId, "warehouse ID");
  const productId = validateId(input.productId, "product ID");
  const bomVersionId = validateId(input.bomVersionId, "BOM version ID");

  const productionOrderNumber =
    typeof input.productionOrderNumber === "string"
      ? input.productionOrderNumber.trim()
      : "";

  if (!productionOrderNumber) {
    throw new Error("Production order number is required");
  }

  if (!["MAKE_TO_STOCK", "MAKE_TO_ORDER"].includes(input.orderType)) {
    throw new Error("Invalid production order type");
  }

  const plannedQuantity = Number(input.plannedQuantity);

  if (!Number.isFinite(plannedQuantity) || plannedQuantity <= 0) {
    throw new Error("Planned quantity must be greater than zero");
  }

  function validateDate(value, fieldName) {
    if (value === undefined || value === null || value === "") {
      return null;
    }

    if (
      typeof value !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
      throw new Error(`Invalid ${fieldName}`);
    }

    const date = new Date(`${value}T00:00:00.000Z`);

    if (
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value
    ) {
      throw new Error(`Invalid ${fieldName}`);
    }

    return value;
  }

  const plannedStartDate = validateDate(
    input.plannedStartDate,
    "planned start date"
  );

  const plannedEndDate = validateDate(
    input.plannedEndDate,
    "planned end date"
  );

  if (
    plannedStartDate &&
    plannedEndDate &&
    plannedEndDate < plannedStartDate
  ) {
    throw new Error("Planned end date cannot precede planned start date");
  }

  const notes =
    typeof input.notes === "string" ? input.notes.trim() || null : null;

  const order = await productionRepository.createProductionOrder({
    companyId: validCompanyId,
    factoryId,
    warehouseId,
    productId,
    bomVersionId,
    productionOrderNumber,
    orderType: input.orderType,
    plannedQuantity,
    plannedStartDate,
    plannedEndDate,
    notes,
    createdBy: userId ? validateId(userId, "user ID") : null,
  });

  if (!order) {
    throw new Error(
      "Invalid or inactive factory, warehouse, product, or BOM version"
    );
  }

  return order;
}
async function releaseProductionOrder(orderId, companyId, userId) {
  const validOrderId = validateId(orderId, "production order ID");
  const validCompanyId = validateId(companyId, "company ID");
  const validUserId = validateId(userId, "user ID");

  return productionReleaseRepository.releaseProductionOrder(
    validOrderId,
    validCompanyId,
    validUserId
  );
}

function validatePositiveNumber(value, fieldName) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(`Invalid ${fieldName}`);
  }

  return number;
}

function validateOutputDate(value) {
  if (value === undefined || value === null || value === "") {
    return new Date().toISOString().slice(0, 10);
  }

  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    throw new Error("Invalid output date");
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new Error("Invalid output date");
  }

  return value;
}

async function createProductionOutput(input, companyId, userId) {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid production output input");
  }

  const productionOrderId = validatePositiveNumber(
    input.productionOrderId,
    "production order ID"
  );

  const warehouseId = validatePositiveNumber(
    input.warehouseId,
    "warehouse ID"
  );

  const outputNumber =
    typeof input.outputNumber === "string"
      ? input.outputNumber.trim()
      : "";

  if (!outputNumber || outputNumber.length > 100) {
    throw new Error("Invalid output number");
  }

  const outputDate = validateOutputDate(input.outputDate);

  return productionOutputRepository.createDraftProductionOutput({
    companyId,
    productionOrderId,
    outputNumber,
    outputDate,
    warehouseId,
    createdBy: userId,
  });
}


async function addProductionOutputLine(
  outputId,
  input,
  companyId
) {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid production output line input");
  }

  const validOutputId = validatePositiveNumber(
    outputId,
    "production output ID"
  );

  const productId = validatePositiveNumber(
    input.productId,
    "product ID"
  );

  const quantity = validatePositiveNumber(
    input.quantity,
    "output quantity"
  );

  const batchNo =
    input.batchNo === undefined ||
    input.batchNo === null
      ? null
      : input.batchNo;

  if (
    batchNo !== null &&
    (typeof batchNo !== "string" ||
      !batchNo.trim() ||
      batchNo.trim().length > 100)
  ) {
    throw new Error("Invalid batch number");
  }

  const qualityStatus = input.qualityStatus || "ACCEPTED";

  const allowedQualityStatuses = [
    "ACCEPTED",
    "REJECTED",
    "QUARANTINE",
  ];

  if (!allowedQualityStatuses.includes(qualityStatus)) {
    throw new Error("Invalid quality status");
  }

  return productionOutputRepository.addProductionOutputLine({
    companyId,
    outputId: validOutputId,
    productId,
    batchNo: batchNo === null ? null : batchNo.trim(),
    quantity,
    qualityStatus,
  });
}

async function postProductionOutput(outputId, companyId, userId) {
  const validOutputId = validatePositiveNumber(
    outputId,
    "production output ID"
  );

  return productionOutputRepository.postProductionOutput({
    companyId,
    outputId: validOutputId,
    userId,
  });
}

async function createProductionCostEntry(input, companyId, createdBy) {
  const productionOrderId = Number(input.productionOrderId);

  if (
    !Number.isSafeInteger(productionOrderId) ||
    productionOrderId <= 0
  ) {
    throw new Error("Valid production order ID is required");
  }

  return productionCostRepository.createCostEntry({
    companyId,
    productionOrderId,
    costType: input.costType,
    description: input.description,
    amount: input.amount,
    sourceDocumentType: input.sourceDocumentType,
    sourceDocumentId: input.sourceDocumentId,
    createdBy,
  });
}
async function approveProductionCostEntry(
  costEntryId,
  companyId,
  approverId,
  approvalNotes = null
) {
  const id = Number(costEntryId);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error("Valid production cost entry ID is required");
  }

  return productionCostRepository.approveCostEntry({
    companyId,
    costEntryId: id,
    approverId,
    approvalNotes,
  });
}

  async function createProductionCostAllocation(
  input,
  companyId,
  createdBy
) {
  return productionCostAllocationRepository.createAllocation({
    companyId,
    productionCostEntryId: input.productionCostEntryId,
    productionOutputId: input.productionOutputId,
    allocatedAmount: input.allocatedAmount,
    notes: input.notes,
    createdBy,
  });
}

async function approveProductionCostAllocation(
  allocationId,
  companyId,
  approverId,
  approvalNotes = null
) {
  const id = Number(allocationId);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error("Valid cost allocation ID is required");
  }

  return productionCostAllocationRepository.approveAllocation({
    companyId,
    allocationId: id,
    approverId,
    approvalNotes,
  });
}
async function calculateProductionOutputCost(outputId, companyId) {
  const id = Number(outputId);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error("Valid production output ID is required");
  }

  return productionOutputRepository.calculateProductionOutputCost({
    companyId,
    outputId: id,
  });
}
module.exports = {
  listProductionOrders,
  getProductionOrder,
  createProductionOrder,
  releaseProductionOrder,
  createProductionOutput,
  addProductionOutputLine,
  postProductionOutput,
createProductionCostEntry,
approveProductionCostEntry,
createProductionCostAllocation,
approveProductionCostAllocation,
calculateProductionOutputCost,
};
