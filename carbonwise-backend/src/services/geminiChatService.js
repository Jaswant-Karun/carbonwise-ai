const crypto = require('node:crypto');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const db = require('../config/db');

const MODEL_ID = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const PROMPT_VERSION = '2026-10-11-v2';
const REQUEST_TIMEOUT_MS = Math.min(Math.max(Number(process.env.GEMINI_TIMEOUT_MS) || 12000, 3000), 30000);
const MAX_OUTPUT_TOKENS = Math.min(Math.max(Number(process.env.GEMINI_MAX_OUTPUT_TOKENS) || 320, 64), 800);
const CACHE_TTL_MS = Math.min(Math.max(Number(process.env.GEMINI_CACHE_TTL_MS) || 86400000, 60000), 604800000);
const RATE_WINDOW_MS = 60000;
const RATE_LIMIT = Math.max(Number(process.env.GEMINI_RATE_LIMIT_PER_MINUTE) || 10, 1);
const inFlight = new Map();
const rateWindows = new Map();
let cacheTableReady;

const stable = (value) => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
};

const cacheKey = ({ userId, task, input, dataVersion = 'static' }) => crypto
  .createHash('sha256')
  .update(stable({ userId, task, input, promptVersion: PROMPT_VERSION, model: MODEL_ID, dataVersion }))
  .digest('hex');

const ensureCacheTable = () => {
  if (!cacheTableReady) {
    cacheTableReady = db.query(`
      CREATE TABLE IF NOT EXISTS ai_response_cache (
        id BIGSERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        task VARCHAR(80) NOT NULL,
        cache_key CHAR(64) NOT NULL,
        response TEXT NOT NULL,
        data_version VARCHAR(120) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (user_id, task, cache_key)
      )
    `).catch((error) => {
      cacheTableReady = null;
      throw error;
    });
  }
  return cacheTableReady;
};

const fallbackText = (task) => ({
  chat: 'I cannot reach the AI service right now. Review your highest-emission categories and choose one small reduction to try today.',
  coach: 'Your plan is grounded in your recorded activity. Start with the first action and review your emissions again after seven days.',
  impact: 'Your report shows recorded emissions and modeled opportunities. Use the comparison to choose a practical next step; it does not prove that an action caused a reduction.',
  report: 'Your report is temporarily unavailable. Focus on the categories with the highest recorded emissions.',
  insights: 'AI insights are temporarily unavailable. Review the highest-emission categories in your dashboard.',
  prediction: 'The deterministic forecast is shown separately. Treat it as an estimate based on recorded history, not a guarantee.',
}[task] || 'AI insights are temporarily unavailable. Please try again later.');

const isQuotaError = (error) => error?.status === 429 || error?.statusCode === 429
  || /429|quota|rate limit|resource exhausted/i.test(error?.message || '');

const consumeRateLimit = (userId) => {
  const now = Date.now();
  const timestamps = (rateWindows.get(String(userId)) || []).filter((time) => now - time < RATE_WINDOW_MS);
  if (timestamps.length >= RATE_LIMIT) {
    const error = new Error('AI request limit reached. Please wait before refreshing AI insights.');
    error.statusCode = 429;
    throw error;
  }
  timestamps.push(now);
  rateWindows.set(String(userId), timestamps);
};

const requestGemini = async (prompt, maxOutputTokens = MAX_OUTPUT_TOKENS) => {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: MODEL_ID,
    generationConfig: { maxOutputTokens, temperature: 0.3 },
  });
  const result = await Promise.race([
    model.generateContent(prompt),
    new Promise((_, reject) => setTimeout(() => {
      const error = new Error('Gemini request timed out');
      error.code = 'ETIMEDOUT';
      reject(error);
    }, REQUEST_TIMEOUT_MS)),
  ]);
  const text = result?.response?.text?.();
  if (typeof text !== 'string' || !text.trim()) throw new Error('Gemini returned an empty response');
  return text.trim();
};

const generateCached = async ({ userId, task, input, dataVersion, prompt, maxOutputTokens, ttlMs = CACHE_TTL_MS, fallback }) => {
  if (!userId) return fallback || fallbackText(task);
  const key = cacheKey({ userId, task, input, dataVersion });
  if (inFlight.has(key)) {
    console.info(`[gemini] task=${task} joined_in_flight=true`);
    return inFlight.get(key);
  }
  const request = (async () => {
    await ensureCacheTable();
    const existing = await db.query(
      `SELECT response FROM ai_response_cache
       WHERE user_id = $1 AND task = $2 AND cache_key = $3 AND expires_at > CURRENT_TIMESTAMP`,
      [userId, task, key],
    );
    if (existing.rows[0]) {
      await db.query('UPDATE ai_response_cache SET last_accessed_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND task = $2 AND cache_key = $3', [userId, task, key]);
      console.info(`[gemini] task=${task} cache_hit=true`);
      return existing.rows[0].response;
    }
    consumeRateLimit(userId);
    const started = Date.now();
    try {
      const response = await requestGemini(prompt, maxOutputTokens);
      await db.query(
        `INSERT INTO ai_response_cache (user_id, task, cache_key, response, data_version, expires_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP + ($6 * INTERVAL '1 millisecond'))
         ON CONFLICT (user_id, task, cache_key) DO UPDATE SET response = EXCLUDED.response,
           data_version = EXCLUDED.data_version, expires_at = EXCLUDED.expires_at,
           last_accessed_at = CURRENT_TIMESTAMP`,
        [userId, task, key, response, dataVersion || 'static', ttlMs],
      );
      console.info(`[gemini] task=${task} cache_hit=false latency_ms=${Date.now() - started}`);
      return response;
    } catch (error) {
      console.warn(`[gemini] task=${task} error=${isQuotaError(error) ? 'quota' : error.code === 'ETIMEDOUT' ? 'timeout' : 'request'}`);
      return fallback || fallbackText(task);
    }
  })().finally(() => inFlight.delete(key));
  inFlight.set(key, request);
  return request;
};

