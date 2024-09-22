const jwt = require('jsonwebtoken');
const User = require('../models/User');
const TokenBlacklist = require('../models/TokenBlacklist');

const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'No token provided or invalid format' });
        }

        const token = authHeader.split(' ')[1];

        const blacklistedToken = await TokenBlacklist.findOne({ token });
        if (blacklistedToken) {
            return res.status(401).json({ message: 'Token has been invalidated. Please log in again.' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const id = await User.find({ userId: decoded.userId });

        if (!id) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        req.userId = id;
        next();
    } catch (err) {
        console.error(err);
        return res.status(403).json({ message: 'Invalid token' });
    }
};

module.exports = authenticate;
