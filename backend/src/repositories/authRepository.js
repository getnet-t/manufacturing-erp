const pool = require("../config/database");

/**
 * Find a user by email.
 *
 * Used during login.
 */
async function findUserByEmail(email) {
  const result = await pool.query(
    `
    SELECT
      id,
      company_id,
      name,
      email,
      password_hash,
      status,
      last_login_at,
      created_at,
      updated_at
    FROM users
    WHERE LOWER(email) = LOWER($1)
    LIMIT 1;
    `,
    [email]
  );

  return result.rows[0] || null;
}

/**
 * Find a user by ID with their roles and permissions.
 *
 * Used after authentication and for authorization.
 */
async function findUserWithRolesAndPermissions(userId) {
  const result = await pool.query(
    `
    SELECT
      u.id,
      u.company_id,
      u.name,
      u.email,
      u.status,
      u.last_login_at,

      COALESCE(
        jsonb_agg(
          DISTINCT jsonb_build_object(
            'id', r.id,
            'code', r.code,
            'name', r.name,
            'permissions',
              COALESCE(
                (
                  SELECT jsonb_agg(
                    DISTINCT jsonb_build_object(
                      'id', p.id,
                      'code', p.code,
                      'name', p.name
                    )
                  )
                  FROM role_permissions rp2
                  INNER JOIN permissions p
                    ON p.id = rp2.permission_id
                  WHERE rp2.role_id = r.id
                ),
                '[]'::jsonb
              )
          )
        ) FILTER (WHERE r.id IS NOT NULL),
        '[]'::jsonb
      ) AS roles

    FROM users u

    LEFT JOIN user_roles ur
      ON ur.user_id = u.id

    LEFT JOIN roles r
      ON r.id = ur.role_id
      AND r.company_id = u.company_id
      AND r.status = 'ACTIVE'

    WHERE u.id = $1

    GROUP BY
      u.id,
      u.company_id,
      u.name,
      u.email,
      u.status,
      u.last_login_at;
    `,
    [userId]
  );

  return result.rows[0] || null;
}

/**
 * Update the user's last login time.
 */
async function updateLastLogin(userId) {
  const result = await pool.query(
    `
    UPDATE users
    SET
      last_login_at = NOW(),
      updated_at = NOW()
    WHERE id = $1
    RETURNING
      id,
      last_login_at;
    `,
    [userId]
  );

  return result.rows[0] || null;
}

module.exports = {
  findUserByEmail,
  findUserWithRolesAndPermissions,
  updateLastLogin,
};
