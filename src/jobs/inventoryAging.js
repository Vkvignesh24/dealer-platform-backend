const Product = require('../models/Product');
const { notify } = require('../services/notificationService');

const BUCKETS = [30, 60, 90];
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Finds available/reserved products that just crossed a 30/60/90-day
 * unsold threshold and haven't already been notified for that threshold,
 * then fires one aging notification each. Safe to run repeatedly — each
 * bucket only ever notifies once per product (tracked on the product
 * itself via agingNotifiedBuckets).
 */
async function checkInventoryAging() {
  const now = Date.now();
  let notified = 0;

  for (const bucket of BUCKETS) {
    const cutoff = new Date(now - bucket * DAY_MS);
    const candidates = await Product.find({
      status: { $in: ['available', 'reserved'] },
      createdAt: { $lte: cutoff },
      agingNotifiedBuckets: { $ne: bucket },
    }).select('name createdAt agingNotifiedBuckets').lean();

    for (const p of candidates) {
      await notify({
        audience: 'dealer',
        type: 'inventory_aging',
        title: 'Inventory Aging Alert',
        body: `${p.name} has been unsold for ${bucket} days`,
        entityType: 'product',
        entityId: p._id,
      });
      await Product.updateOne({ _id: p._id }, { $addToSet: { agingNotifiedBuckets: bucket } });
      notified += 1;
    }
  }

  return notified;
}

/** Runs the check once immediately, then once every 24h. Call from server.js. */
function scheduleInventoryAging() {
  checkInventoryAging().catch((e) => console.error('Inventory aging check failed:', e.message));
  setInterval(() => {
    checkInventoryAging().catch((e) => console.error('Inventory aging check failed:', e.message));
  }, 24 * 60 * 60 * 1000);
}

module.exports = { checkInventoryAging, scheduleInventoryAging };
