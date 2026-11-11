const express = require('express');
const router = express.Router();
const {
  generateReport,
  generateInsights,
  generatePrediction,
  generatePDFReport,
  getDetailedReport,
  downloadCSV,
  getMonthlySustainability,
} = require('../controllers/reportController');
const { protect } = require('../middlewares/authMiddleware');

// Detailed Analytics & Reports Endpoints
router.get('/analytics', protect, getDetailedReport);
router.get('/detailed', protect, getDetailedReport);
router.get('/csv', protect, downloadCSV);
router.get('/monthly-sustainability', protect, getMonthlySustainability);
router.get('/pdf', protect, generatePDFReport);

// Backward-compatible endpoints
router.get('/monthly', protect, generateReport);
router.get('/insights', protect, generateInsights);
router.get('/predict', protect, generatePrediction);
router.get('/prediction', protect, generatePrediction);

module.exports = router;
