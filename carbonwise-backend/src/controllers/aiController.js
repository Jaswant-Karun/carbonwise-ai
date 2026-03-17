const generateEcoPlan = require("../services/geminiChatService");

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