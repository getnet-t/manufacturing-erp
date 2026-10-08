const { login } = require("../services/authService");

/**
 * POST /api/auth/login
 *
 * Authenticate a user and return a JWT.
 */
async function loginUser(req, res) {
  try {
    const { email, password } = req.body || {};

    // ==========================================
    // Validate request
    // ==========================================

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // ==========================================
    // Authenticate user
    // ==========================================

    const result = await login(email, password);

    // ==========================================
    // Success response
    // ==========================================

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: result,
    });
  } catch (error) {
    // ==========================================
    // Authentication errors
    // ==========================================

    if (
      error.message === "Invalid email or password" ||
      error.message === "User account is not active"
    ) {
      return res.status(401).json({
        success: false,
        message: error.message,
      });
    }

    // ==========================================
    // Unexpected server error
    // ==========================================

    console.error("Login error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

async function getCurrentUser(req, res) {
  return res.status(200).json({
    success: true,
    data: {
      user: req.user,
    },
  });
}

module.exports = {
  loginUser,
   getCurrentUser,
};
/*{
  "email": "production.manager@erp.local",
  "password": "123abc"
}*/