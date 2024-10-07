const jwt = require('jsonwebtoken');
const User = require('../models/User');
const TokenBlacklist = require('../models/TokenBlacklist');
const logger = require('../config/logger');
const Admin = require('../models/Admin');

const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            logger.warn('No token provided or invalid format');
            return res.status(401).json({ success: false, message: 'No token provided or invalid format' });
        }

        const token = authHeader.split(' ')[1];

        const blacklistedToken = await TokenBlacklist.findOne({ token });
        if (blacklistedToken) {
            logger.warn('Token has been invalidated. User must log in again.');
            return res.status(401).json({ success: false, message: 'Token has been invalidated. Please log in again.' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Check if the user is an admin
        const admin = await Admin.findById(decoded.userId);
        if (admin) {
            req.user = admin;
            return next();
        }

        // If not an admin, check for a regular user
        const user = await User.findById(decoded.userId);
        if (!user) {
            logger.warn('Unauthorized access attempt: User not found.');
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }
        
        req.user = user;
        next();
    } catch (err) {
        logger.error(`Authentication error: ${err.message}`);
        return res.status(403).json({ success: false, message: 'Invalid token' });
    }
};

module.exports = authenticate;
