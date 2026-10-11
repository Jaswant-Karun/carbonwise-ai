const express = require('express');
const { getForecast } = require('../controllers/forecastController');
const { protect } = require('../middlewares/authMiddleware');

const router = express.Router();
router.get('/', protect, getForecast);

module.exports = router;
