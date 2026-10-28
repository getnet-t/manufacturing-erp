
const {
  getCategories,
  getCategory,
  createNewCategory,
} = require("../services/productCategoryService");

async function getAllCategories(req, res) {
  try {
    const categories = await getCategories(req.user.companyId);

    return res.json({
      success: true,
      data: { categories },
    });
  } catch (error) {
    console.error("Get categories error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

async function getSingleCategory(req, res) {
  try {
    const categoryId = Number(req.params.id);

    const category = await getCategory(
      categoryId,
      req.user.companyId
    );

    return res.json({
      success: true,
      data: { category },
    });
  } catch (error) {
    console.error("Get category error:", error);

    if (
      error.message === "Product category not found" ||
      error.message === "Invalid category ID"
    ) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

async function createCategoryController(req, res) {
  try {
    const category = await createNewCategory({
      companyId: req.user.companyId,
      ...req.body,
    });

    return res.status(201).json({
      success: true,
      message: "Product category created successfully",
      data: { category },
    });
  } catch (error) {
    console.error("Create category error:", error);

    if (
      error.message.includes("required") ||
      error.message.includes("cannot") ||
      error.message.includes("exceed") ||
      error.message.includes("Invalid") ||
      error.message.includes("already exists") ||
      error.message.includes("not found") ||
      error.message.includes("inactive") ||
      error.message.includes("must be")
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

module.exports = {
  getAllCategories,
  getSingleCategory,
  createCategoryController,
};
