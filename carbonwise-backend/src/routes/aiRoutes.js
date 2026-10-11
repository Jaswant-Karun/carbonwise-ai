const express = require("express");
const router = express.Router();
const { generateEcoPlan } = require("../controllers/aiController");
const { protect } = require("../middlewares/authMiddleware");
//Added new Activity
router.post("/eco-plan", protect, generateEcoPlan);

module.exports = router;