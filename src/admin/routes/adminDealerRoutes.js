const router = require('express').Router();
const c = require('../controllers/adminDealerController');
router.get('/', c.list);
router.get('/:id', c.getOne);
module.exports = router;
