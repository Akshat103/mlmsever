const logger = require("../config/logger");
const User = require("../models/User");
const { registrationQueue } = require('./registrationQueue');

// Define job processor for registrationQueue
registrationQueue.process(async (job) => {
    const { parentId, userId } = job.data;
    logger.info(`Processing job with ID: ${job.id}, Parent ID: ${parentId}, Customer ID: ${userId}`);

    try {
        if (parentId) {
            const intendedParent = await User.findOne({ userId: parentId });
            if (!intendedParent) {
                throw new Error(`Parent with userId ${parentId} not found.`);
            }

            if (intendedParent.level === 15) {
                logger.warn(`Customer ${userId} cannot be registered. 15 Levels Reached for parent ${parentId}.`);
                return { message: "15 Levels Reached." };
            }

            const actualParent = await findNextAvailableSpot(parentId);
            if (!actualParent) {
                throw new Error(`Could not find space to add ${userId}.`);
            }

            const user = await User.findOne({ userId: userId });
            user.isActive = true;
            logger.info(`User ${user.userId} activated due to activation product purchase.`);
            user.parent = actualParent.userId;
            await user.save();

            actualParent.children.push(userId);
            intendedParent.referredCustomers.push(userId);
            await actualParent.save();
            await intendedParent.save();

            await updateAncestors(actualParent.userId);
        }

        logger.info(`Customer with userId ${userId} activated successfully.`);
        return { message: "Customer activated successfully.", userId };
    } catch (error) {
        logger.error("Error processing job:", error.message);
        throw new Error("An error occurred while registering the customer: " + error.message);
    }
});

// Helper functions used in the controller
async function findNextAvailableSpot(startNodeId) {
    logger.info(`Finding next available spot starting from userId: ${startNodeId}`);

    const startNode = await User.findOne({ userId: startNodeId });
    if (!startNode) {
        logger.warn(`Start node with userId: ${startNodeId} not found.`);
        return null;
    }

    async function recursiveSearch(nodeId) {
        const node = await User.findOne({ userId: nodeId });
        if (!node) {
            logger.warn(`Node with userId: ${nodeId} not found.`);
            return null;
        }

        if (node.children.length < 3) {
            logger.info(`Available spot found at userId: ${nodeId}`);
            return node;
        }

        const sortedChildren = await Promise.all(node.children.map(async (childId) => {
            const child = await User.findOne({ userId: childId });
            return { userId: childId, descendantCount: child.totalDescendantsCount };
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

async function updateAncestors(customerId) {
    logger.info(`Updating ancestors for customerId: ${customerId}`);

    let current = await User.findOne({ userId: customerId });

    while (current) {
        current.totalDescendantsCount = await getTotalDescendants(current.userId);
        current.childCount = current.children.length;
        current.isComplete = current.children.length === 3;
        current.referredCustomersCount = current.referredCustomers.length;

        if (current.children.length === 3) {
            const childLevels = await Promise.all(current.children.map(async (childId) => {
                const child = await User.findOne({ userId: childId });
                return child.level;
            }));

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
}

async function getTotalDescendants(customerId) {
    const customer = await User.findOne({ userId: customerId });
    if (!customer) {
        logger.warn(`Customer with userId: ${customerId} not found.`);
        return 0;
    }

    let count = customer.children.length;
    logger.info(`Counting descendants for userId: ${customerId}, initial count: ${count}`);

    for (const childId of customer.children) {
        count += await getTotalDescendants(childId);
    }
    logger.info(`Total descendants for userId: ${customerId} is ${count}`);
    return count;
}

module.exports = { registrationQueue };