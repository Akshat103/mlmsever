const express = require('express');
const router = express.Router();
const rewardThresholdController = require('../controllers/rewardThresholdController');
const authenticate = require('../middlewares/authMiddleware');

router.post('/create', authenticate, rewardThresholdController.createThreshold);
router.get('/get-all', authenticate, rewardThresholdController.getAllThresholds);
router.get('/:points', authenticate, rewardThresholdController.getThresholdByPoints);
router.put('/:points', authenticate, rewardThresholdController.updateThresholdByPoints);
router.delete('/:points', authenticate, rewardThresholdController.deleteThresholdByPoints);

module.exports = router;