const Notification = require('../models/Notification');
const User = require('../models/User');
const { admin, initFirebase } = require('../config/firebase');

/**
 * Resolves which users should receive a push for a given audience/target,
 * mirroring the same visibility rules used by GET /notifications (see
 * notificationController.audienceQuery). Only users with a saved fcmToken
 * are relevant here — everyone else still gets the in-app record.
 */
async function resolveRecipients({ audience, target }) {
  if (target) {
    const u = await User.findById(target).select('fcmToken').lean();
    return u?.fcmToken ? [u.fcmToken] : [];
  }
  const roleFilter = audience === 'customer' ? ['customer'] : audience === 'dealer' ? ['dealer', 'admin'] : ['dealer', 'admin', 'customer'];
  const users = await User.find({ role: { $in: roleFilter }, fcmToken: { $ne: null } }).select('fcmToken').lean();
  return users.map((u) => u.fcmToken).filter(Boolean);
}

/**
 * Best-effort push — never throws. If Firebase isn't configured, or a
 * token is stale, we log and move on; the in-app notification (the
 * source of truth) has already been saved by the caller.
 */
async function sendPush(tokens, { title, body, data = {} }) {
  if (!tokens.length) return;
  let fcm;
  try {
    fcm = initFirebase();
  } catch (e) {
    console.warn('Push skipped — Firebase not configured:', e.message);
    return;
  }
  try {
    await fcm.messaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
    });
  } catch (e) {
    console.warn('Push notification failed:', e.message);
  }
}

/**
 * Creates an in-app notification and fires a best-effort FCM push.
 * Never throws — a failed notification should never fail the business
 * operation that triggered it (e.g. a lead being created).
 *
 * @param {object} opts
 * @param {'global'|'dealer'|'customer'} opts.audience
 * @param {string} [opts.target] - specific user id; overrides audience-wide fan-out
 * @param {string} opts.type - one of Notification.TYPES
 * @param {string} opts.title
 * @param {string} opts.body
 * @param {string} [opts.entityType] - 'product' | 'lead' | 'loan' | 'sale' | 'customer'
 * @param {string} [opts.entityId]
 * @param {string} [opts.createdBy]
 */
async function notify(opts) {
  const { audience = 'global', target, type = 'general', title, body, entityType, entityId, createdBy } = opts;
  try {
    const notification = await Notification.create({
      audience, target: target || undefined, type, title, body,
      entityType: entityType || null, entityId: entityId || null, createdBy,
    });
    const tokens = await resolveRecipients({ audience, target });
    await sendPush(tokens, { title, body, data: { type, entityType: entityType || '', entityId: entityId ? String(entityId) : '' } });
    return notification;
  } catch (e) {
    console.error('notify() failed:', e.message);
    return null;
  }
}

module.exports = { notify };
