const db = require('../config/db');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const PDFDocument = require('pdfkit');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// @desc  Generate monthly AI climate report
// @route GET /api/reports/monthly
const generateReport = async (req, res) => {
  try {
    const activitiesResult = await db.query(
      "SELECT * FROM activities WHERE user_id = $1 ORDER BY date DESC LIMIT 30",
      [req.user.id]
    );

    const activities = activitiesResult.rows;

    if (activities.length === 0) {
      return res.status(400).json({
        message: "No activities found. Log some activities first to generate a report."
      });
    }

    const totalEmissions = activities.reduce(
      (sum, a) => sum + parseFloat(a.carbon_emissions),
      0
    );

    const byType = {};

    activities.forEach(a => {
      byType[a.activity_type] =
        (byType[a.activity_type] || 0) + parseFloat(a.carbon_emissions);
    });

    const prompt = `
You are CarbonWise AI, an environmental advisor.

User data:
Total emissions: ${totalEmissions.toFixed(2)} kg CO2
Activity breakdown: ${JSON.stringify(byType)}
Number of activities: ${activities.length}

Generate a clear monthly climate report with:

1. Executive Summary
2. Main Emission Sources
3. Comparison with global average (≈833 kg CO2/month)
4. 5 Practical recommendations
5. Sustainability score out of 100

Keep it concise and readable.
`;

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash"
    });

    const result = await model.generateContent(prompt);

    let reportText = "AI report unavailable.";

    if (
      result &&
      result.response &&
      typeof result.response.text === "function"
    ) {
      reportText = result.response.text();
    }

    res.json({
      report: reportText,
      totalEmissions: totalEmissions.toFixed(2),
      byType,
      activityCount: activities.length
    });

  } catch (error) {
    console.error("Report Error:", error);

    res.json({
      report:
        "Unable to generate the AI report right now. Based on your activities, reducing high-emission areas like transport and electricity can significantly improve your carbon footprint."
    });
  }
};

// @desc  Generate AI insights from user activities
// @route GET /api/reports/insights
const generateInsights = async (req, res) => {
  try {
    const activitiesResult = await db.query(
      'SELECT * FROM activities WHERE user_id = $1 ORDER BY date DESC LIMIT 20',
      [req.user.id]
    );

    const activities = activitiesResult.rows;

    if (activities.length === 0) {
      return res.json({ insights: [] });
    }

    const totalEmissions = activities.reduce(
      (sum, a) => sum + parseFloat(a.carbon_emissions),
      0
    );

    const activitySummary = activities
  .map(a => {
    let value = 0;
    let unit = "";

    if (a.details) {
      try {
        const details = typeof a.details === "string"
          ? JSON.parse(a.details)
          : a.details;

        value = details.value || 0;
        unit = details.unit || "";
      } catch {}
    }

    return `${a.activity_type} - ${value} ${unit} (${a.carbon_emissions} kg CO2)`;
  })
  .join("\n");

    const prompt = `
You are CarbonWise AI.

Analyze the user's activities and generate exactly 5 environmental insights.

Total emissions: ${totalEmissions.toFixed(2)} kg CO2

Activities:
${activitySummary}

Return ONLY JSON format:

[
 {"title":"...", "description":"...", "impact":"high", "icon":"🌱"},
 {"title":"...", "description":"...", "impact":"medium", "icon":"⚡"},
 {"title":"...", "description":"...", "impact":"low", "icon":"♻️"},
 {"title":"...", "description":"...", "impact":"medium", "icon":"🚗"},
 {"title":"...", "description":"...", "impact":"low", "icon":"🌍"}
]

impact must be: high, medium, low
`;

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const result = await model.generateContent(prompt);

  let text = result.response.text().trim();

let insights = [];

try {
  insights = JSON.parse(text);
} catch (e) {
  const match = text.match(/\[[\s\S]*\]/);
  if (match) {
    insights = JSON.parse(match[0]);
  }
}

if (!Array.isArray(insights)) {
  insights = [];
}

    res.json({
      insights,
      totalEmissions: totalEmissions.toFixed(2)
    });

  } catch (error) {
    console.error("Insights Error:", error);
    res.status(500).json({ message: "Error generating insights" });
  }
};

