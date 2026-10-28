
const express = require("express");
const { authenticate } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/authorizeMiddleware");
const productionController = require("../controllers/productionController");
const router = express.Router();

router.get(
  "/health",
  (req, res) => {
    res.json({
      success: true,
      message: "Production routes are working",
    });
  }
);

router.get(
  "/",
  authenticate,
  authorize("PRODUCTION.READ"),
  productionController.listProductionOrders
);

router.get(
  "/:id",
  authenticate,
  authorize("PRODUCTION.READ"),
  productionController.getProductionOrder
);

router.post(
  "/",
  authenticate,
  authorize("PRODUCTION.CREATE"),
  productionController.createProductionOrder

);
router.post(
  "/costs",
  authenticate,
  authorize("PRODUCTION.COST.CREATE"),
  productionController.createProductionCostEntry
);
router.post(
  "/costs/:id/approve",
  authenticate,
  authorize("PRODUCTION.COST.APPROVE"),
  productionController.approveProductionCostEntry
);
router.post(
  "/cost-allocations",
  authenticate,
  authorize("PRODUCTION.COST.CREATE"),
  productionController.createProductionCostAllocation
);

router.post(
  "/cost-allocations/:id/approve",
  authenticate,
  authorize("PRODUCTION.COST.APPROVE"),
  productionController.approveProductionCostAllocation
);

router.post(
 "/:id/release",
 authenticate,
  authorize("PRODUCTION.UPDATE"),
  productionController.releaseProductionOrder
)


router.post(
  "/outputs",
  authenticate,
  authorize("PRODUCTION.OUTPUT.CREATE"),
  productionController.createProductionOutput
);

router.post("/outputs/:id/post", authenticate, authorize("PRODUCTION.OUTPUT.POST"), productionController.postProductionOutput);

router.post(
  "/outputs/:id/lines",
  authenticate,
  authorize("PRODUCTION.UPDATE"),
  productionController.addProductionOutputLine
);

router.post(
  "/outputs/:id/calculate-cost",
  authenticate,
  authorize("PRODUCTION.UPDATE"),
  productionController.calculateProductionOutputCost
);
module.exports = router;
