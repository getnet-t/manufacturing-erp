const { withTransaction } = require("../utils/transaction");
const { hashPassword } = require("../utils/password");

/**
 * Creates the first company, ADMIN role,
 * permissions, and administrator user.
 *
 * This should normally be run only once
 * when setting up a new ERP installation.
 */
async function bootstrapSystem({
  companyCode,
  companyName,
  adminName,
  adminEmail,
  adminPassword,
}) {
  return withTransaction(async (client) => {
    // ==========================================
    // 1. Check whether the system is already
    //    initialized
    // ==========================================

    const existingCompany = await client.query(
      `
      SELECT id
      FROM companies
      LIMIT 1;
      `
    );

    if (existingCompany.rows.length > 0) {
      throw new Error(
        "System is already initialized. Bootstrap cannot run again."
      );
    }

    // ==========================================
    // 2. Create company
    // ==========================================

    const companyResult = await client.query(
      `
      INSERT INTO companies (
        code,
        name,
        base_currency,
        status
      )
      VALUES ($1, $2, 'ETB', 'ACTIVE')
      RETURNING
        id,
        code,
        name,
        base_currency,
        status;
      `,
      [companyCode, companyName]
    );

    const company = companyResult.rows[0];

    // ==========================================
    // 3. Create system permissions
    // ==========================================

    const permissions = [
      {
        code: "USER.CREATE",
        name: "Create Users",
        description: "Create system users",
      },
      {
        code: "USER.READ",
        name: "View Users",
        description: "View system users",
      },
      {
        code: "USER.UPDATE",
        name: "Update Users",
        description: "Update system users",
      },
      {
        code: "USER.DISABLE",
        name: "Disable Users",
        description: "Disable system users",
      },
      {
        code: "ROLE.CREATE",
        name: "Create Roles",
        description: "Create system roles",
      },
      {
        code: "ROLE.READ",
        name: "View Roles",
        description: "View system roles",
      },
      {
        code: "ROLE.UPDATE",
        name: "Update Roles",
        description: "Update system roles",
      },
      {
        code: "ROLE.DELETE",
        name: "Delete Roles",
        description: "Delete system roles",
      },
      {
        code: "SYSTEM.SETTINGS",
        name: "Manage System Settings",
        description: "Manage system settings",
      },
      {
        code: "AUDIT.READ",
        name: "View Audit Logs",
        description: "View system audit logs",
      },
    ];

    const permissionIds = [];

    for (const permission of permissions) {
      const result = await client.query(
        `
        INSERT INTO permissions (
          code,
          name,
          description
        )
        VALUES ($1, $2, $3)
        RETURNING id;
        `,
        [
          permission.code,
          permission.name,
          permission.description,
        ]
      );

      permissionIds.push(result.rows[0].id);
    }

    // ==========================================
    // 4. Create ADMIN role
    // ==========================================

    const roleResult = await client.query(
      `
      INSERT INTO roles (
        company_id,
        code,
        name,
        description,
        status
      )
      VALUES (
        $1,
        'ADMIN',
        'Administrator',
        'Full system administrator',
        'ACTIVE'
      )
      RETURNING
        id,
        company_id,
        code,
        name,
        status;
      `,
      [company.id]
    );

    const adminRole = roleResult.rows[0];

    // ==========================================
    // 5. Assign permissions to ADMIN role
    // ==========================================

    for (const permissionId of permissionIds) {
      await client.query(
        `
        INSERT INTO role_permissions (
          role_id,
          permission_id
        )
        VALUES ($1, $2);
        `,
        [adminRole.id, permissionId]
      );
    }

    // ==========================================
    // 6. Hash administrator password
    // ==========================================

    const passwordHash = await hashPassword(
      adminPassword
    );

    // ==========================================
    // 7. Create first administrator
    // ==========================================

    const userResult = await client.query(
      `
      INSERT INTO users (
        company_id,
        name,
        email,
        password_hash,
        status
      )
      VALUES (
        $1,
        $2,
        LOWER($3),
        $4,
        'ACTIVE'
      )
      RETURNING
        id,
        company_id,
        name,
        email,
        status;
      `,
      [
        company.id,
        adminName,
        adminEmail,
        passwordHash,
      ]
    );

    const adminUser = userResult.rows[0];

    // ==========================================
    // 8. Assign ADMIN role to administrator
    // ==========================================

    await client.query(
      `
      INSERT INTO user_roles (
        user_id,
        role_id
      )
      VALUES ($1, $2);
      `,
      [adminUser.id, adminRole.id]
    );

    // ==========================================
    // 9. Return bootstrap result
    // ==========================================

    return {
      company,
      role: adminRole,
      user: adminUser,
      permissionsCreated: permissionIds.length,
    };
  });
}

module.exports = {
  bootstrapSystem,
};
