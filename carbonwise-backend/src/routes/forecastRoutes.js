const express = require('express');
const { getForecast, simulateForecastScenario } = require('../controllers/forecastController');
const { protect } = require('../middlewares/authMiddleware');

const router = express.Router();
router.get('/', protect, getForecast);
router.post('/simulate', protect, simulateForecastScenario);

module.exports = router;
