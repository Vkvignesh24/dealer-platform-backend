const router = require('express').Router();
const c = require('../controllers/saleController');
const { authenticate, authorize } = require('../middleware/auth');

// Customer: their own purchase history.
router.get('/mine', authenticate, c.mine);

// Dealer/admin: sales lifecycle. This is the ONLY endpoint allowed to move
// a product to `sold` — see saleController for the cascade of updates.
router.get('/', authenticate, authorize('dealer', 'admin'), c.list);
router.get('/:id', authenticate, authorize('dealer', 'admin'), c.get);
router.post('/', authenticate, authorize('dealer', 'admin'), c.create);
router.patch('/:id/reverse', authenticate, authorize('dealer', 'admin'), c.reverse);

module.exports = router;
