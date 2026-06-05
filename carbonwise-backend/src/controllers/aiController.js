const generateEcoPlan = require("../services/geminiChatService");
//Added new Activity in Plan
exports.generateEcoPlan = async (req, res) => {

  try {

    const { activities } = req.body;

    const plan = await generateEcoPlan(activities);

    res.json({ plan });

  } catch (error) {

    console.error("Gemini error:", error);

    res.status(500).json({
      message: "Gemini API failed"
    });

  }

};