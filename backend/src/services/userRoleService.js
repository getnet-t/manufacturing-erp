const {
  findUserById,
} = require("../repositories/userRepository");

const {
  findRolesByUserId,
  deleteUserRoles,
  insertUserRole,
} = require("../repositories/userRoleRepository");

const {
  findRoleById,
} = require("../repositories/roleRepository");

const {
  withTransaction,
} = require("../utils/transaction");

async function getUserRoles(userId, companyId) {
  const user = await findUserById(userId, companyId);

  if (!user) {
    throw new Error("User not found");
  }

  return findRolesByUserId(userId);
}

async function assignRolesToUser({
  userId,
  companyId,
  roleIds,
}) {
  if (!Array.isArray(roleIds)) {
    throw new Error("Role IDs must be an array");
  }

  const normalizedRoleIds = [
    ...new Set(
      roleIds
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id))
    ),
  ];

  const user = await findUserById(
    userId,
    companyId
  );

  if (!user) {
    throw new Error("User not found");
  }

  for (const roleId of normalizedRoleIds) {
    const role = await findRoleById(
      roleId,
      companyId
    );

    if (!role) {
      throw new Error(
        `Role ${roleId} not found`
      );
    }

    if (role.status !== "ACTIVE") {
      throw new Error(
        `Role ${role.code} is not active`
      );
    }
  }

  await withTransaction(async (client) => {
    await deleteUserRoles(
      client,
      userId
    );

    for (const roleId of normalizedRoleIds) {
      await insertUserRole(
        client,
        userId,
        roleId
      );
    }
  });

  return findRolesByUserId(userId);
}

module.exports = {
  getUserRoles,
  assignRolesToUser,
};
