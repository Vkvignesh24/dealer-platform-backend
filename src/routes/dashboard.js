const router = require('express').Router();
const c = require('../controllers/dashboardController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/summary', authenticate, authorize('dealer', 'admin'), c.summary);

module.exports = router;
