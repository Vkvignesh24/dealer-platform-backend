const { initFirebase } = require('../config/firebase');
const User = require('../models/User');
const { fail } = require('../utils/respond');

async function resolveUser(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return { token: null };

  const admin = initFirebase();
  if (!admin) throw Object.assign(new Error('Auth not configured'), { status: 500 });

  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(token);
  } catch (e) {
    const code = (e && e.code) || '';
    const msg = code.includes('expired')
      ? 'Session expired. Please sign in again.'
      : 'Invalid session. Please sign in again.';
    throw Object.assign(new Error(msg), { status: 401 });
  }

  let user = await User.findOne({ firebaseUid: decoded.uid });
  if (!user) {
    user = await User.create({
      firebaseUid: decoded.uid,
      email: (decoded.email || `${decoded.uid}@unknown.local`).toLowerCase(),
      name: decoded.name || decoded.email || 'User',
      role: 'customer',
    });
  }
  if (user.active === false) {
    throw Object.assign(new Error('This account has been disabled.'), { status: 403 });
  }
  return { token, user, decoded };
}

/** Hard auth — request fails without a valid token. */
async function authenticate(req, res, next) {
  try {
    const { token, user, decoded } = await resolveUser(req);
    if (!token) return fail(res, 'Please sign in to continue.', 401);
    req.user = user;
    req.firebase = decoded;
    next();
  } catch (e) {
    return fail(res, e.message, e.status || 500);
  }
}

/** Soft auth — attaches req.user when a valid token is present, else continues. */
async function optionalAuth(req, res, next) {
  try {
    const { token, user, decoded } = await resolveUser(req);
    if (token) {
      req.user = user;
      req.firebase = decoded;
    }
  } catch (_) {
    // Ignore — treat as anonymous.
  }
  next();
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return fail(res, 'Please sign in to continue.', 401);
    if (!roles.includes(req.user.role)) {
      return fail(res, "You don't have permission for this action.", 403);
    }
    next();
  };
}

module.exports = { authenticate, optionalAuth, authorize };
