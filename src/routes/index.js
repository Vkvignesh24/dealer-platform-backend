const router = require('express').Router();

// Customer/dealer-facing API.
router.use('/auth', require('./auth'));
router.use('/products', require('./products'));
router.use('/leads', require('./leads'));
router.use('/loans', require('./loans'));
router.use('/wishlist', require('./wishlist'));
router.use('/settings', require('./settings'));
router.use('/upload', require('./upload'));
router.use('/customers', require('./customers'));
router.use('/dashboard', require('./dashboard'));
router.use('/sales', require('./sales'));
router.use('/reservations', require('./reservations'));
router.use('/notifications', require('./notifications'));

// Admin console API — every route inside is already protected by verifyAdmin.
router.use('/admin', require('../admin'));

module.exports = router;
