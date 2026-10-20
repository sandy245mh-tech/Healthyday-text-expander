const { error } = require('../utils/response');

/**
 * Middleware: extracts user identity from custom headers instead of JWT.
 * Attaches `req.user` with { name, role }.
 */
const requireAuth = (req, res, next) => {
  const userName = req.headers['x-user-name'];
  const userRole = req.headers['x-user-role'];

  if (!userName || !userRole) {
    return error(res, 'User identity headers missing (x-user-name, x-user-role)', 401);
  }

  req.user = {
    name: userName,
    role: userRole,
  };
  
  next();
};

/**
 * Middleware: require the user to have the ADMIN role.
 * Must be used AFTER requireAuth.
 */
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    return error(res, 'Admin access required', 403);
  }
  next();
};

module.exports = { requireAuth, requireAdmin };
