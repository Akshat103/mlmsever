const mongoose = require('mongoose');
const Category = require('../models/Category');
const Product = require('../models/Product');
const successHandler = require('../middlewares/successHandler');

// Create a new category
const createCategory = async (req, res, next) => {
    try {
        const newCategory = new Category(req.body);
        await newCategory.save();
        successHandler(res, null, 'Category created successfully');
    } catch (err) {
        next(err);
    }
};

// Get all categories
const getAllCategories = async (req, res, next) => {
    try {
        const categories = await Category.find().populate('products').select('-__v');
        successHandler(res, categories, 'Categories retrieved successfully');
    } catch (err) {
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
            return res.status(404).json({ message: 'Category not found' });
        }

        if (category.products.length > 0) {
            await session.abortTransaction();
            session.endSession();
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

        successHandler(res, null, 'Category deleted successfully');
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        next(err);
    }
};


module.exports = {
    createCategory,
    getAllCategories,
    deleteCategory
};
