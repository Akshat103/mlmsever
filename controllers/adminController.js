const Admin = require('../models/Admin');
const logger = require('../config/logger');
const successHandler = require('../middlewares/successHandler');
const dotenv = require('dotenv');
const errorHandler = require('../middlewares/errorHandler');
dotenv.config();

// Update Admin
const updateAdmin = async (req, res, next) => {
    const { id } = req.params;
    const { name, email, adminKey } = req.body;

    try {
        // Find the admin by ID
        const admin = await Admin.findById(id);
        if (!admin || adminKey !== process.env.ADMIN_KEY) {
            logger.warn(`Admin not found with ID: ${id} or use correct admin key`);
            return res.status(404).json({ success: false, message: 'Admin not found or use correct admin key' });
        }

        // Update admin fields
        if (name) admin.name = name;
        if (email) admin.email = email;

        const updatedAdmin = await admin.save();
        logger.info(`Admin updated successfully: ${updatedAdmin.email}`);
        successHandler(res, updatedAdmin ,"Admin updated successfully")
    } catch (err) {
        logger.error(`Error updating admin: ${err.message}`);
        errorHandler(err, req, res, next);
    }
};

// Delete Admin
const deleteAdmin = async (req, res, next) => {
    const { id } = req.params;
    const { adminKey } = req.body;

    try {
        const admin = await Admin.findByIdAndDelete(id);
        if (!admin || adminKey !== process.env.ADMIN_KEY) {
            logger.warn(`Admin not found with ID: ${id} or use correct admin key`);
            return res.status(404).json({ success: false, message: 'Admin not found or use correct admin key' });
        }

        logger.info(`Admin deleted successfully: ${admin.email}`);
        successHandler(res, null, 'Admin deleted successfully');
    } catch (err) {
        logger.error(`Error deleting admin: ${err.message}`);
        errorHandler(err, req, res, next);
    }
};

const getAllAdmins = async (req, res, next) => {
    try {
        const admins = await Admin.find().select('-password -__v');

        if (admins.length === 0) {
            logger.warn('No admins found');
            return res.status(404).json({ success: true, message: 'No admins found' });
        }

        logger.info('Retrieved all admins successfully');
        successHandler(res, admins, "Retrieved all admins successfully");
    } catch (err) {
        logger.error(`Error retrieving admins: ${err.message}`);
        errorHandler(err, req, res, next);
    }
};

module.exports = {
    updateAdmin,
    deleteAdmin,
    getAllAdmins
};
