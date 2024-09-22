const User = require('../models/User');
const bcrypt = require('bcrypt');
const successHandler = require('../middlewares/successHandler');

// Create a new user
const createUser = async (req, res, next) => {
    try {
        const { password, ...rest } = req.body;

        if (password.length < 8 || !/^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z\d]+$/.test(password)) {
            throw new Error('Password must be alphanumeric and at least 8 characters long.');
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ ...rest, password: hashedPassword });

        await newUser.save();
        successHandler(res, null, 'User created successfully');
    } catch (err) {
        next(err);
    }
};

// Get all users
const getAllUsers = async (req, res, next) => {
    try {
        const users = await User.find().select('-password -__v');
        successHandler(res, users, 'Users retrieved successfully');
    } catch (err) {
        next(err);
    }
};

// Get user by ID
const getUserById = async (req, res, next) => {
    try {
        console.log(req.params.id)
        const user = await User.findOne({ userId: req.params.id }).select('-password -__v');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        successHandler(res, user, 'User retrieved successfully');
    } catch (err) {
        next(err);
    }
};

// Update user
const updateUser = async (req, res, next) => {
    try {
        const user = await User.findOneAndUpdate({userId:req.params.id}, req.body, { new: true });
        if (!user) return res.status(404).json({ message: 'User not found' });
        successHandler(res, null, 'User updated successfully');
    } catch (err) {
        next(err);
    }
};

module.exports = {
    createUser,
    getAllUsers,
    getUserById,
    updateUser
};
