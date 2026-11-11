const express = require('express');
const router = express.Router();
const { registerUser, loginUser, getMe, loginDemo } = require('../controllers/authController');
const { protect } = require('../middlewares/authMiddleware');
//Added new Activity
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/demo', loginDemo);
router.get('/me', protect, getMe);

module.exports = router;
