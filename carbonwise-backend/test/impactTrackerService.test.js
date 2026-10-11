const test = require('node:test');
const assert = require('node:assert/strict');
const { buildImpactReport, validateBaseline } = require('../src/services/impactTrackerService');

test('builds a deterministic report with baseline comparison and potential savings', () => {
  const report = buildImpactReport({
    activities: [
      { activity_type: 'transport', carbon_emissions: 10, date: '2026-10-10' },
      { activity_type: 'electricity', carbon_emissions: 20, date: '2026-10-09' },
    ],
    currentPeriod: 30,
    baseline: { startDate: '2026-10-01', endDate: '2026-10-05' },
  });
  assert.equal(report.totals.current, 30);
  assert.equal(report.totals.baseline, 0);
  assert.equal(report.totals.status, 'new');
  assert.equal(report.categoryBreakdown[0].potentialSavingsKg, 3);
  assert.equal(report.activityCount, 2);
});

test('handles zero baseline without claiming a percentage reduction', () => {
  const report = buildImpactReport({
    activities: [{ activity_type: 'food', carbon_emissions: 25, date: '2026-10-10' }],
    currentPeriod: 30,
    baseline: { startDate: '2026-09-01', endDate: '2026-09-30' },
  });
  assert.equal(report.totals.percentageChange, null);
  assert.match(report.limitations, /do not prove/);
});

test('validates baseline dates and preserves supported period values', () => {
  assert.deepEqual(validateBaseline({ periodDays: 90, startDate: '2026-01-01', endDate: '2026-03-31' }), {
    periodDays: 90,
    startDate: '2026-01-01',
    endDate: '2026-03-31',
  });
  assert.throws(() => validateBaseline({ periodDays: 30, startDate: '2026-04-01', endDate: '2026-03-01' }), /before endDate/);
});
