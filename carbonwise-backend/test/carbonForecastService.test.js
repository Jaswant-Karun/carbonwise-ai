const test = require('node:test');
const assert = require('node:assert/strict');
const { buildForecast, getForecastConfig, HORIZONS } = require('../src/services/carbonForecastService');

test('uses actual history and a trailing moving-average forecast', () => {
  const result = buildForecast({
    activities: [
      { id: 1, activity_type: 'transport', carbon_emissions: 10, date: '2026-10-01' },
      { id: 2, activity_type: 'electricity', carbon_emissions: 20, date: '2026-10-02' },
      { id: 3, activity_type: 'food', carbon_emissions: 30, date: '2026-10-03' },
    ],
    startDate: '2026-10-01',
    endDate: '2026-10-03',
    periodDays: 30,
    horizonDays: 7,
  });

  assert.equal(result.forecast.method, 'Trailing 7-day moving average');
  assert.equal(result.forecast.actual.length, 3);
  assert.equal(result.forecast.projected.length, 7);
  assert.equal(result.forecast.baselineDailyAverage, 20);
  assert.equal(result.forecast.projected[0].kind, 'forecast');
  assert.equal(result.forecast.actual[0].kind, 'actual');
});

test('reports insufficient data without fabricating projected values', () => {
  const result = buildForecast({
    activities: [{ id: 1, activity_type: 'food', carbon_emissions: 4, date: '2026-10-01' }],
    startDate: '2026-10-01',
    endDate: '2026-10-03',
    periodDays: 30,
    horizonDays: 30,
  });

  assert.equal(result.forecast.sufficientData, false);
  assert.deepEqual(result.forecast.projected, []);
  assert.match(result.forecast.limitation, /14 days/);
});

test('flags a high day and includes related records and category', () => {
  const activities = [
    { id: 1, activity_type: 'transport', carbon_emissions: 100, date: '2026-10-03' },
    { id: 2, activity_type: 'food', carbon_emissions: 2, date: '2026-10-01' },
    { id: 3, activity_type: 'food', carbon_emissions: 2, date: '2026-10-02' },
  ];
  const result = buildForecast({
    activities,
    startDate: '2026-10-01',
    endDate: '2026-10-20',
    periodDays: 30,
    horizonDays: 7,
  });

  assert.equal(result.anomalies.length, 1);
  assert.equal(result.anomalies[0].category, 'transport');
  assert.equal(result.anomalies[0].activityRecords[0].id, 1);
  assert.match(result.anomalies[0].explanation, /historical average/);
});

test('normalizes unsupported forecast configuration to safe defaults', () => {
  assert.deepEqual(getForecastConfig({ periodDays: 12, horizonDays: 99 }), {
    periodDays: 30,
    horizonDays: 7,
  });
  // Accepts 90 days horizon
  assert.equal(getForecastConfig({ periodDays: 90, horizonDays: 90 }).horizonDays, 90);
});

test('predicts future total emissions with dual reporting and 90-day multi-horizon', () => {
  // Create 15 days of activities (sufficient for 30d and 90d forecasts)
  const activities = [];
  for (let i = 1; i <= 15; i++) {
    const dayStr = i < 10 ? `0${i}` : `${i}`;
    activities.push({ id: i, activity_type: 'electricity', carbon_emissions: 20, date: `2026-10-${dayStr}` });
    activities.push({ id: 100 + i, activity_type: 'transport', carbon_emissions: 10, date: `2026-10-${dayStr}` });
  }

  const result = buildForecast({
    activities,
    startDate: '2026-10-01',
    endDate: '2026-10-15',
    periodDays: 30,
    horizonDays: 30,
  });

  assert.equal(result.forecast.sufficientData, true);
  // Daily total = 20 + 10 = 30 kg CO2e
  assert.equal(result.forecast.baselineDailyAverage, 30);
  assert.equal(result.forecast.totalProjectedKg, 900); // 30 * 30
  assert.equal(result.forecast.totalProjectedTonnes, 0.9);
  assert.equal(result.forecast.nextMonthKg, 900);
  assert.equal(result.forecast.nextMonthTonnes, 0.9);
  assert.equal(result.forecast.nextThreeMonthsKg, 2700); // 30 * 90
  assert.equal(result.forecast.nextThreeMonthsTonnes, 2.7);

  // Uncertainty ranges
  assert.ok(result.forecast.uncertainty);
  assert.equal(result.forecast.uncertainty.confidenceLevel, '95%');
  assert.ok(result.forecast.projected[0].lowerBound !== undefined);
  assert.ok(result.forecast.projected[0].upperBound !== undefined);
  assert.ok(result.forecast.projected[0].lowerBound <= result.forecast.projected[0].upperBound);
});

