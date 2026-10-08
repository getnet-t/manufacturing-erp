const pool = require("../config/database");

async function findCompaniesByUser(userId) {
  const result = await pool.query(
    `
    SELECT
      c.id,
      c.code,
      c.name,
      c.base_currency,
      c.status,
      c.created_at,
      c.updated_at
    FROM companies c
    INNER JOIN users u
      ON u.company_id = c.id
    WHERE u.id = $1
    ORDER BY c.id;
    `,
    [userId]
  );

  return result.rows;
}

async function findCompanyById(companyId) {
  const result = await pool.query(
    `
    SELECT
      id,
      code,
      name,
      base_currency,
      status,
      created_at,
      updated_at
    FROM companies
    WHERE id = $1;
    `,
    [companyId]
  );

  return result.rows[0];
}

async function findCompanyByCode(code) {
  const result = await pool.query(
    `
    SELECT
      id,
      code,
      name,
      base_currency,
      status,
      created_at,
      updated_at
    FROM companies
    WHERE code = $1;
    `,
    [code]
  );

  return result.rows[0];
}

async function createCompany({
  code,
  name,
  baseCurrency,
  status = "ACTIVE",
}) {
  const result = await pool.query(
    `
    INSERT INTO companies (
      code,
      name,
      base_currency,
      status
    )
    VALUES ($1, $2, $3, $4)
    RETURNING
      id,
      code,
      name,
      base_currency,
      status,
      created_at,
      updated_at;
    `,
    [
      code,
      name,
      baseCurrency,
      status,
    ]
  );

  return result.rows[0];
}

async function updateCompany(
  companyId,
  {
    name,
    baseCurrency,
    status,
  }
) {
  const result = await pool.query(
    `
    UPDATE companies
    SET
      name = COALESCE($1, name),
      base_currency = COALESCE($2, base_currency),
      status = COALESCE($3, status),
      updated_at = NOW()
    WHERE id = $4
    RETURNING
      id,
      code,
      name,
      base_currency,
      status,
      created_at,
      updated_at;
    `,
    [
      name,
      baseCurrency,
      status,
      companyId,
    ]
  );

  return result.rows[0];
}

module.exports = {
  findCompaniesByUser,
  findCompanyById,
  findCompanyByCode,
  createCompany,
  updateCompany,
};
