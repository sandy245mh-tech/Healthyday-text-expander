const { error } = require('../utils/response');

/**
 * Global error handling middleware.
 * Catches any error passed via next(err).
 */
const errorHandler = (err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);

  // Supabase / PostgreSQL known errors
  if (err.code === '23505') {
    return error(res, 'A record with that value already exists.', 409);
  }
  if (err.code === '42501' || err.message?.includes('violates row-level security')) {
    return error(res, 'Database permission denied (Row Level Security policy violation). Check Supabase RLS policies or use service key.', 403);
  }

  // Generic
  const statusCode = err.statusCode || 500;
  const message =
    process.env.NODE_ENV === 'development'
      ? err.message
      : 'An unexpected error occurred. Please try again.';

  return error(res, message, statusCode);
};

module.exports = { errorHandler };
