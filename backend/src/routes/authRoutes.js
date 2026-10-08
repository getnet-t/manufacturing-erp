const express = require("express");

const {
  loginUser,
  getCurrentUser,
} = require("../controllers/authController");

const {
  authenticate,
} = require("../middleware/authMiddleware");

const router = express.Router();

/**
 * POST /api/auth/login
 *
 * Authenticate a user and return a JWT.
 */
router.post("/login", loginUser);
/**
 * GET /api/auth/me
 *
 * Get the currently authenticated user.
 */
router.get("/me", authenticate, getCurrentUser);

module.exports = router;
