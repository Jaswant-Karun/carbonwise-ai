require('dotenv').config();
const crypto = require('node:crypto');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const db = require('../config/db');

const MODEL_ID = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
const PROMPT_VERSION = '2026-10-11-v2';
const REQUEST_TIMEOUT_MS = Math.min(Math.max(Number(process.env.GEMINI_TIMEOUT_MS) || 12000, 3000), 30000);
const MAX_OUTPUT_TOKENS = Math.min(Math.max(Number(process.env.GEMINI_MAX_OUTPUT_TOKENS) || 380, 64), 800);
const CACHE_TTL_MS = Math.min(Math.max(Number(process.env.GEMINI_CACHE_TTL_MS) || 86400000, 60000), 604800000);
const RATE_WINDOW_MS = 60000;
const RATE_LIMIT = Math.max(Number(process.env.GEMINI_RATE_LIMIT_PER_MINUTE) || 10, 1);
const inFlight = new Map();
const rateWindows = new Map();
let cacheTableReady;
let keyValidationWarned = false;
let circuitBreakerUntil = 0;
let circuitBreakerReason = '';
let circuitBreakerWarned = false;
const CIRCUIT_BREAKER_COOLDOWN_MS = 5 * 60 * 1000; // 5-minute circuit breaker cooldown

const fallbackText = (task) => ({
  chat: 'I cannot reach the AI service right now. Review your highest-emission categories and choose one small reduction to try today.',
  coach: 'Your plan is grounded in your recorded activity. Start with the first action and review your emissions again after seven days.',
  impact: 'Your report shows recorded emissions and modeled opportunities. Use the comparison to choose a practical next step; it does not prove that an action caused a reduction.',
  report: 'Your report is temporarily unavailable. Focus on the categories with the highest recorded emissions.',
  insights: '[]',
  prediction: 'The deterministic forecast is shown separately. Treat it as an estimate based on recorded history, not a guarantee.',
  env_anomaly: 'Environmental anomaly explanation is temporarily unavailable. Review the observed deviation against seasonal baseline.',
  env_trend: 'Climate trend report summary is temporarily unavailable. Review the numerical trend data directly.',
  env_insights: 'Regional environmental insights are temporarily unavailable. Telemetry observations remain nominal.',
}[task] || 'AI insights are temporarily unavailable. Please try again later.');

const isValidGeminiApiKey = (key) => {
  if (typeof key !== 'string') return false;
  const trimmed = key.trim();
  if (!trimmed) return false;
  if (trimmed === 'test-only-placeholder' || trimmed.startsWith('test-')) {
    return true;
  }
  return /^AIza[0-9A-Za-z\-_]{35}$/.test(trimmed);
};

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

const isQuotaError = (error) => error?.status === 429 || error?.statusCode === 429
  || /429|quota|rate limit|resource exhausted|overload/i.test(error?.message || '');

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
  if (!process.env.GEMINI_API_KEY || !isValidGeminiApiKey(process.env.GEMINI_API_KEY)) {
    throw new Error('GEMINI_API_KEY is not configured or format is invalid');
  }
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: MODEL_ID,
    generationConfig: { maxOutputTokens, temperature: 0.3 },
  });

  let timer;
  try {
    const result = await Promise.race([
      model.generateContent(prompt),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          const error = new Error('Gemini request timed out');
          error.code = 'ETIMEDOUT';
          reject(error);
        }, REQUEST_TIMEOUT_MS);
      }),
    ]);
    const text = result?.response?.text?.();
    if (typeof text !== 'string' || !text.trim()) throw new Error('Gemini returned an empty response');
    return text.trim();
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const generateCached = async ({ userId, task, input, dataVersion, prompt, maxOutputTokens, ttlMs = CACHE_TTL_MS, fallback }) => {
  if (!userId) return fallback || fallbackText(task);

  // If Gemini key is not configured or has an invalid format, use deterministic fallback directly without doomed HTTP calls
  if (!isValidGeminiApiKey(process.env.GEMINI_API_KEY)) {
    if (!keyValidationWarned) {
      console.info('[gemini] GEMINI_API_KEY is not configured or format is invalid (starts with AIzaSy... from Google AI Studio). Using deterministic AI fallbacks.');
      keyValidationWarned = true;
    }
    // Check if an existing cached response exists in the database
    try {
      await ensureCacheTable();
      const key = cacheKey({ userId, task, input, dataVersion });
      const existing = await db.query(
        `SELECT response FROM ai_response_cache
         WHERE user_id = $1 AND task = $2 AND cache_key = $3 AND expires_at > CURRENT_TIMESTAMP`,
        [userId, task, key],
      );
      if (existing.rows[0]) {
        return existing.rows[0].response;
      }
    } catch {
      // Continue to deterministic fallback
    }
    return fallback || fallbackText(task);
  }

  // If circuit breaker is active from a recent API failure, immediately serve fallback without external roundtrips
  if (Date.now() < circuitBreakerUntil) {
    try {
      await ensureCacheTable();
      const key = cacheKey({ userId, task, input, dataVersion });
      const existing = await db.query(
        `SELECT response FROM ai_response_cache
         WHERE user_id = $1 AND task = $2 AND cache_key = $3 AND expires_at > CURRENT_TIMESTAMP`,
        [userId, task, key],
      );
      if (existing.rows[0]) {
        return existing.rows[0].response;
      }
    } catch {
      // Continue to deterministic fallback
    }
    return fallback || fallbackText(task);
  } else if (circuitBreakerUntil > 0) {
    // Cooldown elapsed; reset circuit breaker
    circuitBreakerUntil = 0;
    circuitBreakerReason = '';
    circuitBreakerWarned = false;
  }

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
      const isAuthOrInvalidKey = error?.status === 400 && /API_KEY_INVALID|API key not valid/i.test(error?.message || '');
      const errorType = isQuotaError(error) ? 'quota' : error.code === 'ETIMEDOUT' ? 'timeout' : isAuthOrInvalidKey ? 'invalid_key' : 'request';
      const cleanReason = (error?.message || '').replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED]').replace(/\n/g, ' ').slice(0, 120);

      // Trip circuit breaker for 5 minutes
      circuitBreakerUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS;
      circuitBreakerReason = cleanReason;

      if (!circuitBreakerWarned) {
        console.warn(`[gemini] task=${task} error=${errorType}${cleanReason ? ` reason="${cleanReason}"` : ''}. Circuit breaker active for 5m; serving deterministic fallbacks.`);
        circuitBreakerWarned = true;
      }

      // Persist deterministic fallback into cache table with 5-minute TTL so concurrent or repeated requests hit cache immediately
      if (fallback) {
        try {
          await ensureCacheTable();
          await db.query(
            `INSERT INTO ai_response_cache (user_id, task, cache_key, response, data_version, expires_at)
             VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP + ($6 * INTERVAL '1 millisecond'))
             ON CONFLICT (user_id, task, cache_key) DO UPDATE SET response = EXCLUDED.response,
               data_version = EXCLUDED.data_version, expires_at = EXCLUDED.expires_at,
               last_accessed_at = CURRENT_TIMESTAMP`,
            [userId, task, key, fallback, dataVersion || 'static', CIRCUIT_BREAKER_COOLDOWN_MS],
          );
        } catch {
          // Non-blocking cache persistence failure
        }
      }

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

