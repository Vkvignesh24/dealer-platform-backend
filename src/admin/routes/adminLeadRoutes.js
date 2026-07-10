const router = require('express').Router();
const c = require('../controllers/adminLeadController');
router.get('/analytics', c.analytics);
router.get('/', c.list);
router.get('/:id', c.getOne);
router.patch('/:id', c.update);
module.exports = router;
