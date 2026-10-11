const express = require('express');
const {
  compareScenarios,
  createScenario,
  deleteScenario,
  getScenario,
  getScenarios,
  previewScenario,
  updateScenario,
} = require('../controllers/scenarioController');
const { protect } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(protect);
router.post('/preview', previewScenario);
router.post('/compare', compareScenarios);
router.post('/', createScenario);
router.get('/', getScenarios);
router.get('/:id', getScenario);
router.put('/:id', updateScenario);
router.delete('/:id', deleteScenario);

module.exports = router;
