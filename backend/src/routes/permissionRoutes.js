const express = require("express");

const {
  getAllPermissions,
} = require("../controllers/permissionController");

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
  authorize("ROLE.READ"),
  getAllPermissions
);

module.exports = router;
