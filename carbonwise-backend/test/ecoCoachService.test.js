const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildCoachPlan,
  validateActions,
  validateGoal,
  validateStatus,
} = require('../src/services/ecoCoachService');

test('builds seven deterministic actions from highest-impact history', () => {
  const plan = buildCoachPlan({
    activities: [
      { activity_type: 'electricity', carbon_emissions: 50, date: '2026-10-10' },
      { activity_type: 'transport', carbon_emissions: 21, date: '2026-10-09' },
    ],
    completedHistory: [{ category: 'electricity', title: 'Earlier action' }],
  });

  assert.equal(plan.actions.length, 7);
  assert.equal(plan.highestImpactCategories[0].category, 'electricity');
  assert.match(plan.actions[0].title, /again/);
  assert.equal(plan.actions[0].estimatedPotentialSavingsKg, 7.5);
});

test('uses deterministic fallback actions for empty activity history', () => {
  const plan = buildCoachPlan({ activities: [] });
  assert.equal(plan.actions.length, 7);
  assert.equal(plan.actions[0].estimatedPotentialSavingsKg, null);
  assert.equal(plan.activityCount, 0);
});

test('validates action output, statuses, and goals', () => {
  assert.throws(() => validateActions([{ title: 'Bad', category: 'unknown', explanation: 'x', suggestedTarget: 'x' }]), /unsupported category/);
  assert.equal(validateStatus('Completed'), 'completed');
  assert.deepEqual(validateGoal({ period: 'weekly', targetKg: 12, category: 'transport' }), {
    period: 'weekly',
    targetKg: 12,
    category: 'transport',
  });
  assert.throws(() => validateGoal({ period: 'yearly', targetKg: 12 }), /weekly or monthly/);
});