/* =========================================================================
   DETERMINISTIC FALLBACK GENERATORS (Rich, Grounded, Science-Backed)
   ========================================================================= */

const buildDeterministicInsights = (summary = {}) => {
  const byType = summary.byType || {};
  const total = Number(summary.totalEmissions) || 0;
  const count = summary.activityCount || (summary.activities ? summary.activities.length : 0);

  const categoryLabels = {
    electricity: 'Electricity & Power',
    transportation: 'Transportation & Mobility',
    transport: 'Transportation & Mobility',
    food: 'Food & Nutrition',
    waste: 'Waste Management',
    water: 'Water Consumption',
    facilities: 'Facilities & Buildings',
    other: 'Other Operational Sources',
  };

  const categoryIcons = {
    electricity: '⚡',
    transportation: '🚗',
    transport: '🚗',
    food: '🥗',
    waste: '🗑️',
    water: '💧',
    facilities: '🏢',
    other: '🌱',
  };

  const entries = Object.entries(byType)
    .filter(([, val]) => Number(val) > 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]));

  const topCategoryKey = entries.length > 0 ? entries[0][0] : 'electricity';
  const topAmount = entries.length > 0 ? Number(entries[0][1]) : 0;
  const topShare = total > 0 ? ((topAmount / total) * 100).toFixed(0) : '0';
  const topLabel = categoryLabels[topCategoryKey] || 'Operational Energy';
  const topIcon = categoryIcons[topCategoryKey] || '⚡';

  const secondCategoryKey = entries.length > 1 ? entries[1][0] : null;
  const secondAmount = secondCategoryKey ? Number(entries[1][1]) : 0;
  const secondShare = total > 0 && secondCategoryKey ? ((secondAmount / total) * 100).toFixed(0) : '0';
  const secondLabel = secondCategoryKey ? (categoryLabels[secondCategoryKey] || secondCategoryKey) : null;
  const secondIcon = secondCategoryKey ? (categoryIcons[secondCategoryKey] || '🌱') : '🌱';

  const insights = [];

  // Insight 1: Primary Emission Driver
  insights.push({
    icon: topIcon,
    title: `Primary Emission Driver: ${topLabel}`,
    description: `${topLabel} represents your single largest emission contributor at ${topAmount.toFixed(1)} kg CO₂e (${topShare}% of your total ${total.toFixed(1)} kg CO₂e). Targeted mitigation here will produce the largest overall carbon savings.`,
    impact: 'high',
  });

  // Insight 2: Tailored Action Opportunity
  if (topCategoryKey === 'electricity' || topCategoryKey === 'facilities') {
    insights.push({
      icon: '⚡',
      title: 'Cooling & Standby Load Optimization',
      description: 'Adjusting climate control thermostats by 1-2°C and utilizing smart power strips for idle electronic equipment can reduce operational energy emissions by 10% to 25%.',
      impact: 'high',
    });
  } else if (topCategoryKey === 'transportation' || topCategoryKey === 'transport') {
    insights.push({
      icon: '🚆',
      title: 'Modal Shift & Trip Consolidation',
      description: 'Replacing solo passenger car journeys with mass transit, carpooling, or active transport for distances under 3 km significantly curtails transport-related fossil fuel consumption.',
      impact: 'high',
    });
  } else if (topCategoryKey === 'food') {
    insights.push({
      icon: '🥗',
      title: 'Dietary Footprint & Food Waste Mitigation',
      description: 'Prioritizing plant-forward meal choices and planning food purchases to eliminate post-consumer waste can decrease food lifecycle emissions by up to 30%.',
      impact: 'high',
    });
  } else {
    insights.push({
      icon: '🔄',
      title: 'Resource Diversion & Efficiency',
      description: 'Separating organic waste for composting and installing low-flow water fixtures diverts landfill methane and lowers municipal distribution pumping energy.',
      impact: 'high',
    });
  }

  // Insight 3: Logging Consistency & Measurement Accuracy
  insights.push({
    icon: '📊',
    title: 'Measurement Cadence & Data Quality',
    description: `You have recorded ${count} activity entries. Consistent daily or weekly activity logging eliminates blindspots, prevents estimation error, and reinforces sustainable behavioral habits.`,
    impact: 'medium',
  });

  // Insight 4: Secondary Sector Focus
  if (secondCategoryKey) {
    insights.push({
      icon: secondIcon,
      title: `Secondary Reduction Vector: ${secondLabel}`,
      description: `${secondLabel} contributes ${secondAmount.toFixed(1)} kg CO₂e (${secondShare}% of emissions). Implementing secondary reductions prevents emissions rebound as primary cuts take effect.`,
      impact: 'medium',
    });
  } else {
    insights.push({
      icon: '💧',
      title: 'Water & Indirect Energy Management',
      description: 'Water heating and municipal pumping require substantial electrical energy. Lowering hot water temperature to 50°C yields dual water and energy savings.',
      impact: 'medium',
    });
  }

  // Insight 5: Decarbonization Horizon
  insights.push({
    icon: '🎯',
    title: 'Science-Based Reduction Horizon',
    description: 'Adhering to a progressive 5% monthly reduction trajectory aligns your carbon accounting with SDG 13 climate benchmarks. Check your 30-day forecast to monitor progress.',
    impact: 'low',
  });

  return insights;
};

