const BankDetails = require('../models/BankDetails');
const logger = require('../config/logger');
const errorHandler = require('../middlewares/errorHandler');
const successHandler = require('../middlewares/successHandler');

// Create a new bank details
const createBankDetails = async (req, res, next) => {
    try {
        const bankDetails = new BankDetails(req.body);
        await bankDetails.save();
        logger.info("Bank details created successfully for userId: " + req.body.userId);
        successHandler(res, bankDetails, 'Bank details created successfully');
    } catch (error) {
        logger.error(`Error creating bank details: ${error.message}`);
        return errorHandler(error, req, res, next);
    }
};

// Get bank details by userId
const getBankDetails = async (req, res, next) => {
    try {
        const bankDetails = await BankDetails.findOne({ userId: req.params.userId });
        if (!bankDetails) {
            logger.warn(`No bank details found for userId: ${req.params.userId}`);
            return res.status(404).send({ success: false, message: 'Bank details not found' });
        }
        logger.info(`Bank details retrieved for userId: ${req.params.userId}`);
        successHandler(res, bankDetails, 'Bank details retrieved successfully');
    } catch (error) {
        logger.error(`Error retrieving bank details: ${error.message}`);
        return errorHandler(error, req, res, next);
    }
};

// Update bank details
const updateBankDetails = async (req, res, next) => {
    try {
        const bankDetails = await BankDetails.findOneAndUpdate(
            { userId: req.params.userId }, 
            req.body, 
            { new: true, runValidators: true }
        );
        if (!bankDetails) {
            logger.warn(`No bank details found for userId: ${req.params.userId} to update`);
            return res.status(404).send({ success: false, message: 'Bank details not found' });
        }
        logger.info(`Bank details updated for userId: ${req.params.userId}`);
        successHandler(res, bankDetails, 'Bank details updated successfully');
    } catch (error) {
        logger.error(`Error updating bank details: ${error.message}`);
        return errorHandler(error, req, res, next);
    }
};

module.exports = {
    createBankDetails,
    getBankDetails,
    updateBankDetails
};
