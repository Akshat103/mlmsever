const mongoose = require('mongoose');

const TokenBlacklistSchema = new mongoose.Schema({
    token: {
        type: String,
        required: true,
    },
    expiresAt: {
        type: Date,
        required: true,
    }
});

const TokenBlacklist = mongoose.model('TokenBlacklist', TokenBlacklistSchema);

module.exports = TokenBlacklist;
