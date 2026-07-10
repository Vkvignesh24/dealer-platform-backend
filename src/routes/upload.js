const router = require('express').Router();
const c = require('../controllers/uploadController');
const upload = require('../middleware/upload');
const { authenticate, authorize } = require('../middleware/auth');

// Dealer/admin: upload product images/videos to Cloudinary.
router.post('/', authenticate, authorize('dealer', 'admin'), upload.array('files', 10), c.upload);

module.exports = router;
