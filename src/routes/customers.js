const router = require('express').Router();
const c = require('../controllers/customerController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, authorize('dealer', 'admin'), c.list);

module.exports = router;
