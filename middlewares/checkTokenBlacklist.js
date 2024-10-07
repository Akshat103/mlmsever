const TokenBlacklist = require('../models/TokenBlacklist');
const logger = require('../config/logger');

const checkTokenBlacklist = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];

            const blacklistedToken = await TokenBlacklist.findOne({
                token,
                expiresAt: { $gt: new Date() }
            });

            if (blacklistedToken) {
                logger.warn(`Token invalidated: ${token}. User must log in again.`);
                return res.status(401).json({ message: 'Token has been invalidated. Please log in again.' });
            }
        } else {
            logger.warn('Authorization header is missing or invalid format.');
        }

        next();
    } catch (err) {
        logger.error(`Error checking token blacklist: ${err.message}`);
        next(err);
    }
};

module.exports = checkTokenBlacklist;
