const Wishlist = require('../models/Wishlist');
const Product = require('../models/Product');
const successHandler = require('../middlewares/successHandler');
const logger = require('../config/logger');

const addProductToWishlist = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const productId = req.params.productId;

        const product = await Product.findById(productId);
        if (!product) {
            logger.warn(`Product not found: ${productId}`); // Log warning
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        let wishlist = await Wishlist.findOne({ user: userId });
        if (!wishlist) {
            wishlist = new Wishlist({ user: userId, products: [] });
        }

        if (!wishlist.products.includes(productId)) {
            wishlist.products.push(productId);
            logger.info(`Product added to wishlist: ${productId} for user: ${userId}`); // Log success
        } else {
            logger.info(`Product already in wishlist: ${productId} for user: ${userId}`); // Log info
        }

        await wishlist.save();
        successHandler(res, wishlist, 'Product added to wishlist');
    } catch (err) {
        logger.error(`Error adding product to wishlist: ${err.message}`); // Log error
        next(err);
    }
};

const getUserWishlist = async (req, res, next) => {
    try {
        const userId = req.user._id;

        let wishlist = await Wishlist.findOne({ user: userId }).populate('products');
        if (!wishlist) {
            logger.warn(`Wishlist not found for user: ${userId}`); // Log warning
            return res.status(404).json({ success: false, message: 'Wishlist not found' });
        }

        const availableProducts = wishlist.products.filter(product => product != null);

        if (availableProducts.length !== wishlist.products.length) {
            wishlist.products = availableProducts;
            await wishlist.save();
            logger.info(`Updated wishlist for user: ${userId} by removing null products`); // Log success
        }

        successHandler(res, wishlist, 'Wishlist retrieved successfully');
    } catch (err) {
        logger.error(`Error retrieving wishlist for user: ${userId}: ${err.message}`); // Log error
        next(err);
    }
};

const removeProductFromWishlist = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const productId = req.params.productId;

        let wishlist = await Wishlist.findOne({ user: userId });
        if (!wishlist) {
            logger.warn(`Wishlist not found for user: ${userId}`); // Log warning
            return res.status(404).json({ success: false, message: 'Wishlist not found' });
        }

        wishlist.products = wishlist.products.filter(product => product.toString() !== productId);
        await wishlist.save();
        logger.info(`Product removed from wishlist: ${productId} for user: ${userId}`); // Log success

        successHandler(res, wishlist, 'Product removed from wishlist');
    } catch (err) {
        logger.error(`Error removing product from wishlist for user: ${userId}: ${err.message}`); // Log error
        next(err);
    }
};

const clearWishlist = async (req, res, next) => {
    try {
        const userId = req.user._id;
        let wishlist = await Wishlist.findOne({ user: userId });
        if (!wishlist) {
            logger.warn(`Wishlist not found for user: ${userId}`); // Log warning
            return res.status(404).json({ success: false, message: 'Wishlist not found' });
        }
        wishlist.products = [];
        await wishlist.save();
        logger.info(`Wishlist cleared for user: ${userId}`); // Log success

        successHandler(res, wishlist, 'Wishlist cleared');
    } catch (err) {
        logger.error(`Error clearing wishlist for user: ${userId}: ${err.message}`); // Log error
        next(err);
    }
};

module.exports = {
    addProductToWishlist,
    getUserWishlist,
    removeProductFromWishlist,
    clearWishlist
};
