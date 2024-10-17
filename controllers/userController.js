const mongoose = require('mongoose');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Admin = require('../models/Admin');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const successHandler = require('../middlewares/successHandler');
const logger = require('../config/logger');
const dotenv = require('dotenv');
const BankDetails = require('../models/BankDetails');
const errorHandler = require('../middlewares/errorHandler');
dotenv.config();

// Generate 10-character alphanumeric userId
const generateId = () => uuidv4().replace(/-/g, '').toUpperCase().slice(0, 10);

// Create a new user
const createUser = async (req, res, next) => {
    const session = await mongoose.startSession();
    let responseSent = false;
    try {
        session.startTransaction();

        const { parentId, password, isAdmin, adminKey, ...rest } = req.body;

        // Password validation
        if (password.length < 8) {
            throw new Error('Password must be least 8 characters long.');
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = generateId();
        // Decide whether to create an Admin or a User
        if (adminKey === process.env.ADMIN_KEY) {
            // Create an Admin
            const admin = new Admin({
                ...rest,
                password: hashedPassword,
                isAdmin: true
            });

            await admin.save({ session });

            await session.commitTransaction();
            session.endSession();
            logger.info(`Admin created successfully: ${admin._id}`);
            responseSent = true;
            return res.status(201).json({ success: true, message: 'Admin created successfully', adminId: admin._id });
        } else {
            if (parentId) {
                const parentUser = await User.findOne({ userId: parentId }).session(session);
                if (!parentUser) {
                    throw new Error('Referrer user does not exist.');
                }

                if (!parentUser.isActive) {
                    throw new Error('Referrer user is not active.');
                }

                const newUser = new User({
                    ...rest,
                    userId,
                    password: hashedPassword,
                    referredBy: parentUser.userId,
                });

                await newUser.save({ session });
                await session.commitTransaction();
                logger.info(`User created successfully: ${newUser._id}`);
                responseSent = true;
                return res.status(201).json({ success: true, message: 'User created successfully', userId: newUser.userId, id: newUser._id });
            } else {
                const newUser = new User({
                    ...rest,
                    userId,
                    password: hashedPassword
                });

                await newUser.save({ session });
                await session.commitTransaction();
                logger.info(`User created successfully: ${newUser.userId}`);
                responseSent = true;
                return res.status(201).json({ success: true, message: 'User created successfully', userId: newUser.userId, id: newUser._id });
            }
        }
    } catch (error) {
        await session.abortTransaction();
        session.endSession();

        // Handle duplicate key error
        if (error.code === 11000) {
            console.log("error: ", error);
            logger.error(`Duplicate key error: ${error.message}`);

            const duplicateField = Object.keys(error.keyValue)[0];
            const duplicateValue = error.keyValue[duplicateField];

            if (!responseSent) {
                return res.status(400).json({
                    success: false,
                    error: `${duplicateField}: "${duplicateValue}" already exists. Please use a different value.`,
                });
            }
        }

        // Handle validation errors
        if (error.name === 'ValidationError') {
            logger.error(`Validation failed: ${error.message}`);
            if (!responseSent) {
                return res.status(400).json({
                    success: false,
                    error: `Validation failed: ${Object.values(error.errors).map(err => err.message).join(', ')}`,
                });
            }
        }

        if (error) {
            logger.error(`Transaction failed while creating user/admin: ${error.message}`);
            if (!responseSent) {
                return res.status(400).json({
                    success: false,
                    error: error.message,
                });
            }
        }

        // Handle any other errors
        logger.error(`Transaction failed while creating user/admin: ${error.message}`);
        if (!responseSent) {
            res.status(500).json({
                success: false,
                error: `An error occurred: ${error.message}`,
            });
        }

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
        errorHandler(err, req, res, next);
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

// Get User's Wallet Details
const getWalletDetails = async (req, res) => {
    try {
        const user = await User.findOne({ userId: req.params.userId }).populate('wallet');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        successHandler(res, { wallet: user.wallet }, null);
    } catch (error) {
        console.log(error)
        res.status(500).json({ error: 'Server error' });
    }
};

// Get User's Club Rank
const getClubRank = async (req, res) => {
    try {
        const user = await User.findOne({ userId: req.params.userId });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        successHandler(res, { club: user.club }, null);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

// Get User's Rank Details
const getRankDetails = async (req, res) => {
    try {
        const user = await User.findOne({ userId: req.params.userId });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        successHandler(res, { rank: user.rank, maxMonthlyWithdrawal: user.maxMonthlyWithdrawal }, null);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

// Get Referred Customers
const getReferredCustomers = async (req, res) => {
    try {
        const user = await User.findOne({ userId: req.params.userId });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const referredCustomerDetails = await User.find({
            userId: { $in: user.referredCustomers }
        }).select('name');

        const referredCustomerNames = referredCustomerDetails.map(customer => customer.name);

        successHandler(res, { referredCustomer: referredCustomerNames }, null);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

const updateUserProfile = async (req, res) => {
    try {
        const userId = req.params.userId;
        const serverIp = process.env.SERVER || 'localhost';

        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const encodedFilename = encodeURIComponent(req.file.filename);
        const profileUrl = `${serverIp}/uploads/${encodedFilename}`;

        const updatedUser = await User.findOneAndUpdate(
            { userId: userId },
            { profile: profileUrl },
            { new: true, runValidators: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        logger.info(`Profile updated for user: ${userId}`);
        res.status(200).json({ message: 'Profile updated successfully', user: updatedUser });
    } catch (error) {
        logger.error(`Error updating user profile: ${error.message}`);
        res.status(500).json({ message: 'An error occurred while updating the user profile', error: error.message });
    }
};

const withdrawRequest = async (req, res) => {
    const { amountInRupees } = req.body;

    try {
        // Find the user's wallet by userId
        const wallet = await Wallet.findOne({ userId: req.user.userId });

        if (!wallet) {
            logger.error(`Error generating withdraw request. Wallet not found. userId ${req.user.userId}`);
            return res.status(404).json({ success: false, message: 'Wallet not found.' });
        }

        // Call the withdraw method on the wallet instance
        const withdrawal = await wallet.withdrawRequest(amountInRupees);
        logger.info(`Generated withdraw request userId ${req.user.userId}.`);
        return res.status(200).json({
            success: true,
            message: 'Withdrawal request processed successfully.',
            withdrawal,
        });
    } catch (err) {
        logger.error(`Error generating withdraw request userId ${req.user.userId}: ${err.message}`);
        errorHandler(err, req, res, next);
    }
};

const createWithdrawalRequest = async (req, res) => {
    try {
        const userId = req.user.userId;
        const amountInRupees = parseInt(req.body.amount);

        // Find the user's wallet
        const wallet = await Wallet.findOne({ userId });

        if (!wallet) {
            return res.status(404).json({ message: 'Wallet not found.' });
        }

        // Call withdrawRequest method
        const withdrawalRequest = await wallet.withdrawRequest(amountInRupees);
        console.log(withdrawalRequest)
        logger.info(`Withdraw request created ${req.user.userId}`);
        res.status(201).json({
            success: true,
            message: 'Withdrawal request created successfully.',
            withdrawalRequest,
        });
    } catch (error) {
        // Handle different types of errors
        if (error.message.includes('Requested withdrawal amount exceeds')) {
            return res.status(400).json({ success: false, message: error.message });
        }
        if (error.message.includes('User is not eligible')) {
            return res.status(403).json({ success: false, message: error.message });
        }
        if (error.message.includes('Monthly withdrawal limit reached')) {
            return res.status(403).json({ success: false, message: error.message });
        }
        logger.error(`Error requesting withdraw ${req.user.userId}, Error: ${error.message}`);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

module.exports = {
    createUser,
    getAllUsers,
    getUserById,
    updateUser,
    getHierarchy,
    resetSystem,
    getWalletDetails,
    getClubRank,
    getRankDetails,
    getReferredCustomers,
    updateUserProfile,
    withdrawRequest,
    createWithdrawalRequest
};
