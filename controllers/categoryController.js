const mongoose = require('mongoose');
const Category = require('../models/Category');
const Product = require('../models/Product');
const successHandler = require('../middlewares/successHandler');
const logger = require('../config/logger');

// Create a new category
const createCategory = async (req, res, next) => {
    try {
        const newCategory = new Category(req.body);
        await newCategory.save();
        logger.info(`Category created: ${newCategory.name}`); // Log category creation
        successHandler(res, null, 'Category created successfully');
    } catch (err) {
        logger.error(`Error creating category: ${err.message}`); // Log error
        next(err);
    }
};

// Get all categories
const getAllCategories = async (req, res, next) => {
    try {
        const categories = await Category.find().populate('products').select('-__v');
        logger.info(`Retrieved ${categories.length} categories`); // Log retrieval
        successHandler(res, categories, 'Categories retrieved successfully');
    } catch (err) {
        logger.error(`Error retrieving categories: ${err.message}`); // Log error
        next(err);
    }
};

// Delete a category
const deleteCategory = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const categoryId = req.params.id;

        const category = await Category.findById(categoryId).session(session);
        if (!category) {
            await session.abortTransaction();
            session.endSession();
            logger.warn(`Delete category attempt failed: Category not found with id: ${categoryId}`); // Log warning
            return res.status(404).json({ message: 'Category not found' });
        }

        if (category.products.length > 0) {
            await session.abortTransaction();
            session.endSession();
            logger.warn(`Delete category attempt failed: Cannot delete category with products, id: ${categoryId}`); // Log warning
            return res.status(400).json({ message: 'Cannot delete category that has products' });
        }

        await Product.updateMany(
            { category: categoryId },
            { $set: { category: null } },
            { session }
        );

        await Category.findByIdAndDelete(categoryId).session(session);
        await session.commitTransaction();
        session.endSession();

        logger.info(`Category deleted: ${category.name}`);
        successHandler(res, null, 'Category deleted successfully');
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        logger.error(`Error deleting category: ${err.message}`);
        next(err);
    }
};

module.exports = {
    createCategory,
    getAllCategories,
    deleteCategory
};
