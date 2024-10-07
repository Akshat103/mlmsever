const express = require('express');
const router = express.Router();
const rewardThresholdController = require('../controllers/rewardThresholdController');
const authenticate = require('../middlewares/authMiddleware');
const isAdmin = require('../middlewares/isAdmin');

router.post('/create', authenticate, isAdmin, rewardThresholdController.createThreshold);
router.get('/get-all', authenticate,  isAdmin, rewardThresholdController.getAllThresholds);
router.get('/:points', authenticate,  isAdmin, rewardThresholdController.getThresholdByPoints);
router.put('/:points', authenticate,  isAdmin, rewardThresholdController.updateThresholdByPoints);
router.delete('/:points', authenticate,  isAdmin, rewardThresholdController.deleteThresholdByPoints);

module.exports = router;