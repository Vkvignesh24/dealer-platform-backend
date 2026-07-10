const router = require('express').Router();
const c = require('../controllers/settingsController');
const { authenticate, authorize } = require('../middleware/auth');

// Public — customer app reads business info (logo, contact, social links).
router.get('/', c.get);

// Dealer/admin — update business profile.
router.put('/', authenticate, authorize('dealer', 'admin'), c.update);

module.exports = router;
