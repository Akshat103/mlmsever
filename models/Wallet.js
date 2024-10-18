const mongoose = require('mongoose');
const RewardThreshold = require('./RewardThreshold');
const Reward = require('./Reward');
const GlobalPointPool = require('./GlobalPointPool');
const logger = require('../config/logger');

const TransactionSchema = new mongoose.Schema({
    amount: {
        type: Number,
        required: true
    },
    type: {
        type: String,
        enum: ['credit', 'debit'],
        required: true
    },
    description: {
        type: String,
        required: true
    },
    date: {
        type: Date,
        default: Date.now
    }
});

const WithdrawalSchema = new mongoose.Schema({
    amount: {
        type: Number,
        required: true
    },
    date: {
        type: Date,
        default: Date.now
    },
    pointsWithdrawn: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'processed', 'rejected'],
        default: 'pending'
    },
    transactionId: {
        type: String
    },
    image: {
        type: String
    }
});

const WalletSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        unique: true
    },
    currentBalance: {
        type: Number,
        default: 0
    },
    currentMonthlyBalance: {
        type: Number,
        default: 0
    },
    directIncome: {
        current: {
            type: Number,
            default: 0
        },
        monthly: {
            type: Number,
            default: 0
        }
    },
    levelIncome: {
        current: {
            type: Number,
            default: 0
        },
        monthly: {
            type: Number,
            default: 0
        }
    },
    transactions: [TransactionSchema],
    withdrawals: [WithdrawalSchema],
    lastResetDate: {
        type: Date,
        default: Date.now
    }
});

// Virtual property to calculate withdrawable amount
WalletSchema.virtual('withdrawableAmount').get(function () {
    if (this.currentMonthlyBalance < 500) {
        return 0;
    }
    const grossAmountInRupees = Math.floor(this.currentBalance / 5);
    const tdsAndAdminCharges = grossAmountInRupees * 0.1;
    return grossAmountInRupees - tdsAndAdminCharges;
});

// Method to check if user is eligible for withdrawal
WalletSchema.methods.isEligibleForWithdrawal = async function () {
    const User = mongoose.model('User');
    const user = await User.findOne({ userId: this.userId });
    return user.referredCustomersCount >= 3 && this.currentMonthlyBalance >= 500;
};

// Method to reset monthly balance
WalletSchema.methods.resetMonthlyBalance = function () {
    const now = new Date();
    const lastReset = new Date(this.lastResetDate);
    if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
        this.currentMonthlyBalance = 0;
        this.directIncome.monthly = 0;
        this.levelIncome.monthly = 0;
        this.lastResetDate = now;
    }
};

WalletSchema.methods.addDirectIncomePersonal = async function (amount) {
    const User = mongoose.model('User');
    const user = await User.findOne({ userId: this.userId });

    if (user.isActive) {
        this.directIncome.current += amount;
        this.directIncome.monthly += amount;
        this.currentBalance += amount;
        this.currentMonthlyBalance += amount;

        const transaction = {
            amount: amount,
            type: 'credit',
            description: 'Direct income added for buying item.'
        };
        this.transactions.push(transaction);

        await this.updateGlobalPointPool(amount);
        await this.checkForReward();
        await this.assignClubMembership();

        await this.save();
    }
};

WalletSchema.methods.addDirectIncome = async function (amount) {
    const User = mongoose.model('User');
    const user = await User.findOne({ userId: this.userId });

    if (user.isActive) {
        this.directIncome.current += amount;
        this.directIncome.monthly += amount;
        this.currentBalance += amount;
        // this.currentMonthlyBalance += amount;

        const transaction = {
            amount: amount,
            type: 'credit',
            description: 'Direct income added for referral.'
        };
        this.transactions.push(transaction);

        await this.updateGlobalPointPool(amount);
        await this.checkForReward();
        await this.assignClubMembership();

        await this.save();
    }
};

WalletSchema.methods.addLevelIncome = async function (amount) {
    const User = mongoose.model('User');
    const user = await User.findOne({ userId: this.userId });

    if (user.isActive) {
        this.levelIncome.current += amount;
        this.levelIncome.monthly += amount;
        this.currentBalance += amount;
        // this.currentMonthlyBalance += amount;

        const transaction = {
            amount: amount,
            type: 'credit',
            description: 'Level income added'
        };
        this.transactions.push(transaction);

        logger.info(`Level commission of ${amount} points added to parent ${this.userId}`);

        await this.updateGlobalPointPool(amount);
        await this.checkForReward();
        await this.assignClubMembership();

        await this.save();
    }
};

