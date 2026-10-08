const {
  createNewRole,
  getRoles,
  getRole,
  editRole,
} = require("../services/roleService");

/**
 * POST /api/roles
 *
 * Create a new role.
 */
async function createRole(req, res) {
  try {
    const {
      code,
      name,
      description,
      status,
    } = req.body || {};

    const role = await createNewRole({
      companyId: req.user.companyId,
      code,
      name,
      description,
      status,
    });

    return res.status(201).json({
      success: true,
      message: "Role created successfully",
      data: {
        role,
      },
    });
  } catch (error) {
    console.error("Create role error:", error);

    if (
      error.message ===
        "Role code and name are required" ||
      error.message ===
        "A role with this code already exists" ||
      error.message ===
        "Role code cannot be changed"
    ) {
      return res.status(400).json({
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

/**
 * GET /api/roles
 *
 * Get all roles for the company.
 */
async function getAllRoles(req, res) {
  try {
    const roles = await getRoles(
      req.user.companyId
    );

    return res.status(200).json({
      success: true,
      data: {
        roles,
      },
    });
  } catch (error) {
    console.error("Get roles error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

/**
 * GET /api/roles/:id
 *
 * Get one role.
 */
async function getSingleRole(req, res) {
  try {
    const role = await getRole(
      req.params.id,
      req.user.companyId
    );

    return res.status(200).json({
      success: true,
      data: {
        role,
      },
    });
  } catch (error) {
    console.error("Get role error:", error);

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

/**
 * PATCH /api/roles/:id
 *
 * Update a role.
 */
async function updateRole(req, res) {
  try {
    const role = await editRole(
      req.params.id,
      req.user.companyId,
      req.body || {}
    );

    return res.status(200).json({
      success: true,
      message: "Role updated successfully",
      data: {
        role,
      },
    });
  } catch (error) {
    console.error("Update role error:", error);

    if (
      error.message === "Role not found" ||
      error.message ===
        "Role code cannot be changed"
    ) {
      return res.status(400).json({
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

module.exports = {
  createRole,
  getAllRoles,
  getSingleRole,
  updateRole,
};
