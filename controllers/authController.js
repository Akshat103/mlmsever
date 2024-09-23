const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const TokenBlacklist = require('../models/TokenBlacklist');
const successHandler = require('../middlewares/successHandler');

const loginUser = async (req, res, next) => {
    const { identifier, password } = req.body;
    try {
        const user = await User.findOne({
            $or: [{ email: identifier }, { phoneNumber: identifier }],
        });
        if (!user) return next(new Error('User not found'));

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return next(new Error('Invalid credentials'));
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        successHandler(res, { token, userId:user.userId });
    } catch (err) {
        next(err);
    }
};

const logoutUser = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(400).json({ message: 'Invalid token or no token provided' });
        }

        const token = authHeader.split(' ')[1];

        const decoded = jwt.decode(token);

        if (!decoded) {
            return res.status(400).json({ message: 'Invalid token' });
        }

        const newBlacklistedToken = new TokenBlacklist({
            token,
            expiresAt: new Date(decoded.exp * 1000)
        });

        await newBlacklistedToken.save();

        successHandler(res, null, 'Logout successful');
    } catch (err) {
        next(err);
    }
};

module.exports = {
    loginUser,
    logoutUser,
};
