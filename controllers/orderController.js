const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const successHandler = require('../middlewares/successHandler');
const errorHandler = require('../middlewares/errorHandler');
const { commissionQueue } = require('../queues/commissionQueue');
const mongoose = require('mongoose');

// Create an Order from Cart
const createOrder = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const cart = await Cart.findOne({ user: req.user._id })
            .populate('products.product')
            .session(session);
        if (!cart || cart.products.length === 0) {
            return res.status(400).json({ success: false, message: 'Cart is empty' });
        }

        let totalAmount = 0;
        let totalPoints = 0;

        // Calculate totalAmount and totalPoints
        for (let cartItem of cart.products) {
            const product = cartItem.product;
            if (!product || product.stock < cartItem.quantity) {
                return res.status(400).json({ 
                    success: false, 
                    message: `Product ${product.name} is not available in the requested quantity` 
                });
            }
            totalAmount += parseInt(product.price) * parseInt(cartItem.quantity);
            totalPoints += parseInt(product.points) * parseInt(cartItem.quantity);
        }

        const order = new Order({
            user: req.user._id,
            products: cart.products.map(item => ({
                product: item.product._id,
                quantity: item.quantity
            })),
            totalAmount,
            totalPoints 
        });

        // Save the order
        await order.save({ session });

        // Reduce stock for each product in the order
        for (let cartItem of cart.products) {
            const product = await Product.findById(cartItem.product._id).session(session);
            product.stock -= cartItem.quantity;
            await product.save({ session });
        }

        // Clear the cart after placing the order
        cart.products = [];
        await cart.save({ session });

        // Commit the transaction
        await session.commitTransaction();
        successHandler(res, order, 'Order created successfully');
    } catch (err) {
        await session.abortTransaction();
        errorHandler(err, req, res, next);
    } finally {
        session.endSession();
    }
};

// Get Orders for User
const getUserOrders = async (req, res, next) => {
    try {
        const orders = await Order.find({ user: req.user._id }).populate('products.product');

        if (orders.length === 0) {
            return successHandler(res, null, 'No orders till now.');
        } else {
            return successHandler(res, orders, 'Orders retrieved successfully');
        }
    } catch (err) {
        errorHandler(err, req, res, next);
    }
};

// Update Order Status
const updateOrderStatus = async (req, res, next) => {
    try {
        const { orderId, status } = req.body;

        const statusMap = {
            0: 'Pending',
            1: 'Shipped',
            2: 'Delivered',
            3: 'Cancelled'
        };

        if (!(status in statusMap)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }

        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (order.user.toString() !== req.user._id.toString() && !req.user.isAdmin) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        // Update order status
        order.status = statusMap[status];
        await order.save();

        // If the order is delivered, queue the commission job
        if (statusMap[status] === 'Delivered') {
            commissionQueue.add({
                userid: order.user,
                points: order.totalPoints
            });
        }

        successHandler(res, order, 'Order status updated successfully');
    } catch (err) {
        errorHandler(err, req, res, next);
    }
};

// Cancel Order
const cancelOrder = async (req, res, next) => {
    try {
        const { orderId } = req.body;

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        // Allow cancellation only by the user who created the order or by an admin
        if (order.user.toString() !== req.user._id.toString() && !req.user.isAdmin) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        // Only allow cancellation if the order is not already delivered or cancelled
        if (order.status === 'Delivered' || order.status === 'Cancelled') {
            return res.status(400).json({ success: false, message: `Order cannot be canceled as it is ${order.status}` });
        }

        order.status = 'Cancelled';
        await order.save();

        successHandler(res, order, 'Order canceled successfully');
    } catch (err) {
        errorHandler(err, req, res, next);
    }
};

module.exports = {
    createOrder,
    getUserOrders,
    updateOrderStatus,
    cancelOrder
}