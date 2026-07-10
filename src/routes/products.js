const router = require('express').Router();
const c = require('../controllers/productController');
const { authenticate, optionalAuth, authorize } = require('../middleware/auth');

// Public/browse endpoints — optionalAuth lets dealers/admins see extra fields on get().
router.get('/', c.list);
router.get('/featured', c.featured);
router.get('/recent', c.recent);
router.get('/recommended', c.recommended);
router.get('/categories', c.categories);
router.get('/:id', optionalAuth, c.get);

// Dealer/admin management.
router.post('/', authenticate, authorize('dealer', 'admin'), c.create);
router.put('/:id', authenticate, authorize('dealer', 'admin'), c.update);
router.patch('/:id/status', authenticate, authorize('dealer', 'admin'), c.updateStatus);
router.delete('/:id', authenticate, authorize('dealer', 'admin'), c.remove);

module.exports = router;
