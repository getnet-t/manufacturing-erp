const {
  findCompaniesByUser,
  findCompanyById,
  findCompanyByCode,
  createCompany,
  updateCompany,
} = require("../repositories/companyRepository");

async function getCompaniesForUser(userId) {
  return findCompaniesByUser(userId);
}

async function getCompany(companyId) {
  const company = await findCompanyById(
    companyId
  );

  if (!company) {
    throw new Error("Company not found");
  }

  return company;
}

async function createNewCompany({
  code,
  name,
  baseCurrency = "ETB",
}) {
  if (!code || !name) {
    throw new Error(
      "Company code and name are required"
    );
  }

  const normalizedCode = code
    .trim()
    .toUpperCase();

  const normalizedName = name.trim();

  const normalizedCurrency = (
    baseCurrency || "ETB"
  )
    .trim()
    .toUpperCase();

  if (!normalizedCode) {
    throw new Error(
      "Company code is required"
    );
  }

  if (!normalizedName) {
    throw new Error(
      "Company name is required"
    );
  }

  if (normalizedCurrency.length !== 3) {
    throw new Error(
      "Base currency must be a 3-letter currency code"
    );
  }

  const existingCompany =
    await findCompanyByCode(
      normalizedCode
    );

  if (existingCompany) {
    throw new Error(
      "Company code already exists"
    );
  }

  return createCompany({
    code: normalizedCode,
    name: normalizedName,
    baseCurrency: normalizedCurrency,
  });
}

async function updateExistingCompany(
  companyId,
  {
    name,
    baseCurrency,
    status,
  }
) {
  const company =
    await findCompanyById(companyId);

  if (!company) {
    throw new Error("Company not found");
  }

  let normalizedName;

  if (name !== undefined) {
    normalizedName = name.trim();

    if (!normalizedName) {
      throw new Error(
        "Company name cannot be empty"
      );
    }
  }

  let normalizedCurrency;

  if (baseCurrency !== undefined) {
    normalizedCurrency = baseCurrency
      .trim()
      .toUpperCase();

    if (normalizedCurrency.length !== 3) {
      throw new Error(
        "Base currency must be a 3-letter currency code"
      );
    }
  }

  return updateCompany(
    companyId,
    {
      name: normalizedName,
      baseCurrency: normalizedCurrency,
      status,
    }
  );
}

module.exports = {
  getCompaniesForUser,
  getCompany,
  createNewCompany,
  updateExistingCompany,
};