const buildDeterministicPredictionExplanation = (summary = {}) => {
  const activityCount = summary.activityCount || 0;
  const avgDaily = summary.baselineDailyAverage != null ? Number(summary.baselineDailyAverage).toFixed(2) : (summary.avgDaily || '0.00');
  const horizonDays = summary.horizonDays || 30;
  const projectedTotal = summary.totalProjectedKg != null ? Number(summary.totalProjectedKg).toFixed(2) : (summary.predictedMonthly || (Number(avgDaily) * horizonDays).toFixed(2));
  const topContributor = summary.topFutureContributor || 'operational energy and mobility';
  const topShare = summary.topFutureShare != null ? `${Number(summary.topFutureShare).toFixed(0)}%` : 'a significant portion';

  return `Based on your recent logging history of ${activityCount} activity records, your forward emissions for the next ${horizonDays} days are estimated at ${projectedTotal} kg CO₂e, representing a daily baseline average of ${avgDaily} kg CO₂e/day. ${topContributor} is the primary anticipated contributor, accounting for ${topShare} of forward emissions.

Recommended mitigation steps:
1. Energy Conservation: Implement timer controls and adjust cooling setpoints to lower baseline electricity demand.
2. Mobility Shift: Substitute single-passenger motorized transport with public transit or zero-emission modes.
3. Sustainable Consumption: Prioritize low-carbon dietary choices and eliminate avoidable food waste.`;
};

const buildDeterministicReportSummary = (summary = {}) => {
  const total = Number(summary.totalEmissions || 0).toFixed(2);
  const count = summary.activityCount || 0;
  const entries = Object.entries(summary.byType || {}).sort((a, b) => b[1] - a[1]);
  const breakdownStr = entries.length > 0
    ? entries.map(([cat, val]) => `${cat.charAt(0).toUpperCase() + cat.slice(1)}: ${Number(val).toFixed(1)} kg CO₂e`).join(', ')
    : 'No categorised activities recorded';

  return `Executive Sustainability Summary:
A total of ${count} activity records were evaluated, representing cumulative gross greenhouse gas emissions of ${total} kg CO₂e.
Sector Breakdown: ${breakdownStr}.
All calculations adhere to IPCC and EPA documented emission factors. To achieve measurable progress toward reduction milestones, prioritize efficiency measures in your highest-emitting sectors while maintaining continuous activity tracking.`;
};

