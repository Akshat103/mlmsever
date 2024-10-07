const { createLogger, format, transports } = require('winston');
require('winston-daily-rotate-file');

const { combine, timestamp, printf, colorize } = format;

// Define the custom log format
const logFormat = printf(({ level, message, timestamp }) => {
    return `${timestamp} ${level}: ${message}`;
});

// Set up daily rotation for logs
const dailyRotateFileTransport = new transports.DailyRotateFile({
    filename: 'logs/application-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
});

// Create the logger
const logger = createLogger({
    format: combine(
        timestamp(),
        logFormat
    ),
    transports: [
        dailyRotateFileTransport,
        new transports.Console({
            format: combine(
                colorize(),
                logFormat
            )
        })
    ],
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(new transports.Console({
        format: combine(
            colorize(),
            logFormat
        )
    }));
}

module.exports = logger;
