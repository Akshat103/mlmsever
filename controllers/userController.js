const User = require('../models/User');
const bcrypt = require('bcrypt');
const { registrationQueue } = require('../queues/registrationQueue');
const { v4: uuidv4 } = require('uuid');
const successHandler = require('../middlewares/successHandler');
const logger = require('../config/logger');

// Generate 10-character alphanumeric userId
const generateId = () => uuidv4().replace(/-/g, '').toUpperCase().slice(0, 10);

// Define job processor for registrationQueue
registrationQueue.process(async (job) => {
    const { password, parentId, userId, ...rest } = job.data;
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

            const newCustomer = new User({
                ...rest,
                password,
                userId,
                parent: actualParent.userId,
                referredBy: parentId,
            });
            await newCustomer.save();

            actualParent.children.push(userId);
            intendedParent.referredCustomers.push(userId);
            await actualParent.save();
            await intendedParent.save();

            await updateAncestors(actualParent.userId);
        } else {
            const newCustomer = new User({
                ...rest,
                password,
                userId,
                referredBy: null,
            });
            await newCustomer.save();
        }

        logger.info(`Customer with userId ${userId} registered successfully.`);
        return { message: "Customer registered successfully.", userId };
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

// Create a new user
const createUser = async (req, res, next) => {
    const session = await User.startSession();
    try {
        session.startTransaction();

        const { parentId, password, ...rest } = req.body;

        if (password.length < 8 || !/^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z\d]+$/.test(password)) {
            throw new Error('Password must be alphanumeric and at least 8 characters long.');
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = generateId();

        const job = await registrationQueue.add({
            ...rest,
            password: hashedPassword,
            parentId,
            userId,
        });

        job.finished()
            .then(result => {
                session.commitTransaction();
                session.endSession();
                logger.info(`User created successfully: ${userId}`);
                res.status(201).json(result);
            })
            .catch(error => {
                session.abortTransaction();
                session.endSession();
                logger.error(`Error processing registration for userId ${userId}: ${error.message}`);
                res.status(500).json({
                    error: "An error occurred while processing your registration: " + error.message,
                });
            });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        logger.error(`Transaction failed while creating user: ${error.message}`);
        next(error);
    }
};

// Get all users
const getAllUsers = async (req, res, next) => {
    try {
        const users = await User.find().select('-password -__v');
        logger.info('All users retrieved successfully');
        successHandler(res, users, 'Users retrieved successfully');
    } catch (err) {
        logger.error(`Error retrieving users: ${err.message}`);
        next(err);
    }
};

// Get user by ID
const getUserById = async (req, res, next) => {
    try {
        const user = await User.findOne({ userId: req.params.id }).select('-password -__v').populate("wallet");

        if (!user) {
            logger.warn(`User not found: ${req.params.id}`);
            return res.status(404).json({ message: 'User not found' });
        }

        const wallet = user.wallet;
        wallet.resetMonthlyBalance();

        const isEligible = await wallet.isEligibleForWithdrawal();
        const withdrawableAmount = wallet.withdrawableAmount;

        await wallet.save();

        successHandler(res, {
            user,
            withdrawableAmount,
            isEligibleForWithdrawal: isEligible
        }, 'User retrieved successfully');
    } catch (err) {
        logger.error(`Error retrieving userId ${req.params.id}: ${err.message}`);
        next(err);
    }
};

// Update user
const updateUser = async (req, res, next) => {
    try {
        const user = await User.findOneAndUpdate({ userId: req.params.id }, req.body, { new: true });
        if (!user) {
            logger.warn(`User not found for update: ${req.params.id}`);
            return res.status(404).json({ message: 'User not found' });
        }
        logger.info(`User updated successfully: ${req.params.id}`);
        successHandler(res, null, 'User updated successfully');
    } catch (err) {
        logger.error(`Error updating userId ${req.params.id}: ${err.message}`);
        next(err);
    }
};

// Get user hierarchy
const getHierarchy = async (req, res) => {
    try {
        const buildCustomerData = async (customerId) => {
            const customer = await User.findOne({ userId: customerId });
            if (!customer) {
                logger.warn(`Customer with userId ${customerId} not found`);
                return null;
            }

            const children = await Promise.all(
                (customer.children || []).map(childId => buildCustomerData(childId))
            );

            return {
                name: customer.userId,
                level: customer.level,
                parents: await getParents(customer.userId),
                immediate_children: customer.children,
                referred_customers: customer.referredCustomers,
                referred_customers_count: customer.referredCustomersCount,
                children: children.filter(child => child !== null),
                child_count: customer.childCount,
                total_descendant_count: customer.totalDescendantsCount,
                is_complete: customer.isComplete,
                referred_by: customer.referredBy
            };
        };

        const getParents = async (customerId) => {
            const parents = [];
            let current = await User.findOne({ userId: customerId });
            while (current && current.parent) {
                parents.unshift(current.parent);
                current = await User.findOne({ userId: current.parent });
            }
            return parents;
        };

        const rootCustomers = await User.find({ parent: null });
        const hierarchy = await Promise.all(rootCustomers.map(customer => buildCustomerData(customer.userId)));
        res.json({ hierarchy: hierarchy.filter(item => item !== null) });
    } catch (error) {
        logger.error("Error in /hierarchy route: " + error.message);
        res.status(500).json({ error: "An error occurred while fetching the hierarchy." });
    }
};

// Reset the system
const resetSystem = async (req, res) => {
    try {
        await User.deleteMany({});
        logger.info("System reset successfully.");
        res.json({ message: "System reset successfully." });
    } catch (error) {
        logger.error("Error while resetting the system: " + error.message);
        res.status(500).json({ error: "An error occurred while resetting the system." });
    }
};

module.exports = {
    createUser,
    getAllUsers,
    getUserById,
    updateUser,
    getHierarchy,
    resetSystem
};
