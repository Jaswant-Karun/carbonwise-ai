const generateEcoPlan = require('../services/geminiChatService');
const { buildDeterministicEcoPlan } = require('../services/geminiChatService');
const db = require('../config/db');

exports.generateEcoPlan = async (req, res) => {
  let activities = [];
  try {
    const result = await db.query(
      'SELECT activity_type, details, carbon_emissions, date FROM activities WHERE user_id = $1 ORDER BY date ASC',
      [req.user.id],
    );
    activities = result.rows || [];
    const plan = await generateEcoPlan(activities, { userId: req.user.id, dataVersion: `activities-${activities.length}-${activities.at(-1)?.date || 'none'}` });
    res.json({ plan });
  } catch (error) {
    console.error('Eco plan generation error:', error);
    const plan = buildDeterministicEcoPlan(activities);
    res.json({ plan });
  }
};