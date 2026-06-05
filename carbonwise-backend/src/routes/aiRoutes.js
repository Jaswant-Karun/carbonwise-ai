const express = require("express");
const router = express.Router();
const { generateEcoPlan } = require("../controllers/aiController");
//Added new Activity
router.post("/eco-plan", generateEcoPlan);

module.exports = router;