const {
  getPermissions,
} = require("../services/permissionService");

async function getAllPermissions(req, res) {
  try {
    const permissions =
      await getPermissions();

    return res.status(200).json({
      success: true,
      data: {
        permissions,
      },
    });
  } catch (error) {
    console.error(
      "Get permissions error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

module.exports = {
  getAllPermissions,
};
