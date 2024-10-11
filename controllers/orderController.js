const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const successHandler = require('../middlewares/successHandler');
const errorHandler = require('../middlewares/errorHandler');
const { commissionQueue } = require('../queues/commissionQueue');
const mongoose = require('mongoose');
const logger = require('../config/logger');
const User = require('../models/User');
const { registrationQueue } = require('../queues/processRegistrationQueue');

// Create an Order from Cart
const createOrder = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const cart = await Cart.findOne({ user: req.user._id })
            .populate('products.product')
            .session(session);
        if (!cart || cart.products.length === 0) {
            logger.warn(`User ${req.user._id} attempted to create an order with an empty cart`);
            return res.status(400).json({ success: false, message: 'Cart is empty' });
        }

        let totalAmount = 0;
        let totalPoints = 0;

        // Calculate totalAmount and totalPoints
        for (let cartItem of cart.products) {
            const product = cartItem.product;
            if (!product || product.stock < cartItem.quantity) {
                logger.warn(`Insufficient stock for product ${product.name} for user ${req.user._id}`);
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
        logger.info(`Order created: ${order._id} for user ${req.user._id}`);

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
        logger.error(`Error creating order for user ${req.user._id}: ${err.message}`);
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
            logger.info(`No orders found for user ${req.user._id}`);
            return successHandler(res, null, 'No orders till now.');
        } else {
            logger.info(`Retrieved ${orders.length} orders for user ${req.user._id}`);
            return successHandler(res, orders, 'Orders retrieved successfully');
        }
    } catch (err) {
        logger.error(`Error retrieving orders for user ${req.user._id}: ${err.message}`);
        errorHandler(err, req, res, next);
    }
};

async function checkActivationProduct(order) {
    for (const item of order.products) {
        const product = await Product.findById(item.product);

        if (product.activationProduct) {
            return true;
        }
    }

    return false;
}

// Update Order Status
const updateOrderStatus = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { orderId, status } = req.body;
        const statusMap = {
            0: 'Pending',
            1: 'Shipped',
            2: 'Delivered',
            3: 'Cancelled'
        };

        if (!(status in statusMap)) {
            logger.warn(`Invalid status update attempt for order ${orderId} by user ${req.user._id}`);
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }

        const order = await Order.findById(orderId).populate('products').session(session);
        if (!order) {
            logger.warn(`Order ${orderId} not found for user ${req.user._id}`);
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (order.user.toString() !== req.user._id.toString() && !req.user.isAdmin) {
            logger.warn(`Unauthorized status update attempt for order ${orderId} by user ${req.user._id}`);
            await session.abortTransaction();
            session.endSession();
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        // Update order status
        order.status = statusMap[status];
        await order.save({ session });
        logger.info(`Order ${orderId} status updated to ${order.status} by user ${req.user._id}`);

        // If the order is delivered, check for activation conditions
        if (order.status === 'Delivered') {
            const activationProductExists = await checkActivationProduct(order);
            const user = await User.findById(order.user).session(session);

            if (!user) {
                logger.error(`User not found for ID: ${user.userid}`);
                throw new Error('User not found');
            }

            if (activationProductExists && !user.isActive) {
                if (user.referredBy) {
                    const job = await registrationQueue.add({
                        parentId: user.referredBy,
                        userId: user.userId,
                    });

                    try {
                        const registrationResult = await job.finished();
                        logger.info(`User created successfully: ${user.userId}`);

                        // Start the commission job only after the registration job is completed
                        await commissionQueue.add({
                            user: user,
                            points: order.totalPoints,
                        });

                        // Commit the transaction after all operations are complete
                        await session.commitTransaction();
                        session.endSession();

                        return successHandler(res, { registrationResult, order }, 'Order status updated successfully')
                    } catch (error) {
                        logger.error(`Error processing registration for userId ${user.userId}: ${error.message}`);

                        // Only abort if the transaction hasn't been committed
                        if (session.inTransaction()) {
                            await session.abortTransaction();
                        }
                        session.endSession();

                        return res.status(500).json({
                            success: false,
                            error: "An error occurred while processing your registration: " + error.message,
                        });
                    }
                } else {
                    user.isActive = true;
                    await user.save({ session });
                    await session.commitTransaction();
                    session.endSession();

                    // Queue the commission job
                    await commissionQueue.add({
                        user: user,
                        points: order.totalPoints
                    });


                    logger.info(`User ${req.user._id} activated due to activation product purchase.`);
                    return successHandler(res, order, 'Order status updated successfully');
                }
            } else {
                // If no registration is needed, just commit the transaction for commission job
                await commissionQueue.add({
                    user: user,
                    points: order.totalPoints
                });

                await session.commitTransaction();
                session.endSession();

                return successHandler(res, order, 'Order status updated successfully');
            }
        }

        await session.commitTransaction();
        session.endSession();
        return successHandler(res, order, 'Order status updated successfully');
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        logger.error(`Error updating order status for order ${req.body.orderId}: ${err.message}`);
        return errorHandler(err, req, res, next);
    }
};

// Cancel Order
const cancelOrder = async (req, res, next) => {
    try {
        const { orderId } = req.body;

        const order = await Order.findById(orderId);
        if (!order) {
            logger.warn(`Order ${orderId} not found for user ${req.user._id}`);
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        // Allow cancellation only by the user who created the order or by an admin
        if (order.user.toString() !== req.user._id.toString() && !req.user.isAdmin) {
            logger.warn(`Unauthorized cancellation attempt for order ${orderId} by user ${req.user._id}`);
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        // Only allow cancellation if the order is not already delivered or cancelled
        if (order.status === 'Delivered' || order.status === 'Cancelled') {
            logger.warn(`Cancellation attempt for order ${orderId} failed: Order is already ${order.status}`);
            return res.status(400).json({ success: false, message: `Order cannot be canceled as it is ${order.status}` });
        }

        order.status = 'Cancelled';
        await order.save();
        logger.info(`Order ${orderId} canceled by user ${req.user._id}`);

        successHandler(res, order, 'Order canceled successfully');
    } catch (err) {
        logger.error(`Error canceling order ${req.body.orderId}: ${err.message}`);
        errorHandler(err, req, res, next);
    }
};

module.exports = {
    createOrder,
    getUserOrders,
    updateOrderStatus,
    cancelOrder
};
