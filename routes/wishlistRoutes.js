const express = require('express');
const router = express.Router();
const {
    addProductToWishlist,
    getUserWishlist,
    removeProductFromWishlist,
    clearWishlist
} = require('../controllers/wishlistController');
const authenticate = require('../middlewares/authMiddleware');

// Add product to wishlist
router.post('/:productId', authenticate, addProductToWishlist);

// Get user's wishlist
router.get('/get', authenticate, getUserWishlist);

// Remove product from wishlist
router.delete('/:productId', authenticate, removeProductFromWishlist);

// Clear wishlist
router.delete('/clear/all', authenticate, clearWishlist);

module.exports = router;
