const router = require('express').Router();
const c = require('../controllers/adminDashboardController');
router.get('/', c.summary);
module.exports = router;
