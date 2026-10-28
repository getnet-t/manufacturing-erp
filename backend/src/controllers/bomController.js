
const bomService = require("../services/bomService");

function handleError(res, error, operation) {
  const message = error.message || "Internal server error";

  const badRequestMessages = [
    "Invalid BOM ID",
    "Invalid BOM version ID",
    "Invalid product ID",
    "Invalid component product ID",
    "BOM code is required",
    "BOM name is required",
    "A valid effectiveFrom date in YYYY-MM-DD format is required",
    "Product not found for this company",
    "BOM product must be active",
    "BOM code already exists for this company",
    "BOM not found",
    "Cannot create a version for an inactive BOM",
    "BOM version not found for this company",
    "Components can only be added to a DRAFT BOM version",
    "A BOM product cannot be its own component",
    "Component product not found for this company",
    "Component product must be active",
    "quantityRequired must be greater than zero",
    "scrapPercent must be between 0 and 100",
    "sequenceNo must be a positive integer",
    "issueMethod must be MANUAL or BACKFLUSH",
    "Status must be ACTIVE or INACTIVE",
    "This sequence number already exists in the BOM version",
  ];

  console.error(`${operation}:`, error);

  if (badRequestMessages.includes(message)) {
    return res.status(400).json({
      success: false,
      message,
    });
  }

  if (message === "BOM not found") {
    return res.status(404).json({
      success: false,
      message,
    });
  }

  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
}

async function listBoms(req, res) {
  try {
    const boms = await bomService.listBoms(req.user.companyId);

    return res.json({
      success: true,
      data: { boms },
    });
  } catch (error) {
    return handleError(res, error, "List BOMs error");
  }
}

async function getBom(req, res) {
  try {
    const bom = await bomService.getBom(
      req.params.id,
      req.user.companyId
    );

    return res.json({
      success: true,
      data: { bom },
    });
  } catch (error) {
    return handleError(res, error, "Get BOM error");
  }
}

async function createBom(req, res) {
  try {
    const bom = await bomService.createBom({
      ...req.body,
      companyId: req.user.companyId,
    });

    return res.status(201).json({
      success: true,
      message: "BOM created successfully with an initial draft version",
      data: { bom },
    });
  } catch (error) {
    return handleError(res, error, "Create BOM error");
  }
}

async function createBomVersion(req, res) {
  try {
    const version = await bomService.createBomVersion({
      ...req.body,
      bomId: req.params.id,
      companyId: req.user.companyId,
    });

    return res.status(201).json({
      success: true,
      message: "BOM version created successfully",
      data: { version },
    });
  } catch (error) {
    return handleError(res, error, "Create BOM version error");
  }
}

async function addBomComponent(req, res) {
  try {
    const component = await bomService.addBomComponent({
      ...req.body,
      bomVersionId: req.params.versionId,
      companyId: req.user.companyId,
    });

    return res.status(201).json({
      success: true,
      message: "BOM component added successfully",
      data: { component },
    });
  } catch (error) {
    return handleError(res, error, "Add BOM component error");
  }
}

async function changeBomStatus(req, res) {
  try {
    const bom = await bomService.changeBomStatus(
      req.params.id,
      req.user.companyId,
      req.body.status
    );

    return res.json({
      success: true,
      message: "BOM status updated successfully",
      data: { bom },
    });
  } catch (error) {
    return handleError(res, error, "Change BOM status error");
  }
}

async function activateBomVersion(req, res) {
  try {
    const version = await bomService.activateBomVersion({
      bomVersionId: req.params.versionId,
      companyId: req.user.companyId,
    });

    return res.json({
      success: true,
      message: "BOM version activated successfully",
      data: { version },
    });
  } catch (error) {
    return handleError(res, error, "Activate BOM version error");
  }
}

module.exports = {
  listBoms,
  getBom,
  createBom,
  createBomVersion,
  addBomComponent,
  changeBomStatus,
  activateBomVersion,
};
