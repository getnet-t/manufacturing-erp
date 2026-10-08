const pool = require("../config/database");

async function findAllPermissions() {
  const result = await pool.query(
    `
    SELECT
      id,
      code,
      name,
      description
    FROM permissions
    ORDER BY id;
    `
  );

  return result.rows;
}

async function findPermissionsByCodes(codes) {
  const result = await pool.query(
    `
    SELECT
      id,
      code,
      name,
      description
    FROM permissions
    WHERE code = ANY($1::text[])
    ORDER BY id;
    `,
    [codes]
  );

  return result.rows;
}

async function findPermissionsByRoleId(roleId) {
  const result = await pool.query(
    `
    SELECT
      p.id,
      p.code,
      p.name,
      p.description
    FROM permissions p
    INNER JOIN role_permissions rp
      ON rp.permission_id = p.id
    WHERE rp.role_id = $1
    ORDER BY p.id;
    `,
    [roleId]
  );

  return result.rows;
}

async function deleteRolePermissions(client, roleId) {
  await client.query(
    `
    DELETE FROM role_permissions
    WHERE role_id = $1;
    `,
    [roleId]
  );
}

async function insertRolePermission(
  client,
  roleId,
  permissionId
) {
  await client.query(
    `
    INSERT INTO role_permissions (
      role_id,
      permission_id
    )
    VALUES ($1, $2)
    ON CONFLICT DO NOTHING;
    `,
    [roleId, permissionId]
  );
}

module.exports = {
  findAllPermissions,
  findPermissionsByCodes,
  findPermissionsByRoleId,
  deleteRolePermissions,
  insertRolePermission,
};
