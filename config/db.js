const mongoose = require('mongoose');
const dotenv = require('dotenv');
const logger = require('./logger');

dotenv.config();

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI,{
            retryWrites: true
        });
        logger.info('MongoDB connected');
    } catch (error) {
        logger.error(`MongoDB connection error: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;
