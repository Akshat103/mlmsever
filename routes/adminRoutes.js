const express = require('express');
const { updateAdmin, deleteAdmin, getAllAdmins } = require('../controllers/adminController');
const authenticate = require('../middlewares/authMiddleware');
const isAdmin = require('../middlewares/isAdmin');
const router = express.Router();

// Get all admins
router.get('/get-all', authenticate, isAdmin, getAllAdmins);

// Update admin
router.put('/:id', authenticate, isAdmin, updateAdmin);

// Delete admin
router.delete('/:id', authenticate, isAdmin, deleteAdmin);

module.exports = router;
