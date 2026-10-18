const test = require('node:test');
const assert = require('node:assert/strict');

const { buildIntelligence } = require('../src/services/carbonIntelligenceService');
const { calculateScenario } = require('../src/services/whatIfSimulatorService');
const { buildCoachPlan } = require('../src/services/ecoCoachService');
const { buildForecast } = require('../src/services/carbonForecastService');
const { buildImpactReport } = require('../src/services/impactTrackerService');

test('Module 1 - Smart Carbon Intelligence Engine: analyzes activities by category and explains trends', () => {
  const activities = [
    { date: '2026-10-01', activity_type: 'transport', details: { value: 100 }, carbon_emissions: 21.0 },
    { date: '2026-10-05', activity_type: 'electricity', details: { value: 50 }, carbon_emissions: 25.0 },
    { date: '2026-10-10', activity_type: 'food', details: { value: 4 }, carbon_emissions: 10.0 },
    { date: '2026-09-15', activity_type: 'transport', details: { value: 200 }, carbon_emissions: 42.0 },
  ];

  const intelligence = buildIntelligence({
    activities,
    periodDays: 30,
    currentStart: '2026-10-01',
    currentEnd: '2026-10-30',
    previousStart: '2026-09-01',
    previousEnd: '2026-09-30',
  });

  assert.equal(intelligence.activityCount, 3);
  assert.equal(intelligence.totals.current, 56.0);
  assert.equal(intelligence.totals.previous, 42.0);
  assert.equal(intelligence.comparison.status, 'increase');
  assert.equal(intelligence.categoryBreakdown.length, 3);
  assert.ok(intelligence.explanation.length > 0);
  assert.ok(Array.isArray(intelligence.anomalies));
});

test('Module 2 - What-If Carbon Simulator: models hypothetical savings while separating from observations', () => {
  const activities = [
    { activity_type: 'transport', details: { value: 100 }, carbon_emissions: 21.0, date: '2026-10-10' },
    { activity_type: 'electricity', details: { value: 100 }, carbon_emissions: 50.0, date: '2026-10-12' },
  ];

  const result = calculateScenario({
    activities,
    periodDays: 30,
    changes: [
      { action: 'reduce', category: 'electricity', percentage: 20 },
    ],
  });

  assert.equal(result.baselineEmissionsKg, 71.0);
  // Electricity reduced by 20% -> 50 - 10 = 40. Total = 21 + 40 = 61.
  assert.equal(result.scenarioEmissionsKg, 61.0);
  assert.equal(result.potentialSavingsKg, 10.0);
  assert.equal(result.potentialSavingsPercentage, 14.08);
  assert.ok(result.assumptions.length > 0);
  // Verify modeled scenario disclaimer is present
  assert.ok(result.assumptions[0].includes('Electricity consumption'));
});

test('Module 3 - Adaptive AI Eco-Coach: creates personalized plan adapted to user history', () => {
  const activities = [
    { activity_type: 'transport', details: { value: 150 }, carbon_emissions: 31.5, date: '2026-10-05' },
    { activity_type: 'transport', details: { value: 200 }, carbon_emissions: 42.0, date: '2026-10-12' },
  ];
  const completedHistory = [
    { category: 'transport', title: 'Plan transit trips', completed_at: '2026-10-01' },
  ];

  const plan = buildCoachPlan({ activities, completedHistory });
  assert.equal(plan.actions.length, 7);
  assert.ok(plan.categories.includes('transport'));
  // High-impact category transport is prioritized
  assert.equal(plan.actions[0].category, 'transport');
  assert.ok(plan.actions.every((a) => a.title && a.explanation && a.suggestedTarget));
});

test('Module 4 - Carbon Forecasting & Anomaly Detection: forecasts footprint and flags unusual spikes', () => {
  const activities = [
    { id: 1, activity_type: 'transport', details: { value: 10 }, carbon_emissions: 2.1, date: '2026-10-01' },
    { id: 2, activity_type: 'transport', details: { value: 10 }, carbon_emissions: 2.1, date: '2026-10-02' },
    { id: 3, activity_type: 'transport', details: { value: 10 }, carbon_emissions: 2.1, date: '2026-10-03' },
    { id: 4, activity_type: 'flight', details: { value: 1000 }, carbon_emissions: 255.0, date: '2026-10-04' },
    { id: 5, activity_type: 'transport', details: { value: 10 }, carbon_emissions: 2.1, date: '2026-10-05' },
  ];

  const forecast = buildForecast({
    activities,
    startDate: '2026-10-01',
    endDate: '2026-10-05',
    periodDays: 30,
    horizonDays: 7,
  });

  assert.ok(forecast.forecast);
  assert.ok(Array.isArray(forecast.forecast.actual));
  assert.ok(Array.isArray(forecast.forecast.projected));
  assert.ok(forecast.anomalies.length > 0);
  // Flight day flagged as carbon anomaly
  assert.equal(forecast.anomalies[0].date, '2026-10-04');
  assert.equal(forecast.anomalies[0].severity, 'high');
});

test('Module 5 - Sustainability Impact Tracker: tracks observed changes and modeled potential separately', () => {
  const activities = [
    { id: 1, activity_type: 'electricity', details: { value: 100 }, carbon_emissions: 50.0, date: '2026-10-05' },
    { id: 2, activity_type: 'electricity', details: { value: 200 }, carbon_emissions: 100.0, date: '2026-09-05' },
  ];

  const report = buildImpactReport({
    activities,
    currentPeriod: 30,
    baseline: { startDate: '2026-09-01', endDate: '2026-09-30' },
  });

  assert.equal(report.totals.current, 50.0);
  assert.equal(report.totals.baseline, 100.0);
  assert.equal(report.totals.absoluteChange, -50.0);
  assert.equal(report.totals.percentageChange, -50.0);
  assert.equal(report.totals.status, 'decrease');
  // Modeled opportunity is calculated separately from observed change
  assert.ok(Number(report.potentialSavingsKg) > 0);
  assert.ok(report.limitations.length > 0);
});
