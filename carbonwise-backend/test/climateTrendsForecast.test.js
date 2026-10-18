const test = require('node:test');
const assert = require('node:assert/strict');
const {
  calculateLinearTrend,
  detectDateGaps,
  aggregateObservations,
} = require('../src/services/climateTrendsService');
const {
  CMIP6_PROJECTIONS,
} = require('../src/services/climateForecastService');
const {
  calculateReferenceBaseline,
  parseYmdToIso,
  formatDateToYmd,
} = require('../src/services/nasaPowerService');

test('date formatting: formats YYYYMMDD and parses back to ISO YYYY-MM-DD correctly', () => {
  const d = new Date('2026-06-15T12:00:00Z');
  assert.equal(formatDateToYmd(d), '20260615');
  assert.equal(parseYmdToIso('20260615'), '2026-06-15');
});

test('linear trend: calculates positive warming slope, R², and rate per decade', () => {
  // Steady 0.2°C per day increase over 10 days
  const points = [
    { date: '2026-01-01', value: 20.0 },
    { date: '2026-01-02', value: 20.2 },
    { date: '2026-01-03', value: 20.4 },
    { date: '2026-01-04', value: 20.6 },
    { date: '2026-01-05', value: 20.8 },
    { date: '2026-01-06', value: 21.0 },
  ];

  const trend = calculateLinearTrend(points, { resolution: 'daily', metric: 'temperature' });
  assert.equal(trend.status, 'sufficient');
  assert.equal(trend.direction, 'warming');
  assert.equal(trend.slope, 0.2);
  assert.ok(trend.rSquared > 0.99);
  assert.ok(trend.ratePerDecade > 0);
  assert.match(trend.method, /Ordinary Least Squares/);
  assert.match(trend.limitations, /monotonic linear trend/);
});

test('linear trend: returns insufficient_history when sample size is below threshold (< 3)', () => {
  const points = [{ date: '2026-01-01', value: 22.0 }, { date: '2026-01-02', value: 22.5 }];
  const trend = calculateLinearTrend(points);
  assert.equal(trend.status, 'insufficient_history');
  assert.equal(trend.slope, null);
  assert.match(trend.limitations, /At least 3 valid observations/);
});

test('gap detection: identifies missing date intervals without creating artificial data', () => {
  const dates = ['2026-05-01', '2026-05-02', '2026-05-05', '2026-05-06'];
  const gaps = detectDateGaps(dates, 'daily');
  assert.deepEqual(gaps, ['2026-05-03', '2026-05-04']);
});

test('aggregation: aggregates hourly temperature to daily mean and precipitation to daily sum', () => {
  const hourlyRows = [
    { observed_at: '2026-04-10T08:00:00Z', value: 20.0, unit: '°C' },
    { observed_at: '2026-04-10T14:00:00Z', value: 26.0, unit: '°C' },
    { observed_at: '2026-04-11T08:00:00Z', value: 22.0, unit: '°C' },
    { observed_at: '2026-04-11T14:00:00Z', value: 28.0, unit: '°C' },
  ];

  const dailyTemp = aggregateObservations(hourlyRows, 'daily', 'temperature');
  assert.equal(dailyTemp.length, 2);
  assert.equal(dailyTemp[0].date, '2026-04-10');
  assert.equal(dailyTemp[0].value, 23.0); // (20 + 26) / 2
  assert.equal(dailyTemp[1].date, '2026-04-11');
  assert.equal(dailyTemp[1].value, 25.0); // (22 + 28) / 2

  const rainRows = [
    { observed_at: '2026-04-10T08:00:00Z', value: 5.5, unit: 'mm' },
    { observed_at: '2026-04-10T14:00:00Z', value: 12.0, unit: 'mm' },
  ];
  const dailyRain = aggregateObservations(rainRows, 'daily', 'precipitation');
  assert.equal(dailyRain.length, 1);
  assert.equal(dailyRain[0].value, 17.5); // 5.5 + 12.0 sum
});

test('aggregation: aggregates daily data into monthly and annual resolutions', () => {
  const dailyRows = [
    { date: '2025-01-10', value: 10.0 },
    { date: '2025-01-20', value: 20.0 },
    { date: '2025-02-10', value: 15.0 },
    { date: '2026-01-15', value: 30.0 },
  ];

  const monthly = aggregateObservations(dailyRows, 'monthly', 'temperature');
  assert.equal(monthly.length, 3);
  assert.equal(monthly[0].date, '2025-01');
  assert.equal(monthly[0].value, 15.0); // (10 + 20) / 2
  assert.equal(monthly[1].date, '2025-02');
  assert.equal(monthly[1].value, 15.0);
  assert.equal(monthly[2].date, '2026-01');
  assert.equal(monthly[2].value, 30.0);

  const annual = aggregateObservations(dailyRows, 'annual', 'temperature');
  assert.equal(annual.length, 2);
  assert.equal(annual[0].date, '2025');
  assert.equal(annual[0].value, 15.0); // (10 + 20 + 15) / 3 = 15.0
  assert.equal(annual[1].date, '2026');
  assert.equal(annual[1].value, 30.0);
});

test('reference baseline: handles empty observations safely without NaN or crash', () => {
  const baseline = calculateReferenceBaseline([]);
  assert.equal(baseline.status, 'insufficient_history');
  assert.equal(baseline.sampleDays, 0);
  assert.equal(baseline.temperatureMean, null);
  assert.equal(baseline.precipitationDailyMean, null);
});

test('climate projections: contains explicit CMIP6 model metadata, scenarios, assumptions, and disclaimers', () => {
  assert.match(CMIP6_PROJECTIONS.model, /CMIP6/);
  assert.match(CMIP6_PROJECTIONS.baselineReference, /1850–1900/);
  assert.match(CMIP6_PROJECTIONS.timeframe, /2025–2050/);
  assert.ok(CMIP6_PROJECTIONS.assumptions.length > 20);

  const scenarios = CMIP6_PROJECTIONS.scenarios;
  assert.ok(scenarios['SSP1-2.6']);
  assert.ok(scenarios['SSP2-4.5']);
  assert.ok(scenarios['SSP5-8.5']);

  // Check expected warming progression: SSP5-8.5 warming must be higher than SSP1-2.6
  assert.ok(scenarios['SSP5-8.5'].projectedWarming2050 > scenarios['SSP1-2.6'].projectedWarming2050);
  // Check uncertainty bounds: lower <= upper
  assert.ok(scenarios['SSP2-4.5'].uncertaintyRange2050[0] < scenarios['SSP2-4.5'].uncertaintyRange2050[1]);
});
