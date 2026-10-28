

const {
  getProducts,
  getProduct,
  createNewProduct,
  updateExistingProduct,
  changeProductStatus,
} = require("../services/productService");
async function getAllProducts(req, res) {
  try {
    const products = await getProducts(req.user.companyId);

    return res.json({
      success: true,
      data: { products },
    });
  } catch (error) {
    console.error("Get products error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

async function getSingleProduct(req, res) {
  try {
    const productId = Number(req.params.id);

    const product = await getProduct(
      productId,
      req.user.companyId
    );

    return res.json({
      success: true,
      data: { product },
    });
  } catch (error) {
    console.error("Get product error:", error);

    if (
      error.message === "Product not found" ||
      error.message === "Invalid product ID"
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

async function createProductController(req, res) {
  try {
    const product = await createNewProduct({
      companyId: req.user.companyId,
      ...req.body,
    });

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: { product },
    });
  } catch (error) {
    console.error("Create product error:", error);

    if (
      error.message.includes("required") ||
      error.message.includes("cannot") ||
      error.message.includes("exceed") ||
      error.message.includes("Invalid") ||
      error.message.includes("Allowed values") ||
      error.message.includes("already exists") ||
      error.message.includes("must be") ||
      error.message.includes("requires") ||
      error.message.includes("belong to another company") ||
      error.message.includes("do not exist") ||
      error.message.includes("inactive")
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
async function updateProductController(req, res) {
  try {
    const product = await updateExistingProduct(
      req.params.id,
      req.user.companyId,
      req.body
    );

    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: product,
    });
  } catch (error) {
    const message = error.message || "Internal server error";

    if (
      message === "Invalid product ID" ||
      message === "A valid productCategoryId is required"
    ) {
      return res.status(400).json({
        success: false,
        message,
      });
    }

    if (
      message === "Product not found" ||
      message === "Active product category not found for this company"
    ) {
      return res.status(404).json({
        success: false,
        message,
      });
    }

    console.error("Update product error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

async function changeProductStatusController(req, res) {
  try {
    const product = await changeProductStatus(
      req.params.id,
      req.user.companyId,
      req.body.status
    );

    return res.status(200).json({
      success: true,
      message: "Product status updated successfully",
      data: product,
    });
  } catch (error) {
    const message = error.message || "Internal server error";

    if (
      message === "Invalid product ID" ||
      message === "Status must be ACTIVE or INACTIVE"
    ) {
      return res.status(400).json({
        success: false,
        message,
      });
    }

    if (message === "Product not found") {
      return res.status(404).json({
        success: false,
        message,
      });
    }

    console.error("Change product status error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}
module.exports = {
  getAllProducts,
  getSingleProduct,
  createProductController,
   updateProductController,
   changeProductStatusController,
};
