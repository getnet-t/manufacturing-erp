
const express = require("express");
const {
  authenticate,
} = require("../middleware/authMiddleware");
const {
  authorize,
} = require("../middleware/authorizeMiddleware");
const inventoryController = require("../controllers/inventoryController");
const router = express.Router();

// Inventory routes will require authentication
// and the appropriate inventory permissions.

router.get(
  "/test-transaction",
  authenticate,
  authorize("INVENTORY.READ"),
  (req, res) => {
    res.json({
      success: true,
      message: "Inventory route authorization works",
      userId: req.user.id,
      companyId: req.user.companyId,
    });
  }
);

router.post(
  "/receipts",
  authenticate,
  authorize("INVENTORY.RECEIPT.CREATE"),
  inventoryController.createPurchaseReceipt
);

router.post(
  "/receipts/:id/post",
  authenticate,
  authorize("INVENTORY.RECEIPT.CREATE"),
  inventoryController.postPurchaseReceipt
);
// Create a production issue draft
router.post(
  "/production-issues",
  authenticate,
  authorize("INVENTORY.RECEIPT.CREATE"),
  inventoryController.createProductionIssue
);
router.post(
  "/production-issues/:id/reverse",
  authenticate,
  authorize("INVENTORY.PRODUCTION_ISSUE.REVERSE"),
    inventoryController.reverseProductionIssue
);
// Post a production issue
router.post(
  "/production-issues/:id/post",
  authenticate,
  authorize("INVENTORY.RECEIPT.CREATE"),
  inventoryController.postProductionIssue
);
module.exports = router;
