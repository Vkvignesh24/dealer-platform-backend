const { fail } = require('../utils/respond');

function notFound(req, res) {
  fail(res, `Route not found: ${req.originalUrl}`, 404);
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Always log server-side for diagnostics, but never leak internals.
  if (process.env.NODE_ENV !== 'test') {
    console.error('[error]', err.name, err.message);
    if (err.stack && process.env.NODE_ENV !== 'production') {
      console.error(err.stack);
    }
  }

  // Mongoose validation
  if (err.name === 'ValidationError') {
    const first = Object.values(err.errors || {})[0];
    return fail(res, first?.message || 'Invalid input', 422);
  }

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    return fail(res, `Invalid ${err.path}`, 400);
  }

  // Duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return fail(res, `${field} already exists`, 409);
  }

  // Joi
  if (err.isJoi) {
    return fail(res, err.details?.[0]?.message || 'Invalid input', 422);
  }

  const status = err.status || err.statusCode || 500;
  const msg =
    status >= 500 && process.env.NODE_ENV === 'production'
      ? 'Something went wrong on our side. Please try again.'
      : err.message || 'Server error';
  fail(res, msg, status);
}

module.exports = { notFound, errorHandler };
