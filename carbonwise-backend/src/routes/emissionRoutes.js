const express = require('express');
const router = express.Router();
const {
  getFactors,
  calculate,
  getSummary,
  getActivityEmission,
} = require('../controllers/emissionController');
const { protect } = require('../middlewares/authMiddleware');

// Public or authenticated factor lookup
router.get('/factors', getFactors);

// Standalone calculation engine endpoint
router.post('/calculate', calculate);

// Protected routes (User specific summary & linked activity records)
router.use(protect);
router.get('/summary', getSummary);
router.get('/activity/:activityId', getActivityEmission);

module.exports = router;
