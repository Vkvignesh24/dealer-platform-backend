const router = require('express').Router();
const c = require('../controllers/notificationController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, c.list);
router.get('/unread-count', authenticate, c.unreadCount);
router.patch('/:id/read', authenticate, c.markRead);
router.patch('/read-all', authenticate, c.markAllRead);

module.exports = router;
