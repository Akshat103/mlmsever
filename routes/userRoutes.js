const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authController = require('../controllers/authController');
const authenticate = require('../middlewares/authMiddleware');
const isAdmin = require('../middlewares/isAdmin');

// User routes
router.post('/register', userController.createUser);
router.get('/get-all', authenticate, isAdmin, userController.getAllUsers);
router.get('/hierarchy', userController.getHierarchy);
// router.post('/reset', userController.resetSystem);
router.get('/:id', authenticate, userController.getUserById);
router.put('/:id', authenticate, userController.updateUser);
router.get('/:userId/wallet', authenticate, userController.getWalletDetails);
router.get('/:userId/club', authenticate, userController.getClubRank);
router.get('/:userId/rank', authenticate, userController.getRankDetails);
router.get('/:userId/referredCustomers', authenticate, userController.getReferredCustomers);

// Auth routes
router.post('/login', authController.loginUser);
router.post('/logout', authenticate, authController.logoutUser);

module.exports = router;
