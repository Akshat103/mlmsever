const Bull = require('bull');
const CONCURRENCY = 1;

const logger = require("../config/logger");
const User = require("../models/User");
const Wallet = require("../models/Wallet");

const DIRECT_PLAN_COMMISSION = 0.2;
const LEVEL_PLAN_COMMISSION = 0.05;
const MAX_RETRIES = 3;
const INITIAL_BACKOFF = 1000; // 1 second

const unifiedQueue = new Bull('unifiedQueue', {
    settings: {
        lockDuration: 30000, // 30 seconds
        lockRenewTime: 15000, // 15 seconds
    }
});

unifiedQueue.process(CONCURRENCY, async (job) => {
    return processWithRetry(job);
});

async function processWithRetry(job) {
    let retries = 0;
    while (retries < MAX_RETRIES) {
        try {
            const result = await processJob(job);
            return result;
        } catch (error) {
            if (retries < MAX_RETRIES) {
                retries++;
                const backoff = INITIAL_BACKOFF * Math.pow(2, retries);
                logger.warn(`Retrying job ${job.id} after ${backoff}ms. Attempt ${retries + 1} of ${MAX_RETRIES}`);
                await new Promise(resolve => setTimeout(resolve, backoff));
            } else {
                logger.error(`Max retries reached for job ${job.id}: ${error.message}`);
                throw error;
            }
        }
    }
    throw new Error(`Max retries (${MAX_RETRIES}) reached for job ${job.id}`);
}

async function processJob(job) {
    try {
        const { parentId, userId, points, referredBy } = job.data;

        if (parentId) {
            const intendedParent = await User.findOne({ userId: parentId });
            if (!intendedParent) {
                throw new Error(`Parent with userId ${parentId} not found.`);
            }

            const actualParent = await findNextAvailableSpot(parentId);
            if (!actualParent) {
                logger.warn(`No available spot found for userId ${userId}.`);
                return { success: false, message: 'No available spot found in the entire tree.' };
            }

            if (actualParent.depth === 15) {
                logger.warn(`Customer ${userId} cannot be registered. 15 Levels Reached for parent ${parentId}.`);
                throw new Error("15 Levels Reached.");
            }

            await updateReferredCustomerCount(intendedParent.userId);
            await updateAncestorsDescendantCount(actualParent.userId);

            const bulkOps = [
                { updateOne: { filter: { userId: userId }, update: { $set: { isActive: true, parent: actualParent.userId, depth: (actualParent.depth + 1) } } } },
                { updateOne: { filter: { userId: actualParent.userId }, update: { $push: { children: userId } } } },
                { updateOne: { filter: { userId: intendedParent.userId }, update: { $push: { referredCustomers: userId } } } },
            ];

            await User.bulkWrite(bulkOps);
            logger.info(`User ${userId} activated and assigned to parent ${actualParent.userId}.`);

            await updateAncestors(userId);
        }
        else{
            await User.findOneAndUpdate(
                { userId, isActive: false },
                { $set: { isActive: true } },
                { new: true, runValidators: true }
            );
            logger.info(`User ${userId} activated.`);
        }

        const user = await User.findOne({ userId });
        await processCommissions(user, points, referredBy);
        logger.info(`Processing completed successfully for user ${userId}`);
        return { message: "Processing completed successfully.", userId, success: true };
    } catch (error) {
        logger.error(`Error processing job ${job.id}: ${error.message}`);
        throw error;
    }
}

async function updateAncestorsDescendantCount(userId) {
    try {
        let currentAncestor = await User.findOne({ userId });
        while (currentAncestor) {
            await updateTotalDescendantsCount(currentAncestor.userId);
            currentAncestor = await User.findOne({ userId: currentAncestor.parent });
        }
    } catch (error) {
        logger.error(`Error updating ancestor descendant count for userId ${userId}: ${error.message}`);
        throw error;
    }
}