const buildDeterministicChatReply = (message = '', activities = []) => {
  const msg = String(message).toLowerCase();
  const totalEmissions = activities.reduce((sum, a) => sum + (Number(a.carbon_emissions) || 0), 0);
  const byCategory = {};
  activities.forEach((a) => {
    const cat = a.activity_type || 'other';
    byCategory[cat] = (byCategory[cat] || 0) + (Number(a.carbon_emissions) || 0);
  });
  const sortedCategories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  const topCategory = sortedCategories[0];

  if (activities.length === 0) {
    return 'Welcome to CarbonWise AI! You have not logged any activities yet. Start by logging your energy, transport, food, water, or waste activities using the "+ Log Activity" button, and I will help you track and reduce your carbon footprint.';
  }

  // Domain-specific queries first
  if (/transport|travel|car|driving|flight|transit|bus|train|commute/i.test(msg)) {
    const transportTotal = byCategory.transportation || byCategory.transport || 0;
    return `Transportation footprint in recent logs: ${transportTotal.toFixed(1)} kg CO₂e. To reduce mobility emissions: 1) Combine errands into single linked trips; 2) Choose public rail/transit or carpooling for medium commutes; 3) Use walking or cycling for journeys under 3 km.`;
  }

  if (/electricity|energy|power|kwh|\bac\b|cooling|heating|solar/i.test(msg)) {
    const energyTotal = byCategory.electricity || byCategory.energy || 0;
    return `Electricity emissions in recent logs: ${energyTotal.toFixed(1)} kg CO₂e. Recommendations: 1) Adjust AC setpoint by 1-2°C to reduce cooling load by ~10%; 2) Unplug idle electronic chargers to prevent phantom loads; 3) Consider certified renewable electricity options or rooftop solar where feasible.`;
  }

  if (/food|diet|meat|dairy|vegetarian|vegan/i.test(msg)) {
    const foodTotal = byCategory.food || 0;
    return `Food and diet emissions in recent logs: ${foodTotal.toFixed(1)} kg CO₂e. Key reduction strategies: 1) Incorporate more plant-forward meals during the week; 2) Store food properly to minimize spoilage; 3) Compost organic scraps to keep methane-generating waste out of landfills.`;
  }

  if (/waste|compost|recycling|recycle|plastic/i.test(msg)) {
    const wasteTotal = byCategory.waste || 0;
    return `Waste-related emissions in recent logs: ${wasteTotal.toFixed(1)} kg CO₂e. Key strategies: 1) Divert organic matter through dedicated composting; 2) Eliminate single-use disposables; 3) Clean and sort recyclable polymers and metals properly.`;
  }

  if (/water|shower|tap|leak/i.test(msg)) {
    const waterTotal = byCategory.water || 0;
    return `Water-related emissions in recent logs: ${waterTotal.toFixed(1)} kg CO₂e. Recommendations: 1) Install aerators on faucets to reduce flow rates; 2) Lower hot water heater temperature to 50°C (120°F); 3) Fix leaky fixtures promptly to conserve municipal supply pumping energy.`;
  }

  if (/highest|top|most|breakdown|total|summary|how much|footprint/i.test(msg)) {
    const topStr = topCategory ? `Your highest single contributor is ${topCategory[0]} at ${topCategory[1].toFixed(1)} kg CO₂e (${((topCategory[1] / (totalEmissions || 1)) * 100).toFixed(0)}% of total).` : '';
    return `You have logged ${activities.length} recent activities totaling ${totalEmissions.toFixed(2)} kg CO₂e. ${topStr} Focusing your reduction efforts on your highest sector will deliver the fastest results.`;
  }

  if (/plan|action|coach|today|advice|reduce|tip|recommend/i.test(msg)) {
    return `To accelerate your sustainability progress: 1) Review your personalized 7-Day Action Plan on the Climate Actions page; 2) Start with one small, high-impact habit today (such as switching off unused equipment or taking transit); 3) Check back after a week to measure your verified carbon savings.`;
  }

  return `I am your CarbonWise AI assistant. Based on your ${activities.length} logged activities, your recent footprint is ${totalEmissions.toFixed(2)} kg CO₂e${topCategory ? ` with ${topCategory[0]} as the leading category` : ''}. Ask me about your energy, transport, food emissions, or ways to optimize your action plan!`;
};

const buildDeterministicEcoPlan = (activities = []) => {
  const total = activities.reduce((sum, a) => sum + (Number(a.carbon_emissions) || 0), 0);
  return `CarbonWise 7-Day Sustainability Plan (Baseline: ${total.toFixed(1)} kg CO₂e over ${activities.length} logged activities):
• Day 1 (Energy): Conduct a facility/home energy audit and shut down phantom loads.
• Day 2 (Mobility): Substitute one passenger car trip with public transit, cycling, or walking.
• Day 3 (Diet): Prepare a zero-waste, plant-rich meal to reduce food lifecycle emissions.
• Day 4 (Water): Check faucets for leaks and reduce shower duration by two minutes.
• Day 5 (Waste): Separate recyclables and compost organic waste to divert landfill methane.
• Day 6 (Efficiency): Adjust thermostat by 1°C to optimize climate control energy demand.
• Day 7 (Review): Log weekly activities in CarbonWise AI and evaluate your progress.`;
};

