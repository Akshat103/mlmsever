const mongoose = require('mongoose');
const Review = require('../models/Review');
const Product = require('../models/Product');
const successHandler = require('../middlewares/successHandler');

// Add a review
const addReview = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { user, product, rating, comment } = req.body;

        const newReview = new Review({ user, product, rating, comment });
        await newReview.save();
        await Product.findByIdAndUpdate(product, { $push: { reviews: newReview._id } });
        await session.commitTransaction();
        session.endSession();
        successHandler(res, null, 'Review added successfully');
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        next(err);
    }
};

// Delete a review
const deleteReview = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { reviewId } = req.params;

        const review = await Review.findByIdAndDelete(reviewId);
        if (!review) return res.status(404).json({ message: 'Review not found' });

        await Product.findByIdAndUpdate(review.product, { $pull: { reviews: reviewId } });
        await session.commitTransaction();
        session.endSession();
        successHandler(res, null, 'Review deleted successfully');
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        next(err);
    }
};

module.exports = {
    addReview,
    deleteReview,
};
