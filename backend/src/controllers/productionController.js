
const productionService = require("../services/productionService");


function handleError(res, error, operation = "Production operation error") {
  console.error(`${operation}:`, error);

  const message =
    typeof error?.message === "string" ? error.message : "";

  // Missing resources
  if (
    message === "Production order not found" ||
    message === "Production output not found"
  ) {
    return res.status(404).json({
      success: false,
      message,
    });
  }

  // Conflicting production state
  if (
    message.startsWith("Only draft production outputs") ||
    message.startsWith("Only DRAFT production outputs") ||
    message.startsWith("Only accepted output lines") ||
    message.startsWith("Production output could not be posted") ||
    message.startsWith("Production output requires a released or in-progress order") ||
    message.startsWith("Production order is not available") ||
        message.startsWith("Costing is blocked:") ||
    message.startsWith("Only DRAFT production outputs can be costed")


  ) {
    return res.status(409).json({
      success: false,
      message,
    });
  }

  // Expected validation and business-rule errors
  if (
    message.startsWith("Invalid ") ||
    message.startsWith("Valid ") ||
    message.startsWith("Planned quantity") ||
    message.startsWith("Output ") ||
    message.startsWith("A batch number") ||
    message.startsWith("Batch number") ||
    message.startsWith("Finished-goods batch") ||
    message.startsWith("Active ") ||
    message.startsWith("Cannot post ") ||
    message.startsWith("Production output requires") ||
    message.startsWith("Production order number") ||
    message.startsWith("Production order type") ||

    message.startsWith("No BOM components") ||
    message.startsWith("Unexpected material issue") ||
    message.startsWith("Material quantity mismatch") ||
    message.startsWith("Unable to determine posted material cost") ||
    message.startsWith("Calculated production cost") ||
    message.startsWith("Linked finished-goods batch") ||
    message.startsWith("Output warehouse") ||
    message.startsWith("Production output has no lines")

  ) {
    return res.status(400).json({
      success: false,
      message,
    });
  }

  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
}


async function listProductionOrders(req, res) {
  try {
    const orders = await productionService.listProductionOrders(
      req.user.companyId
    );

    return res.json({
      success: true,
      data: { orders },
    });
  } catch (error) {
    return handleError(res, error, "List production orders error");
  }
}

async function getProductionOrder(req, res) {
  try {
    const order = await productionService.getProductionOrder(
      req.params.id,
      req.user.companyId
    );

    return res.json({
      success: true,
      data: { order },
    });
  } catch (error) {
    return handleError(res, error, "Get production order error");
  }
}


async function createProductionOrder(req, res) {
  try {
    const order = await productionService.createProductionOrder(
      req.body,
      req.user.companyId,
      req.user.id
    );

    return res.status(201).json({
      success: true,
      message: "Production order created successfully",
      data: { order },
    });
  } catch (error) {
    return handleError(res, error, "Create production order error");
  }
}


async function releaseProductionOrder(req, res) {
  try {
    const result = await productionService.releaseProductionOrder(
      req.params.id,
      req.user.companyId,
      req.user.id
    );

    return res.json({
      success: true,
      message: "Production order released successfully",
      data: result,
    });
  } catch (error) {
    return handleError(res, error, "Release production order error");
  }
}

async function createProductionOutput(req, res) {
  try {
    const output = await productionService.createProductionOutput(
      req.body,
      req.user.companyId,
      req.user.id
    );

    return res.status(201).json({
      message: "Production output draft created successfully",
      data: output,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

async function addProductionOutputLine(req, res) {
  try {
    const outputLine = await productionService.addProductionOutputLine(
      req.params.id,
      req.body,
      req.user.companyId
    );

    return res.status(201).json({
      message: "Production output line added successfully",
      data: outputLine,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

async function postProductionOutput(req, res) {
  try {
    const output = await productionService.postProductionOutput(
      req.params.id,
      req.user.companyId,
      req.user.id
    );

    return res.json({
      success: true,
      message: "Production output posted successfully",
      data: output,
    });
  } catch (error) {
    return handleError(res, error, "Post production output error");
  }
}

async function createProductionCostEntry(req, res) {
  try {
    const costEntry = await productionService.createProductionCostEntry(
  req.body,
  req.user.companyId,
  req.user.id
);
    return res.status(201).json({
      success: true,
      message: "Production cost entry created and awaiting approval",
      data: costEntry,
    });
  } catch (error) {
    return handleError(res, error, "Create production cost entry error");
  }
}
async function approveProductionCostEntry(req, res) {
  try {
    const result = await productionService.approveProductionCostEntry(
      req.params.id,
      req.user.companyId,
      req.user.id,
      req.body.approvalNotes
    );

    return res.status(200).json({
      success: true,
      message: "Production cost approved successfully",
      data: result,
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Approve production cost error"
    );
  }
}

async function createProductionCostAllocation(req, res) {
  try {
    const result = await productionService.createProductionCostAllocation(
  req.body,
  req.user.companyId,
  req.user.id
);

    return res.status(201).json({
      success: true,
      message: "Production cost allocation created and awaiting approval",
      data: result,
    });
  } catch (error) {
    return handleError(res, error, "Create production cost allocation error");
  }
}

async function approveProductionCostAllocation(req, res) {
  try {
    const result = await productionService.approveProductionCostAllocation(
      req.params.id,
      req.user.companyId,
      req.user.id,
      req.body.approvalNotes
    );

    return res.status(200).json({
      success: true,
      message: "Production cost allocation approved successfully",
      data: result,
    });
  } catch (error) {
    return handleError(res, error, "Approve production cost allocation error");
  }
}
async function calculateProductionOutputCost(req, res) {
  try {
    const result =
      await productionService.calculateProductionOutputCost(
        req.params.id,
        req.user.companyId
      );

    return res.json({
      success: true,
      message: "Production output cost calculated successfully",
      data: result,
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Calculate production output cost error"
    );
  }
}

module.exports = {
  listProductionOrders,
  getProductionOrder,
  createProductionOrder,
releaseProductionOrder,
createProductionOutput,
  addProductionOutputLine,
  postProductionOutput,
createProductionCostEntry,
approveProductionCostEntry,
createProductionCostAllocation,
approveProductionCostAllocation,
calculateProductionOutputCost,
};
