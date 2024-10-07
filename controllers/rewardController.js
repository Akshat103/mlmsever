const Reward = require('../models/Reward');
const logger = require('../config/logger');

// Get reward by userId
const getRewardByUserId = async (req, res) => {
    try {
        const { userId } = req.params;
        const rewards = await Reward.find({ userId });
        
        if (!rewards || rewards.length === 0) { // Check for an empty array
            logger.warn(`No rewards found for userId: ${userId}`); // Log warning
            return res.status(404).json({ message: 'Rewards not found for this user.' });
        }

        logger.info(`Rewards retrieved successfully for userId: ${userId}`); // Log success
        res.status(200).json(rewards);
    } catch (error) {
        logger.error(`Error fetching rewards for userId: ${req.params.userId} - ${error.message}`); // Log error
        res.status(500).json({ message: 'Error fetching rewards', error });
    }
};

// Redeem reward by rewardId
const redeemReward = async (req, res) => {
    try {
        const { rewardId } = req.params;
        const reward = await Reward.findById(rewardId);

        if (!reward) {
            logger.warn(`Reward not found for rewardId: ${rewardId}`); // Log warning
            return res.status(404).json({ message: 'Reward not found.' });
        }

        if (reward.isRedeemed) {
            logger.warn(`Attempted to redeem already redeemed rewardId: ${rewardId}`); // Log warning
            return res.status(400).json({ message: 'Reward already redeemed.' });
        }

        reward.isRedeemed = true;
        await reward.save();

        logger.info(`Reward redeemed successfully for rewardId: ${rewardId}`); // Log success
        res.status(200).json({ message: 'Reward redeemed successfully and points added to wallet.', reward });
    } catch (error) {
        logger.error(`Error redeeming rewardId: ${rewardId} - ${error.message}`); // Log error
        res.status(500).json({ message: 'Error redeeming reward', error });
    }
};

module.exports = {
    getRewardByUserId,
    redeemReward
};