const summarizeActivities = (activities = [], limit = 30) => activities.slice(-limit).map((activity) => ({
  type: activity.activity_type,
  value: activity.details?.value,
  unit: activity.details?.unit,
  emissions: Number(activity.carbon_emissions) || 0,
  date: activity.date,
}));

async function generateEcoPlan(activities, options = {}) {
  return generateCached({
    userId: options.userId,
    task: 'coach',
    input: summarizeActivities(activities),
    dataVersion: options.dataVersion || `activities-${activities.length}`,
    prompt: `You are an environmental sustainability advisor. Based only on this activity summary, write a concise seven-day plan. Do not invent measurements or claim reductions are guaranteed.\n${JSON.stringify(summarizeActivities(activities))}`,
    maxOutputTokens: 420,
    fallback: fallbackText('coach'),
  });
}

module.exports = generateEcoPlan;
module.exports.generateCoachNarrative = (context, options = {}) => generateCached({
  userId: options.userId,
  task: 'coach',
  input: { categories: context.categories, actions: context.actions.map(({ title, explanation }) => ({ title, explanation })) },
  dataVersion: options.dataVersion || 'coach-plan',
  prompt: `You are a concise sustainability coach. Write no more than 80 words. Do not invent measurements or claim actions guarantee reductions.\nCategories: ${context.categories.join(', ') || 'None recorded'}\nActions:\n${context.actions.map((action) => `- ${action.title}: ${action.explanation}`).join('\n')}`,
  maxOutputTokens: 180,
  fallback: fallbackText('coach'),
});

module.exports.generateImpactNarrative = (report, options = {}) => generateCached({
  userId: options.userId,
  task: 'impact',
  input: { totals: report.totals, categories: report.categoryBreakdown.slice(0, 3) },
  dataVersion: options.dataVersion || `report-${report.period?.currentEnd}`,
  prompt: `Write a supportive sustainability report explanation in no more than 120 words. Do not invent numbers, claim actions caused reductions, or describe potential savings as observed savings.\nCurrent: ${report.totals.current} kg CO2; baseline: ${report.totals.baseline} kg CO2; status: ${report.totals.status}; categories: ${report.categoryBreakdown.slice(0, 3).map((item) => `${item.label} ${item.emissions} kg`).join(', ')}`,
  maxOutputTokens: 240,
  fallback: fallbackText('impact'),
});

module.exports.generateChatResponse = (message, activities, options = {}) => generateCached({
  userId: options.userId,
  task: 'chat',
  input: { message: String(message).trim().slice(0, 500), activities: summarizeActivities(activities, 10) },
  dataVersion: options.dataVersion || `activities-${activities.length}`,
  prompt: `You are CarbonWise AI, a concise sustainability coach. Answer the user's question using only the supplied activity summary. Do not calculate or invent emissions; numerical values must come from the summary.\nQuestion: ${String(message).trim().slice(0, 500)}\nActivity summary: ${JSON.stringify(summarizeActivities(activities, 10))}`,
  maxOutputTokens: 220,
  fallback: fallbackText('chat'),
});

module.exports.generateReportNarrative = (summary, options = {}) => generateCached({
  userId: options.userId,
  task: 'report',
  input: summary,
  dataVersion: options.dataVersion || `report-${summary.activityCount}`,
  prompt: `Write a concise natural-language sustainability report from these supplied values. Do not calculate new values, invent facts, or claim causation.\n${JSON.stringify(summary)}`,
  maxOutputTokens: 320,
  fallback: fallbackText('report'),
});

module.exports.generateInsightsNarrative = (summary, options = {}) => generateCached({
  userId: options.userId,
  task: 'insights',
  input: summary,
  dataVersion: options.dataVersion || `insights-${summary.activityCount}`,
  prompt: `Return exactly five concise sustainability insights as a JSON array with title, description, and impact (high, medium, or low). Use only these supplied values and do not invent facts.\n${JSON.stringify(summary)}`,
  maxOutputTokens: 360,
  fallback: '[]',
});

module.exports.generatePredictionNarrative = (summary, options = {}) => generateCached({
  userId: options.userId,
  task: 'prediction',
  input: summary,
  dataVersion: options.dataVersion || `prediction-${summary.activityCount}`,
  prompt: `Explain these deterministic emissions estimates in one short paragraph and give three practical tips. Do not recalculate, invent values, or present the estimate as a guarantee.\n${JSON.stringify(summary)}`,
  maxOutputTokens: 220,
  fallback: fallbackText('prediction'),
});

module.exports._test = { cacheKey, stable, inFlight, rateWindows, requestGemini, generateCached, isQuotaError };