const buildDeterministicCoachNarrative = (context = {}) => {
  const categories = context.categories?.join(', ') || 'recorded activities';
  return `Your personalized 7-day action plan prioritizes emissions reductions in ${categories}. Focus on consistent execution of each daily target to achieve measurable, science-backed carbon savings.`;
};

const buildDeterministicImpactNarrative = (report = {}) => {
  const current = report.totals?.current != null ? report.totals.current : '0.0';
  const baseline = report.totals?.baseline != null ? report.totals.baseline : '0.0';
  const status = report.totals?.status || 'tracked';
  return `Your recorded emissions for this period are ${current} kg CO₂e compared to a baseline of ${baseline} kg CO₂e (status: ${status}). Use this comparison to track your progress and identify high-impact opportunities for further reductions.`;
};

async function generateEcoPlan(activities, options = {}) {
  return generateCached({
    userId: options.userId,
    task: 'coach',
    input: summarizeActivities(activities),
    dataVersion: options.dataVersion || `activities-${activities.length}`,
    prompt: `You are an environmental sustainability advisor. Based only on this activity summary, write a concise seven-day plan. Do not invent measurements or claim reductions are guaranteed.\n${JSON.stringify(summarizeActivities(activities))}`,
    maxOutputTokens: 420,
    fallback: buildDeterministicEcoPlan(activities),
  });
}

module.exports = generateEcoPlan;

module.exports.generateCoachNarrative = (context, options = {}) => generateCached({
  userId: options.userId,
  task: 'coach',
  input: { categories: context.categories, actions: context.actions?.map(({ title, explanation }) => ({ title, explanation })) },
  dataVersion: options.dataVersion || 'coach-plan',
  prompt: `You are a concise sustainability coach. Write no more than 80 words. Do not invent measurements or claim actions guarantee reductions.\nCategories: ${context.categories?.join(', ') || 'None recorded'}\nActions:\n${context.actions?.map((action) => `- ${action.title}: ${action.explanation}`).join('\n')}`,
  maxOutputTokens: 180,
  fallback: buildDeterministicCoachNarrative(context),
});

module.exports.generateImpactNarrative = (report, options = {}) => generateCached({
  userId: options.userId,
  task: 'impact',
  input: { totals: report.totals, categories: report.categoryBreakdown?.slice(0, 3) },
  dataVersion: options.dataVersion || `report-${report.period?.currentEnd}`,
  prompt: `Write a supportive sustainability report explanation in no more than 120 words. Do not invent numbers, claim actions caused reductions, or describe potential savings as observed savings.\nCurrent: ${report.totals?.current} kg CO2; baseline: ${report.totals?.baseline} kg CO2; status: ${report.totals?.status}; categories: ${report.categoryBreakdown?.slice(0, 3).map((item) => `${item.label} ${item.emissions} kg`).join(', ')}`,
  maxOutputTokens: 240,
  fallback: buildDeterministicImpactNarrative(report),
});

module.exports.generateChatResponse = (message, activities, options = {}) => generateCached({
  userId: options.userId,
  task: 'chat',
  input: { message: String(message).trim().slice(0, 500), activities: summarizeActivities(activities, 10) },
  dataVersion: options.dataVersion || `activities-${activities.length}`,
  prompt: `You are CarbonWise AI, a concise sustainability coach. Answer the user's question using only the supplied activity summary. Do not calculate or invent emissions; numerical values must come from the summary.\nQuestion: ${String(message).trim().slice(0, 500)}\nActivity summary: ${JSON.stringify(summarizeActivities(activities, 10))}`,
  maxOutputTokens: 260,
  fallback: buildDeterministicChatReply(message, activities),
});

module.exports.generateReportNarrative = (summary, options = {}) => generateCached({
  userId: options.userId,
  task: 'report',
  input: summary,
  dataVersion: options.dataVersion || `report-${summary.activityCount}`,
  prompt: `Write a concise natural-language sustainability report from these supplied values. Do not calculate new values, invent facts, or claim causation.\n${JSON.stringify(summary)}`,
  maxOutputTokens: 320,
  fallback: buildDeterministicReportSummary(summary),
});

module.exports.generateInsightsNarrative = (summary, options = {}) => generateCached({
  userId: options.userId,
  task: 'insights',
  input: summary,
  dataVersion: options.dataVersion || `insights-${summary.activityCount}`,
  prompt: `Return exactly five concise sustainability insights as a JSON array with icon, title, description, and impact (high, medium, or low). Use only these supplied values and do not invent facts.\n${JSON.stringify(summary)}`,
  maxOutputTokens: 420,
  fallback: JSON.stringify(buildDeterministicInsights(summary)),
});

module.exports.generatePredictionNarrative = (summary, options = {}) => generateCached({
  userId: options.userId,
  task: 'prediction',
  input: summary,
  dataVersion: options.dataVersion || `prediction-${summary.activityCount}`,
  prompt: `Explain these deterministic emissions estimates in one short paragraph and give three practical tips. Do not recalculate, invent values, or present the estimate as a guarantee.\n${JSON.stringify(summary)}`,
  maxOutputTokens: 260,
  fallback: buildDeterministicPredictionExplanation(summary),
});

