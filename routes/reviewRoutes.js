const express = require('express');
const { addReview, deleteReview } = require('../controllers/reviewController');
const router = express.Router();
const authenticate = require('../middlewares/authMiddleware');

router.post('/add', authenticate, addReview);
router.delete('/:reviewId', authenticate, deleteReview);

module.exports = router;
