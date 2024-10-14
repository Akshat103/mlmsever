const express = require('express');
const router = express.Router();
const authenticate = require('../middlewares/authMiddleware');
const cartController = require('../controllers/cartController');

// Get Cart by User
router.get('/', authenticate, cartController.getCart);

// Add Product to Cart
router.post('/add', authenticate, cartController.addProductToCart);

// Update Product to Cart
router.post('/update', authenticate, cartController.updateCartItemQuantity);

// Remove Product from Cart
router.delete('/remove', authenticate, cartController.removeProductFromCart);

// Clear Cart
router.delete('/clear', authenticate, cartController.clearCart);

module.exports = router;
