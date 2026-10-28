
const pool = require("../config/database");

async function findCategoriesByCompany(companyId) {
  const result = await pool.query(
    `
    SELECT
      id,
      company_id,
      parent_id,
      code,
      name,
      description,
      status,
      created_at,
      updated_at
    FROM product_categories
    WHERE company_id = $1
    ORDER BY id;
    `,
    [companyId]
  );

  return result.rows;
}

async function findCategoryById(categoryId, companyId) {
  const result = await pool.query(
    `
    SELECT
      id,
      company_id,
      parent_id,
      code,
      name,
      description,
      status,
      created_at,
      updated_at
    FROM product_categories
    WHERE id = $1
      AND company_id = $2;
    `,
    [categoryId, companyId]
  );

  return result.rows[0];
}

async function findCategoryByCode(code, companyId) {
  const result = await pool.query(
    `
    SELECT id
    FROM product_categories
    WHERE code = $1
      AND company_id = $2;
    `,
    [code, companyId]
  );

  return result.rows[0];
}

async function createCategory({
  companyId,
  parentId,
  code,
  name,
  description,
}) {
  const result = await pool.query(
    `
    INSERT INTO product_categories (
      company_id,
      parent_id,
      code,
      name,
      description
    )

    VALUES ($1, $2, $3, $4, $5)
    RETURNING
      id,
      company_id,
      parent_id,
      code,
      name,
      description,
      status,
      created_at,
      updated_at;
    `,
    [companyId, parentId, code, name, description]
  );

  return result.rows[0];
}

module.exports = {
  findCategoriesByCompany,
  findCategoryById,
  findCategoryByCode,
  createCategory,
};
