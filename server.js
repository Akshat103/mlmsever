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
const { setQueues: setRegistrationQueue } = require('./queues/registrationQueue');
const { setCommissionQueue } = require('./queues/commissionQueue');
const { router } = require('bull-board');
require('./queues/processCommissionQueue');
const app = express();

// Connect to database
connectDB();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Setup Bull Board for Monitoring
setRegistrationQueue();
setCommissionQueue();
app.use('/admin/queues', router);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/wishlists', wishlistRoutes);
app.use('/api/carts', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/manage-reward', rewardThresholdRoutes);
app.use('/api/rewards', rewardRoutes);

app.get('/api', (req, res) => {
    res.send('Welcome to MLM E-commerce.');
});

app.use((req, res) => {
    res.status(404).send('No service here.');
});

// Global error handling middleware
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
