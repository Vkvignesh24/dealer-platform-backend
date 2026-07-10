/**
 * Standard API response helpers.
 * Every controller in this project calls ok()/fail() instead of res.json()
 * directly, so the response envelope stays consistent across all endpoints.
 *
 *   ok(res, data, message = 'OK', status = 200)
 *   fail(res, message = 'Something went wrong', status = 400)
 */

function ok(res, data = null, message = 'OK', status = 200) {
  return res.status(status).json({
    success: true,
    message,
    data,
  });
}

function fail(res, message = 'Something went wrong', status = 400) {
  return res.status(status).json({
    success: false,
    message: typeof message === 'string' ? message : message?.message || 'Something went wrong',
  });
}

module.exports = { ok, fail };
