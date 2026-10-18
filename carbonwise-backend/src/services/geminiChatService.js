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
  env_anomaly: 'Environmental anomaly explanation is temporarily unavailable. Review the observed deviation against seasonal baseline.',
  env_trend: 'Climate trend report summary is temporarily unavailable. Review the numerical trend data directly.',
  env_insights: 'Regional environmental insights are temporarily unavailable. Telemetry observations remain nominal.',
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
  return {
    regionName: region?.name || 'Monitored Region',
    coordinates: region ? `${Number(region.latitude).toFixed(2)}, ${Number(region.longitude).toFixed(2)}` : null,
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
      pollutant: p.pollutant,
      value: p.value,
      unit: p.unit,
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
      whatChanged: `OpenAQ ground station reporting ${evidence.airQualityPollutants.map((p) => `${p.pollutant.toUpperCase()}: ${p.value} ${p.unit}`).join(', ')}.`,
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

module.exports._test = {
  cacheKey,
  stable,
  inFlight,
  rateWindows,
  requestGemini,
  generateCached,
  isQuotaError,
  summarizeAnomalyEvidence,
  summarizeTrendEvidence,
  summarizeRegionalEvidence,
  buildDeterministicAnomalyExplanation,
  buildDeterministicTrendReport,
  buildDeterministicRegionalInsights,
};
