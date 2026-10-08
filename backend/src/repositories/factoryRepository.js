const pool = require("../config/database");

async function findFactoriesByCompany(companyId) {
  const result = await pool.query(
    `
    SELECT
      id,
      company_id,
      code,
      name,
      address,
      status,
      created_at,
      updated_at
    FROM factories
    WHERE company_id = $1
    ORDER BY id;
    `,
    [companyId]
  );

  return result.rows;
}

async function findFactoryById(
  factoryId,
  companyId
) {
  const result = await pool.query(
    `
    SELECT
      id,
      company_id,
      code,
      name,
      address,
      status,
      created_at,
      updated_at
    FROM factories
    WHERE id = $1
      AND company_id = $2;
    `,
    [factoryId, companyId]
  );

  return result.rows[0];
}

async function findFactoryByCode(
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
      address,
      status,
      created_at,
      updated_at
    FROM factories
    WHERE code = $1
      AND company_id = $2;
    `,
    [code, companyId]
  );

  return result.rows[0];
}

async function createFactory({
  companyId,
  code,
  name,
  address,
  status = "ACTIVE",
}) {
  const result = await pool.query(
    `
    INSERT INTO factories (
      company_id,
      code,
      name,
      address,
      status
    )
    VALUES ($1, $2, $3, $4, $5)
    RETURNING
      id,
      company_id,
      code,
      name,
      address,
      status,
      created_at,
      updated_at;
    `,
    [
      companyId,
      code,
      name,
      address,
      status,
    ]
  );

  return result.rows[0];
}

async function updateFactory(
  factoryId,
  companyId,
  {
    name,
    address,
    status,
  }
) {
  const result = await pool.query(
    `
    UPDATE factories
    SET
      name = COALESCE($1, name),
      address = COALESCE($2, address),
      status = COALESCE($3, status),
      updated_at = NOW()
    WHERE id = $4
      AND company_id = $5
    RETURNING
      id,
      company_id,
      code,
      name,
      address,
      status,
      created_at,
      updated_at;
    `,
    [
      name,
      address,
      status,
      factoryId,
      companyId,
    ]
  );

  return result.rows[0];
}

module.exports = {
  findFactoriesByCompany,
  findFactoryById,
  findFactoryByCode,
  createFactory,
  updateFactory,
};
