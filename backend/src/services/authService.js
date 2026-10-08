const jwt = require("jsonwebtoken");

const {
  findUserByEmail,
  findUserWithRolesAndPermissions,
  updateLastLogin,
} = require("../repositories/authRepository");

const {
  hashPassword,
  comparePassword,
} = require("../utils/password");

/**
 * Create a JWT for an authenticated user.
 */
function generateToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      companyId: user.company_id,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "1d",
    }
  );
}

/**
 * Login user.
 */
async function login(email, password) {
  const user = await findUserByEmail(email);

  if (!user) {
    throw new Error("Invalid email or password");
  }

  if (user.status !== "ACTIVE") {
    throw new Error("User account is not active");
  }

  const passwordValid = await comparePassword(
    password,
    user.password_hash
  );

  if (!passwordValid) {
    throw new Error("Invalid email or password");
  }

  const fullUser =
    await findUserWithRolesAndPermissions(user.id);

  await updateLastLogin(user.id);

  const token = generateToken(fullUser);

  return {
    user: {
      id: fullUser.id,
      companyId: fullUser.company_id,
      name: fullUser.name,
      email: fullUser.email,
      status: fullUser.status,
      roles: fullUser.roles,
    },
    token,
  };
}

module.exports = {
  login,
  generateToken,
};
