const {
  createNewUser,
  getUsers,
  getUser,
  editUser,
  changeUserPassword,
} = require("../services/userService");

/**
 * POST /api/users
 *
 * Create a new user.
 */
async function createUser(req, res) {
  try {
    const {
      name,
      email,
      password,
      status,
    } = req.body || {};

    const user = await createNewUser({
      companyId: req.user.companyId,
      name,
      email,
      password,
      status,
    });

    return res.status(201).json({
      success: true,
      message: "User created successfully",
      data: {
        user,
      },
    });
  } catch (error) {
    console.error("Create user error:", error);

    if (
      error.message ===
        "Name, email, and password are required" ||
      error.message ===
        "Password must be at least 8 characters" ||
      error.message ===
        "A user with this email already exists"
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
 * GET /api/users
 *
 * Get all users belonging to the
 * authenticated user's company.
 */
async function getAllUsers(req, res) {
  try {
    const users = await getUsers(
      req.user.companyId
    );

    return res.status(200).json({
      success: true,
      data: {
        users,
      },
    });
  } catch (error) {
    console.error("Get users error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

/**
 * GET /api/users/:id
 *
 * Get one user.
 */
async function getSingleUser(req, res) {
  try {
    const user = await getUser(
      req.params.id,
      req.user.companyId
    );

    return res.status(200).json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error) {
    console.error("Get user error:", error);

    if (error.message === "User not found") {
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
 * PATCH /api/users/:id
 *
 * Update user information.
 */
async function updateUser(req, res) {
  try {
    const user = await editUser(
      req.params.id,
      req.user.companyId,
      req.body || {}
    );

    return res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: {
        user,
      },
    });
  } catch (error) {
    console.error("Update user error:", error);

    if (
      error.message === "User not found" ||
      error.message ===
        "A user with this email already exists"
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
 * PATCH /api/users/:id/password
 *
 * Change a user's password.
 */
async function changePassword(req, res) {
  try {
    const {
      newPassword,
    } = req.body || {};

    const user =
      await changeUserPassword(
        req.params.id,
        req.user.companyId,
        newPassword
      );

    return res.status(200).json({
      success: true,
      message: "Password changed successfully",
      data: {
        user,
      },
    });
  } catch (error) {
    console.error(
      "Change password error:",
      error
    );

    if (
      error.message ===
        "New password is required" ||
      error.message ===
        "Password must be at least 8 characters" ||
      error.message === "User not found"
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
  createUser,
  getAllUsers,
  getSingleUser,
  updateUser,
  changePassword,
};

