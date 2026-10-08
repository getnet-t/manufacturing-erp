const {
  findRolesByCompany,
  findRoleById,
  findRoleByCode,
  createRole,
  updateRole,
} = require("../repositories/roleRepository");

/**
 * Create a new role.
 */
async function createNewRole({
  companyId,
  code,
  name,
  description,
  status = "ACTIVE",
}) {
  if (!code || !name) {
    throw new Error(
      "Role code and name are required"
    );
  }

  // Normalize role code
  const normalizedCode =
    code.trim().toUpperCase();

  // Prevent duplicate role codes
  const existingRole =
    await findRoleByCode(
      normalizedCode,
      companyId
    );

  if (existingRole) {
    throw new Error(
      "A role with this code already exists"
    );
  }

  return createRole({
    companyId,
    code: normalizedCode,
    name: name.trim(),
    description,
    status,
  });
}

/**
 * Get all roles for a company.
 */
async function getRoles(companyId) {
  return findRolesByCompany(companyId);
}

/**
 * Get one role.
 */
async function getRole(
  roleId,
  companyId
) {
  const role = await findRoleById(
    roleId,
    companyId
  );

  if (!role) {
    throw new Error("Role not found");
  }

  return role;
}

/**
 * Update a role.
 */
async function editRole(
  roleId,
  companyId,
  data
) {
  const existingRole =
    await findRoleById(
      roleId,
      companyId
    );

  if (!existingRole) {
    throw new Error("Role not found");
  }

  if (
    data.code &&
    data.code.toUpperCase() !==
      existingRole.code
  ) {
    throw new Error(
      "Role code cannot be changed"
    );
  }

  return updateRole(
    roleId,
    companyId,
    {
      name: data.name,
      description: data.description,
      status: data.status,
    }
  );
}

module.exports = {
  createNewRole,
  getRoles,
  getRole,
  editRole,
};
