const RewardThreshold = require('../models/RewardThreshold');
const successHandler = require('../middlewares/successHandler');
const logger = require('../config/logger');

// Create a new threshold
const createThreshold = async (req, res, next) => {
    const { points, description, rewardPoints } = req.body;

    const threshold = new RewardThreshold({
        points,
        description,
        rewardPoints
    });

    try {
        const savedThreshold = await threshold.save();
        logger.info(`New threshold created with points: ${points}`); // Log success
        successHandler(res, savedThreshold, "New Reward created.");
    } catch (error) {
        logger.error(`Error creating threshold: ${error.message}`); // Log error
        next(error);
    }
};

// Get all thresholds
const getAllThresholds = async (req, res, next) => {
    try {
        const thresholds = await RewardThreshold.find();
        logger.info('All thresholds retrieved successfully.'); // Log success
        successHandler(res, thresholds, "All Rewards.");
    } catch (error) {
        logger.error(`Error fetching thresholds: ${error.message}`); // Log error
        next(error);
    }
};

// Get a threshold by points
const getThresholdByPoints = async (req, res, next) => {
    try {
        const threshold = await RewardThreshold.findOne({ points: req.params.points });
        if (!threshold) {
            logger.warn(`Threshold not found for points: ${req.params.points}`); // Log warning
            return res.status(404).json({ success: false, message: 'Threshold not found.' });
        }
        logger.info(`Threshold found for points: ${req.params.points}`); // Log success
        successHandler(res, threshold, "Found Reward.");
    } catch (error) {
        logger.error(`Error fetching threshold for points ${req.params.points}: ${error.message}`); // Log error
        next(error);
    }
};

// Update a threshold by points
const updateThresholdByPoints = async (req, res, next) => {
    try {
        const updatedThreshold = await RewardThreshold.findOneAndUpdate(
            { points: req.params.points },
            req.body,
            { new: true, runValidators: true }
        );
        if (!updatedThreshold) {
            logger.warn(`Threshold not found for points: ${req.params.points}`); // Log warning
            return res.status(404).json({ message: 'Threshold not found.' });
        }
        logger.info(`Threshold updated successfully for points: ${req.params.points}`); // Log success
        res.json(updatedThreshold);
    } catch (error) {
        logger.error(`Error updating threshold for points ${req.params.points}: ${error.message}`); // Log error
        next(error);
    }
};

// Delete a threshold by points
const deleteThresholdByPoints = async (req, res, next) => {
    try {
        const deletedThreshold = await RewardThreshold.findOneAndDelete({ points: req.params.points });
        if (!deletedThreshold) {
            logger.warn(`Threshold not found for points: ${req.params.points}`); // Log warning
            return res.status(404).json({ message: 'Threshold not found.' });
        }
        logger.info(`Threshold deleted successfully for points: ${req.params.points}`); // Log success
        res.json({ message: 'Threshold deleted successfully.' });
    } catch (error) {
        logger.error(`Error deleting threshold for points ${req.params.points}: ${error.message}`); // Log error
        next(error);
    }
};

module.exports = {
    createThreshold,
    getAllThresholds,
    getThresholdByPoints,
    updateThresholdByPoints,
    deleteThresholdByPoints
};
