const express = require('express');
const router = express.Router();
const { addActivity, getActivities } = require('../controllers/activityController');
const { protect } = require('../middlewares/authMiddleware');

router.post('/', protect, addActivity);
router.get('/', protect, getActivities);

module.exports = router;
