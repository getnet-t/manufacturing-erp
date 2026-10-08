const express = require("express");

const {
  getAllFactories,
  getSingleFactory,
  createFactoryController,
  updateFactoryController,
} = require("../controllers/factoryController");

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
  authorize("SYSTEM.SETTINGS"),
  getAllFactories
);

router.get(
  "/:id",
  authenticate,
  authorize("SYSTEM.SETTINGS"),
  getSingleFactory
);

router.post(
  "/",
  authenticate,
  authorize("SYSTEM.SETTINGS"),
  createFactoryController
);

router.patch(
  "/:id",
  authenticate,
  authorize("SYSTEM.SETTINGS"),
  updateFactoryController
);

module.exports = router;
