const mongoose = require('mongoose');
const Review = require('../models/Review');
const Product = require('../models/Product');
const successHandler = require('../middlewares/successHandler');
const logger = require('../config/logger');

// Add a review
const addReview = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { user, product, rating, comment } = req.body;

        const newReview = new Review({ user, product, rating, comment });
        await newReview.save({ session }); // Ensure to save in the session
        await Product.findByIdAndUpdate(product, { $push: { reviews: newReview._id } }, { session });
        
        await session.commitTransaction();
        session.endSession();
        successHandler(res, null, 'Review added successfully');
        logger.info(`Review added successfully for product ${product} by user ${user}`); // Log success
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        logger.error(`Error adding review: ${err.message}`); // Log error
        next(err);
    }
};

// Delete a review
const deleteReview = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { reviewId } = req.params;

        const review = await Review.findByIdAndDelete(reviewId).session(session);
        if (!review) {
            logger.warn(`Attempted to delete non-existing review ${reviewId}`); // Log warning
            return res.status(404).json({ message: 'Review not found' });
        }

        await Product.findByIdAndUpdate(review.product, { $pull: { reviews: reviewId } }, { session });
        
        await session.commitTransaction();
        session.endSession();
        successHandler(res, null, 'Review deleted successfully');
        logger.info(`Review ${reviewId} deleted successfully`); // Log success
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        logger.error(`Error deleting review: ${err.message}`); // Log error
        next(err);
    }
};

module.exports = {
    addReview,
    deleteReview,
};
