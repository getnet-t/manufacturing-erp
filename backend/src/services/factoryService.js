const {
  findFactoriesByCompany,
  findFactoryById,
  findFactoryByCode,
  createFactory,
  updateFactory,
} = require("../repositories/factoryRepository");

async function getFactories(companyId) {
  return findFactoriesByCompany(companyId);
}

async function getFactory(factoryId, companyId) {
  const factory = await findFactoryById(
    factoryId,
    companyId
  );

  if (!factory) {
    throw new Error("Factory not found");
  }

  return factory;
}

async function createNewFactory({
  companyId,
  code,
  name,
  address,
}) {
  if (!code || !name) {
    throw new Error(
      "Factory code and name are required"
    );
  }

  const normalizedCode = code
    .trim()
    .toUpperCase();

  const normalizedName = name.trim();

  const normalizedAddress =
    address?.trim() || null;

  if (!normalizedCode) {
    throw new Error(
      "Factory code is required"
    );
  }

  if (!normalizedName) {
    throw new Error(
      "Factory name is required"
    );
  }

  const existingFactory =
    await findFactoryByCode(
      normalizedCode,
      companyId
    );

  if (existingFactory) {
    throw new Error(
      "Factory code already exists"
    );
  }

  return createFactory({
    companyId,
    code: normalizedCode,
    name: normalizedName,
    address: normalizedAddress,
  });
}

async function updateExistingFactory(
  factoryId,
  companyId,
  {
    name,
    address,
    status,
  }
) {
  const factory =
    await findFactoryById(
      factoryId,
      companyId
    );

  if (!factory) {
    throw new Error("Factory not found");
  }

  let normalizedName;

  if (name !== undefined) {
    normalizedName = name.trim();

    if (!normalizedName) {
      throw new Error(
        "Factory name cannot be empty"
      );
    }
  }

  let normalizedAddress;

  if (address !== undefined) {
    normalizedAddress =
      address.trim() || null;
  }

  return updateFactory(
    factoryId,
    companyId,
    {
      name: normalizedName,
      address: normalizedAddress,
      status,
    }
  );
}

module.exports = {
  getFactories,
  getFactory,
  createNewFactory,
  updateExistingFactory,
};
