const express = require("express");

const {
  createUser,
  getAllUsers,
  getSingleUser,
  updateUser,
  changePassword,
} = require("../controllers/userController");

const {
  getRolesForUser,
  updateUserRoles,
} = require("../controllers/userRoleController");

const {
  authenticate,
} = require("../middleware/authMiddleware");

const {
  authorize,
} = require("../middleware/authorizeMiddleware");

const router = express.Router();

router.post(
  "/",
  authenticate,
  authorize("USER.CREATE"),
  createUser
);

router.get(
  "/",
  authenticate,
  authorize("USER.READ"),
  getAllUsers
);

router.get(
  "/:id/roles",
  authenticate,
  authorize("ROLE.READ"),
  getRolesForUser
);

router.put(
  "/:id/roles",
  authenticate,
  authorize("ROLE.UPDATE"),
  updateUserRoles
);

router.get(
  "/:id",
  authenticate,
  authorize("USER.READ"),
  getSingleUser
);

router.patch(
  "/:id",
  authenticate,
  authorize("USER.UPDATE"),
  updateUser
);

router.patch(
  "/:id/password",
  authenticate,
  authorize("USER.UPDATE"),
  changePassword
);

module.exports = router;