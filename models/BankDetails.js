const mongoose = require('mongoose');

const BankDetailsSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        unique: true
    },
    bankAccountNumber: {
        type: String,
        required: true,
        unique: true,
    },
    bankName: {
        type: String,
        required: true,
    },
    ifscCode: {
        type: String,
        required: true,
    },
    aadharCardNumber: {
        type: String,
        required: true,
        unique: true,
    },
    panNumber: {
        type: String,
        required: true,
        unique: true,
    },
});

const BankDetails = mongoose.model('BankDetails', BankDetailsSchema);
module.exports = BankDetails;
