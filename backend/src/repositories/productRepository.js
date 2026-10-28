
const pool = require("../config/database");

async function findProductsByCompany(companyId) {
  const result = await pool.query(
    `
    SELECT
      p.id,
      p.company_id,
      p.sku,
      p.name,
      p.description,
      p.product_category_id,
      p.product_type,
      p.base_uom_id,
      p.purchase_uom_id,
      p.sales_uom_id,
      p.is_purchased,
      p.is_manufactured,
      p.track_batch,
      p.track_expiry,
      p.status,
      p.created_at,
      p.updated_at,
      u.code AS base_uom_code,
      u.name AS base_uom_name
    FROM products p
    JOIN units_of_measure u
      ON u.id = p.base_uom_id
     AND u.company_id = p.company_id
    WHERE p.company_id = $1
    ORDER BY p.id;
    `,
    [companyId]
  );

  return result.rows;
}

async function findProductById(productId, companyId) {
  const result = await pool.query(
    `
    SELECT
      p.id,
      p.company_id,
      p.sku,
      p.name,
      p.description,
      p.product_category_id,
      p.product_type,
      p.base_uom_id,
      p.purchase_uom_id,
      p.sales_uom_id,
      p.is_purchased,
      p.is_manufactured,
      p.track_batch,
      p.track_expiry,
      p.status,
      p.created_at,
      p.updated_at,
      u.code AS base_uom_code,
      u.name AS base_uom_name
    FROM products p
    JOIN units_of_measure u
      ON u.id = p.base_uom_id
     AND u.company_id = p.company_id
    WHERE p.id = $1
      AND p.company_id = $2;
    `,
    [productId, companyId]
  );

  return result.rows[0];
}

async function findProductBySku(sku, companyId) {
  const result = await pool.query(
    `
    SELECT id
    FROM products
    WHERE sku = $1
      AND company_id = $2;
    `,
    [sku, companyId]
  );

  return result.rows[0];
}

async function createProduct(product) {
  const {
    companyId,
    sku,
    name,
    description,
    productCategoryId,
    productType,
    baseUomId,
    purchaseUomId,
    salesUomId,
    isPurchased,
    isManufactured,
    trackBatch,
    trackExpiry,
  } = product;

  const result = await pool.query(
    `
    INSERT INTO products (
      company_id,
      sku,
      name,
      description,
      product_category_id,
      product_type,
      base_uom_id,
      purchase_uom_id,
      sales_uom_id,
      is_purchased,
      is_manufactured,
      track_batch,
      track_expiry
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7,
      $8, $9, $10, $11, $12, $13
    )
    RETURNING *;
    `,
    [
      companyId,
      sku,
      name,
      description,
      productCategoryId,
      productType,
      baseUomId,
      purchaseUomId,
      salesUomId,
      isPurchased,
      isManufactured,
      trackBatch,
      trackExpiry,
    ]
  );

  return result.rows[0];
}

async function updateProduct(productId, companyId, product) {
  const {
    name,
    description,
    productCategoryId,
    productType,
    baseUomId,
    purchaseUomId,
    salesUomId,
    isPurchased,
    isManufactured,
    trackBatch,
    trackExpiry,
  } = product;

  const result = await pool.query(
    `
    UPDATE products
    SET
      name = COALESCE($1, name),
      description = COALESCE($2, description),
      product_category_id = COALESCE($3, product_category_id),
      product_type = COALESCE($4, product_type),
      base_uom_id = COALESCE($5, base_uom_id),
      purchase_uom_id = COALESCE($6, purchase_uom_id),
      sales_uom_id = COALESCE($7, sales_uom_id),
      is_purchased = COALESCE($8, is_purchased),
      is_manufactured = COALESCE($9, is_manufactured),
      track_batch = COALESCE($10, track_batch),
      track_expiry = COALESCE($11, track_expiry),
      updated_at = NOW()
    WHERE id = $12
      AND company_id = $13
    RETURNING *;
    `,
    [
      name ?? null,
      description ?? null,
      productCategoryId ?? null,
      productType ?? null,
      baseUomId ?? null,
      purchaseUomId ?? null,
      salesUomId ?? null,
      isPurchased ?? null,
      isManufactured ?? null,
      trackBatch ?? null,
      trackExpiry ?? null,
      productId,
      companyId,
    ]
  );

  return result.rows[0];
}

async function updateProductStatus(productId, companyId, status) {
  const result = await pool.query(
    `
    UPDATE products
    SET
      status = $1,
      updated_at = NOW()
    WHERE id = $2
      AND company_id = $3
    RETURNING *;
    `,
    [status, productId, companyId]
  );

  return result.rows[0];
}
module.exports = {
  findProductsByCompany,
  findProductById,
  findProductBySku,
  createProduct,
  updateProduct,
  updateProductStatus,
};
