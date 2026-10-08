const {
  getFactories,
  getFactory,
  createNewFactory,
  updateExistingFactory,
} = require("../services/factoryService");

async function getAllFactories(req, res) {
  try {
    const factories = await getFactories(
      req.user.companyId
    );

    res.json({
      success: true,
      data: {
        factories,
      },
    });
  } catch (error) {
    console.error(
      "Get factories error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

async function getSingleFactory(req, res) {
  try {
    const factoryId = Number(
      req.params.id
    );

    const factory = await getFactory(
      factoryId,
      req.user.companyId
    );

    res.json({
      success: true,
      data: {
        factory,
      },
    });
  } catch (error) {
    console.error(
      "Get factory error:",
      error
    );

    if (
      error.message === "Factory not found"
    ) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

async function createFactoryController(
  req,
  res
) {
  try {
    const {
      code,
      name,
      address,
    } = req.body;

    const factory =
      await createNewFactory({
        companyId: req.user.companyId,
        code,
        name,
        address,
      });

    res.status(201).json({
      success: true,
      message: "Factory created successfully",
      data: {
        factory,
      },
    });
  } catch (error) {
    console.error(
      "Create factory error:",
      error
    );

    if (
      error.message.includes("required") ||
      error.message.includes("already exists")
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

async function updateFactoryController(
  req,
  res
) {
  try {
    const factoryId = Number(
      req.params.id
    );

    const {
      name,
      address,
      status,
    } = req.body;

    const factory =
      await updateExistingFactory(
        factoryId,
        req.user.companyId,
        {
          name,
          address,
          status,
        }
      );

    res.json({
      success: true,
      message: "Factory updated successfully",
      data: {
        factory,
      },
    });
  } catch (error) {
    console.error(
      "Update factory error:",
      error
    );

    if (
      error.message === "Factory not found" ||
      error.message.includes("cannot be empty")
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

module.exports = {
  getAllFactories,
  getSingleFactory,
  createFactoryController,
  updateFactoryController,
};