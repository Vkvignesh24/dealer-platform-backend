const router = require('express').Router();
const c = require('../controllers/adminAnalyticsController');
router.get('/inventory', c.inventory);
router.get('/leads', c.leads);
router.get('/revenue', c.revenue);
router.get('/aging', c.aging);
module.exports = router;
