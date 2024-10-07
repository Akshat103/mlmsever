const logger = require('../config/logger');

const errorHandler = (err, req, res, next) => {
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

    // Log the error details
    logger.error(`Error: ${err.message}, Status Code: ${statusCode}, Stack: ${err.stack}`);

    res.status(statusCode).json({
        success: false,
        message: err.message || 'Internal Server Error',
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
};

module.exports = errorHandler;
