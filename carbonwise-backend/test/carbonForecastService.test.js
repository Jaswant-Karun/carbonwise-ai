const test = require('node:test');
const assert = require('node:assert/strict');
const { buildForecast, getForecastConfig } = require('../src/services/carbonForecastService');

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
    endDate: '2026-10-03',
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
});
