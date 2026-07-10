/**
 * Wraps an async Express route/controller so rejected promises are
 * forwarded to next(err) instead of crashing the process or hanging
 * the request. Used by every controller in this project:
 *
 *   exports.me = asyncHandler(async (req, res) => { ... });
 */
module.exports = function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
