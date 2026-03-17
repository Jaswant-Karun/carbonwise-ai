const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function generateEcoPlan(activities) {

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash"
  });

  const activitySummary = activities
    .map(a =>
      `Type: ${a.activity_type}, Value: ${a.details?.value}, Emission: ${a.carbon_emissions} kg`
    )
    .join("\n");

  const prompt = `
You are an environmental sustainability advisor.

User activities:

${activitySummary}

Generate a clear 7 day sustainability plan to reduce the user's carbon footprint.
`;

  const result = await model.generateContent(prompt);

  return result.response.text();
}

module.exports = generateEcoPlan;