const TokenBlacklist = require('../models/TokenBlacklist');

const checkTokenBlacklist = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];

            const blacklistedToken = await TokenBlacklist.findOne({
                token,
                expiresAt: { $gt: new Date() }
            });

            if (blacklistedToken) {
                return res.status(401).json({ message: 'Token has been invalidated. Please log in again.' });
            }
        }

        next();
    } catch (err) {
        next(err);
    }
};

module.exports = checkTokenBlacklist;
