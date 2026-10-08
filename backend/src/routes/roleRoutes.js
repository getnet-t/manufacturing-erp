const express = require("express");

const {
  createRole,
  getAllRoles,
  getSingleRole,
  updateRole,
} = require("../controllers/roleController");
const {
  getPermissionsForRole,
  updateRolePermissions,
} = require("../controllers/rolePermissionController");
const {
  authenticate,
} = require("../middleware/authMiddleware");

const {
  authorize,
} = require("../middleware/authorizeMiddleware");

const router = express.Router();

/**
 * Create role
 */
router.post(
  "/",
  authenticate,
  authorize("ROLE.CREATE"),
  createRole
);

/**
 * Get all roles
 */
router.get(
  "/",
  authenticate,
  authorize("ROLE.READ"),
  getAllRoles
);
router.get(
  "/:id/permissions",
  authenticate,
  authorize("ROLE.READ"),
  getPermissionsForRole
);

router.put(
  "/:id/permissions",
  authenticate,
  authorize("ROLE.UPDATE"),
  updateRolePermissions
);
/**
 * Get one role
 */
router.get(
  "/:id",
  authenticate,
  authorize("ROLE.READ"),
  getSingleRole
);

/**
 * Update role
 */
router.patch(
  "/:id",
  authenticate,
  authorize("ROLE.UPDATE"),
  updateRole
);

module.exports = router;
