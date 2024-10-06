const User = require('../models/User');
const bcrypt = require('bcrypt');
const { registrationQueue } = require('../queues/registrationQueue');
const { v4: uuidv4 } = require('uuid');
const successHandler = require('../middlewares/successHandler');

// Generate 10-character alphanumeric userId
const generateId = () => uuidv4().replace(/-/g, '').toUpperCase().slice(0, 10);

// Define job processor for registrationQueue
registrationQueue.process(async (job) => {
    const { password, parentId, userId, ...rest } = job.data;
    console.log(`Processing job with ID: ${job.id}, Parent ID: ${parentId}, Customer ID: ${userId}`);

    try {
        if (parentId) {
            const intendedParent = await User.findOne({ userId: parentId });
            if (!intendedParent) {
                throw new Error(`Parent with userId ${parentId} not found.`);
            }

            if (intendedParent.level === 15) {
                return { message: "15 Levels Reached."}
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

        console.log(`Customer with userId ${userId} registered successfully.`);
        return { message: "Customer registered successfully.", userId };
    } catch (error) {
        console.error("Error processing job:", error.message);
        throw new Error("An error occurred while registering the customer: " + error.message);
    }
});

// Helper functions used in the controller
async function findNextAvailableSpot(startNodeId) {
    const startNode = await User.findOne({ userId: startNodeId });
    if (!startNode) return null;

    async function recursiveSearch(nodeId) {
        const node = await User.findOne({ userId: nodeId });
        if (!node) return null;

        if (node.children.length < 3) {
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

        return null;
    }

    return recursiveSearch(startNodeId);
}

async function updateAncestors(customerId) {
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
        current = await User.findOne({ userId: current.parent });
    }
}

async function getTotalDescendants(customerId) {
    const customer = await User.findOne({ userId: customerId });
    if (!customer) return 0;

    let count = customer.children.length;
    for (const childId of customer.children) {
        count += await getTotalDescendants(childId);
    }
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
                res.status(201).json(result);
            })
            .catch(error => {
                session.abortTransaction();
                session.endSession();
                res.status(500).json({
                    error: "An error occurred while processing your registration: " + error.message,
                });
            });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        next(error);
    }
};

// Get all users
const getAllUsers = async (req, res, next) => {
    try {
        const users = await User.find().select('-password -__v');
        successHandler(res, users, 'Users retrieved successfully');
    } catch (err) {
        next(err);
    }
};

// Get user by ID
const getUserById = async (req, res, next) => {
    try {
        const user = await User.findOne({ userId: req.params.id }).select('-password -__v').populate("wallet");

        if (!user) {
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
        next(err);
    }
};

// Update user
const updateUser = async (req, res, next) => {
    try {
        const user = await User.findOneAndUpdate({ userId: req.params.id }, req.body, { new: true });
        if (!user) return res.status(404).json({ message: 'User not found' });
        successHandler(res, null, 'User updated successfully');
    } catch (err) {
        next(err);
    }
};

const getHierarchy = async (req, res) => {
    try {
        const buildCustomerData = async (customerId) => {
            const customer = await User.findOne({ userId: customerId });
            if (!customer) {
                console.warn(`Customer with userId ${customerId} not found`);
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
        console.error("Error in /hierarchy route:", error);
        res.status(500).json({ error: "An error occurred while fetching the hierarchy." });
    }
};

const resetSystem = async (req, res) => {
    try {
        await User.deleteMany({});
        res.json({ message: "System reset successfully." });
    } catch (error) {
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
