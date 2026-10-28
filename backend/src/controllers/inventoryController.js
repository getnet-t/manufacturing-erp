
const inventoryService = require("../services/inventoryService");

async function createPurchaseReceipt(req, res) {
  try {
    const {
      documentNo,
      transactionDate,
      productId,
      warehouseId,
      locationId,
      quantity,
      unitCost,
      batchNo,
      supplierBatchNo,
      manufacturedAt,
      expiresAt,
    } = req.body || {};

    const result = await inventoryService.createPurchaseReceipt({
      companyId: req.user.companyId,
      userId: req.user.id,
      documentNo,
      transactionDate,
      productId,
      warehouseId,
      locationId,
      quantity,
      unitCost,
      batchNo,
      supplierBatchNo,
      manufacturedAt,
      expiresAt,
    });

    return res.status(201).json({
      success: true,
      message: "Purchase receipt created successfully as a draft",
      data: result,
    });
  } catch (error) {
    console.error("Create purchase receipt error:", error.message);
    if (error.message === "This production issue has already been reversed") {
      return res.status(409).json({
        success: false,
        message: error.message,
      });
    }
    const clientErrors = [
      "Required receipt fields are missing",
      "Quantity must be greater than zero",
      "Unit cost cannot be negative",
      "Batch number must be a non-empty string",
      "A batch number is required for this product",
      "An expiry date is required for this product",
      "Active product not found in this company",
      "This product is not configured for purchasing",
      "Active warehouse not found in this company",
      "Active location not found in this warehouse",
      "Batch exists but is not available for receipt",
    ];

    if (clientErrors.includes(error.message)) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "A receipt with this document number already exists",
      });
    }

    if (error.code === "23503" || error.code === "23514") {
      return res.status(400).json({
        success: false,
        message: "Receipt data violates a database constraint",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create purchase receipt",
    });
  }
}

async function postPurchaseReceipt(req, res) {
  try {
    const transactionId = Number(req.params.id);

    if (!Number.isSafeInteger(transactionId) || transactionId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid receipt ID",
      });
    }

    const result = await inventoryService.postPurchaseReceipt({
      companyId: req.user.companyId,
      userId: req.user.id,
      transactionId,
    });

    return res.status(200).json({
      success: true,
      message: "Purchase receipt posted successfully",
      data: result,
    });
  } catch (error) {
    console.error("Post purchase receipt error:", error.message);

    const clientErrors = [
      "Required posting fields are missing",
      "Purchase receipt not found",
      "Only draft receipts can be posted",
      "Cannot post a receipt without lines",
      "Receipt line has invalid quantity or cost",
      "Active product not found in this company",
      "This product is not configured for purchasing",
      "Active warehouse not found in this company",
      "A batch number is required for this product",
      "An expiry date is required for this product",
      "Batch exists but is not available for receipt",
      "Receipt could not be posted",
    ];

    if (clientErrors.includes(error.message)) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    if (error.code === "23503" || error.code === "23514") {
      return res.status(400).json({
        success: false,
        message: "Receipt data violates a database constraint",
      });
    }

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "A duplicate inventory record was detected",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to post purchase receipt",
    });
  }
}


async function createProductionIssue(req, res) {
  try {
    const {
      documentNo,
      transactionDate,
      productId,
      warehouseId,
      locationId,
      quantity,
      productionOrderId,
    } = req.body || {};

    const result = await inventoryService.createProductionIssue({
      companyId: req.user.companyId,
      userId: req.user.id,
      documentNo,
      transactionDate,
      productId,
      warehouseId,
      locationId,
      quantity,
      productionOrderId,
    });

    return res.status(201).json({
      success: true,
      message: "Production issue created successfully as a draft",
      data: result,
    });
  } catch (error) {
    console.error("Create production issue error:", error.message);

    const clientErrors = [
      "Required production issue fields are missing",
      "Issue quantity must be greater than zero",
      "Active product not found in this company",
      "This initial production issue workflow requires a batch-tracked product",
      "Active warehouse not found in this company",
      "Active location not found in this warehouse",
      "Insufficient available stock for this issue",
      "Insufficient available batch quantity",
    ];

    if (clientErrors.includes(error.message)) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "A production issue with this document number already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create production issue",
    });
  }
}

