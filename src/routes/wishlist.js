const router = require('express').Router();
const c = require('../controllers/wishlistController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, c.list);
router.post('/', authenticate, c.add);
router.delete('/:id', authenticate, c.remove);

module.exports = router;
