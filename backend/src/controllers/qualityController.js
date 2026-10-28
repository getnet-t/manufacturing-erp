
const qualityService = require("../services/qualityService");


function handleError(res, error) {
  const message = error.message || "Internal server error";
if (message === "Quality inspection not found") {
  return res.status(404).json({
    success: false,
    message,
  });
}

  if (error.code === "23505") {
    return res.status(409).json({
      success: false,
      message: "A record with this unique value already exists",
    });
  }

  const isValidationError =
    /required|invalid|must be|cannot|only |not found|cannot approve|before approval|partial approval|failed inspection|full acceptance|test results|sum exactly|finalized inspection/i.test(
      message
    );

  return res.status(isValidationError ? 400 : 500).json({
    success: false,
    message: isValidationError ? message : "Internal server error",
  });
}

async function createInspection(req, res) {
  try {
    const data = await qualityService.createInspection({
      companyId: req.user.companyId,
      userId: req.user.id,
      data: req.body,
    });

    return res.status(201).json({
      success: true,
      message: "Quality inspection created",
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

async function getInspections(req, res) {
  try {
    const data = await qualityService.getInspections({
      companyId: req.user.companyId,
      status: req.query.status || null,
    });

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

async function getInspectionById(req, res) {
  try {
    const data = await qualityService.getInspectionById({
      companyId: req.user.companyId,
      inspectionId: req.params.id,
    });

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

async function addInspectionResult(req, res) {
  try {
    const data = await qualityService.addInspectionResult({
      companyId: req.user.companyId,
      inspectionId: req.params.id,
      data: req.body,
    });

    return res.status(201).json({
      success: true,
      message: "Inspection result recorded",
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

async function approveInspection(req, res) {
  try {
    const data = await qualityService.approveInspection({
      companyId: req.user.companyId,
      inspectionId: req.params.id,
      approverId: req.user.id,
      data: req.body,
    });

    return res.status(200).json({
      success: true,
      message: "Quality inspection reviewed",
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

module.exports = {
  createInspection,
  getInspections,
  getInspectionById,
  addInspectionResult,
  approveInspection,
};
