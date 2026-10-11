const { GoogleGenerativeAI } = require("@google/generative-ai");

async function generateEcoPlan(activities) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash"
  });
//Added new Activity
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

module.exports.generateCoachNarrative = async (context) => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const result = await model.generateContent(`
You are a concise sustainability coach. Write a supportive introduction of no more than 80 words
for a user's seven-day action plan. Do not invent measurements, claim that actions guarantee
emission reductions, or add actions beyond the supplied plan.

Highest-impact categories: ${context.categories.join(', ') || 'No categories recorded'}
Plan actions:
${context.actions.map((action) => `- ${action.title}: ${action.explanation}`).join('\n')}
`);
  return result.response.text().trim();
};