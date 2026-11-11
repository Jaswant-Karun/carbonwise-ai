const test = require('node:test');
const assert = require('node:assert/strict');

const queries = [];
const cache = new Map();
const dbPath = require.resolve('../src/config/db');
require.cache[dbPath] = { exports: {
  query: async (sql, params = []) => {
    queries.push(sql);
    if (sql.trimStart().startsWith('SELECT response')) {
      const value = cache.get(params[2]);
      return { rows: value ? [{ response: value }] : [] };
    }
    if (sql.trimStart().startsWith('INSERT INTO ai_response_cache')) {
      cache.set(params[2], params[3]);
    }
    return { rows: [] };
  },
} };

let generationCount = 0;
const sdkPath = require.resolve('@google/generative-ai');
require.cache[sdkPath] = { exports: {
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return { generateContent: async () => {
        generationCount += 1;
        return { response: { text: () => 'cached AI response' } };
      } };
    }
  },
} };
process.env.GEMINI_API_KEY = 'test-only-placeholder';
const service = require('../src/services/geminiChatService');
const { generateCached, cacheKey, inFlight, rateWindows, isQuotaError } = service._test;

test.beforeEach(() => {
  cache.clear();
  queries.length = 0;
  generationCount = 0;
  inFlight.clear();
  rateWindows.clear();
});

test('reuses an identical cached response without another Gemini request', async () => {
  const options = {
    userId: 7, task: 'impact', input: { total: 10 }, dataVersion: 'activities-1',
    prompt: 'prompt', fallback: 'deterministic fallback',
  };
  assert.equal(await generateCached(options), 'cached AI response');
  assert.equal(await generateCached(options), 'cached AI response');
  assert.equal(generationCount, 1);
  assert.equal(queries.filter((query) => query.startsWith('INSERT INTO ai_response_cache')).length, 1);
  assert.equal(cacheKey({ userId: 7, task: 'impact', input: { total: 10 }, dataVersion: 'activities-1' }),
    cacheKey({ userId: 7, task: 'impact', input: { total: 10 }, dataVersion: 'activities-1' }));
});

test('joins concurrent identical requests and only creates one cache record', async () => {
  const options = {
    userId: 8, task: 'coach', input: { category: 'transport' }, dataVersion: 'v1',
    prompt: 'prompt', fallback: 'fallback',
  };
  const results = await Promise.all([generateCached(options), generateCached(options)]);
  assert.deepEqual(results, ['cached AI response', 'cached AI response']);
  assert.equal(generationCount, 1);
  assert.equal(queries.filter((query) => query.startsWith('INSERT INTO ai_response_cache')).length, 1);
});

test('classifies quota responses without retry semantics', () => {
  assert.equal(isQuotaError({ status: 429 }), true);
  assert.equal(isQuotaError(new Error('resource exhausted')), true);
  assert.equal(isQuotaError(new Error('network unavailable')), false);
});

test('returns an explicit deterministic fallback when credentials are unavailable', async () => {
  const key = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  const result = await generateCached({
    userId: 9, task: 'impact', input: { total: 2 }, dataVersion: 'fallback',
    prompt: 'prompt', fallback: 'deterministic fallback',
  });
  process.env.GEMINI_API_KEY = key;
  assert.equal(result, 'deterministic fallback');
});

test('summarizeAnomalyEvidence: extracts minimum non-sensitive evidence without private data', () => {
  const { summarizeAnomalyEvidence, buildDeterministicAnomalyExplanation } = service._test;
  const rawAnomaly = {
    metric: 'temperature',
    observed_value: 36.8,
    baseline_value: 29.2,
    deviation: 7.6,
    unit: '°C',
    detection_method: 'robust_z_score_mad',
    observed_at: '2026-10-18T12:00:00Z',
    data_source: 'Open-Meteo Verification',
    severity: 'critical',
  };
  const region = { name: 'Berlin Central' };
  const evidence = summarizeAnomalyEvidence(rawAnomaly, region);

  assert.equal(evidence.regionName, 'Berlin Central');
  assert.equal(evidence.metric, 'temperature');
  assert.equal(evidence.observedValue, 36.8);
  assert.equal(evidence.baselineValue, 29.2);
  assert.equal(evidence.deviation, 7.6);
  assert.equal(evidence.unit, '°C');

  // Verify deterministic fallback structure
  const explanation = buildDeterministicAnomalyExplanation(evidence);
  assert.ok(explanation.whatChanged.includes('36.8 °C'));
  assert.ok(explanation.whatChanged.includes('+7.6 °C'));
  assert.ok(explanation.baselineUsed.includes('29.2 °C'));
  assert.ok(explanation.dataSource.includes('Open-Meteo'));
  assert.ok(explanation.limitations.length > 0);
  assert.ok(Array.isArray(explanation.recommendations) && explanation.recommendations.length > 0);
});

