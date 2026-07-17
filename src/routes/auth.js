const router = require('express').Router();
const c = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { register } = require('../validators/schemas');

router.get('/me', authenticate, c.me);
router.post('/register', authenticate, validate(register), c.register);
router.put('/profile', authenticate, c.updateProfile);
router.post('/fcm-token', authenticate, c.registerFcmToken);
router.delete('/fcm-token', authenticate, c.removeFcmToken);

module.exports = router;
