const express = require('express');
const { getCarbonIntelligence } = require('../controllers/intelligenceController');
const { protect } = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/', protect, getCarbonIntelligence);

module.exports = router;
