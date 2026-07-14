const router = require('express').Router();
const c = require('../controllers/productController');
const { authenticate, optionalAuth, authorize } = require('../middleware/auth');

// Public/browse endpoints — optionalAuth lets dealers/admins see sold
// inventory and extra fields; customers/anonymous visitors never see sold.
router.get('/', optionalAuth, c.list);
router.get('/featured', optionalAuth, c.featured);
router.get('/recent', optionalAuth, c.recent);
router.get('/recommended', optionalAuth, c.recommended);
router.get('/categories', optionalAuth, c.categories);
router.get('/:id', optionalAuth, c.get);

// Dealer/admin management.
router.post('/', authenticate, authorize('dealer', 'admin'), c.create);
router.put('/:id', authenticate, authorize('dealer', 'admin'), c.update);
router.patch('/:id/status', authenticate, authorize('dealer', 'admin'), c.updateStatus);
router.delete('/:id', authenticate, authorize('dealer', 'admin'), c.remove);

module.exports = router;
