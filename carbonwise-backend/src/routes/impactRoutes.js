const express = require('express');
const { protect } = require('../middlewares/authMiddleware');
const { createBaseline, createReport, exportReportPdf, getBaselines, getReports } = require('../controllers/impactController');

const router = express.Router();
router.use(protect);
router.post('/baselines', createBaseline);
router.get('/baselines', getBaselines);
router.post('/reports', createReport);
router.get('/reports', getReports);
router.get('/reports/:id/pdf', exportReportPdf);

module.exports = router;
