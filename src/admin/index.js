const router = require('express').Router();
const { verifyAdmin } = require('./middleware/verifyAdmin');

// Every admin route is protected by the admin guard.
router.use(verifyAdmin);

router.use('/dashboard', require('./routes/adminDashboardRoutes'));
router.use('/products', require('./routes/adminProductRoutes'));
router.use('/customers', require('./routes/adminCustomerRoutes'));
router.use('/leads', require('./routes/adminLeadRoutes'));
router.use('/loans', require('./routes/adminLoanRoutes'));
router.use('/dealers', require('./routes/adminDealerRoutes'));
router.use('/analytics', require('./routes/adminAnalyticsRoutes'));
router.use('/notifications', require('./routes/adminNotificationRoutes'));

module.exports = router;
