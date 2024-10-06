const express = require('express');
const router = express.Router();
const rewardController = require('../controllers/rewardController');

// Get rewards by userId
router.get('/user/:userId', rewardController.getRewardByUserId);

// Redeem reward by rewardId
router.post('/redeem/:rewardId', rewardController.redeemReward);

module.exports = router;