test('summarizeTrendEvidence: formats decadal rate and regression limitations deterministically', () => {
  const { summarizeTrendEvidence, buildDeterministicTrendReport } = service._test;
  const rawTrend = {
    parameter: 'temperature_2m',
    timeRange: 'annual',
    provider: 'NASA POWER / Open-Meteo',
    referencePeriod: { label: '1991-2020 WMO Standard Reference' },
    missingIntervals: ['2004-01-01'],
    linearTrend: {
      ratePerDecade: 0.38,
      unit: '°C',
      slope: 0.038,
      rSquared: 0.82,
      sampleSize: 30,
    },
  };
  const region = { name: 'Paris' };
  const evidence = summarizeTrendEvidence(rawTrend, region);

  assert.equal(evidence.ratePerDecade, 0.38);
  assert.equal(evidence.unit, '°C');
  assert.equal(evidence.sampleSize, 30);
  assert.equal(evidence.missingIntervalsCount, 1);

  const report = buildDeterministicTrendReport(evidence);
  assert.ok(report.whatChanged.includes('+0.38 °C/decade'));
  assert.ok(report.baselineUsed.includes('1991-2020'));
  assert.ok(report.limitations.includes('R² of 0.82'));
  assert.ok(Array.isArray(report.recommendations));
});

test('environmental anomaly explanation: returns structured explanation with caching', async () => {
  const rawAnomaly = {
    metric: 'pm2_5',
    observed_value: 48.0,
    baseline_value: 15.0,
    deviation: 33.0,
    unit: 'µg/m³',
    observed_at: '2026-10-18T10:00:00Z',
    severity: 'warning',
  };
  const region = { name: 'Tokyo' };
  const result = await service.generateEnvironmentalAnomalyExplanation(rawAnomaly, region, { userId: 10 });
  assert.ok(result);
  assert.ok(result.whatChanged);
  assert.ok(result.recommendations);
  assert.equal(generationCount, 1);
});

test('isValidGeminiApiKey: correctly discriminates Google AI Studio key format', () => {
  const { isValidGeminiApiKey } = service._test;
  assert.equal(isValidGeminiApiKey('AIzaSyD_1234567890abcdefghijklmnopqrstu'), true);
  assert.equal(isValidGeminiApiKey('AQ.Ab8RN6I-XomCjB9xHjaE_y3o-qM8hxDF3qT73hx0K1pCbJvWxw'), false);
  assert.equal(isValidGeminiApiKey(''), false);
  assert.equal(isValidGeminiApiKey('random_token_string'), false);
  assert.equal(isValidGeminiApiKey(null), false);
  assert.equal(isValidGeminiApiKey(undefined), false);
});

test('buildDeterministicInsights: produces 5 grounded insights with high/medium/low impact', () => {
  const { buildDeterministicInsights } = service._test;
  const summary = {
    totalEmissions: '250.00',
    activityCount: 15,
    byType: {
      electricity: 150.0,
      transportation: 75.0,
      food: 25.0,
    },
  };
  const insights = buildDeterministicInsights(summary);
  assert.equal(insights.length, 5);
  insights.forEach((item) => {
    assert.ok(item.title);
    assert.ok(item.description);
    assert.ok(['high', 'medium', 'low'].includes(item.impact));
    assert.ok(item.icon);
  });
  assert.ok(insights[0].title.includes('Electricity'));
  assert.ok(insights[0].description.includes('150.0 kg CO₂e'));
  assert.equal(insights[0].impact, 'high');
});

test('buildDeterministicPredictionExplanation: articulates horizon, daily baseline, and actionable mitigation', () => {
  const { buildDeterministicPredictionExplanation } = service._test;
  const summary = {
    activityCount: 20,
    baselineDailyAverage: '8.40',
    horizonDays: 30,
    totalProjectedKg: '252.00',
    topFutureContributor: 'transportation',
    topFutureShare: 60,
  };
  const explanation = buildDeterministicPredictionExplanation(summary);
  assert.ok(explanation.includes('252.00 kg CO₂e'));
  assert.ok(explanation.includes('8.40 kg CO₂e/day'));
  assert.ok(explanation.includes('transportation'));
  assert.ok(explanation.includes('Recommended mitigation steps:'));
});

test('buildDeterministicChatReply: returns grounded data-aware responses', () => {
  const { buildDeterministicChatReply } = service._test;
  const activities = [
    { activity_type: 'electricity', carbon_emissions: 100 },
    { activity_type: 'transportation', carbon_emissions: 50 },
  ];

  const emptyReply = buildDeterministicChatReply('What can I do?', []);
  assert.ok(emptyReply.includes('Welcome to CarbonWise AI'));

  const emissionsReply = buildDeterministicChatReply('What are my highest emissions?', activities);
  assert.ok(emissionsReply.includes('150.00 kg CO₂e'));
  assert.ok(emissionsReply.includes('electricity'));

  const transportReply = buildDeterministicChatReply('How do I reduce my driving footprint?', activities);
  assert.ok(transportReply.includes('50.0 kg CO₂e'));
  assert.ok(transportReply.includes('transit'));

  const greetingReply = buildDeterministicChatReply('Hello!', activities);
  assert.ok(greetingReply.includes('CarbonWise AI'));
});

