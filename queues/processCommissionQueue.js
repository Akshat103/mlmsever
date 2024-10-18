const { commissionQueue } = require('./commissionQueue');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const logger = require('../config/logger');
const mongoose = require('mongoose');

const DIRECT_PLAN_COMMISSION = 0.2;
const LEVEL_PLAN_COMMISSION = 0.05;

// Process commission jobs
commissionQueue.process(async (job) => {
    const { user, points } = job.data;
    const userid = user._id;

    logger.info(`Processing commission for User: ${userid}, Points: ${points}`);

    try {
        // Add points to the user's wallet directly
        const userWallet = await Wallet.findOne({ userId: user.userId });
        if (userWallet) {
            try {
                await userWallet.addDirectIncomePersonal(points);
                await userWallet.save();
                logger.info(`Direct income of ${points} points added to user ${userid}'s wallet`);
            } catch (walletError) {
                logger.error(`Failed to add direct income to user wallet: ${walletError.message}`);
            }
        } else {
            logger.error(`Wallet not found for User ID: ${userid}`);
        }

        // Direct Plan: 20% commission to the direct referrer
        if (user.referredBy) {
            try {
                const referrer = await User.findOne({ userId: user.referredBy });
                if (referrer) {
                    const directCommission = points * DIRECT_PLAN_COMMISSION;
                    const referrerWallet = await Wallet.findOne({ userId: referrer.userId });
                    if (referrerWallet) {
                        try {
                            await referrerWallet.addDirectIncome(directCommission);
                            await referrerWallet.save();
                            logger.info(`Direct commission of ${directCommission} points added to referrer ${referrer.userId}`);
                        } catch (referrerWalletError) {
                            logger.error(`Failed to add direct commission to referrer wallet: ${referrerWalletError.message}`);
                        }
                    } else {
                        logger.error(`Referrer wallet not found for ID: ${referrer.userId}`);
                    }
                } else {
                    logger.error(`Referrer not found for referredBy ID: ${user.referredBy}`);
                }
            } catch (referrerError) {
                logger.error(`Error retrieving referrer: ${referrerError.message}`);
            }
        }

        // Level Plan: 5% commission for each parent up to the root node
        let currentUser = user;
        const levelCommission = points * LEVEL_PLAN_COMMISSION;
        const levelCommissions = []; // Store promises for parallel execution

        while (currentUser.parent) {
            try {
                const parent = await User.findOne({ userId: currentUser.parent });
                if (!parent) break;

                const parentWallet = await Wallet.findOne({ userId: parent.userId });
                if (!parentWallet) {
                    logger.error(`Parent wallet not found for ID: ${parent.userId}`);
                    currentUser = parent; // Move to the next parent even if wallet is not found
                    continue; // Skip further processing for this parent
                }

                // Use levelIncome method to handle income addition
                levelCommissions.push(
                    parentWallet.addLevelIncome(levelCommission).catch(err => {
                        logger.error(`Failed to add level commission to parent ${parent.userId}: ${err.message}`);
                    })
                );

                // Move to the next parent in the hierarchy
                currentUser = parent;
            } catch (parentError) {
                logger.error(`Error retrieving parent: ${parentError.message}`);
                break; // Exit loop if there's an issue retrieving parent data
            }
        }

        // Execute all level income updates in parallel
        await Promise.all(levelCommissions);

        logger.info(`Commission processing completed for User: ${userid}`);
    } catch (error) {
        logger.error(`Error during commission processing for User: ${userid}, Error: ${error.message}`);
    }
});
