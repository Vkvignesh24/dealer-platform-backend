const { authenticate, authorize } = require('../../middleware/auth');

// Reuses the existing Firebase auth pipeline, then enforces the admin role.
// authenticate -> resolves req.user from the Firebase token (unchanged logic)
// authorize('admin') -> rejects non-admins
const verifyAdmin = [authenticate, authorize('admin')];

module.exports = { verifyAdmin };
