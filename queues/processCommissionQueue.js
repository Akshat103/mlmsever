const { commissionQueue } = require('./commissionQueue');
const User = require('../models/User');
const Wallet = require('../models/Wallet');

const DIRECT_PLAN_COMMISSION = 0.2;
const LEVEL_PLAN_COMMISSION = 0.05;

// Process commission jobs
commissionQueue.process(async (job) => {
    const { userid, points } = job.data;

    console.log(`Processing commission for User: ${userid}, Points: ${points}`);

    // Find the user
    const user = await User.findById(userid);
    if (!user) {
        console.error(`User not found for ID: ${userid}`);
        throw new Error('User not found');
    }

    // Add points to the user's wallet directly
    const userWallet = await Wallet.findOne({ userId: user.userId });
    if (userWallet) {
        await userWallet.addDirectIncome(points);
        await userWallet.save();
        console.log(`Direct income of ${points} points added to user ${userid}'s wallet`);
    } else {
        console.error(`Wallet not found for User ID: ${userid}`);
    }

    // Direct Plan: 20% commission to the direct referrer
    if (user.referredBy) {
        const referrer = await User.findOne({ userId: user.referredBy });
        if (referrer) {
            const directCommission = points * DIRECT_PLAN_COMMISSION;
            const referrerWallet = await Wallet.findOne({ userId: referrer.userId });
            if (referrerWallet) {
                await referrerWallet.addDirectIncome(directCommission);
                await referrerWallet.save();
                console.log(`Direct commission of ${directCommission} points added to referrer ${referrer.userId}`);
            } else {
                console.error(`Referrer wallet not found for ID: ${referrer.userId}`);
            }
        } else {
            console.error(`Referrer not found for referredBy ID: ${user.referredBy}`);
        }
    }

    // Level Plan: 5% commission for each parent up to the root node
    let currentUser = user;
    while (currentUser.parent) {
        const parent = await User.findOne({ userId: currentUser.parent });
        if (!parent) break;

        // Skip if the parent is the direct referrer
        if (parent.userId === user.referredBy) {
            console.log(`Skipping parent ${parent.userId} as they are the direct referrer`);
            currentUser = parent;
            continue;
        }

        const levelCommission = points * LEVEL_PLAN_COMMISSION;
        const parentWallet = await Wallet.findOne({ userId: parent.userId });
        if (parentWallet) {
            await parentWallet.addLevelIncome(levelCommission);
            await parentWallet.save();
            console.log(`Level commission of ${levelCommission} points added to parent ${parent.userId}`);
        } else {
            console.error(`Parent wallet not found for ID: ${parent.userId}`);
        }

        // Move to the next parent in the hierarchy
        currentUser = parent;
    }

    console.log(`Commission processing completed for User: ${userid}`);
});
