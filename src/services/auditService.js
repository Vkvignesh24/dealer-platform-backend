const AuditLog = require('../models/AuditLog');

/**
 * Records a mutation for the activity trail (Profile page "Recent
 * Activity", future audit views). Never throws — logging a mistake
 * should never fail the business operation itself.
 */
async function logAction({ action, entityType, entityId, entityLabel, user }) {
  try {
    await AuditLog.create({
      action,
      entityType,
      entityId,
      entityLabel,
      performedBy: user?._id,
      performedByName: user?.name,
    });
  } catch (e) {
    console.error('logAction() failed:', e.message);
  }
}

module.exports = { logAction };
