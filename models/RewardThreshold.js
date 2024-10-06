const mongoose = require('mongoose');

const RewardThresholdSchema = new mongoose.Schema({
    points: {
        type: Number,
        required: true,
        unique: true
    },
    description: {
        type: String,
        required: true
    },
    rewardPoints: {
        type: Number,
        required: true
    },
});

module.exports = mongoose.model('RewardThreshold', RewardThresholdSchema);
