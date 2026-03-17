const express = require('express');
const router = express.Router();
const {
  generateReport,
  generateInsights,
  generatePrediction,
  generatePDFReport
} = require('../controllers/reportController');

const { protect } = require('../middlewares/authMiddleware');

router.get('/monthly', protect, generateReport);
router.get('/insights', protect, generateInsights);
router.get('/predict', protect, generatePrediction);
router.get('/pdf', protect, generatePDFReport);

module.exports = router;