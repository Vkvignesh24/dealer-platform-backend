const router = require('express').Router();
const c = require('../controllers/adminLoanController');
router.get('/analytics', c.analytics);
router.get('/', c.list);
router.get('/:id', c.getOne);
router.patch('/:id', c.update);
router.post('/:id/documents', c.addDocument);
router.delete('/:id/documents/:docId', c.removeDocument);
module.exports = router;
