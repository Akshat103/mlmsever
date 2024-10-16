const express = require('express');
const router = express.Router();
const authenticate = require('../middlewares/authMiddleware');
const orderController = require('../controllers/orderController');
const isAdmin = require('../middlewares/isAdmin');

// Create Order from Carts
router.post('/create', authenticate, orderController.createOrder);

// Get User's Orders
router.get('/', authenticate, orderController.getUserOrders);

// Update Order Status
router.put('/update-status', authenticate, isAdmin, orderController.updateOrderStatus);

// Cancel Order
router.post('/cancel', authenticate, orderController.cancelOrder);

// Get All Order
router.get('/get-all', authenticate, isAdmin, orderController.getAllOrders);

module.exports = router;
