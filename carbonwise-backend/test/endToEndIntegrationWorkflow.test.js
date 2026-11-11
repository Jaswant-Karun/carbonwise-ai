const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const db = require('../src/config/db');
const { app } = require('../src/index');

const API_BASE = 'http://localhost:5000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

let localServer;
let startedLocal = false;

const apiRequest = async (path, { method = 'GET', body = null, token = null, headers = {} } = {}) => {
  const reqHeaders = { 'Content-Type': 'application/json', ...headers };
  if (token) reqHeaders.Authorization = `Bearer ${token}`;
  const options = { method, headers: reqHeaders };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${path}`, options);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, headers: res.headers, body: json || text };
};

test('Module 11: End-to-End Functionality and Unified Workflow Verification', async (t) => {
  // Ensure server is active
  try {
    const probe = await fetch('http://localhost:5000/api/health');
    if (!probe.ok) throw new Error();
  } catch {
    await new Promise((resolve) => {
      localServer = app.listen(5000, () => {
        startedLocal = true;
        resolve();
      });
    });
  }

  let userToken;
  let userId;
  let electricityActivityId;
  let coachActionId;
  let baselineId;
  let electricityEmissionsKg = 0;

  // Cleanup test user after tests complete
  t.after(async () => {
    if (userId) {
      await db.query('DELETE FROM users WHERE id = $1', [userId]);
    }
    if (startedLocal && localServer) {
      await new Promise((resolve) => localServer.close(resolve));
    }
  });

  await t.test('Step 0: User Setup and Zero-State Baseline Integrity', async () => {
    const email = `workflow_user_${Date.now()}@carbonwise.ai`;
    const userRes = await db.query(
      `INSERT INTO users (name, email, password) VALUES ($1, $2, 'securehash123') RETURNING id, email`,
      ['Priya Sharma', email],
    );
    userId = userRes.rows[0].id;
    userToken = jwt.sign({ id: userId, email }, JWT_SECRET, { expiresIn: '2h' });

    // Verify initial clean state with zero activities
    const initialIntel = await apiRequest('/intelligence?period=30', { token: userToken });
    assert.equal(initialIntel.status, 200);
    assert.equal(initialIntel.body.totals.currentPeriod, 0);
    assert.equal(initialIntel.body.activityCount, 0);
  });

  await t.test('Step 1 & 2: User records an electricity activity & Backend validates the input', async () => {
    // Validation check: Rejects negative kWh value
    const invalidRes = await apiRequest('/activities', {
      method: 'POST',
      token: userToken,
      body: {
        activity_type: 'electricity',
        details: { kwh: -50, energySource: 'grid' },
        date: '2026-11-01',
      },
    });
    assert.equal(invalidRes.status, 400);

    // Validation check: Accepts valid electricity activity with idempotency protection
    const validRes = await apiRequest('/activities', {
      method: 'POST',
      token: userToken,
      headers: { 'x-idempotency-key': 'workflow-elec-log-1' },
      body: {
        activity_type: 'electricity',
        details: {
          kwh: 120,
          energySource: 'grid',
          notes: 'Main residential meter reading for November',
        },
        date: '2026-11-01',
      },
    });
    assert.equal(validRes.status, 201);
    assert.ok(validRes.body.id);
    electricityActivityId = validRes.body.id;
    electricityEmissionsKg = Number(validRes.body.carbon_emissions);
    assert.ok(electricityEmissionsKg > 0);

    // Duplicate submission with same idempotency key returns the existing record
    const dupRes = await apiRequest('/activities', {
      method: 'POST',
      token: userToken,
      headers: { 'x-idempotency-key': 'workflow-elec-log-1' },
      body: {
        activity_type: 'electricity',
        details: { kwh: 120, energySource: 'grid' },
        date: '2026-11-01',
      },
    });
    assert.equal(dupRes.status, 200);
    assert.equal(dupRes.body.id, electricityActivityId);
  });

  await t.test('Step 3 & 4: Emission Engine calculates CO2e estimate & Stores in PostgreSQL', async () => {
    // Query PostgreSQL activities table directly
    const actRow = await db.query('SELECT * FROM activities WHERE id = $1 AND user_id = $2', [
      electricityActivityId,
      userId,
    ]);
    assert.equal(actRow.rows.length, 1);
    const row = actRow.rows[0];
    assert.equal(row.activity_type, 'electricity');
    assert.equal(Number(row.carbon_emissions), electricityEmissionsKg);
    assert.equal(row.details.notes, 'Main residential meter reading for November');

    // Query connected activity_emissions table
    const recRow = await db.query('SELECT * FROM activity_emissions WHERE activity_id = $1 AND user_id = $2', [
      electricityActivityId,
      userId,
    ]);
    assert.equal(recRow.rows.length, 1);
    assert.equal(Number(recRow.rows[0].emissions_kg), electricityEmissionsKg);
    assert.equal(recRow.rows[0].scope, 'Scope 2');
    assert.ok(recRow.rows[0].methodology.includes('0.82') || recRow.rows[0].methodology.includes('Factor') || recRow.rows[0].methodology.includes('grid'));
  });

  await t.test('Step 5: Dashboard updates category and total emissions immediately', async () => {
    // Query intelligence summary endpoint used by the Dashboard
    const intelRes = await apiRequest('/intelligence?period=30', { token: userToken });
    assert.equal(intelRes.status, 200);
    assert.equal(intelRes.body.totals.currentPeriod, electricityEmissionsKg);
    assert.equal(intelRes.body.activityCount, 1);

    // Category breakdown reflects electricity
    const elecCat = intelRes.body.categoryBreakdown.find((c) => c.category === 'electricity');
    assert.ok(elecCat);
    assert.equal(elecCat.emissions, electricityEmissionsKg);
    assert.equal(elecCat.contributionPercentage, 100);

    // Largest source is electricity
    assert.equal(intelRes.body.largestSources[0].category, 'electricity');

    // Recent activities list in dashboard
    const actList = await apiRequest('/activities', { token: userToken });
    assert.equal(actList.status, 200);
    assert.ok(Array.isArray(actList.body));
    assert.equal(actList.body[0].id, electricityActivityId);
  });

  await t.test('Step 6: Prediction Engine incorporates updated historical records', async () => {
    // Add additional activities across prior dates to form a historical time series
    for (let i = 2; i <= 6; i++) {
      await apiRequest('/activities', {
        method: 'POST',
        token: userToken,
        body: {
          activity_type: 'electricity',
          details: { kwh: 100 + i * 5, energySource: 'grid' },
          date: `2026-11-0${i}`,
        },
      });
    }

    const forecastRes = await apiRequest('/forecast?period=30&horizon=7', { token: userToken });
    assert.equal(forecastRes.status, 200);
    assert.ok(forecastRes.body.forecast);
    assert.ok(forecastRes.body.forecast.totalProjectedKg > 0);
    assert.ok(forecastRes.body.forecast.baselineDailyAverage > 0);
    assert.ok(forecastRes.body.dataQuality.activityCount >= 6);

    // Identifies electricity as primary future contributor
    assert.equal(forecastRes.body.outlooks.topFutureContributor.category, 'electricity');
    assert.ok(forecastRes.body.explanation.aiNarrative);
  });

  await t.test('Step 7: Climate Action Engine identifies potential reductions in electricity', async () => {
    const planRes = await apiRequest('/coach/plans', {
      method: 'POST',
      token: userToken,
      body: { useGemini: false },
    });
    assert.equal(planRes.status, 201);
    assert.ok(Array.isArray(planRes.body.actions));
    assert.ok(planRes.body.actions.length > 0);

    // Highest impact categories prioritize electricity
    const highest = planRes.body.highestImpactCategories || [];
    assert.ok(highest.some((h) => h.category === 'electricity'));

    // Plan contains actionable electricity reductions
    const elecAction = planRes.body.actions.find((a) => a.category === 'electricity');
    assert.ok(elecAction);
    assert.ok(elecAction.estimatedPotentialSavingsKg > 0);
    assert.ok(elecAction.reason);
    assert.ok(elecAction.savingsCalculation);
    coachActionId = elecAction.id;
  });

  await t.test('Step 8: Reports module includes the new activity in analytics, CSV, and PDF', async () => {
    // Detailed analytics
    const reportRes = await apiRequest('/reports/analytics?filter=30d', { token: userToken });
    assert.equal(reportRes.status, 200);
    assert.ok(reportRes.body.totals.emissionsKg > 0);
    assert.ok(reportRes.body.sectorEmissions.electricity > 0);
    assert.ok(reportRes.body.allActivities.some((a) => a.id === electricityActivityId));

    // CSV Report
    const csvRes = await apiRequest('/reports/csv?filter=30d', { token: userToken });
    assert.equal(csvRes.status, 200);
    assert.ok(csvRes.headers.get('content-type').includes('csv') || typeof csvRes.body === 'string');
    assert.ok(typeof csvRes.body === 'string' && csvRes.body.includes('electricity'));

    // PDF Report
    const pdfRes = await apiRequest('/reports/pdf?filter=30d', { token: userToken });
    assert.equal(pdfRes.status, 200);
    assert.ok(pdfRes.headers.get('content-type').includes('pdf'));
  });

  await t.test('Step 9: User tracks and completes a selected climate action', async () => {
    // User moves action to 'in_progress'
    const inProgressRes = await apiRequest(`/coach/actions/${coachActionId}`, {
      method: 'PATCH',
      token: userToken,
      body: { status: 'in_progress' },
    });
    assert.equal(inProgressRes.status, 200);
    assert.equal(inProgressRes.body.status, 'in_progress');

    // User marks action 'completed'
    const completeRes = await apiRequest(`/coach/actions/${coachActionId}`, {
      method: 'PATCH',
      token: userToken,
      body: { status: 'completed' },
    });
    assert.equal(completeRes.status, 200);
    assert.equal(completeRes.body.status, 'completed');
    assert.ok(completeRes.body.completedAt);

    // Verify database record has completed status and timestamp
    const dbAction = await db.query('SELECT * FROM coach_actions WHERE id = $1', [coachActionId]);
    assert.equal(dbAction.rows[0].status, 'completed');
    assert.ok(dbAction.rows[0].completed_at);
  });

  await t.test('Step 10: Subsequent records assess actual emission changes vs baseline', async () => {
    // 1. Establish a baseline for the initial observation window
    const baseRes = await apiRequest('/impact/baselines', {
      method: 'POST',
      token: userToken,
      body: {
        name: 'Pre-Action Baseline (Early Nov)',
        startDate: '2026-11-01',
        endDate: '2026-11-06',
        periodDays: 6,
      },
    });
    assert.equal(baseRes.status, 201);
    assert.ok(baseRes.body.id);
    baselineId = baseRes.body.id;
    assert.ok(baseRes.body.totalEmissions > 0);

    // 2. User implements reduction action, logging significantly lower electricity
    await apiRequest('/activities', {
      method: 'POST',
      token: userToken,
      body: {
        activity_type: 'electricity',
        details: { kwh: 30, energySource: 'grid', notes: 'Post-efficiency optimization reading' },
        date: '2026-11-07',
      },
    });

    // 3. Generate Impact Report evaluating actual changes against baseline
    const impactRes = await apiRequest('/impact/reports', {
      method: 'POST',
      token: userToken,
      body: {
        periodDays: 7,
        baselineId,
        useGemini: false,
      },
    });
    assert.equal(impactRes.status, 201);
    assert.ok(impactRes.body.totals);
    assert.ok(impactRes.body.totals.current !== undefined);
    assert.ok(impactRes.body.totals.baseline !== undefined);
    assert.ok(impactRes.body.totals.status);
    assert.ok(Array.isArray(impactRes.body.categoryBreakdown));
  });
});
