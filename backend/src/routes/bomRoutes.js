
const express = require("express");
const { authenticate } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/authorizeMiddleware");

const bomController = require("../controllers/bomController");

const router = express.Router();

// List all BOMs for the authenticated user's company
router.get(
  "/",
  authenticate,
  authorize("BOM.READ"),
  bomController.listBoms
);

// Get a BOM, its versions, and their components
router.get(
  "/:id",
  authenticate,
  authorize("BOM.READ"),
  bomController.getBom
);

// Create a BOM and its initial draft version
router.post(
  "/",
  authenticate,
  authorize("BOM.CREATE"),
  bomController.createBom
);

// Create another draft version for a BOM
router.post(
  "/:id/versions",
  authenticate,
  authorize("BOM.CREATE"),
  bomController.createBomVersion
);

// Add a component to a draft BOM version
router.post(
  "/versions/:versionId/components",
  authenticate,
  authorize("BOM.UPDATE"),
  bomController.addBomComponent
);

// Activate or deactivate a BOM
router.patch(
  "/:id/status",
  authenticate,
  authorize("BOM.UPDATE"),
  bomController.changeBomStatus
);
router.patch(
  "/versions/:versionId/activate",
  authenticate,
  authorize("BOM.UPDATE"),
  bomController.activateBomVersion
);
module.exports = router;
