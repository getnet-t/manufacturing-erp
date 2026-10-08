const {
  getRolePermissions,
  assignPermissionsToRole,
} = require("../services/rolePermissionService");

async function getPermissionsForRole(req, res) {
  try {
    const permissions =
      await getRolePermissions(
        req.params.id,
        req.user.companyId
      );

    return res.status(200).json({
      success: true,
      data: {
        permissions,
      },
    });
  } catch (error) {
    console.error(
      "Get role permissions error:",
      error
    );

    if (error.message === "Role not found") {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

async function updateRolePermissions(req, res) {
  try {
    const {
      permissionCodes,
    } = req.body || {};

    const permissions =
      await assignPermissionsToRole({
        roleId: req.params.id,
        companyId: req.user.companyId,
        permissionCodes,
      });

    return res.status(200).json({
      success: true,
      message:
        "Role permissions updated successfully",
      data: {
        permissions,
      },
    });
  } catch (error) {
    console.error(
      "Update role permissions error:",
      error
    );

    if (
      error.message ===
      "Permission codes must be an array"
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    if (error.message === "Role not found") {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    if (
      error.message ===
      "One or more permissions do not exist"
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
        missingCodes:
          error.missingCodes || [],
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

module.exports = {
  getPermissionsForRole,
  updateRolePermissions,
};
