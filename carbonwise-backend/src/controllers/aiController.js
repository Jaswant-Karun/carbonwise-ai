const generateEcoPlan = require("../services/geminiChatService");
const db = require('../config/db');
//Added new Activity in Plan
exports.generateEcoPlan = async (req, res) => {

  try {

    const result = await db.query(
      'SELECT activity_type, details, carbon_emissions, date FROM activities WHERE user_id = $1 ORDER BY date ASC',
      [req.user.id],
    );
    const plan = await generateEcoPlan(result.rows, { userId: req.user.id, dataVersion: `activities-${result.rows.length}-${result.rows.at(-1)?.date || 'none'}` });

    res.json({ plan });

  } catch (error) {

    console.error("Gemini error:", error);

    res.status(500).json({
      message: "Gemini API failed"
    });

  }

};