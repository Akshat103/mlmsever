const RewardThreshold = require('../models/RewardThreshold');
const successHandler = require('../middlewares/successHandler');

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
        successHandler(res, savedThreshold, "New Reward created.");
    } catch (error) {
        next(error);
    }
};

// Get all thresholds
const getAllThresholds = async (req, res, next) => {
    try {
        const thresholds = await RewardThreshold.find();
        successHandler(res, thresholds, "All Rewards.");
    } catch (error) {
        next(error);
    }
};

// Get a threshold by points
const getThresholdByPoints = async (req, res, next) => {
    try {
        const threshold = await RewardThreshold.findOne({ points: req.params.points });
        if (!threshold) {
            return res.status(404).json({ success: false, message: 'Threshold not found.' });
        }
        successHandler(res, threshold, "Found Reward.");
    } catch (error) {
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
            return res.status(404).json({ message: 'Threshold not found.' });
        }
        res.json(updatedThreshold);
    } catch (error) {
        next(error);
    }
};

// Delete a threshold by points
const deleteThresholdByPoints = async (req, res, next) => {
    try {
        const deletedThreshold = await RewardThreshold.findOneAndDelete({ points: req.params.points });
        if (!deletedThreshold) {
            return res.status(404).json({ message: 'Threshold not found.' });
        }
        res.json({ message: 'Threshold deleted successfully.' });
    } catch (error) {
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