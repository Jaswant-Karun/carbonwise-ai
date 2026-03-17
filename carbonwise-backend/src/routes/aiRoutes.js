const express = require("express");
const router = express.Router();
const { generateEcoPlan } = require("../controllers/aiController");

router.post("/eco-plan", generateEcoPlan);

module.exports = router;