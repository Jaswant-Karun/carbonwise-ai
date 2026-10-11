const express = require("express");
const router = express.Router();
const { chat } = require("../controllers/chatController");
const { protect } = require("../middlewares/authMiddleware");
//Added new Activity
router.post("/", protect, chat);

module.exports = router;