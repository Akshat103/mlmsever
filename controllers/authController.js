const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const TokenBlacklist = require('../models/TokenBlacklist');
const successHandler = require('../middlewares/successHandler');
const logger = require('../config/logger');
const Admin = require('../models/Admin');
const sendResetOTPEmail = require('../config/sendResetOTPEmail');
const crypto = require('crypto');
const errorHandler = require('../middlewares/errorHandler');

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
                logger.warn(`Login attempt failed: Invalid credentials for admin: ${admin.email}`);
                return res.status(401).json({ success: false, message: 'Invalid credentials' });
            }

            const token = jwt.sign({ userId: admin._id }, process.env.JWT_SECRET);
            logger.info(`Admin logged in successfully: ${admin.email}`);
            return successHandler(res, { token, userId: admin._id });
        }

        // If not an admin, check for a regular user
        const user = await User.findOne({
            $or: [{ email: identifier }, { phoneNumber: identifier }],
        });

        if (!user) {
            logger.warn(`Login attempt failed: User not found for identifier: ${identifier}`);
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            logger.warn(`Login attempt failed: Invalid credentials for user: ${user.email || user.phoneNumber}`);
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);
        logger.info(`User logged in successfully: ${user.email || user.phoneNumber}`);
        return successHandler(res, { token, userId: user.userId, id: user._id });
    } catch (err) {
        logger.error(`Error during login: ${err.message}`);
        return errorHandler(err, req, res, next);
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
        errorHandler(err, req, res, next);
    }
};

const resetPasswordUsingOldPassword = async (req, res) => {
    try {
        const { identifier, oldPassword, newPassword } = req.body;

        // Find the user by email or phone number
        const user = await User.findOne({
            $or: [
                { email: identifier },
                { phoneNumber: identifier }
            ]
        });

        if (!user) {
            logger.warn(`User not found: ${identifier}`);
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Compare old password with the hashed password in the database
        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) {
            logger.warn(`Old password is incorrect: ${user.userId}`);
            return res.status(400).json({ success: false, message: 'Old password is incorrect' });
        }

        // Hash the new password
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);

        // Update the user's password
        user.password = hashedNewPassword;
        await user.save();
        logger.info(`Password successfully updated: ${user.userId}`);
        return res.status(200).json({ success: true, message: 'Password successfully updated' });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Server error', error });
    }
};

const sendOtpForPasswordReset = async (req, res) => {
    try {
        const { email } = req.body;

        // Find the user by email
        const user = await User.findOne({ email: email });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Generate a random 6-digit OTP
        const otp = crypto.randomInt(100000, 999999);

        // Store the OTP temporarily
        user.resetOtp = otp;
        user.otpExpiry = Date.now() + 10 * 60 * 1000;
        await user.save();

        // Send OTP to user's email
        await sendResetOTPEmail(user.email, 'Your OTP for Password Reset - PSB Marketing', otp);

        return res.status(200).json({ success: true, message: `OTP sent to email ${email}` });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Server error', error });
    }
};

const verifyOtpAndResetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;

        // Find the user by email
        const user = await User.findOne({ email: email }).select('+resetOtp +otpExpiry');

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Check if OTP is valid
        if (user.resetOtp !== otp || user.otpExpiry < Date.now()) {
            return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
        }

        // Hash the new password
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);

        // Update the user's password and remove OTP fields
        user.password = hashedNewPassword;
        user.resetOtp = undefined;
        user.otpExpiry = undefined;
        await user.save();

        return res.status(200).json({ success: true, message: 'Password successfully updated' });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Server error', error });
    }
};


module.exports = {
    loginUser,
    logoutUser,
    resetPasswordUsingOldPassword,
    sendOtpForPasswordReset,
    verifyOtpAndResetPassword
};
