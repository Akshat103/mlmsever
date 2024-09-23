const Wishlist = require('../models/Wishlist');
const Product = require('../models/Product');
const successHandler = require('../middlewares/successHandler');

const addProductToWishlist = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const productId = req.params.productId;

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        let wishlist = await Wishlist.findOne({ user: userId });
        if (!wishlist) {
            wishlist = new Wishlist({ user: userId, products: [] });
        }

        if (!wishlist.products.includes(productId)) {
            wishlist.products.push(productId);
        }

        await wishlist.save();
        successHandler(res, wishlist, 'Product added to wishlist');
    } catch (err) {
        next(err);
    }
};

const getUserWishlist = async (req, res, next) => {
    try {
        const userId = req.user._id;

        let wishlist = await Wishlist.findOne({ user: userId }).populate('products');
        if (!wishlist) {
            return res.status(404).json({ success: false, message: 'Wishlist not found' });
        }

        const availableProducts = wishlist.products.filter(product => product != null);

        if (availableProducts.length !== wishlist.products.length) {
            wishlist.products = availableProducts;
            await wishlist.save();
        }

        successHandler(res, wishlist, 'Wishlist retrieved successfully');
    } catch (err) {
        next(err);
    }
};

const removeProductFromWishlist = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const productId = req.params.productId;

        let wishlist = await Wishlist.findOne({ user: userId });
        if (!wishlist) {
            return res.status(404).json({ success: false, message: 'Wishlist not found' });
        }

        wishlist.products = wishlist.products.filter(product => product.toString() !== productId);
        await wishlist.save();

        successHandler(res, wishlist, 'Product removed from wishlist');
    } catch (err) {
        next(err);
    }
};

const clearWishlist = async (req, res, next) => {
    try {
        const userId = req.user._id;
        let wishlist = await Wishlist.findOne({ user: userId });
        if (!wishlist) {
            return res.status(404).json({ success: false, message: 'Wishlist not found' });
        }
        wishlist.products = [];
        await wishlist.save();

        successHandler(res, wishlist, 'Wishlist cleared');
    } catch (err) {
        next(err);
    }
};

module.exports = {
    addProductToWishlist,
    getUserWishlist,
    removeProductFromWishlist,
    clearWishlist
};
