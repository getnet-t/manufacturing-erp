const pool = require("../config/database");

/**
 * Create a new user.
 */
async function createUser({
  companyId,
  name,
  email,
  passwordHash,
  status = "ACTIVE",
}) {
  const result = await pool.query(
    `
    INSERT INTO users (
      company_id,
      name,
      email,
      password_hash,
      status
    )
    VALUES ($1, $2, LOWER($3), $4, $5)
    RETURNING
      id,
      company_id,
      name,
      email,
      status,
      last_login_at,
      created_at,
      updated_at;
    `,
    [
      companyId,
      name,
      email,
      passwordHash,
      status,
    ]
  );

  return result.rows[0];
}

/**
 * Find users belonging to a company.
 */
async function findUsersByCompany(companyId) {
  const result = await pool.query(
    `
    SELECT
      id,
      company_id,
      name,
      email,
      status,
      last_login_at,
      created_at,
      updated_at
    FROM users
    WHERE company_id = $1
    ORDER BY id DESC;
    `,
    [companyId]
  );

  return result.rows;
}

/**
 * Find one user by ID.
 */
async function findUserById(userId, companyId) {
  const result = await pool.query(
    `
    SELECT
      id,
      company_id,
      name,
      email,
      status,
      last_login_at,
      created_at,
      updated_at
    FROM users
    WHERE id = $1
      AND company_id = $2
    LIMIT 1;
    `,
    [userId, companyId]
  );

  return result.rows[0] || null;
}

/**
 * Find a user by email within a company.
 */
async function findUserByEmailAndCompany(
  email,
  companyId
) {
  const result = await pool.query(
    `
    SELECT
      id,
      company_id,
      name,
      email,
      password_hash,
      status,
      last_login_at,
      created_at,
      updated_at
    FROM users
    WHERE LOWER(email) = LOWER($1)
      AND company_id = $2
    LIMIT 1;
    `,
    [email, companyId]
  );

  return result.rows[0] || null;
}

/**
 * Update basic user information.
 */
async function updateUser(
  userId,
  companyId,
  { name, email, status }
) {
  const result = await pool.query(
    `
    UPDATE users
    SET
      name = COALESCE($1, name),
      email = COALESCE(LOWER($2), email),
      status = COALESCE($3, status),
      updated_at = NOW()
    WHERE id = $4
      AND company_id = $5
    RETURNING
      id,
      company_id,
      name,
      email,
      status,
      last_login_at,
      created_at,
      updated_at;
    `,
    [
      name ?? null,
      email ?? null,
      status ?? null,
      userId,
      companyId,
    ]
  );

  return result.rows[0] || null;
}

/**
 * Change a user's password.
 */
async function updateUserPassword(
  userId,
  companyId,
  passwordHash
) {
  const result = await pool.query(
    `
    UPDATE users
    SET
      password_hash = $1,
      updated_at = NOW()
    WHERE id = $2
      AND company_id = $3
    RETURNING
      id,
      company_id,
      name,
      email,
      status,
      updated_at;
    `,
    [
      passwordHash,
      userId,
      companyId,
    ]
  );

  return result.rows[0] || null;
}

module.exports = {
  createUser,
  findUsersByCompany,
  findUserById,
  findUserByEmailAndCompany,
  updateUser,
  updateUserPassword,
};
