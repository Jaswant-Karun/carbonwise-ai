const express = require('express');
const { protect } = require('../middlewares/authMiddleware');
const {
  createRegion,
  getSummary,
  listAlerts,
  listRegions,
  refreshRegion,
  updateAlert,
} = require('../controllers/environmentController');

const router = express.Router();
router.use(protect);
router.get('/regions', listRegions);
router.post('/regions', createRegion);
router.get('/regions/:regionId/summary', getSummary);
router.post('/regions/:regionId/refresh', refreshRegion);
router.get('/alerts', listAlerts);
router.patch('/alerts/:alertId', updateAlert);

module.exports = router;
