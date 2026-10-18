const express = require('express');
const { protect } = require('../middlewares/authMiddleware');
const {
  createRegion,
  getClimateForecasts,
  getClimateProjections,
  getClimateTrends,
  getOverview,
  getRegionAnomalies,
  getSummary,
  listAlerts,
  listRegions,
  refreshRegion,
  searchLocationSuggestions,
  updateAlert,
} = require('../controllers/environmentController');

const router = express.Router();

// Read-only overview (accessible with protect)
router.get('/overview', protect, getOverview);

// Location geocoding suggestions
router.get('/locations/search', protect, searchLocationSuggestions);

// Regional endpoints
router.get('/regions', protect, listRegions);
router.post('/regions', protect, createRegion);
router.get('/regions/:regionId/summary', protect, getSummary);
router.get('/regions/:regionId/anomalies', protect, getRegionAnomalies);
router.get('/regions/:regionId/trends', protect, getClimateTrends);
router.get('/regions/:regionId/forecasts', protect, getClimateForecasts);
router.get('/regions/:regionId/climate-projections', protect, getClimateProjections);
router.post('/regions/:regionId/refresh', protect, refreshRegion);

// Alerts endpoints
router.get('/alerts', protect, listAlerts);
router.patch('/alerts/:alertId', protect, updateAlert);

module.exports = router;
