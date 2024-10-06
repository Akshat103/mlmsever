const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authController = require('../controllers/authController');
const authenticate = require('../middlewares/authMiddleware');

// User routes
router.post('/register', userController.createUser);
router.get('/get-all', authenticate, userController.getAllUsers);
router.get('/hierarchy', userController.getHierarchy);
router.post('/reset', userController.resetSystem);
router.get('/:id', authenticate, userController.getUserById);
router.put('/:id', authenticate, userController.updateUser);

// Auth routes
router.post('/login', authController.loginUser);
router.post('/logout', authController.logoutUser);

module.exports = router;
