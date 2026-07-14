const router = require('express').Router();
const c = require('../controllers/reservationController');
const { authenticate, authorize } = require('../middleware/auth');

// Dealer/admin only. This is the ONLY endpoint allowed to move a product
// to `reserved` — see reservationController.
router.get('/', authenticate, authorize('dealer', 'admin'), c.list);
router.get('/:id', authenticate, authorize('dealer', 'admin'), c.get);
router.post('/', authenticate, authorize('dealer', 'admin'), c.create);
router.patch('/:id/release', authenticate, authorize('dealer', 'admin'), c.release);

module.exports = router;
