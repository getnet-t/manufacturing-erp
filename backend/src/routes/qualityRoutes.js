
const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/authorizeMiddleware");
const qualityController = require("../controllers/qualityController");

// Read inspections
router.get(
  "/",
  authenticate,
  authorize("QUALITY.INSPECTION.READ"),
  qualityController.getInspections
);

router.get(
  "/inspections/:id",
  authenticate,
  authorize("QUALITY.INSPECTION.READ"),
  qualityController.getInspectionById
);

// Create inspections and record test results
router.post(
  "/inspections",
  authenticate,
  authorize("QUALITY.INSPECTION.CREATE"),
  qualityController.createInspection
);

router.post(
  "/inspections/:id/results",
  authenticate,
  authorize("QUALITY.INSPECTION.CREATE"),
  qualityController.addInspectionResult
);

// Approve inspections
router.post(
  "/inspections/:id/approve",
  authenticate,
  authorize("QUALITY.INSPECTION.APPROVE"),
  qualityController.approveInspection
);

module.exports = router;
