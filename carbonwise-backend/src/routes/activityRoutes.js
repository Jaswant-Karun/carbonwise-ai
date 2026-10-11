const express = require('express');
const router = express.Router();
const { addActivity, getActivities, deleteActivity } = require('../controllers/activityController');
const { protect } = require('../middlewares/authMiddleware');
//Added new Activity
router.post('/', protect, addActivity);
router.get('/', protect, getActivities);
router.delete('/:id', protect, deleteActivity);

module.exports = router;
