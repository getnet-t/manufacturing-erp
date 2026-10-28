
const express = require("express");

const {
  getAllCategories,
  getSingleCategory,
  createCategoryController,
} = require("../controllers/productCategoryController");

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
  getAllCategories
);

router.get(
  "/:id",
  authenticate,
  authorize("PRODUCT.READ"),
  getSingleCategory
);

router.post(
  "/",
  authenticate,
  authorize("PRODUCT.CREATE"),
  createCategoryController
);

module.exports = router;
