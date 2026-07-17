const router = require('express').Router();
const c = require('../controllers/adminAuditController');

router.get('/', c.list);
router.get('/recent', c.recent);

module.exports = router;