async function postProductionIssue(req, res) {
  try {
    const transactionId = Number(req.params.id);

    if (!Number.isSafeInteger(transactionId) || transactionId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid production issue ID",
      });
    }

    const result = await inventoryService.postProductionIssue({
      companyId: req.user.companyId,
      userId: req.user.id,
      transactionId,
    });

    return res.status(200).json({
      success: true,
      message: "Production issue posted successfully",
      data: result,
    });
  } catch (error) {
    console.error("Post production issue error:", error.message);



    const clientErrors = [
      "Required production issue fields are missing",
      "Issue quantity must be greater than zero",
      "Invalid production order ID",
      "Active product not found in this company",
      "This initial production issue workflow requires a batch-tracked product",
      "Active warehouse not found in this company",
      "Active location not found in this warehouse",
      "Insufficient available stock for this issue",
      "Insufficient available batch quantity",
      "Production order not found or is not released",
      "Production issue warehouse does not match production order",
      "Production order allocation has no batch for a batch-tracked product",
    ];

    if (
      clientErrors.includes(error.message) ||
      error.message.startsWith("Insufficient remaining production allocation for product") ||
      error.message.startsWith("Insufficient physical stock for production order product") ||
      error.message.startsWith("Insufficient available stock for product")
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }


    if (
      clientErrors.includes(error.message) ||
      error.message.startsWith("Insufficient available stock for product") ||
      error.message.startsWith("Insufficient available batch quantity for product") ||
      error.message.startsWith("Insufficient remaining production allocation for product") ||
      error.message.startsWith("Insufficient physical stock for production order product")
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    if (
      clientErrors.includes(error.message) ||
      error.message.startsWith("Insufficient available stock for product") ||
      error.message.startsWith("Insufficient available batch quantity for product")
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    if (error.code === "23503" || error.code === "23514") {
      return res.status(400).json({
        success: false,
        message: "Production issue data violates a database constraint",
      });
    }

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "A duplicate batch movement was detected",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to post production issue",
    });
  }
}

async function reverseProductionIssue(req, res) {
  try {
    const transactionId = Number(req.params.id);

    if (!Number.isSafeInteger(transactionId) || transactionId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid production issue ID",
      });
    }

    const result = await inventoryService.reverseProductionIssue({
      companyId: req.user.companyId,
      userId: req.user.id,
      transactionId,
    });

    return res.status(200).json({
      success: true,
      message: "Production issue reversed successfully",
      data: result,
    });
  } catch (error) {
    console.error("Reverse production issue error:", error.message);

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "This production issue has already been reversed",
      });
    }
if (error.message === "This production issue has already been reversed") {
  return res.status(409).json({
    success: false,
    message: error.message,
  });
}
    const clientErrors = [
      "Production issue not found",
      "Only a posted production-order issue can be reversed",
      "Original production order was not found",
      "Production issue has no movement lines",
      "Invalid original production issue movement line",
      "Original issue warehouse does not match its production order",
      "Cannot reverse an issue line without its original batch movements",
      "Original batch quantities do not match the issue quantity",
      "Expected exactly one production allocation for the original issue batch",
      "Cannot reverse issue: allocation issued quantity is insufficient",
      "Inventory balance not found or invalid when restoring reversed issue",
      "Inventory valuation balance not found when restoring reversed issue",
      "Reversal document number exceeds 100 characters",
    ];

    if (
      clientErrors.includes(error.message) ||
      error.message.startsWith("Reversal quantity") ||
      error.message.startsWith("Reversal unit cost") ||
      error.message.startsWith("Reversal value")
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    if (error.code === "23503" || error.code === "23514") {
      return res.status(400).json({
        success: false,
        message: "Reversal data violates a database constraint",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to reverse production issue",
    });
  }
}


module.exports = {
  createPurchaseReceipt,
  postPurchaseReceipt,
  createProductionIssue,
  postProductionIssue,
 reverseProductionIssue,
};
