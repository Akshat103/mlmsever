const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const TokenBlacklist = require('../models/TokenBlacklist');
const successHandler = require('../middlewares/successHandler');
const logger = require('../config/logger');
const Admin = require('../models/Admin');

const loginUser = async (req, res, next) => {
    const { identifier, password } = req.body;
    try {
        
        if (!identifier || !password) {
            logger.warn('Login attempt failed: Missing identifier or password.');
            return res.status(400).json({ success: false, message: 'Identifier and password are required.' });
        }

        // Check for admin user first
        let admin = await Admin.findOne({ email: identifier });

        if (admin) {
            const isMatch = await bcrypt.compare(password, admin.password);
            if (!isMatch) {
                logger.warn(`Login attempt failed: Invalid credentials for user: ${admin.email}`);
                return next(new Error('Invalid credentials'));
            }
            const token = jwt.sign({ userId: admin._id }, process.env.JWT_SECRET, { expiresIn: '12h' });
            logger.info(`Admin logged in successfully: ${admin.email}`);
            return successHandler(res, { token, userId: admin._id });
        }

        // If not an admin, check for a regular user
        const user = await User.findOne({
            $or: [{ email: identifier }, { phoneNumber: identifier }],
        });

        if (!user) {
            logger.warn(`Login attempt failed: User not found for identifier: ${identifier}`);
            return next(new Error('User not found'));
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            logger.warn(`Login attempt failed: Invalid credentials for user: ${user.email || user.phoneNumber}`);
            return next(new Error('Invalid credentials'));
        }

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '12h' });
        logger.info(`User logged in successfully: ${user.email || user.phoneNumber}`);
        return successHandler(res, { token, userId: user.userId });
    } catch (err) {
        logger.error(`Error during login: ${err.message}`);
        return next(err);
    }
};

const logoutUser = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            logger.warn('Logout attempt failed: Invalid token or no token provided');
            return res.status(400).json({ message: 'Invalid token or no token provided' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.decode(token);

        if (!decoded) {
            logger.warn('Logout attempt failed: Invalid token');
            return res.status(400).json({ message: 'Invalid token' });
        }

        const newBlacklistedToken = new TokenBlacklist({
            token,
            expiresAt: new Date(decoded.exp * 1000)
        });

        await newBlacklistedToken.save();
        logger.info(`User logged out successfully: ${decoded.userId}`);
        successHandler(res, null, 'Logout successful');
    } catch (err) {
        logger.error(`Error during logout: ${err.message}`);
        next(err);
    }
};

module.exports = {
    loginUser,
    logoutUser,
};
