const {
  createUser,
  findUsersByCompany,
  findUserById,
  findUserByEmailAndCompany,
  updateUser,
  updateUserPassword,
} = require("../repositories/userRepository");

const {
  hashPassword,
} = require("../utils/password");

/**
 * Create a new user.
 */
async function createNewUser({
  companyId,
  name,
  email,
  password,
  status = "ACTIVE",
}) {
  // Basic validation
  if (!name || !email || !password) {
    throw new Error(
      "Name, email, and password are required"
    );
  }

  if (password.length < 8) {
    throw new Error(
      "Password must be at least 8 characters"
    );
  }

  // Check duplicate email inside the company
  const existingUser =
    await findUserByEmailAndCompany(
      email,
      companyId
    );

  if (existingUser) {
    throw new Error(
      "A user with this email already exists"
    );
  }

  // Hash password before storing it
  const passwordHash =
    await hashPassword(password);

  return createUser({
    companyId,
    name,
    email,
    passwordHash,
    status,
  });
}

/**
 * Get all users in the company.
 */
async function getUsers(companyId) {
  return findUsersByCompany(companyId);
}

/**
 * Get one user.
 */
async function getUser(userId, companyId) {
  const user = await findUserById(
    userId,
    companyId
  );

  if (!user) {
    throw new Error("User not found");
  }

  return user;
}

/**
 * Update basic user information.
 */
async function editUser(
  userId,
  companyId,
  data
) {
  const existingUser =
    await findUserById(
      userId,
      companyId
    );

  if (!existingUser) {
    throw new Error("User not found");
  }

  if (data.email) {
    const emailOwner =
      await findUserByEmailAndCompany(
        data.email,
        companyId
      );

    if (
      emailOwner &&
      String(emailOwner.id) !== String(userId)
    ) {
      throw new Error(
        "A user with this email already exists"
      );
    }
  }

  const updatedUser =
    await updateUser(
      userId,
      companyId,
      {
        name: data.name,
        email: data.email,
        status: data.status,
      }
    );

  return updatedUser;
}

/**
 * Change a user's password.
 */
async function changeUserPassword(
  userId,
  companyId,
  newPassword
) {
  if (!newPassword) {
    throw new Error(
      "New password is required"
    );
  }

  if (newPassword.length < 8) {
    throw new Error(
      "Password must be at least 8 characters"
    );
  }

  const existingUser =
    await findUserById(
      userId,
      companyId
    );

  if (!existingUser) {
    throw new Error("User not found");
  }

  const passwordHash =
    await hashPassword(newPassword);

  return updateUserPassword(
    userId,
    companyId,
    passwordHash
  );
}

module.exports = {
  createNewUser,
  getUsers,
  getUser,
  editUser,
  changeUserPassword,
};
