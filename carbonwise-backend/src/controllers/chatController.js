const askGemini = require("../services/geminiChatService");
const Activity = require("../models/Activity");

exports.chat = async (req, res) => {

  try {

    const { message } = req.body;

    const activities = await Activity.find().limit(10);

    const reply = await askGemini(message, activities);

    res.json({ reply });

  } catch (error) {

    console.error(error);

    res.json({
      reply: "Sorry, I am having trouble connecting to my climate database right now."
    });

  }

};