const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const db = require('../src/config/db');

const API_BASE = 'http://localhost:5000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

const apiRequest = async (path, { method = 'GET', body = null, token = null } = {}) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${path}`, options);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, headers: res.headers, body: json || text };
};

test('CarbonWise AI - End-to-End Verification Pass', async (t) => {
  let user1Token;
  let user2Token;
  let user1Id;
  let user2Id;
  let testRegionId;
  let testActivityId;
  let testScenarioId;
  let testPlanId;

  await t.test('1. Server and PostgreSQL connectivity', async () => {
    const health = await apiRequest('/health');
    assert.equal(health.status, 200);
    assert.equal(health.body.status, 'ok');

    const dbRes = await db.query('SELECT NOW() as current_time, current_database() as db_name;');
    assert.ok(dbRes.rows[0].current_time);
    assert.ok(dbRes.rows[0].db_name);
  });

  await t.test('2. Authentication setup and user tokens', async () => {
    // Look up or create two distinct test users for isolation testing
    const email1 = `test_e2e_1_${Date.now()}@example.com`;
    const email2 = `test_e2e_2_${Date.now()}@example.com`;

    const u1 = await db.query(
      `INSERT INTO users (name, email, password) VALUES ($1, $2, 'hashedpass1') RETURNING id, email`,
      ['Test User 1', email1]
    );
    const u2 = await db.query(
      `INSERT INTO users (name, email, password) VALUES ($1, $2, 'hashedpass2') RETURNING id, email`,
      ['Test User 2', email2]
    );

    user1Id = u1.rows[0].id;
    user2Id = u2.rows[0].id;

    user1Token = jwt.sign({ id: user1Id, email: email1 }, JWT_SECRET, { expiresIn: '1h' });
    user2Token = jwt.sign({ id: user2Id, email: email2 }, JWT_SECRET, { expiresIn: '1h' });

    assert.ok(user1Token);
    assert.ok(user2Token);
  });

  await t.test('3. Geocoding location search (real Open-Meteo)', async () => {
    const geoRes = await apiRequest('/environment/locations/search?q=Bengaluru', { token: user1Token });
    assert.equal(geoRes.status, 200);
    assert.ok(Array.isArray(geoRes.body));
    assert.ok(geoRes.body.length > 0);
    const first = geoRes.body[0];
    assert.ok(first.name.toLowerCase().includes('bengaluru') || first.name.toLowerCase().includes('bangalore'));
    assert.ok(Number.isFinite(first.latitude));
    assert.ok(Number.isFinite(first.longitude));
  });

  await t.test('4. Environmental region creation & live data ingestion', async () => {
    // Create region
    const createRes = await apiRequest('/environment/regions', {
      method: 'POST',
      token: user1Token,
      body: {
        name: 'Bengaluru Urban',
        latitude: 12.97,
        longitude: 77.59,
        country: 'India',
        admin1: 'Karnataka',
        timezone: 'Asia/Kolkata',
      },
    });
    assert.equal(createRes.status, 201);
    assert.ok(createRes.body.id);
    testRegionId = createRes.body.id;

    // Trigger live ingestion
    const refreshRes = await apiRequest(`/environment/regions/${testRegionId}/refresh`, {
      method: 'POST',
      token: user1Token,
    });
    assert.equal(refreshRes.status, 200);
    assert.ok(refreshRes.body.ingestion?.observationsCount >= 0 || refreshRes.body.summary);

    // Verify observations exist in DB for this region
    const obsDb = await db.query(
      `SELECT count(*) FROM environment_observations WHERE region_id = $1`,
      [testRegionId]
    );
    assert.ok(Number(obsDb.rows[0].count) > 0);
  });

  await t.test('5. Summary and real-time telemetry verification', async () => {
    const summaryRes = await apiRequest(`/environment/regions/${testRegionId}/summary`, { token: user1Token });
    assert.equal(summaryRes.status, 200);
    assert.ok(summaryRes.body.region);
    assert.ok(Array.isArray(summaryRes.body.metrics));
    const tempMetric = summaryRes.body.metrics.find((m) => m.metric === 'temperature');
    assert.ok(tempMetric);
    assert.ok(tempMetric.latest !== null);
  });

  await t.test('6. Climate Trends and historical aggregation endpoint', async () => {
    const trendsRes = await apiRequest(`/environment/regions/${testRegionId}/trends?resolution=daily`, { token: user1Token });
    assert.equal(trendsRes.status, 200);
    assert.ok(Array.isArray(trendsRes.body.timeSeries));
    assert.ok(trendsRes.body.trend);
  });

  await t.test('7. 7-Day Weather Forecasts separating predictions from actuals', async () => {
    const forecastRes = await apiRequest(`/environment/regions/${testRegionId}/forecasts`, { token: user1Token });
    assert.equal(forecastRes.status, 200);
    assert.ok(forecastRes.body.tiers?.shortTermForecast);
    assert.ok(Array.isArray(forecastRes.body.tiers.shortTermForecast.days));
    assert.ok(forecastRes.body.tiers.shortTermForecast.disclaimer);
  });

  await t.test('8. CMIP6 Climate Projections with explicit assumptions and models', async () => {
    const projRes = await apiRequest(`/environment/regions/${testRegionId}/climate-projections`, { token: user1Token });
    assert.equal(projRes.status, 200);
    assert.ok(projRes.body.projections?.scenarios);
    assert.ok(projRes.body.projections.scenarios['SSP1-2.6']);
    assert.ok(projRes.body.projections.scenarios['SSP2-4.5']);
    assert.ok(projRes.body.projections.scenarios['SSP5-8.5']);
    assert.ok(projRes.body.projections.model);
  });

  await t.test('9. Air-Quality telemetry endpoint', async () => {
    const aqRes = await apiRequest(`/environment/regions/${testRegionId}/air-quality`, { token: user1Token });
    assert.equal(aqRes.status, 200);
    assert.ok(aqRes.body.provider);
    assert.ok(Array.isArray(aqRes.body.measurements) || aqRes.body.status === 'auth_required');
  });

  await t.test('10. User Activity and Carbon Intelligence Engine (Module 1)', async () => {
    // Add sample activities
    const act1 = await apiRequest('/activities', {
      method: 'POST',
      token: user1Token,
      body: { activityType: 'transport', details: { value: 100 }, carbonEmissions: 21.0, date: '2026-10-15' },
    });
    const act2 = await apiRequest('/activities', {
      method: 'POST',
      token: user1Token,
      body: { activityType: 'electricity', details: { value: 50 }, carbonEmissions: 25.0, date: '2026-10-16' },
    });
    testActivityId = act1.body?.id || act1.body?.activity?.id;

    // Fetch intelligence
    const intelRes = await apiRequest('/intelligence?period=30', { token: user1Token });
    assert.equal(intelRes.status, 200);
    assert.ok(intelRes.body.totals);
    assert.ok(intelRes.body.totals.currentPeriod >= 46.0);
    assert.ok(Array.isArray(intelRes.body.categoryBreakdown));
    assert.ok(Array.isArray(intelRes.body.recommendations));
  });

  await t.test('11. What-If Carbon Simulator (Module 2)', async () => {
    const previewRes = await apiRequest('/scenarios/preview', {
      method: 'POST',
      token: user1Token,
      body: {
        periodDays: 30,
        changes: [{ action: 'reduce', category: 'electricity', percentage: 20 }],
      },
    });
    assert.equal(previewRes.status, 200);
    assert.ok(previewRes.body.potentialSavingsKg >= 0);
    assert.ok(previewRes.body.assumptions.length > 0);

    // Save scenario
    const saveRes = await apiRequest('/scenarios', {
      method: 'POST',
      token: user1Token,
      body: {
        name: 'Energy Savings 20%',
        periodDays: 30,
        changes: [{ action: 'reduce', category: 'electricity', percentage: 20 }],
      },
    });
    assert.equal(saveRes.status, 201);
    testScenarioId = saveRes.body.id;
  });

  await t.test('12. Adaptive AI Eco-Coach (Module 3)', async () => {
    const planRes = await apiRequest('/coach/plans', {
      method: 'POST',
      token: user1Token,
    });
    assert.equal(planRes.status, 201);
    assert.ok(planRes.body.actions);
    assert.equal(planRes.body.actions.length, 7);
    testPlanId = planRes.body.id;

    // Update an action
    const actionId = planRes.body.actions[0].id;
    const updateRes = await apiRequest(`/coach/actions/${actionId}`, {
      method: 'PATCH',
      token: user1Token,
      body: { status: 'completed' },
    });
    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.body.status, 'completed');
  });

  await t.test('13. Carbon Forecasting and Anomaly Detection (Module 4)', async () => {
    const forecastRes = await apiRequest('/forecast?period=30&horizon=7', { token: user1Token });
    assert.equal(forecastRes.status, 200);
    assert.ok(forecastRes.body.forecast);
    assert.ok(Array.isArray(forecastRes.body.forecast.actual));
    assert.ok(Array.isArray(forecastRes.body.anomalies));
  });

  await t.test('14. Sustainability Impact Tracker (Module 5)', async () => {
    const impactRes = await apiRequest('/impact/reports', {
      method: 'POST',
      token: user1Token,
      body: { currentPeriod: 30 },
    });
    assert.equal(impactRes.status, 201);
    assert.ok(impactRes.body.totals);
    assert.ok(impactRes.body.potentialSavingsKg >= 0);
    assert.ok(impactRes.body.limitations);
  });

  await t.test('15. Authentication & User-Data Isolation', async () => {
    // User 2 attempts to access User 1's scenario
    const unauthorizedScenario = await apiRequest(`/scenarios/${testScenarioId}`, { token: user2Token });
    assert.equal(unauthorizedScenario.status, 404);

    // User 2 attempts to mutate User 1's region
    const unauthorizedRegion = await apiRequest(`/environment/regions/${testRegionId}/refresh`, {
      method: 'POST',
      token: user2Token,
    });
    assert.equal(unauthorizedRegion.status, 404);

    // Request with no token is rejected
    const noToken = await apiRequest('/intelligence');
    assert.equal(noToken.status, 401);
  });

  await t.test('16. Gemini deterministic fallbacks and caching', async () => {
    const aiInsightRes = await apiRequest(`/environment/regions/${testRegionId}/ai-insights`, { token: user1Token });
    assert.equal(aiInsightRes.status, 200);
    assert.ok(Array.isArray(aiInsightRes.body.insights));
    assert.ok(aiInsightRes.body.insights.length > 0);
    assert.ok(aiInsightRes.body.insights[0].title);
  });

  // Cleanup test records
  t.after(async () => {
    if (user1Id) await db.query('DELETE FROM users WHERE id = $1', [user1Id]);
    if (user2Id) await db.query('DELETE FROM users WHERE id = $1', [user2Id]);
  });
});
