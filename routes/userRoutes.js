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

// Auth routes
router.post('/login', authController.loginUser);
router.post('/logout', authenticate, authController.logoutUser);

module.exports = router;