const summarizeAnomalyEvidence = (anomaly, region) => {
  if (!anomaly) return null;
  return {
    regionName: region?.name || 'Monitored Region',
    metric: anomaly.metric,
    observedValue: Number(anomaly.observed_value != null ? anomaly.observed_value : anomaly.latest_value),
    baselineValue: anomaly.baseline_value != null ? Number(anomaly.baseline_value) : null,
    deviation: anomaly.deviation != null ? Number(anomaly.deviation) : null,
    unit: anomaly.unit || '',
    method: anomaly.detection_method || 'seasonal_baseline',
    observedPeriod: anomaly.observed_at ? String(anomaly.observed_at).slice(0, 16) : 'recent_telemetry',
    dataSource: anomaly.data_source || 'Open-Meteo',
    severity: anomaly.severity || 'warning',
    anomalyType: anomaly.anomaly_category || anomaly.anomaly_type || 'atmospheric',
  };
};

const buildDeterministicAnomalyExplanation = (evidence) => {
  if (!evidence) {
    return {
      summary: 'Environmental anomaly explanation unavailable.',
      whatChanged: 'No specific anomaly evidence provided.',
      baselineUsed: 'Historical reference baseline',
      observedPeriod: 'Recent observation window',
      dataSource: 'Environmental telemetry',
      limitations: 'Automated statistical baseline approximation.',
      recommendations: ['Maintain regular station telemetry polling.'],
    };
  }
  const metricName = evidence.metric?.replace(/_/g, ' ') || 'Environmental metric';
  const whatChanged = evidence.deviation != null
    ? `${metricName} recorded at ${evidence.observedValue} ${evidence.unit}, reflecting an excursion of ${evidence.deviation > 0 ? '+' : ''}${evidence.deviation} ${evidence.unit} relative to baseline.`
    : `${metricName} recorded at ${evidence.observedValue} ${evidence.unit}.`;
  const baselineUsed = evidence.baselineValue != null
    ? `Seasonal historical baseline of ${evidence.baselineValue} ${evidence.unit} calculated via ${evidence.method}.`
    : 'Historical seasonal reference threshold.';
  const limitations = 'Baseline derived from reanalysis and ground telemetry. Local microclimates, thermal lag, and localized topography may influence point observations.';
  const recommendations = [
    `Cross-verify localized ground observations against adjacent meteorological stations to confirm duration.`,
    `Review historical seasonal variance for ${evidence.regionName} before dispatching operational alerts.`,
    `Track potential downstream impact on municipal water reserves and energy grid demand.`,
  ];
  return {
    summary: `${evidence.regionName}: ${metricName} anomaly flagged with ${evidence.severity} severity.`,
    whatChanged,
    baselineUsed,
    observedPeriod: evidence.observedPeriod || 'Recent telemetry window',
    dataSource: evidence.dataSource || 'Open-Meteo Verified Telemetry',
    limitations,
    recommendations,
  };
};

const summarizeTrendEvidence = (trendData, region) => {
  if (!trendData) return null;
  return {
    regionName: region?.name || 'Monitored Region',
    parameter: trendData.parameter || 'temperature_2m',
    timeRange: trendData.timeRange || 'annual',
    ratePerDecade: trendData.linearTrend?.ratePerDecade != null ? Number(trendData.linearTrend.ratePerDecade) : null,
    unit: trendData.linearTrend?.unit || '°C',
    slope: trendData.linearTrend?.slope != null ? Number(trendData.linearTrend.slope) : null,
    rSquared: trendData.linearTrend?.rSquared != null ? Number(trendData.linearTrend.rSquared) : null,
    sampleSize: trendData.linearTrend?.sampleSize || 0,
    baselinePeriod: trendData.referencePeriod?.label || '1991-2020 WMO Standard Reference',
    missingIntervalsCount: trendData.missingIntervals?.length || 0,
    dataSource: trendData.provider || 'NASA POWER / Open-Meteo Historical API',
  };
};

const buildDeterministicTrendReport = (evidence) => {
  if (!evidence) {
    return {
      summary: 'Climate trend summary unavailable.',
      whatChanged: 'Insufficient historical data points.',
      baselineUsed: 'WMO Standard Baseline',
      observedPeriod: 'Historical period',
      dataSource: 'NASA POWER / Open-Meteo',
      limitations: 'Data resolution constraints.',
      recommendations: ['Expand telemetry history for long-term climatological evaluation.'],
    };
  }
  const param = evidence.parameter?.replace(/_/g, ' ') || 'Temperature';
  const decadalRate = evidence.ratePerDecade != null ? `${evidence.ratePerDecade > 0 ? '+' : ''}${evidence.ratePerDecade} ${evidence.unit}/decade` : 'indivisible';
  const whatChanged = `Long-term historical trend indicates a slope of ${evidence.slope || 0} (${decadalRate}) over the observed ${evidence.timeRange} series across ${evidence.sampleSize} valid records.`;
  const baselineUsed = `Comparative reference period: ${evidence.baselinePeriod}.`;
  const limitations = `Linear least-squares regression has R² of ${evidence.rSquared != null ? evidence.rSquared : 'N/A'} with ${evidence.missingIntervalsCount} missing observation intervals. External climate projections are based on CMIP6 model ensembles and represent scenario pathways, not guaranteed weather forecasts.`;
  const recommendations = [
    `Factor decadal temperature shifts into urban infrastructure and thermal resilience planning.`,
    `Incorporate drought risk mitigation and rainwater harvesting based on seasonal precipitation baselines.`,
    `Utilize multi-model ensemble ranges rather than single-model extrapolations for policy targets.`,
  ];
  return {
    summary: `${evidence.regionName}: ${param} decadal trend analysis (${decadalRate}).`,
    whatChanged,
    baselineUsed,
    observedPeriod: `${evidence.sampleSize} aggregated intervals`,
    dataSource: evidence.dataSource,
    limitations,
    recommendations,
  };
};

