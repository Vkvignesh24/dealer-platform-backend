const router = require('express').Router();
const c = require('../controllers/leadController');
const { authenticate, optionalAuth, authorize } = require('../middleware/auth');

// Dealer/admin: full lead list and detail.
router.get('/', authenticate, authorize('dealer', 'admin'), c.list);
router.get('/my', authenticate, c.myLeads);
router.get('/:id', authenticate, authorize('dealer', 'admin'), c.get);

// Customer: submit an enquiry (optionalAuth so guests can still enquire).
router.post('/', optionalAuth, c.create);

// Dealer/admin: update lead status/response.
router.put('/:id', authenticate, authorize('dealer', 'admin'), c.update);

module.exports = router;
