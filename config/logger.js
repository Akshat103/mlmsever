const { createLogger, format, transports } = require('winston');
require('winston-daily-rotate-file');
const path = require('path');
const { combine, timestamp, printf, colorize } = format;

// Function to capture the calling file name
function getCallerFile() {
    const originalFunc = Error.prepareStackTrace;
    let callerfile;
    try {
        const err = new Error();
        let currentfile;

        Error.prepareStackTrace = function (err, stack) {
            return stack;
        };

        currentfile = err.stack.shift().getFileName();

        while (err.stack.length) {
            callerfile = err.stack.shift().getFileName();
            if (currentfile !== callerfile) break;
        }
    } catch (err) {}
    Error.prepareStackTrace = originalFunc;

    return path.basename(callerfile || 'UNKNOWN');
}

// Define the custom log format
const logFormat = printf(({ level, message, timestamp, filename }) => {
    return `${timestamp} [${filename}] ${level}: ${message}`;
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
        format((info) => {
            info.filename = getCallerFile();
            return info;
        })(),
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
