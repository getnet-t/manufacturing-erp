/**
 * Authorization middleware.
 *
 * Allows access when the authenticated user has
 * at least one of the required permissions.
 */
function authorize(...requiredPermissions) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const userPermissions = new Set();

    for (const role of req.user.roles || []) {
      for (const permission of role.permissions || []) {
        if (permission.code) {
          userPermissions.add(permission.code);
        }
      }
    }

    const hasPermission = requiredPermissions.some(
      (permission) => userPermissions.has(permission)
    );

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to perform this action",
      });
    }

    next();
  };
}

module.exports = {
  authorize,
};