// @desc  Predict future emissions
// @route GET /api/reports/predict
const generatePrediction = async (req, res) => {
  try {
    const activitiesResult = await db.query(
      "SELECT * FROM activities WHERE user_id = $1 ORDER BY date DESC LIMIT 30",
      [req.user.id]
    );

    const activities = activitiesResult.rows;

    if (activities.length < 5) {
      return res.json({
        prediction: "Need at least 5 logged activities for accurate prediction.",
      });
    }

    const totalEmissions = activities.reduce(
      (sum, a) => sum + parseFloat(a.carbon_emissions),
      0
    );

    const avgDaily = (totalEmissions / activities.length).toFixed(2);
    const predictedMonthly = (avgDaily * 30).toFixed(2);

    const prompt = `
A user's average daily carbon emission is ${avgDaily} kg CO2.
Predicted monthly emission is about ${predictedMonthly} kg CO2.

Explain what this means for the environment and give 3 simple tips to reduce emissions.
Return a short paragraph.
`;

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
    });

    const result = await model.generateContent(prompt);

    let predictionText = "AI prediction unavailable.";

    if (
      result &&
      result.response &&
      typeof result.response.text === "function"
    ) {
      predictionText = result.response.text();
    }

    res.json({
      prediction: predictionText,
      avgDaily,
      predictedMonthly,
    });
  } catch (error) {
    console.error("Prediction Error:", error);

    res.json({
      prediction:
        "Based on your current habits, your emissions may continue at a similar level next month. Try reducing transport fuel usage, lowering electricity consumption, and choosing more plant-based meals.",
    });
  }
};

// @desc  Generate PDF report
// @route GET /api/reports/pdf
const generatePDFReport = async (req, res) => {
  try {
    const activitiesResult = await db.query(
      "SELECT * FROM activities WHERE user_id = $1 ORDER BY date DESC LIMIT 30",
      [req.user.id]
    );

    const activities = activitiesResult.rows;

    if (activities.length === 0) {
      return res.status(400).json({
        message: "No activities found. Log some activities first to generate a PDF report.",
      });
    }

    const totalEmissions = activities.reduce(
      (sum, a) => sum + parseFloat(a.carbon_emissions),
      0
    );

    const byType = {};

    activities.forEach((a) => {
      byType[a.activity_type] =
        (byType[a.activity_type] || 0) + parseFloat(a.carbon_emissions);
    });

    const doc = new PDFDocument({ margin: 50 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=carbon-report.pdf");

    doc.pipe(res);

    doc.fontSize(20).text("Carbon Footprint Report", { align: "center" });
    doc.moveDown();

    doc.fontSize(12).text(`Generated on: ${new Date().toLocaleDateString()}`);
    doc.text(`Total Emissions: ${totalEmissions.toFixed(2)} kg CO2`);
    doc.text(`Activities Analyzed: ${activities.length}`);
    doc.moveDown();

    doc.fontSize(14).text("Emission Breakdown by Activity", { underline: true });
    doc.moveDown(0.5);

    Object.entries(byType).forEach(([type, value]) => {
      doc.fontSize(12).text(`- ${type}: ${value.toFixed(2)} kg CO2`);
    });

    doc.moveDown();
    doc.fontSize(14).text("Recent Activities", { underline: true });
    doc.moveDown(0.5);

    activities.slice(0, 10).forEach((activity) => {
      doc
        .fontSize(11)
        .text(
          `${activity.date ? new Date(activity.date).toLocaleDateString() : "N/A"} | ${activity.activity_type} | ${parseFloat(activity.carbon_emissions).toFixed(2)} kg CO2`
        );
    });

    doc.end();
  } catch (error) {
    console.error("PDF Report Error:", error);
    res.status(500).json({ message: "Error generating PDF report" });
  }
};

module.exports = {
  generateReport,
  generateInsights,
  generatePrediction,
  generatePDFReport,
};