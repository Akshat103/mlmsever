const Reward = require('../models/Reward');
const Wallet = require('../models/Wallet');

// Get reward by userId
const getRewardByUserId = async (req, res) => {
    try {
        const { userId } = req.params;
        const rewards = await Reward.find({ userId });
        
        if (!rewards) {
            return res.status(404).json({ message: 'Rewards not found for this user.' });
        }

        res.status(200).json(rewards);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching rewards', error });
    }
};

// Redeem reward by rewardId
const redeemReward = async (req, res) => {
    try {
        const { rewardId } = req.params;
        const reward = await Reward.findById(rewardId);

        if (!reward) {
            return res.status(404).json({ message: 'Reward not found.' });
        }

        if (reward.isRedeemed) {
            return res.status(400).json({ message: 'Reward already redeemed.' });
        }

        reward.isRedeemed = true;
        await reward.save();

        // Find the user's wallet and add the reward points to it
        const wallet = await Wallet.findOne({ userId: reward.userId });

        if (wallet) {
            await wallet.addDirectIncome(reward.rewardPoints);
            await wallet.save();
        }

        res.status(200).json({ message: 'Reward redeemed successfully and points added to wallet.', reward });
    } catch (error) {
        res.status(500).json({ message: 'Error redeeming reward', error });
    }
};

module.exports = {
    getRewardByUserId,
    redeemReward
};