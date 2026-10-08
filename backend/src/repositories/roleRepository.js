const pool = require("../config/database");

/**
 * Find all roles for a company.
 */
async function findRolesByCompany(companyId) {
  const result = await pool.query(
    `
    SELECT
      id,
      company_id,
      code,
      name,
      description,
      status,
      created_at,
      updated_at
    FROM roles
    WHERE company_id = $1
    ORDER BY id;
    `,
    [companyId]
  );

  return result.rows;
}

/**
 * Find one role belonging to a company.
 */
async function findRoleById(roleId, companyId) {
  const result = await pool.query(
    `
    SELECT
      id,
      company_id,
      code,
      name,
      description,
      status,
      created_at,
      updated_at
    FROM roles
    WHERE id = $1
      AND company_id = $2
    LIMIT 1;
    `,
    [roleId, companyId]
  );

  return result.rows[0] || null;
}

/**
 * Find a role by code within a company.
 */
async function findRoleByCode(
  code,
  companyId
) {
  const result = await pool.query(
    `
    SELECT
      id,
      company_id,
      code,
      name,
      description,
      status,
      created_at,
      updated_at
    FROM roles
    WHERE LOWER(code) = LOWER($1)
      AND company_id = $2
    LIMIT 1;
    `,
    [code, companyId]
  );

  return result.rows[0] || null;
}

/**
 * Create a role.
 */
async function createRole({
  companyId,
  code,
  name,
  description,
  status = "ACTIVE",
}) {
  const result = await pool.query(
    `
    INSERT INTO roles (
      company_id,
      code,
      name,
      description,
      status
    )
    VALUES ($1, UPPER($2), $3, $4, $5)
    RETURNING
      id,
      company_id,
      code,
      name,
      description,
      status,
      created_at,
      updated_at;
    `,
    [
      companyId,
      code,
      name,
      description ?? null,
      status,
    ]
  );

  return result.rows[0];
}

/**
 * Update a role.
 */
async function updateRole(
  roleId,
  companyId,
  {
    name,
    description,
    status,
  }
) {
  const result = await pool.query(
    `
    UPDATE roles
    SET
      name = COALESCE($1, name),
      description = COALESCE($2, description),
      status = COALESCE($3, status),
      updated_at = NOW()
    WHERE id = $4
      AND company_id = $5
    RETURNING
      id,
      company_id,
      code,
      name,
      description,
      status,
      created_at,
      updated_at;
    `,
    [
      name ?? null,
      description ?? null,
      status ?? null,
      roleId,
      companyId,
    ]
  );

  return result.rows[0] || null;
}

module.exports = {
  findRolesByCompany,
  findRoleById,
  findRoleByCode,
  createRole,
  updateRole,
};