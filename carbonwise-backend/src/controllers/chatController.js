const { generateChatResponse, buildDeterministicChatReply } = require('../services/geminiChatService');
const db = require('../config/db');

exports.chat = async (req, res) => {
  let activities = [];
  try {
    const { message = '' } = req.body || {};
    const activitiesResult = await db.query(
      'SELECT activity_type, details, carbon_emissions, date FROM activities WHERE user_id = $1 ORDER BY date DESC LIMIT 20',
      [req.user.id],
    );
    activities = activitiesResult.rows || [];
    const reply = await generateChatResponse(message, activities, { userId: req.user.id });
    res.json({ reply });
  } catch (error) {
    console.error('Chat controller error:', error);
    const reply = buildDeterministicChatReply(req.body?.message || '', activities);
    res.json({ reply });
  }
};