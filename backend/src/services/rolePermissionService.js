const {
  findRoleById,
} = require("../repositories/roleRepository");

const {
  findPermissionsByCodes,
  findPermissionsByRoleId,
  deleteRolePermissions,
  insertRolePermission,
} = require("../repositories/permissionRepository");

const {
  withTransaction,
} = require("../utils/transaction");

async function getRolePermissions(
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

  return findPermissionsByRoleId(roleId);
}

async function assignPermissionsToRole({
  roleId,
  companyId,
  permissionCodes,
}) {
  if (
    !Array.isArray(permissionCodes)
  ) {
    throw new Error(
      "Permission codes must be an array"
    );
  }

  const normalizedCodes = [
    ...new Set(
      permissionCodes
        .filter(Boolean)
        .map((code) =>
          code.trim().toUpperCase()
        )
    ),
  ];

  const role = await findRoleById(
    roleId,
    companyId
  );

  if (!role) {
    throw new Error("Role not found");
  }

  const permissions =
    await findPermissionsByCodes(
      normalizedCodes
    );

  if (
    permissions.length !==
    normalizedCodes.length
  ) {
    const foundCodes = new Set(
      permissions.map(
        (permission) => permission.code
      )
    );

    const missingCodes =
      normalizedCodes.filter(
        (code) => !foundCodes.has(code)
      );

    const error = new Error(
      "One or more permissions do not exist"
    );

    error.missingCodes = missingCodes;

    throw error;
  }

  await withTransaction(
    async (client) => {
      await deleteRolePermissions(
        client,
        roleId
      );

      for (const permission of permissions) {
        await insertRolePermission(
          client,
          roleId,
          permission.id
        );
      }
    }
  );

  return findPermissionsByRoleId(
    roleId
  );
}

module.exports = {
  getRolePermissions,
  assignPermissionsToRole,
};