const test = require('node:test');
const assert = require('node:assert/strict');
const {
  calculateScenario,
  normalizeChanges,
} = require('../src/services/whatIfSimulatorService');

const activities = [
  { activity_type: 'transport', carbon_emissions: 21, date: '2026-10-10' },
  { activity_type: 'electricity', carbon_emissions: 50, date: '2026-10-09' },
  { activity_type: 'food', carbon_emissions: 25, date: '2026-10-08' },
];

test('calculates deterministic reduction savings without changing activities', () => {
  const result = calculateScenario({
    activities,
    periodDays: 30,
    changes: [
      { action: 'reduce', category: 'electricity', percentage: 20 },
      { action: 'reduce', category: 'food', percentage: 40 },
    ],
  });

  assert.equal(result.baselineEmissionsKg, 96);
  assert.equal(result.scenarioEmissionsKg, 76);
  assert.equal(result.potentialSavingsKg, 20);
  assert.equal(result.potentialSavingsPercentage, 20.83);
  assert.equal(activities[1].carbon_emissions, 50);
  assert.equal(result.isEstimate, true);
});

test('calculates transport mode switching using transparent factors', () => {
  const result = calculateScenario({
    activities,
    changes: [{ action: 'switch_transport', category: 'transport', targetMode: 'cycling', percentage: 50 }],
  });

  assert.equal(result.baselineEmissionsKg, 96);
  assert.equal(result.scenarioEmissionsKg, 85.5);
  assert.equal(result.potentialSavingsKg, 10.5);
  assert.match(result.assumptions[0], /cycling/);
});

test('returns zero-safe savings for empty history', () => {
  const result = calculateScenario({
    activities: [],
    changes: [{ action: 'reduce', category: 'transport', percentage: 30 }],
  });

  assert.equal(result.baselineEmissionsKg, 0);
  assert.equal(result.scenarioEmissionsKg, 0);
  assert.equal(result.potentialSavingsPercentage, 0);
});

test('rejects invalid ranges, unsupported factors, and duplicate categories', () => {
  assert.throws(
    () => normalizeChanges([{ action: 'reduce', category: 'electricity', percentage: 101 }]),
    /between 0 and 100/,
  );
  assert.throws(
    () => normalizeChanges([{ action: 'reduce', category: 'unknown', percentage: 10 }]),
    /unsupported category/,
  );
  assert.throws(
    () => normalizeChanges([
      { action: 'reduce', category: 'food', percentage: 10 },
      { action: 'reduce', category: 'food', percentage: 10 },
    ]),
    /one change per category/,
  );
});
