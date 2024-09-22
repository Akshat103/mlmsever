const mongoose = require('mongoose');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Review = require('../models/Review');
const successHandler = require('../middlewares/successHandler');

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
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        next(err);
    }
};

// Get all products
const getAllProducts = async (req, res, next) => {
    try {
        const products = await Product.find().populate('category').populate('reviews');
        successHandler(res, products, 'Products retrieved successfully');
    } catch (err) {
        next(err);
    }
};

// Get a product by ID
const getProductById = async (req, res, next) => {
    try {
        const product = await Product.findById(req.params.id).populate('category').populate('reviews');
        if (!product) return res.status(404).json({ message: 'Product not found' });
        successHandler(res, product, 'Product retrieved successfully');
    } catch (err) {
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

        if (!updatedProduct) return res.status(404).json({ message: 'Product not found' });
        successHandler(res, updatedProduct, 'Product updated successfully');
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
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
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        next(err);
    }
};

// Get products by category
const getProductsByCategory = async (req, res, next) => {
    try {
        const products = await Product.find({ category: req.params.categoryId }).populate('category').populate('reviews');
        successHandler(res, products, 'Products retrieved successfully');
    } catch (err) {
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
