const mongoose = require('mongoose');

const RewardSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true
    },
    points: {
        type: Number,
        required: true
    },
    rewardPoints: {
        type: Number,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    isRedeemed: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Reward', RewardSchema);