test('computes category-based future projections and trends', () => {
  const activities = [];
  for (let i = 1; i <= 15; i++) {
    const dayStr = i < 10 ? `0${i}` : `${i}`;
    // Increasing electricity: 10 + i * 2
    activities.push({ id: i, activity_type: 'electricity', carbon_emissions: 10 + i * 2, date: `2026-10-${dayStr}` });
    // Stable transport: 15
    activities.push({ id: 100 + i, activity_type: 'transport', carbon_emissions: 15, date: `2026-10-${dayStr}` });
  }

  const result = buildForecast({
    activities,
    startDate: '2026-10-01',
    endDate: '2026-10-15',
    periodDays: 30,
    horizonDays: 30,
  });

  assert.ok(Array.isArray(result.categoryPredictions));
  assert.equal(result.categoryPredictions.length, 7);

  const elecPred = result.categoryPredictions.find((c) => c.category === 'electricity');
  assert.ok(elecPred);
  assert.equal(elecPred.trendDirection, 'increasing');
  assert.ok(elecPred.projectedKg > 0);

  const transPred = result.categoryPredictions.find((c) => c.category === 'transport');
  assert.ok(transPred);
  assert.equal(transPred.trendDirection, 'stable');

  // Top future contributor identified
  assert.ok(result.outlooks.topFutureContributor);
  assert.equal(result.outlooks.topFutureContributor.category, 'electricity');
});

test('simulates what-if reduction scenarios with hypothetical label', () => {
  const activities = [];
  for (let i = 1; i <= 15; i++) {
    const dayStr = i < 10 ? `0${i}` : `${i}`;
    activities.push({ id: i, activity_type: 'electricity', carbon_emissions: 50, date: `2026-10-${dayStr}` });
    activities.push({ id: 100 + i, activity_type: 'transport', carbon_emissions: 50, date: `2026-10-${dayStr}` });
  }

  // Simulate 20% electricity reduction and 10% transport reduction
  const result = buildForecast({
    activities,
    startDate: '2026-10-01',
    endDate: '2026-10-15',
    periodDays: 30,
    horizonDays: 30,
    whatIfReductions: {
      electricityPct: 20,
      transportPct: 10,
    },
  });

  const sim = result.scenarioSimulation;
  assert.ok(sim);
  assert.equal(sim.isHypothetical, true);
  assert.equal(sim.baselineFutureKg, 3000); // 100 kg/day * 30 days
  // 50 * 0.8 = 40 (electricity), 50 * 0.9 = 45 (transport) -> 85 kg/day * 30 days = 2550 kg
  assert.equal(sim.simulatedFutureKg, 2550);
  assert.equal(sim.potentialSavingsKg, 450);
  assert.equal(sim.percentageReduction, 15.0);
  assert.match(sim.disclaimer, /Hypothetical simulation/);
});

test('provides structured prediction explanations without hallucinations', () => {
  const activities = [
    { id: 1, activity_type: 'food', carbon_emissions: 5, date: '2026-10-01' },
    { id: 2, activity_type: 'food', carbon_emissions: 5, date: '2026-10-02' },
    { id: 3, activity_type: 'food', carbon_emissions: 5, date: '2026-10-03' },
  ];

  const result = buildForecast({
    activities,
    startDate: '2026-10-01',
    endDate: '2026-10-03',
    periodDays: 30,
    horizonDays: 7,
  });

  assert.ok(result.explanation);
  assert.ok(result.explanation.predictedValue.includes('kg CO₂e'));
  assert.ok(result.explanation.historicalReference.includes('Trailing 7-day average'));
  assert.ok(result.explanation.forecastPeriod.includes('7 Days'));
  assert.ok(result.explanation.methodUsed);
  assert.ok(result.explanation.dataSufficiency.includes('Sufficient'));
  assert.ok(result.explanation.uncertaintyAndLimitations);
});
