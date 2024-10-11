const express = require('express');
const router = express.Router();
const bankDetailsController = require('../controllers/bankDetailsController');
const authenticate = require('../middlewares/authMiddleware');

// Create a new bank details
router.post('/create', authenticate, bankDetailsController.createBankDetails);

// Get bank details by userId
router.get('/:userId', authenticate, bankDetailsController.getBankDetails);

// Update bank details
router.put('/:userId', authenticate, bankDetailsController.updateBankDetails);

module.exports = router;
