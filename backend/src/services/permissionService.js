const {
  findAllPermissions,
  findPermissionsByCodes,
} = require("../repositories/permissionRepository");

async function getPermissions() {
  return findAllPermissions();
}

async function getPermissionsByCodes(codes) {
  if (!Array.isArray(codes) || codes.length === 0) {
    throw new Error("Permission codes are required");
  }

  const normalizedCodes = [
    ...new Set(
      codes
        .filter(Boolean)
        .map((code) => code.trim().toUpperCase())
    ),
  ];

  if (normalizedCodes.length === 0) {
    throw new Error("Permission codes are required");
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

  return permissions;
}

module.exports = {
  getPermissions,
  getPermissionsByCodes,
};