const summarizeRegionalEvidence = ({ region, metrics = [], anomalies = [], alerts = [], airQuality }) => {
  const hasCoords = region && Number.isFinite(Number(region.latitude)) && Number.isFinite(Number(region.longitude));
  const coordinates = hasCoords ? `${Number(region.latitude).toFixed(2)}, ${Number(region.longitude).toFixed(2)}` : null;
  return {
    regionName: region?.name || 'Monitored Region',
    coordinates,
    metrics: (metrics || []).slice(0, 5).map((m) => ({
      metric: m.metric,
      label: m.label,
      value: Number(m.latest),
      unit: m.unit,
      anomaly: Boolean(m.anomaly),
      freshness: m.freshness,
    })),
    activeAnomaliesCount: (anomalies || []).length,
    activeAlertsCount: (alerts || []).filter((a) => a.status === 'open').length,
    airQualityStatus: airQuality?.status || 'unavailable',
    airQualityStation: airQuality?.stationName || null,
    airQualityPollutants: (airQuality?.measurements || []).slice(0, 4).map((p) => ({
      pollutant: p.pollutant || p.parameter || 'ambient',
      value: p.value,
      unit: p.unit || '',
    })),
  };
};

const buildDeterministicRegionalInsights = (evidence) => {
  const insights = [];
  if (!evidence) return insights;

  insights.push({
    title: `${evidence.regionName} Environmental Telemetry Status`,
    whatChanged: `Monitored with ${evidence.metrics.length} active telemetry metrics. ${evidence.activeAnomaliesCount} anomalies and ${evidence.activeAlertsCount} active alerts currently open.`,
    evidence: `Coordinates: ${evidence.coordinates || 'Configured region'}; Air quality status: ${evidence.airQualityStatus}.`,
    recommendation: 'Continue scheduled background ingestion and periodic historical baseline updates.',
    severity: evidence.activeAnomaliesCount > 0 ? 'warning' : 'normal',
    dataSource: 'Open-Meteo & OpenAQ',
    limitations: 'Telemetry reflects nearest ground or reanalysis grid cell.',
  });

  if (evidence.airQualityPollutants?.length > 0) {
    insights.push({
      title: 'Ground Air Quality Telemetry',
      whatChanged: `OpenAQ ground station reporting ${evidence.airQualityPollutants.map((p) => `${String(p.pollutant || 'pollutant').toUpperCase()}: ${p.value} ${p.unit || ''}`).join(', ')}.`,
      evidence: `Station: ${evidence.airQualityStation || 'Nearest Ground Monitor'}; evaluation against WHO 2021 air quality guidelines.`,
      recommendation: 'Ambient particulate matter reflects local conditions and is evaluated separately from long-term climate change baselines.',
      severity: 'info',
      dataSource: 'OpenAQ Ground Station Network',
      limitations: 'Ground monitoring coverage depends on local station operation.',
    });
  } else if (evidence.airQualityStatus === 'data_unavailable' || evidence.airQualityStatus === 'auth_required') {
    insights.push({
      title: 'Air Quality Telemetry Coverage',
      whatChanged: 'No active ground air quality monitor detected within 25 km.',
      evidence: 'Missing sensor telemetry is explicitly tagged as data unavailable and is not assumed to be clean air.',
      recommendation: 'Inquire with local municipal environmental protection boards or deploy community sensors.',
      severity: 'info',
      dataSource: 'OpenAQ Community',
      limitations: 'Sparse sensor density in remote or rural locations.',
    });
  }

  return insights;
};

module.exports.generateEnvironmentalAnomalyExplanation = async (anomaly, region, options = {}) => {
  const evidence = summarizeAnomalyEvidence(anomaly, region);
  const fallback = buildDeterministicAnomalyExplanation(evidence);
  if (!evidence) return fallback;

  const prompt = `You are an environmental analytics assistant. Explain this verified environmental anomaly using ONLY the provided evidence.
DO NOT invent any measurements, locations, historical records, or confidence values.
Your explanation must address:
1. What changed (observed value vs baseline and deviation)
2. The baseline used
3. The observed period
4. The data source
5. Limitations (e.g., local station microclimates, sensor calibration, temporal resolution)
6. Practical, actionable recommendations appropriate to the observed evidence.

Return a JSON object with keys: summary, whatChanged, baselineUsed, observedPeriod, dataSource, limitations, recommendations (array of strings).
Evidence:
${JSON.stringify(evidence)}`;

  const responseText = await generateCached({
    userId: options.userId,
    task: 'env_anomaly',
    input: evidence,
    dataVersion: options.dataVersion || `anomaly-${anomaly.id || evidence.metric}-${evidence.observedPeriod}`,
    prompt,
    maxOutputTokens: 380,
    fallback: JSON.stringify(fallback),
  });

  try {
    const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return {
      ...fallback,
      summary: responseText.slice(0, 200),
      whatChanged: responseText,
    };
  }
};

