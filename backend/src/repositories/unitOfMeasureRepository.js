const pool = require("../config/database");

async function findUnitsByCompany(companyId) {
const result = await pool.query(
`     SELECT
      id,
      company_id,
      code,
      name,
      dimension,
      status,
      created_at,
      updated_at
    FROM units_of_measure
    WHERE company_id = $1
    ORDER BY id;
    `,
[companyId]
);

return result.rows;
}

async function findUnitById(unitId, companyId) {
const result = await pool.query(
`     SELECT
      id,
      company_id,
      code,
      name,
      dimension,
      status,
      created_at,
      updated_at
    FROM units_of_measure
    WHERE id = $1
      AND company_id = $2;
    `,
[unitId, companyId]
);

return result.rows[0];
}

async function findUnitByCode(code, companyId) {
const result = await pool.query(
`     SELECT
      id,
      company_id,
      code,
      name,
      dimension,
      status,
      created_at,
      updated_at
    FROM units_of_measure
    WHERE code = $1
      AND company_id = $2;
    `,
[code, companyId]
);

return result.rows[0];
}

async function createUnit({
companyId,
code,
name,
dimension,
}) {
const result = await pool.query(
`     INSERT INTO units_of_measure (
      company_id,
      code,
      name,
      dimension
    )
    VALUES ($1, $2, $3, $4)
    RETURNING
      id,
      company_id,
      code,
      name,
      dimension,
      status,
      created_at,
      updated_at;
    `,
[companyId, code, name, dimension]
);

return result.rows[0];
}

async function updateUnit(
unitId,
companyId,
{ name, dimension, status }
) {
const result = await pool.query(
`     UPDATE units_of_measure
    SET
      name = COALESCE($1, name),
      dimension = COALESCE($2, dimension),
      status = COALESCE($3, status),
      updated_at = NOW()
    WHERE id = $4
      AND company_id = $5
    RETURNING
      id,
      company_id,
      code,
      name,
      dimension,
      status,
      created_at,
      updated_at;
    `,
[name, dimension, status, unitId, companyId]
);

return result.rows[0];
}

module.exports = {
findUnitsByCompany,
findUnitById,
findUnitByCode,
createUnit,
updateUnit,
};