async function updateAncestors(customerId) {
    try {
        logger.info(`Updating ancestors for customerId: ${customerId}`);
        let current = await User.findOne({ userId: customerId });

        while (current) {
            await updateTotalDescendantsCount(current.userId);
            await updateReferredCustomerCount(current.userId);
            current.childCount = current.children.length;
            current.isComplete = current.children.length === 3;

            if (current.children.length === 3) {
                const childLevels = await Promise.all(current.children.map(async (childId) => {
                    const child = await User.findOne({ userId: childId });
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

            await current.save();
            logger.info(`Updated userId: ${current.userId} with level: ${current.level}, totalDescendantsCount: ${current.totalDescendantsCount}`);

            current = await User.findOne({ userId: current.parent });
        }
        logger.info(`Updating ancestors for customerId: ${customerId} completed.`);
    } catch (error) {
        logger.error(`Error updating ancestors for customerId ${customerId}: ${error.message}`);
        throw error;
    }
}

async function updateTotalDescendantsCount(userId) {
    try {
        const result = await User.aggregate([
            { $match: { userId } },
            {
                $graphLookup: {
                    from: "users",
                    startWith: "$children",
                    connectFromField: "children",
                    connectToField: "userId",
                    as: "descendants"
                }
            },
            {
                $project: {
                    totalDescendantsCount: { $size: "$descendants" }
                }
            }
        ]);

        if (result.length > 0) {
            await User.updateOne(
                { userId },
                { $set: { totalDescendantsCount: result[0].totalDescendantsCount } }
            );
        }
    } catch (error) {
        logger.error(`Error updating total descendants count for userId ${userId}: ${error.message}`);
        throw error;
    }
}

async function updateReferredCustomerCount(userId) {
    try {
        const user = await User.findOne({ userId });
        if (user) {
            user.referredCustomersCount = user.referredCustomers.length;
            await user.save();
        }
    } catch (error) {
        logger.error(`Error updating referred customer count for userId ${userId}: ${error.message}`);
        throw error;
    }
}

async function processCommissions(user, points, referredBy) {
    try {
        const userWallet = await Wallet.findOne({ userId: user.userId });
        if (userWallet) {
            await userWallet.addDirectIncomePersonal(points);
        }

        if (referredBy) {
            const referrer = await User.findOne({ userId: referredBy });
            if (referrer) {
                const referrerWallet = await Wallet.findOne({ userId: referrer.userId });
                const directCommission = points * DIRECT_PLAN_COMMISSION;
                if (referrerWallet) {
                    await referrerWallet.addDirectIncome(directCommission);
                }
            }
        }

        let currentUser = user;
        const parents = [];
        while (currentUser && currentUser.parent) {
            const parent = await User.findOne({ userId: currentUser.parent });
            if (!parent) break;
            parents.push(parent);
            currentUser = parent;
        }

        for (const parent of parents) {
            const levelCommission = points * LEVEL_PLAN_COMMISSION;
            const parentWallet = await Wallet.findOne({ userId: parent.userId });

            if (parentWallet) {
                await parentWallet.addLevelIncome(levelCommission);
            }
        }
    } catch (error) {
        logger.error(`Error processing commissions for user ${user.userId}: ${error.message}`);
        throw error;
    }
}

async function findNextAvailableSpot(startNodeId) {
    try {
        logger.info(`Finding next available spot starting from userId: ${startNodeId}`);
        let currentStartNode = await User.findOne({ userId: startNodeId });
        if (!currentStartNode) {
            logger.warn(`Start node with userId ${startNodeId} not found.`);
            return null;
        }

        while (currentStartNode) {
            const queue = [currentStartNode];
            while (queue.length) {
                const currentNode = queue.shift();
                if (currentNode.children.length < 3 && currentNode.depth < 15) {
                    logger.info(`Available spot found in userId: ${currentNode.userId}`);
                    return currentNode;
                }

                const children = await User.find({ userId: { $in: currentNode.children } });
                queue.push(...children);
            }

            if (currentStartNode.parent) {
                currentStartNode = await User.findOne({ userId: currentStartNode.parent });
                logger.info(`Moving up to parent node: ${currentStartNode.userId}`);
            } else {
                logger.warn(`No available spot found in the entire tree.`);
                return null;
            }
        }

        return null;
    } catch (error) {
        logger.error(`Error finding next available spot for startNodeId ${startNodeId}: ${error.message}`);
        throw error;
    }
}


module.exports = { unifiedQueue, findNextAvailableSpot };
