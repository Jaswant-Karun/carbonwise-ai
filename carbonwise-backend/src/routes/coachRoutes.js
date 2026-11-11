const express = require('express');
const { protect } = require('../middlewares/authMiddleware');
const {
  acceptAction,
  createGoal,
  createPlan,
  dismissAction,
  getGoals,
  getPlan,
  getPlans,
  getRecommendations,
  updateAction,
  updateGoal,
} = require('../controllers/coachController');

const router = express.Router();
router.use(protect);

router.post('/plans', createPlan);
router.get('/plans', getPlans);
router.post('/plan', createPlan);
router.get('/plan', getPlans);
router.get('/plans/:id', getPlan);

router.get('/recommendations', getRecommendations);
router.patch('/actions/:actionId', updateAction);
router.post('/actions/:actionId/accept', acceptAction);
router.post('/actions/:actionId/dismiss', dismissAction);

router.get('/goals', getGoals);
router.post('/goals', createGoal);
router.patch('/goals/:id', updateGoal);

module.exports = router;
