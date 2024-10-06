const Cart = require('../models/Cart');
const Product = require('../models/Product');
const successHandler = require('../middlewares/successHandler');
const errorHandler = require('../middlewares/errorHandler');

// Get Cart by User
const getCart = async (req, res, next) => {
    try {
        let cart = await Cart.findOne({ user: req.user._id }).populate('products.product');

        if (!cart) {
            cart = new Cart({ user: req.user._id, products: [] });
        }

        let updated = false;

        for (let i = 0; i < cart.products.length; i++) {
            const cartItem = cart.products[i];
            const product = cartItem.product;

            if (!product || product.stock <= 0) {
                cart.products.splice(i, 1);
                i--;
                updated = true;
            } else if (cartItem.quantity > product.stock) {
                cartItem.quantity = product.stock;
                updated = true;
            }
        }

        if (updated) {
            await cart.save();
        }

        successHandler(res, cart, updated ? 'Cart updated due to stock changes' : 'Cart retrieved successfully');
    } catch (err) {
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
            return res.status(400).json({ message: 'Invalid product or insufficient stock' });
        }

        if (!cart) {
            cart = new Cart({ user: req.user._id, products: [] });
        }

        const productInCart = cart.products.find(p => p.product.equals(productId));

        if (productInCart) {
            productInCart.quantity = quantity;
        } else {
            cart.products.push({ product: productId, quantity });
        }

        await cart.save();
        successHandler(res, null, 'Product added to cart');
    } catch (err) {
        errorHandler(err, req, res, next);
    }
};

// Remove Product from Cart
const removeProductFromCart = async (req, res, next) => {
    const { productId } = req.body;
    try {
        let cart = await Cart.findOne({ user: req.user._id });

        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' });
        }

        cart.products = cart.products.filter(p => !p.product.equals(productId));

        await cart.save();
        successHandler(res, cart, 'Product removed from cart');
    } catch (err) {
        errorHandler(err, req, res, next);
    }
};

// Clear Cart
const clearCart = async (req, res, next) => {
    try {
        let cart = await Cart.findOne({ user: req.user._id });

        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' });
        }

        cart.products = [];
        await cart.save();
        successHandler(res, cart, 'Cart cleared successfully');
    } catch (err) {
        errorHandler(err, req, res, next);
    }
};

module.exports = {
    getCart,
    addProductToCart,
    removeProductFromCart,
    clearCart
};