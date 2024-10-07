const cron = require('node-cron');
const mongoose = require('mongoose');
const GlobalPointPool = require('../models/GlobalPointPool');
const User = require('../models/User');
const logger = require('../config/logger');

// Helper function to get the previous month and year
function getPreviousMonthAndYear() {
    const now = new Date();
    const previousMonth = now.getMonth() === 0 ? 12 : now.getMonth();
    const year = previousMonth === 12 ? now.getFullYear() - 1 : now.getFullYear();
    return { previousMonth, year };
}

// Function to distribute points to qualifying users
async function distributePoints() {
    try {
        const { previousMonth, year } = getPreviousMonthAndYear();

        // Get the Global Point Pool for the previous month
        const globalPointPool = await GlobalPointPool.findOne({ month: previousMonth, year });
        if (!globalPointPool) {
            logger.info(`No global point pool found for month ${previousMonth} and year ${year}`);
            return;
        }

        // Calculate 1% of the total monthly points
        const pointsToDistribute = Math.floor(globalPointPool.totalMonthlyPoints * 0.01);
        logger.info(`Distributing ${pointsToDistribute} points for month ${previousMonth}, year ${year}`);

        // Find all users with club status "Silver" or "Gold" or rank "Crown"
        const qualifyingUsers = await User.find({
            $or: [
                { club: { $in: ['Silver', 'Gold'] } },
                { rank: 'Crown' }
            ]
        });

        const numberOfUsers = qualifyingUsers.length;

        if (numberOfUsers === 0) {
            logger.info('No qualifying users found.');
            return;
        }

        // Calculate the points to distribute per user
        const pointsPerUser = Math.floor(pointsToDistribute / numberOfUsers);

        // Update each qualifying user's wallet with the distributed points
        for (const user of qualifyingUsers) {
            if (user.wallet) {
                const wallet = await mongoose.model('Wallet').findById(user.wallet);
                if (wallet) {
                    wallet.addDirectIncome(pointsPerUser);
                    await wallet.save();
                    logger.info(`Distributed ${pointsPerUser} points to user ${user.userId}`);
                }
            }
        }

        logger.info('Point distribution completed successfully.');
    } catch (error) {
        logger.error('Error during point distribution:', error);
    }
}

// Schedule the cron job to run on the 5th of every month at 00:00
cron.schedule('0 0 5 * *', distributePoints);

logger.info('Cron job scheduled for point distribution on the 5th of every month.');