WalletSchema.methods.updateGlobalPointPool = async function (amount) {
    try {
        const globalPointPool = await GlobalPointPool.findOrCreateForCurrentMonth();
        globalPointPool.totalMonthlyPoints += amount;

        logger.info(`Global point pool updated: ${JSON.stringify(globalPointPool.totalMonthlyPoints)}`);

        await globalPointPool.save();
    } catch (error) {
        logger.error(`Error updating global point pool: ${error.message}`);
    }
};

WalletSchema.methods.checkForReward = async function () {
    const rewardThreshold = await RewardThreshold.findOne({ points: { $lte: this.currentBalance } }).sort({ points: -1 });

    if (rewardThreshold) {
        const existingReward = await Reward.findOne({ userId: this.userId, points: rewardThreshold.points });

        if (!existingReward) {
            const reward = new Reward({
                userId: this.userId,
                points: rewardThreshold.points,
                rewardPoints: rewardThreshold.rewardPoints,
                description: rewardThreshold.description
            });
            await reward.save();
        }
    }
};

// Virtual property for determining club membership based on monthly spending
WalletSchema.virtual('clubMembership').get(function () {
    if (this.currentMonthlyBalance >= 10000) {
        return 'Gold';
    } else if (this.currentMonthlyBalance >= 5000) {
        return 'Silver';
    } else {
        return 'None';
    }
});

// Method to assign club membership based on monthly balance
WalletSchema.methods.assignClubMembership = async function () {
    const membership = this.clubMembership;
    const User = mongoose.model('User');
    const user = await User.findOne({ userId: this.userId });

    if (membership === 'Gold' || membership === 'Silver') {
        user.club = membership;
        await user.save();
    }
};

// Method to process a withdrawal in rupees
WalletSchema.methods.withdrawRequest = async function (amountInRupees) {

    amountInRupees = Math.floor(amountInRupees);

    if (amountInRupees > this.withdrawableAmount) {
        throw new Error('Requested withdrawal amount exceeds the available withdrawable amount.');
    }

    const isEligible = await this.isEligibleForWithdrawal();
    if (!isEligible) {
        throw new Error('User is not eligible for withdrawal.');
    }

    const User = mongoose.model('User');
    const user = await User.findOne({ userId: this.userId });

    if (amountInRupees > user.maxMonthlyWithdrawal) {
        throw new Error(`Monthly withdrawal limit reached for rank ${user.rank}. Max allowed: ₹${user.maxMonthlyEarnings}`);
    }

    const amountInPoints = Math.floor(amountInRupees * 5);
    const pointsToWithdraw = Math.floor(amountInPoints / 0.9);

    const withdrawal = {
        amount: amountInRupees,
        status: 'pending',
        pointsWithdrawn: pointsToWithdraw
    };

    this.withdrawals.push(withdrawal);

    await this.save();

    return withdrawal;
};

WalletSchema.methods.withdraw = async function (withdrawalId, transactionId, image) {
    const withdrawal = this.withdrawals.id(withdrawalId);

    if (!withdrawal) {
        throw new Error('Withdrawal request not found.');
    }

    if (withdrawal.status !== 'pending') {
        throw new Error('Withdrawal request is not pending.');
    }

    // Check available balance for processing
    if (this.withdrawableAmount < withdrawal.amount) {
        throw new Error('Insufficient balance to process the withdrawal.');
    }

    // Process withdrawal
    withdrawal.status = 'processed';
    withdrawal.transactionId = transactionId;
    withdrawal.image = image;

    // Deduct amount from current balance
    this.currentBalance -= withdrawal.pointsWithdrawn;
    await this.save();

    return withdrawal;
};

WalletSchema.methods.reject = async function (withdrawalId) {
    const withdrawal = this.withdrawals.id(withdrawalId);

    if (!withdrawal) {
        throw new Error('Withdrawal request not found.');
    }

    if (withdrawal.status !== 'pending') {
        throw new Error('Withdrawal request is not pending.');
    }

    // Update status to rejected
    withdrawal.status = 'rejected';
    await this.save();

    return withdrawal;
};

module.exports = mongoose.model('Wallet', WalletSchema);
