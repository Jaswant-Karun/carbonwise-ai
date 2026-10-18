const { generateChatResponse } = require("../services/geminiChatService");

exports.chat = async (req, res) => {

  try {

    const { message } = req.body;

    const activitiesResult = await require('../config/db').query(
      'SELECT activity_type, details, carbon_emissions, date FROM activities WHERE user_id = $1 ORDER BY date DESC LIMIT 10',
      [req.user.id],
    );
    const reply = await generateChatResponse(message, activitiesResult.rows, { userId: req.user.id });

    res.json({ reply });

  } catch (error) {

    console.error(error);

    res.json({
      reply: "Sorry, I am having trouble connecting to my climate database right now."
    });

  }

};