const jwt = require("jsonwebtoken");
const {
  findUserWithRolesAndPermissions,
} = require("../repositories/authRepository");

/**
 * Protect routes with JWT authentication.
 *
 * Expected header:
 * Authorization: Bearer <token>
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    // Check Authorization header
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Extract token
    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication token is missing",
      });
    }

    // Verify token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    // Get current user and permissions
    const user =
      await findUserWithRolesAndPermissions(
        decoded.userId
      );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User no longer exists",
      });
    }

    if (user.status !== "ACTIVE") {
      return res.status(401).json({
        success: false,
        message: "User account is not active",
      });
    }
    // Attach authenticated user to request
    req.user = {
      id: user.id,
      companyId: user.company_id,
      name: user.name,
      email: user.email,
      status: user.status,
      roles: user.roles,
    };

    next();
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired authentication token",
      });
    }

    console.error("Authentication error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}
/**
 * GET /api/auth/me
 *
 * Return the currently authenticated user.
 */
async function getCurrentUser(req, res) {
  return res.status(200).json({
    success: true,
    data: {
      user: req.user,
    },
  });
}

module.exports = {
  authenticate,
  getCurrentUser,

};
