const express = require('express');
const {
    createCategory,
    getAllCategories,
    deleteCategory
} = require('../controllers/categoryController');

const router = express.Router();
const authenticate = require('../middlewares/authMiddleware');

// Create a new category
router.post('/create', authenticate, createCategory);

// Get all categories
router.get('/get-all', authenticate, getAllCategories);

// Delete a category
router.delete('/:id', authenticate, deleteCategory);

module.exports = router;
