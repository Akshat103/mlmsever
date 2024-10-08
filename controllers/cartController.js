const Cart = require('../models/Cart');
const Product = require('../models/Product');
const successHandler = require('../middlewares/successHandler');
const errorHandler = require('../middlewares/errorHandler');
const logger = require('../config/logger');

// Get Cart by User
const getCart = async (req, res, next) => {
    try {
        let cart = await Cart.findOne({ user: req.user._id }).populate('products.product');

        if (!cart) {
            cart = new Cart({ user: req.user._id, products: [] });
            logger.info(`Cart created for user: ${req.user._id}`);
        }

        let updated = false;

        for (let i = 0; i < cart.products.length; i++) {
            const cartItem = cart.products[i];
            const product = cartItem.product;

            if (!product || product.stock <= 0) {
                cart.products.splice(i, 1);
                i--;
                updated = true;
                logger.warn(`Product removed from cart due to insufficient stock: ${cartItem.product}`);
            } else if (cartItem.quantity > product.stock) {
                cartItem.quantity = product.stock;
                updated = true;
                logger.warn(`Product quantity updated due to insufficient stock: ${product.name}`);
            }
        }

        if (updated) {
            await cart.save();
            logger.info(`Cart updated for user: ${req.user._id}`);
        }

        successHandler(res, cart, updated ? 'Cart updated due to stock changes' : 'Cart retrieved successfully');
    } catch (err) {
        logger.error(`Error retrieving cart for user ${req.user._id}: ${err.message}`);
        errorHandler(err, req, res, next);
    }
};

// Add Product to Cart
const addProductToCart = async (req, res, next) => {
    const { productId, quantity } = req.body;
    try {
        let cart = await Cart.findOne({ user: req.user._id });
        const product = await Product.findById(productId);

        if (!product || product.stock < quantity) {
            logger.warn(`Add product attempt failed: Invalid product or insufficient stock for productId: ${productId}`);
            return res.status(400).json({ message: 'Invalid product or insufficient stock' });
        }

        if (!cart) {
            cart = new Cart({ user: req.user._id, products: [] });
            logger.info(`Cart created for user: ${req.user._id}`);
        }

        const productInCart = cart.products.find(p => p.product.equals(productId));

        if (productInCart) {
            productInCart.quantity = quantity;
            logger.info(`Product quantity updated in cart: ${product.name}`);
        } else {
            cart.products.push({ product: productId, quantity });
            logger.info(`Product added to cart: ${product.name}`);
        }

        await cart.save();
        successHandler(res, null, 'Product added to cart');
    } catch (err) {
        logger.error(`Error adding product to cart for user ${req.user._id}: ${err.message}`);
        errorHandler(err, req, res, next);
    }
};

// Remove Product from Cart
const removeProductFromCart = async (req, res, next) => {
    const { productId } = req.body;
    try {
        let cart = await Cart.findOne({ user: req.user._id });

        if (!cart) {
            logger.warn(`Remove product attempt failed: Cart not found for user: ${req.user._id}`);
            return res.status(404).json({ message: 'Cart not found' });
        }

        cart.products = cart.products.filter(p => !p.product.equals(productId));
        await cart.save();
        logger.info(`Product removed from cart: ${productId} for user: ${req.user._id}`);
        successHandler(res, cart, 'Product removed from cart');
    } catch (err) {
        logger.error(`Error removing product from cart for user ${req.user._id}: ${err.message}`);
        errorHandler(err, req, res, next);
    }
};

// Clear Cart
const clearCart = async (req, res, next) => {
    try {
        let cart = await Cart.findOne({ user: req.user._id });

        if (!cart) {
            logger.warn(`Clear cart attempt failed: Cart not found for user: ${req.user._id}`);
            return res.status(404).json({ message: 'Cart not found' });
        }

        cart.products = [];
        await cart.save();
        logger.info(`Cart cleared for user: ${req.user._id}`);
        successHandler(res, cart, 'Cart cleared successfully');
    } catch (err) {
        logger.error(`Error clearing cart for user ${req.user._id}: ${err.message}`);
        errorHandler(err, req, res, next);
    }
};

module.exports = {
    getCart,
    addProductToCart,
    removeProductFromCart,
    clearCart
};
