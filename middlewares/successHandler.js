const logger = require('../config/logger');

const successHandler = (res, data, message = 'Success') => {
    logger.info(`Response sent: ${message}`);

    res.status(200).json({
        success: true,
        message,
        data,
    });
};

module.exports = successHandler;
