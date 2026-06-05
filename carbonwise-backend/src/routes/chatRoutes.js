const express = require("express");
const router = express.Router();
const { chat } = require("../controllers/chatController");
//Added new Activity
router.post("/", chat);

module.exports = router;