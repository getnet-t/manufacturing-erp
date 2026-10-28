

const {
  findProductsByCompany,
  findProductById,
  findProductBySku,
  createProduct,
  updateProduct,
  updateProductStatus,
} = require("../repositories/productRepository");
const pool = require("../config/database");

const VALID_PRODUCT_TYPES = [
  "RAW_MATERIAL",
  "SEMI_FINISHED",
  "FINISHED_GOOD",
  "CONSUMABLE",
  "PACKAGING",
  "SPARE_PART",
];

async function getProducts(companyId) {
  return findProductsByCompany(companyId);
}

async function getProduct(productId, companyId) {
  if (!Number.isSafeInteger(productId) || productId <= 0) {
    throw new Error("Invalid product ID");
  }

  const product = await findProductById(productId, companyId);

  if (!product) {
    throw new Error("Product not found");
  }

  return product;
}

async function createNewProduct({
  companyId,
  sku,
  name,
  description,
  productCategoryId,
  productType,
  baseUomId,
  purchaseUomId,
  salesUomId,
  isPurchased = true,
  isManufactured = false,
  trackBatch = true,
  trackExpiry = false,
}) {
  if (
    typeof sku !== "string" ||
    typeof name !== "string" ||
    typeof productType !== "string" ||
    baseUomId === undefined ||
    baseUomId === null
  ) {
    throw new Error(
      "SKU, name, product type, and base unit of measure are required"
    );
  }

  const normalizedSku = sku.trim().toUpperCase();
  const normalizedName = name.trim();
  const normalizedType = productType.trim().toUpperCase();

  if (!normalizedSku || !normalizedName) {
    throw new Error("SKU and name cannot be empty");
  }

  if (normalizedSku.length > 50) {
    throw new Error("SKU cannot exceed 50 characters");
  }

  if (normalizedName.length > 150) {
    throw new Error("Name cannot exceed 150 characters");
  }

  if (!VALID_PRODUCT_TYPES.includes(normalizedType)) {
    throw new Error(
      `Invalid product type. Allowed values: ${VALID_PRODUCT_TYPES.join(", ")}`
    );
  }

  if (typeof isPurchased !== "boolean" ||
      typeof isManufactured !== "boolean" ||
      typeof trackBatch !== "boolean" ||
      typeof trackExpiry !== "boolean") {
    throw new Error("Product flags must be true or false");
  }

  if (!isPurchased && !isManufactured) {
    throw new Error(
      "A product must be purchased, manufactured, or both"
    );
  }

  if (trackExpiry && !trackBatch) {
    throw new Error("Expiry tracking requires batch tracking");
  }

  const normalizedBaseUomId = Number(baseUomId);

  if (!Number.isSafeInteger(normalizedBaseUomId) ||
      normalizedBaseUomId <= 0) {
    throw new Error("Invalid base unit of measure ID");
  }

  const normalizedCategoryId =
    productCategoryId == null ? null : Number(productCategoryId);

  const normalizedPurchaseUomId =
    purchaseUomId == null ? null : Number(purchaseUomId);

  const normalizedSalesUomId =
    salesUomId == null ? null : Number(salesUomId);

  for (const id of [
    normalizedCategoryId,
    normalizedPurchaseUomId,
    normalizedSalesUomId,
  ]) {
    if (id !== null && (!Number.isSafeInteger(id) || id <= 0)) {
      throw new Error("Invalid category or unit of measure ID");
    }
  }

  if (
    description !== undefined &&
    description !== null &&
    typeof description !== "string"
  ) {
    throw new Error("Description must be a string");
  }

  const existingProduct = await findProductBySku(
    normalizedSku,
    companyId
  );

  if (existingProduct) {
    throw new Error("Product SKU already exists");
  }

  const unitIds = [
    normalizedBaseUomId,
    normalizedPurchaseUomId,
    normalizedSalesUomId,
  ].filter((id) => id !== null);

  const uniqueUnitIds = [...new Set(unitIds)];

  const unitResult = await pool.query(
    `
    SELECT id
    FROM units_of_measure
    WHERE company_id = $1
      AND status = 'ACTIVE'
      AND id = ANY($2::bigint[]);
    `,
    [companyId, uniqueUnitIds]
  );

  if (unitResult.rows.length !== uniqueUnitIds.length) {
    throw new Error(
      "One or more units of measure do not exist, are inactive, or belong to another company"
    );
  }

  if (normalizedCategoryId !== null) {
    const categoryResult = await pool.query(
      `
      SELECT id
      FROM product_categories
      WHERE id = $1
        AND company_id = $2
        AND status = 'ACTIVE';
      `,
      [normalizedCategoryId, companyId]
    );

    if (categoryResult.rowCount === 0) {
      throw new Error(
        "Product category does not exist, is inactive, or belongs to another company"
      );
    }
  }
  return createProduct({
    companyId,
    sku: normalizedSku,
    name: normalizedName,
    description: description?.trim() || null,
    productCategoryId: normalizedCategoryId,
    productType: normalizedType,
    baseUomId: normalizedBaseUomId,
    purchaseUomId: normalizedPurchaseUomId,
    salesUomId: normalizedSalesUomId,
    isPurchased,
    isManufactured,
    trackBatch,
    trackExpiry,
  });
}
async function updateExistingProduct(productId, companyId, payload) {
  const id = Number(productId);

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("Invalid product ID");
  }

  if (
    payload.productCategoryId === undefined ||
    !Number.isInteger(Number(payload.productCategoryId)) ||
    Number(payload.productCategoryId) <= 0
  ) {
    throw new Error("A valid productCategoryId is required");
  }

  const existingProduct = await findProductById(id, companyId);

  if (!existingProduct) {
    throw new Error("Product not found");
  }
  const categoryResult = await pool.query(
    `
    SELECT id
    FROM product_categories
    WHERE id = $1
      AND company_id = $2
      AND status = 'ACTIVE'
    `,
    [Number(payload.productCategoryId), companyId]
  );
  if (categoryResult.rows.length === 0) {
    throw new Error("Active product category not found for this company");
  }

  return updateProduct(id, companyId, {
    productCategoryId: Number(payload.productCategoryId),
  });
}
async function changeProductStatus(productId, companyId, status) {
  const id = Number(productId);

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("Invalid product ID");
  }

  if (typeof status !== "string") {
    throw new Error("Status must be ACTIVE or INACTIVE");
  }

  const normalizedStatus = status.trim().toUpperCase();

  if (!["ACTIVE", "INACTIVE"].includes(normalizedStatus)) {
    throw new Error("Status must be ACTIVE or INACTIVE");
  }

  const existingProduct = await findProductById(id, companyId);

  if (!existingProduct) {
    throw new Error("Product not found");
  }
  return updateProductStatus(id, companyId, normalizedStatus);
}
module.exports = {
  getProducts,
  getProduct,
  createNewProduct,
  updateExistingProduct,
  changeProductStatus,
};
