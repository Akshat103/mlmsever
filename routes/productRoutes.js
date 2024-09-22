const express = require('express');
const upload = require('../config/multer');
const {
    createProduct,
    getAllProducts,
    getProductById,
    updateProduct,
    deleteProduct,
    getProductsByCategory
} = require('../controllers/productController');
const router = express.Router();
const authenticate = require('../middlewares/authMiddleware');

// Create a new product with image upload
router.post('/add', authenticate, upload.array('images', 3), createProduct);

// Get all products
router.get('/get-all', authenticate, getAllProducts);

// Get a product by ID
router.get('/:id', authenticate, getProductById);

// Update a product with image upload
router.put('/:id', authenticate, upload.array('images', 3), updateProduct);

// Delete a product
router.delete('/:id', authenticate, deleteProduct);

// Get products by category
router.get('/category/:categoryId', authenticate, getProductsByCategory);

module.exports = router;
