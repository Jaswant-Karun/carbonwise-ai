const express = require('express');
const router = express.Router();
const {
  addActivity,
  getActivities,
  getActivity,
  updateActivity,
  deleteActivity,
} = require('../controllers/activityController');
const { protect } = require('../middlewares/authMiddleware');

router.use(protect);

router.post('/', addActivity);
router.get('/', getActivities);
router.get('/:id', getActivity);
router.put('/:id', updateActivity);
router.patch('/:id', updateActivity);
router.delete('/:id', deleteActivity);

module.exports = router;
