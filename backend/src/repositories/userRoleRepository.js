const pool = require("../config/database");

async function findRolesByUserId(userId) {
  const result = await pool.query(
    `
    SELECT
      r.id,
      r.company_id,
      r.code,
      r.name,
      r.description,
      r.status,
      r.created_at,
      r.updated_at
    FROM roles r
    INNER JOIN user_roles ur
      ON ur.role_id = r.id
    WHERE ur.user_id = $1
      AND r.status = 'ACTIVE'
    ORDER BY r.id;
    `,
    [userId]
  );

  return result.rows;
}

async function deleteUserRoles(
  client,
  userId
) {
  await client.query(
    `
    DELETE FROM user_roles
    WHERE user_id = $1;
    `,
    [userId]
  );
}

async function insertUserRole(
  client,
  userId,
  roleId
) {
  await client.query(
    `
    INSERT INTO user_roles (
      user_id,
      role_id
    )
    VALUES ($1, $2)
    ON CONFLICT DO NOTHING;
    `,
    [userId, roleId]
  );
}

module.exports = {
  findRolesByUserId,
  deleteUserRoles,
  insertUserRole,
};