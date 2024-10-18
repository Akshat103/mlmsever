const logger = require("../config/logger");
const User = require("../models/User");
const Wallet = require("../models/Wallet");
const Queue = require('bull');
const mongoose = require('mongoose');

const unifiedQueue = new Queue('unifiedQueue');
const DIRECT_PLAN_COMMISSION = 0.2;
const LEVEL_PLAN_COMMISSION = 0.05;
const MAX_RETRIES = 3;
const INITIAL_BACKOFF = 1000; // 1 second

async function processWithRetry(job) {
    let retries = 0;
    while (retries < MAX_RETRIES) {
        try {
            const result = await processJob(job);
            return result;
        } catch (error) {
            if (error.hasErrorLabel('TransientTransactionError') && retries < MAX_RETRIES - 1) {
                retries++;
                const backoff = INITIAL_BACKOFF * Math.pow(2, retries);
                logger.warn(`Retrying job ${job.id} after ${backoff}ms. Attempt ${retries + 1} of ${MAX_RETRIES}`);
                await new Promise(resolve => setTimeout(resolve, backoff));
            } else {
                throw error;
            }
        }
    }
}

unifiedQueue.process(async (job) => {
    return processWithRetry(job);
});

async function processJob(job) {
    const { parentId, userId, points, referredBy } = job.data;
    const session = await mongoose.startSession();

    logger.info(`Processing job with ID: ${job.id}, Parent ID: ${parentId}, Customer ID: ${userId}, Points: ${points}`);

    try {
        session.startTransaction({ maxTimeMS: 120000 });

        // User Registration
        const user = await User.findOne({ userId }).session(session);
        if (!user) {
            throw new Error(`User with userId ${userId} not found.`);
        }

        if (parentId) {
            const intendedParent = await User.findOne({ userId: parentId }).session(session);
            if (!intendedParent) {
                throw new Error(`Parent with userId ${parentId} not found.`);
            }

            if (intendedParent.level === 15) {
                logger.warn(`Customer ${userId} cannot be registered. 15 Levels Reached for parent ${parentId}.`);
                throw new Error("15 Levels Reached.");
            }

            const actualParent = await findNextAvailableSpot(parentId, session);
            if (!actualParent) {
                throw new Error(`Could not find space to add ${userId}.`);
            }

            user.isActive = true;
            user.parent = actualParent.userId;
            logger.info(`User ${user.userId} activated and assigned to parent ${actualParent.userId}.`);

            // Prepare bulk updates
            const bulkOps = [
                { updateOne: { filter: { userId: userId }, update: { $set: { isActive: true, parent: actualParent.userId } } } },
                { updateOne: { filter: { userId: actualParent.userId }, update: { $push: { children: userId } } } },
                { updateOne: { filter: { userId: intendedParent.userId }, update: { $push: { referredCustomers: userId } } } }
            ];

            // Execute bulk updates
            await User.bulkWrite(bulkOps, { session });

            await updateAncestors(actualParent.userId, session);
        }
        else{
            user.isActive = true;
            await user.save({ session });
        }

        // Commission Processing
        await processCommissions(user, points, referredBy, session);

        await session.commitTransaction();
        logger.info(`Job processed successfully for User: ${userId}`);
        return { message: "Processing completed successfully.", userId };
    } catch (error) {
        logger.error("Error processing job:", error.message);
        await session.abortTransaction();
        throw error; // Rethrow the error after aborting the transaction
    } finally {
        session.endSession();
    }
}

async function processCommissions(user, points, referredBy, session) {
    const userWallet = await Wallet.findOne({ userId: user.userId }).session(session);
    if (userWallet) {
        await userWallet.addDirectIncomePersonal(points);
        await userWallet.save({ session });
        logger.info(`Direct income of ${points} points added to user ${user.userId}'s wallet.`);
    }

    if (referredBy) {
        const referrer = await User.findOne({ userId: referredBy }).session(session);
        if (referrer) {
            const referrerWallet = await Wallet.findOne({ userId: referrer.userId }).session(session);
            const directCommission = points * DIRECT_PLAN_COMMISSION;
            if (referrerWallet) {
                await referrerWallet.addDirectIncome(directCommission);
                await referrerWallet.save({ session });
                logger.info(`Direct commission of ${directCommission} points added to referrer ${referrer.userId}`);
            }
        }
    }

    let currentUser = user;
    const parents = [];

    // Traverse up the hierarchy, collecting parents
    while (currentUser && currentUser.parent) {
        const parent = await User.findOne({ userId: currentUser.parent }).session(session);
        if (!parent) break;  // Break if parent is not found

        parents.push(parent);
        currentUser = parent;  // Move up to the next parent
    }

    if (parents.length === 0) {
        logger.info(`User ${user.userId} has no parents in the hierarchy.`);
        return; // Exit if no parents were found, preventing further processing
    }

    const levelCommissions = [];

    // Process each parent and add the level income
    for (const parent of parents) {
        const levelCommission = points * LEVEL_PLAN_COMMISSION;
        const parentWallet = await Wallet.findOne({ userId: parent.userId }).session(session);

        if (parentWallet) {
            // Use the wallet's addLevelIncome method to handle income addition, global pool, rewards, and club membership
            levelCommissions.push(parentWallet.addLevelIncome(levelCommission));

            logger.info(`Level commission of ${levelCommission} points added to parent ${parent.userId}`);
        }
    }

    // Execute all the parent wallet updates in parallel
    await Promise.all(levelCommissions);
}

async function findNextAvailableSpot(startNodeId, session) {
    logger.info(`Finding next available spot starting from userId: ${startNodeId}`);
    const startNode = await User.findOne({ userId: startNodeId }).session(session);
    if (!startNode) {
        logger.warn(`Start node with userId: ${startNodeId} not found.`);
        return null;
    }

    async function recursiveSearch(nodeId) {
        const node = await User.findOne({ userId: nodeId }).session(session);
        if (!node) {
            logger.warn(`Node with userId: ${nodeId} not found.`);
            return null;
        }

        if (node.children.length < 3) {
            logger.info(`Available spot found at userId: ${nodeId}`);
            return node;
        }

        const sortedChildren = await Promise.all(node.children.map(async (childId) => {
            const child = await User.findOne({ userId: childId }).session(session);
            return { userId: childId, descendantCount: child.children.length };
        }));

        sortedChildren.sort((a, b) => a.descendantCount - b.descendantCount);

        for (const child of sortedChildren) {
            const result = await recursiveSearch(child.userId);
            if (result) return result;
        }

        logger.info(`No available spots found under userId: ${nodeId}`);
        return null;
    }

    return recursiveSearch(startNodeId);
}

async function updateAncestors(customerId, session) {
    logger.info(`Updating ancestors for customerId: ${customerId}`);
    let current = await User.findOne({ userId: customerId }).session(session);

    while (current) {
        current.childCount = current.children.length;
        current.isComplete = current.children.length === 3;
        current.referredCustomersCount = current.referredCustomers.length;

        if (current.children.length === 3) {
            const childLevels = await Promise.all(current.children.map(async (childId) => {
                const child = await User.findOne({ userId: childId }).session(session);
                return child.level;
            }));

            if (current.level === (Math.min(...childLevels) + 1)) {
                break;
            }

            current.level = Math.min(...childLevels) + 1;
            if (current.level > 15) {
                current.level = 15;
            }
        } else {
            current.level = 0;
        }

        await current.save({ session });
        logger.info(`Updated userId: ${current.userId} with level: ${current.level}`);

        current = await User.findOne({ userId: current.parent }).session(session);
    }
}

module.exports = { unifiedQueue };
