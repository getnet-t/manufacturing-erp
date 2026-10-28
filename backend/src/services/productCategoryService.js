
const {
  findCategoriesByCompany,
  findCategoryById,
  findCategoryByCode,
  createCategory,
} = require("../repositories/productCategoryRepository");

async function getCategories(companyId) {
  return findCategoriesByCompany(companyId);
}

async function getCategory(categoryId, companyId) {
  if (!Number.isSafeInteger(categoryId) || categoryId <= 0) {
    throw new Error("Invalid category ID");
  }

  const category = await findCategoryById(categoryId, companyId);

  if (!category) {
    throw new Error("Product category not found");
  }

  return category;
}

async function createNewCategory({
  companyId,
  parentId,
  code,
  name,
  description,
}) {
  if (
    typeof code !== "string" ||
    typeof name !== "string"
  ) {
    throw new Error("Category code and name are required");
  }

  const normalizedCode = code.trim().toUpperCase();
  const normalizedName = name.trim();

  if (!normalizedCode || !normalizedName) {
    throw new Error("Category code and name cannot be empty");
  }

  if (normalizedCode.length > 50) {
    throw new Error("Category code cannot exceed 50 characters");
  }

  if (normalizedName.length > 150) {
    throw new Error("Category name cannot exceed 150 characters");
  }

  if (
    description !== undefined &&
    description !== null &&
    typeof description !== "string"
  ) {
    throw new Error("Description must be a string");
  }

  const normalizedParentId =
    parentId == null ? null : Number(parentId);

  if (
    normalizedParentId !== null &&
    (!Number.isSafeInteger(normalizedParentId) ||
      normalizedParentId <= 0)
  ) {
    throw new Error("Invalid parent category ID");
  }

  if (normalizedParentId !== null) {
    const parent = await findCategoryById(
      normalizedParentId,
      companyId
    );

    if (!parent) {
      throw new Error("Parent category not found");
    }

    if (parent.status !== "ACTIVE") {
      throw new Error("Parent category is inactive");
    }
  }

  const existing = await findCategoryByCode(
    normalizedCode,
    companyId
  );

  if (existing) {
    throw new Error("Category code already exists");
  }

  return createCategory({
    companyId,
    parentId: normalizedParentId,
    code: normalizedCode,
    name: normalizedName,
    description: description?.trim() || null,
  });
}
module.exports = {
  getCategories,
  getCategory,
  createNewCategory,
};
