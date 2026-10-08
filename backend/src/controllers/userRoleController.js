const {
  getUserRoles,
  assignRolesToUser,
} = require("../services/userRoleService");

async function getRolesForUser(req, res) {
  try {
    const userId = Number(req.params.id);

    const roles = await getUserRoles(
      userId,
      req.user.companyId
    );

    res.json({
      success: true,
      data: {
        roles,
      },
    });
  } catch (error) {
    console.error(
      "Get user roles error:",
      error
    );

    if (error.message === "User not found") {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

async function updateUserRoles(req, res) {
  try {
    const userId = Number(req.params.id);

    const { roleIds } = req.body;

    const roles = await assignRolesToUser({
      userId,
      companyId: req.user.companyId,
      roleIds,
    });

    res.json({
      success: true,
      message: "User roles updated successfully",
      data: {
        roles,
      },
    });
  } catch (error) {
    console.error(
      "Update user roles error:",
      error
    );

    if (
      error.message === "User not found" ||
      error.message.startsWith("Role ")
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    if (
      error.message ===
      "Role IDs must be an array"
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

module.exports = {
  getRolesForUser,
  updateUserRoles,
};
