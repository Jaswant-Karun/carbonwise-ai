const express = require('express');
const { protect } = require('../middlewares/authMiddleware');
const {
  createGoal, createPlan, getGoals, getPlan, getPlans, updateAction, updateGoal,
} = require('../controllers/coachController');

const router = express.Router();
router.use(protect);
router.post('/plans', createPlan);
router.get('/plans', getPlans);
router.get('/plans/:id', getPlan);
router.patch('/actions/:actionId', updateAction);
router.get('/goals', getGoals);
router.post('/goals', createGoal);
router.patch('/goals/:id', updateGoal);

module.exports = router;
