const mongoose = require('mongoose');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Review = require('../models/Review');
const successHandler = require('../middlewares/successHandler');
const logger = require('../config/logger'); // Adjust the path as necessary

// Create a new product
const createProduct = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const images = req.files.map(file => file.path);
        const newProduct = new Product({ ...req.body, images });
        await newProduct.save({ session });
        await Category.findByIdAndUpdate(
            req.body.category,
            { $push: { products: newProduct._id } },
            { new: true, session }
        );
        await session.commitTransaction();
        session.endSession();
        successHandler(res, null, 'Product created successfully');
        logger.info(`Product created: ${newProduct._id}`); // Log product creation
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        logger.error(`Error creating product: ${err.message}`); // Log the error
        next(err);
    }
};

// Get all products
const getAllProducts = async (req, res, next) => {
    try {
        const products = await Product.find().populate('category').populate('reviews');
        successHandler(res, products, 'Products retrieved successfully');
        logger.info('All products retrieved successfully'); // Log retrieval success
    } catch (err) {
        logger.error(`Error retrieving products: ${err.message}`); // Log the error
        next(err);
    }
};

// Get a product by ID
const getProductById = async (req, res, next) => {
    try {
        const product = await Product.findById(req.params.id).populate('category').populate('reviews');
        if (!product) {
            logger.warn(`Product not found: ${req.params.id}`); // Log warning
            return res.status(404).json({ message: 'Product not found' });
        }
        successHandler(res, product, 'Product retrieved successfully');
        logger.info(`Product retrieved: ${req.params.id}`); // Log retrieval
    } catch (err) {
        logger.error(`Error retrieving product: ${err.message}`); // Log the error
        next(err);
    }
};

// Update a product
const updateProduct = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const productId = req.params.id;
        const { category } = req.body;

        const existingProduct = await Product.findById(productId).session(session);
        if (!existingProduct) {
            await session.abortTransaction();
            session.endSession();
            logger.warn(`Product not found for update: ${productId}`); // Log warning
            return res.status(404).json({ message: 'Product not found' });
        }

        if (category && existingProduct.category !== category) {
            if (existingProduct.category) {
                await Category.findByIdAndUpdate(
                    existingProduct.category,
                    { $pull: { products: productId } },
                    { session }
                );
            }

            await Category.findByIdAndUpdate(
                category,
                { $addToSet: { products: productId } },
                { session }
            );
        } else if (!category) {
            await Category.findByIdAndUpdate(
                existingProduct.category,
                { $pull: { products: productId } },
                { session }
            );
        }

        const updatedProduct = await Product.findByIdAndUpdate(
            productId,
            { ...req.body, category: category || null },
            { new: true, runValidators: true, session }
        );

        await session.commitTransaction();
        session.endSession();

        if (!updatedProduct) {
            logger.warn(`Product not found after update attempt: ${productId}`); // Log warning
            return res.status(404).json({ message: 'Product not found' });
        }
        successHandler(res, updatedProduct, 'Product updated successfully');
        logger.info(`Product updated: ${productId}`); // Log update success
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        logger.error(`Error updating product: ${err.message}`); // Log the error
        next(err);
    }
};

// Delete a product
const deleteProduct = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const productId = req.params.id;

        const deletedProduct = await Product.findById(productId).session(session);
        if (!deletedProduct) {
            await session.abortTransaction();
            session.endSession();
            logger.warn(`Product not found for deletion: ${productId}`); // Log warning
            return res.status(404).json({ message: 'Product not found' });
        }

        await Review.deleteMany({ product: productId }).session(session);

        if (deletedProduct.category) {
            await Category.findByIdAndUpdate(
                deletedProduct.category,
                { $pull: { products: productId } },
                { session }
            );
        }

        await Product.findByIdAndDelete(productId).session(session);

        await session.commitTransaction();
        session.endSession();

        successHandler(res, null, 'Product deleted successfully');
        logger.info(`Product deleted: ${productId}`); // Log deletion success
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        logger.error(`Error deleting product: ${err.message}`); // Log the error
        next(err);
    }
};

// Get products by category
const getProductsByCategory = async (req, res, next) => {
    try {
        const categoryId = req.params.categoryId;

        const query = categoryId && categoryId !== 'null' ? { category: categoryId } : { category: { $exists: false } };

        const products = await Product.find(query)
            .populate('category')
            .populate('reviews');

        successHandler(res, products, 'Products retrieved successfully');
        logger.info(`Products retrieved by category: ${categoryId}`); // Log retrieval by category
    } catch (err) {
        logger.error(`Error retrieving products by category: ${err.message}`); // Log the error
        next(err);
    }
};

module.exports = {
    createProduct,
    getAllProducts,
    getProductById,
    updateProduct,
    deleteProduct,
    getProductsByCategory
};
