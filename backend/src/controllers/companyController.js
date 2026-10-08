const {
  getCompaniesForUser,
  getCompany,
  createNewCompany,
  updateExistingCompany,
} = require("../services/companyService");

async function getCompanies(req, res) {
  try {
    const companies = await getCompaniesForUser(
      req.user.id
    );

    res.json({
      success: true,
      data: {
        companies,
      },
    });
  } catch (error) {
    console.error(
      "Get companies error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

async function getSingleCompany(req, res) {
  try {
    const companyId = Number(
      req.params.id
    );

    const company = await getCompany(
      companyId
    );

    res.json({
      success: true,
      data: {
        company,
      },
    });
  } catch (error) {
    console.error(
      "Get company error:",
      error
    );

    if (
      error.message === "Company not found"
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

async function createNewCompanyController(
  req,
  res
) {
  try {
    const {
      code,
      name,
      baseCurrency,
    } = req.body;

    const company =
      await createNewCompany({
        code,
        name,
        baseCurrency,
      });

    res.status(201).json({
      success: true,
      message: "Company created successfully",
      data: {
        company,
      },
    });
  } catch (error) {
    console.error(
      "Create company error:",
      error
    );

    if (
      error.message.includes("required") ||
      error.message.includes("currency") ||
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

async function updateCompanyController(
  req,
  res
) {
  try {
    const companyId = Number(
      req.params.id
    );

    const {
      name,
      baseCurrency,
      status,
    } = req.body;

    const company =
      await updateExistingCompany(
        companyId,
        {
          name,
          baseCurrency,
          status,
        }
      );

    res.json({
      success: true,
      message: "Company updated successfully",
      data: {
        company,
      },
    });
  } catch (error) {
    console.error(
      "Update company error:",
      error
    );

    if (
      error.message === "Company not found" ||
      error.message.includes("cannot be empty") ||
      error.message.includes("currency")
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
  getCompanies,
  getSingleCompany,
  createNewCompanyController,
  updateCompanyController,
};
