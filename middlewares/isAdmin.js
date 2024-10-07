const logger = require('../config/logger');

const isAdmin = (req, res, next) => {
    if (req.user && req.user.isAdmin) {
        return next();
    }

    logger.warn('Unauthorized access attempt: User is not an admin.');
    return res.status(403).json({ success: false, message: 'Access denied: Admins only' });
};

module.exports = isAdmin;
