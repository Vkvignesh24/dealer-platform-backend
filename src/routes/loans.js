const router = require('express').Router();
const c = require('../controllers/loanController');
const { authenticate, optionalAuth, authorize } = require('../middleware/auth');

// Dealer/admin: full loan request list and detail.
router.get('/', authenticate, authorize('dealer', 'admin'), c.list);
router.get('/mine', authenticate, c.mine);
router.get('/:id', authenticate, authorize('dealer', 'admin'), c.get);

// Customer: submit a loan request.
router.post('/', optionalAuth, c.create);

// Dealer/admin: approve/reject/update status.
router.patch('/:id/status', authenticate, authorize('dealer', 'admin'), c.updateStatus);

module.exports = router;
