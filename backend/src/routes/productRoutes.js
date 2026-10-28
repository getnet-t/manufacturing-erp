
const express = require("express");


const {
  getAllProducts,
  getSingleProduct,
  createProductController,
  updateProductController,
  changeProductStatusController,
} = require("../controllers/productController");
const {
  authenticate,
} = require("../middleware/authMiddleware");

const {
  authorize,
} = require("../middleware/authorizeMiddleware");

const router = express.Router();

router.get(
  "/",
  authenticate,
  authorize("PRODUCT.READ"),
  getAllProducts
);

router.get(
  "/:id",
  authenticate,
  authorize("PRODUCT.READ"),
  getSingleProduct
);

router.post(
  "/",
  authenticate,
  authorize("PRODUCT.CREATE"),
  createProductController
);
router.patch(
  "/:id",
  authenticate,
  authorize("PRODUCT.UPDATE"),
  updateProductController
);
router.patch(
  "/:id/status",
  authenticate,
  authorize("PRODUCT.UPDATE"),
  changeProductStatusController,
);

module.exports = router;