module.exports.generateEnvironmentalTrendReport = async (trendData, region, options = {}) => {
  const evidence = summarizeTrendEvidence(trendData, region);
  const fallback = buildDeterministicTrendReport(evidence);
  if (!evidence) return fallback;

  const prompt = `You are an environmental reporting assistant. Summarize this verified climate trend using ONLY the provided evidence.
DO NOT invent numbers, projections, or historical periods.
Address:
1. What changed over the observed period (e.g., rate per decade, historical trend)
2. The historical reference baseline used
3. The data source
4. Scientific limitations (e.g., coverage gaps, statistical R², regional downscaling)
5. Practical sustainability and planning recommendations.

Return a JSON object with keys: summary, whatChanged, baselineUsed, observedPeriod, dataSource, limitations, recommendations (array of strings).
Evidence:
${JSON.stringify(evidence)}`;

  const responseText = await generateCached({
    userId: options.userId,
    task: 'env_trend',
    input: evidence,
    dataVersion: options.dataVersion || `trend-${evidence.regionName}-${evidence.parameter}-${evidence.timeRange}`,
    prompt,
    maxOutputTokens: 380,
    fallback: JSON.stringify(fallback),
  });

  try {
    const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return {
      ...fallback,
      summary: responseText.slice(0, 200),
      whatChanged: responseText,
    };
  }
};

module.exports.generateRegionalAiInsights = async (regionalContext, options = {}) => {
  const evidence = summarizeRegionalEvidence(regionalContext);
  const fallback = buildDeterministicRegionalInsights(evidence);
  if (!evidence) return fallback;

  const prompt = `You are an environmental analytics assistant. Generate 2 to 3 concise, factual AI insight cards for this regional environmental dashboard based ONLY on this evidence.
DO NOT invent measurements, alerts, or confidence scores.
Each insight must have:
- title: concise heading
- whatChanged: factual statement of current state
- evidence: data points supporting it
- recommendation: practical, realistic action
- severity: 'normal', 'info', or 'warning'
- dataSource: verified source name
- limitations: scientific or sensor limitations

Return a JSON array of objects.
Evidence:
${JSON.stringify(evidence)}`;

  const responseText = await generateCached({
    userId: options.userId,
    task: 'env_insights',
    input: evidence,
    dataVersion: options.dataVersion || `insights-${evidence.regionName}-${evidence.metrics.length}-${evidence.activeAnomaliesCount}`,
    prompt,
    maxOutputTokens: 420,
    fallback: JSON.stringify(fallback),
  });

  try {
    const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : fallback;
  } catch {
    return fallback;
  }
};

module.exports.buildDeterministicInsights = buildDeterministicInsights;
module.exports.buildDeterministicPredictionExplanation = buildDeterministicPredictionExplanation;
module.exports.buildDeterministicReportSummary = buildDeterministicReportSummary;
module.exports.buildDeterministicChatReply = buildDeterministicChatReply;
module.exports.buildDeterministicEcoPlan = buildDeterministicEcoPlan;
module.exports.buildDeterministicCoachNarrative = buildDeterministicCoachNarrative;
module.exports.buildDeterministicImpactNarrative = buildDeterministicImpactNarrative;
module.exports.isValidGeminiApiKey = isValidGeminiApiKey;

module.exports._test = {
  cacheKey,
  stable,
  inFlight,
  rateWindows,
  requestGemini,
  generateCached,
  isQuotaError,
  isValidGeminiApiKey,
  resetCircuitBreaker: () => {
    circuitBreakerUntil = 0;
    circuitBreakerReason = '';
    circuitBreakerWarned = false;
  },
  getCircuitBreakerStatus: () => ({
    isOpen: Date.now() < circuitBreakerUntil,
    until: circuitBreakerUntil,
    reason: circuitBreakerReason,
  }),
  tripCircuitBreaker: (durationMs = 300000) => {
    circuitBreakerUntil = Date.now() + durationMs;
    circuitBreakerWarned = true;
  },
  summarizeAnomalyEvidence,
  summarizeTrendEvidence,
  summarizeRegionalEvidence,
  buildDeterministicAnomalyExplanation,
  buildDeterministicTrendReport,
  buildDeterministicRegionalInsights,
  buildDeterministicInsights,
  buildDeterministicPredictionExplanation,
  buildDeterministicReportSummary,
  buildDeterministicChatReply,
  buildDeterministicEcoPlan,
};
