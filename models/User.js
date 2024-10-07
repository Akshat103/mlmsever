const Wallet = require('./Wallet');
const mongoose = require('mongoose');
const validator = require('validator');

const rankDetails = {
    3: { rank: 'Star', maxWithdrawal: 10000 },
    10: { rank: 'Silver', maxWithdrawal: 50000 },
    12: { rank: 'Gold', maxWithdrawal: 100000 },
    15: { rank: 'Ruby', maxWithdrawal: 500000 },
    17: { rank: 'Platinum', maxWithdrawal: 1000000 },
    20: { rank: 'Diamond', maxWithdrawal: 5000000 },
    25: { rank: 'Crown', maxWithdrawal: 10000000 },
};

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        validate: {
            validator: validator.isEmail,
            message: 'Invalid email format'
        }
    },
    phoneNumber: {
        type: String,
        required: true,
        unique: true,
        validate: {
            validator: function (v) {
                return /\d{10}/.test(v);
            },
            message: props => `${props.value} is not a valid phone number!`
        }
    },
    password: {
        type: String,
        required: true
    },
    userId: {
        type: String,
        unique: true,
        required: true,
        index: true
    },
    parent: {
        type: String,
        default: null
    },
    children: [String],
    level: {
        type: Number,
        default: 0
    },
    referredCustomers: [String],
    childCount: {
        type: Number,
        default: 0
    },
    isComplete: {
        type: Boolean,
        default: false
    },
    referredCustomersCount: {
        type: Number,
        default: 0
    },
    totalDescendantsCount: {
        type: Number,
        default: 0
    },
    referredBy: {
        type: String,
        default: null
    },
    wallet: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Wallet'
    },
    rank: {
        type: String,
        default: null
    },
    club: {
        type: String,
        enum: ['None', 'Silver', 'Gold'],
        default: 'None'
    },
    maxMonthlyWithdrawal: {
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: false
    }
});

UserSchema.post('save', function (doc, next) {
    if (doc.isActive) {
        const count = doc.referredCustomersCount;
        const rankDetail = Object.keys(rankDetails).reverse().find(key => count >= key);
        if (rankDetail) {
            doc.rank = rankDetails[rankDetail].rank;
            doc.maxMonthlyWithdrawal = rankDetails[rankDetail].maxWithdrawal;
            doc.save();
        }
    }
    next();
});

UserSchema.post('save', async function (doc, next) {
    const Wallet = mongoose.model('Wallet');
    if (!doc.wallet) {
        const wallet = await Wallet.create({ userId: doc.userId });
        doc.wallet = wallet._id;
        await doc.save();
    }
    next();
});

module.exports = mongoose.model('User', UserSchema);
