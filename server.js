const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const connectDB = require('./config/db');
const errorHandler = require('./middlewares/errorHandler');
const upload = require('./config/multer');
const path = require('path');
const userRoutes = require('./routes/userRoutes');
const productRoutes = require('./routes/productRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');
const cartRoutes = require('./routes/cartRoutes');
const orderRoutes = require('./routes/orderRoutes');
const rewardThresholdRoutes = require('./routes/rewardThresholdRoutes');
const rewardRoutes = require('./routes/rewardRoutes');
const adminRoutes = require('./routes/adminRoutes');
const bankDetailsRoutes = require('./routes/bankDetailsRoutes');
const { setQueues: setRegistrationQueue } = require('./queues/registrationQueue');
const { setCommissionQueue } = require('./queues/commissionQueue');
const { router } = require('bull-board');
require('./queues/processCommissionQueue');
require('./jobs/GlobalPointPoolJob');
const logger = require('./config/logger');

const app = express();

// Connect to database
connectDB();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(errorHandler);

// Log incoming requests
app.use((req, res, next) => {
    logger.info(`Incoming Request: ${req.method} ${req.originalUrl}`);
    next();
});

// Setup Bull Board for Monitoring
setRegistrationQueue();
setCommissionQueue();
app.use('/admin/queues', router);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/wishlists', wishlistRoutes);
app.use('/api/carts', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/manage-reward', rewardThresholdRoutes);
app.use('/api/rewards', rewardRoutes);
app.use('/api/admins', adminRoutes);
app.use('/api/bank-details', bankDetailsRoutes);

app.get('/api', (req, res) => {
    res.send('Welcome to MLM E-commerce.');
});

// 404 handler
app.use((req, res) => {
    logger.warn(`404 Not Found: ${req.method} ${req.originalUrl}`);
    res.status(404).send('No service here.');
});

// Global error handling middleware
app.use((err, req, res, next) => {
    logger.error(`Error: ${err.message}`);
    res.status(500).send('Server Error');
    next(err);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
});
