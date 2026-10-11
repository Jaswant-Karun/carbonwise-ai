const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildIntelligence,
  comparePeriods,
  parseActivity,
} = require('../src/services/carbonIntelligenceService');

const bounds = {
  currentStart: '2026-10-01',
  currentEnd: '2026-10-07',
  previousStart: '2026-09-24',
  previousEnd: '2026-09-30',
  periodDays: 7,
};

test('returns zero-safe summaries for empty history', () => {
  const result = buildIntelligence({ activities: [], ...bounds });

  assert.equal(result.totals.currentPeriod, 0);
  assert.equal(result.totals.previousPeriod, 0);
  assert.equal(result.comparison.percentageChange, 0);
  assert.deepEqual(result.categoryBreakdown, []);
  assert.deepEqual(result.anomalies, []);
  assert.deepEqual(result.recommendations, []);
});

test('handles previous-period zero without Infinity or NaN', () => {
  const result = comparePeriods(12.5, 0);

  assert.equal(result.absoluteChange, 12.5);
  assert.equal(result.percentageChange, null);
  assert.equal(result.status, 'new');
});

test('ignores invalid activity data and counts it explicitly', () => {
  assert.equal(parseActivity({ date: '2026-10-01', activity_type: 'transport', carbon_emissions: '-2' }), null);
  assert.equal(parseActivity({ date: 'not-a-date', activity_type: 'food', carbon_emissions: 2 }), null);

  const result = buildIntelligence({
    activities: [
      { date: '2026-10-01', activity_type: 'transport', carbon_emissions: 4 },
      { date: '2026-10-02', activity_type: 'food', carbon_emissions: 'invalid' },
    ],
    ...bounds,
  });

  assert.equal(result.invalidActivityCount, 1);
  assert.equal(result.totals.currentPeriod, 4);
});

test('compares equivalent periods and ranks sources by savings', () => {
  const result = buildIntelligence({
    activities: [
      { date: '2026-09-25', activity_type: 'transport', carbon_emissions: 10 },
      { date: '2026-10-01', activity_type: 'transport', carbon_emissions: 10 },
      { date: '2026-10-02', activity_type: 'food', carbon_emissions: 12 },
    ],
    ...bounds,
  });

  assert.equal(result.comparison.current, 22);
  assert.equal(result.comparison.previous, 10);
  assert.equal(result.comparison.absoluteChange, 12);
  assert.equal(result.comparison.percentageChange, 120);
  assert.equal(result.recommendations[0].category, 'food');
  assert.equal(result.recommendations[0].potentialSavingsKg, 2);
});
