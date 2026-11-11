const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ACTION_CATALOG,
  ACTION_STATUSES,
  buildCoachPlan,
  evaluateGoalProgress,
  generateAllRecommendations,
  validateActions,
  validateGoal,
  validateStatus,
} = require('../src/services/ecoCoachService');

test('builds seven deterministic actions from highest-impact history', () => {
  const today = new Date().toISOString().slice(0, 10);
  const plan = buildCoachPlan({
    activities: [
      { activity_type: 'electricity', carbon_emissions: 50, date: today },
      { activity_type: 'transport', carbon_emissions: 21, date: today },
    ],
    completedHistory: [{ category: 'electricity', title: 'Earlier action' }],
  });

  assert.equal(plan.actions.length, 7);
  assert.equal(plan.highestImpactCategories[0].category, 'electricity');
  assert.match(plan.actions[0].title, /again/);
  assert.equal(plan.actions[0].estimatedPotentialSavingsKg, 7.5);
  assert.ok(plan.actions[0].reason);
  assert.ok(plan.actions[0].savingsCalculation);
});

test('uses deterministic fallback actions for empty activity history', () => {
  const plan = buildCoachPlan({ activities: [] });
  assert.equal(plan.actions.length, 7);
  assert.equal(plan.actions[0].estimatedPotentialSavingsKg, null);
  assert.equal(plan.activityCount, 0);
  assert.ok(Array.isArray(plan.recommendations));
  assert.ok(plan.recommendations.length > 0);
});

test('validates action output, statuses, and goals', () => {
  assert.throws(() => validateActions([{ title: 'Bad', category: 'unknown', explanation: 'x', suggestedTarget: 'x' }]), /unsupported category/);
  assert.equal(validateStatus('Completed'), 'completed');
  assert.equal(validateStatus('dismissed'), 'dismissed');
  assert.equal(validateStatus('planned'), 'planned');
  assert.equal(validateStatus('in_progress'), 'in_progress');
  assert.deepEqual(validateGoal({ period: 'weekly', targetKg: 12, category: 'transport' }), {
    period: 'weekly',
    targetKg: 12,
    category: 'transport',
  });
  assert.throws(() => validateGoal({ period: 'yearly', targetKg: 12 }), /weekly or monthly/);
});

test('generates comprehensive recommendations with documented calculations across all sectors', () => {
  const today = new Date().toISOString().slice(0, 10);
  const activities = [
    { activity_type: 'electricity', carbon_emissions: 120, date: today },
    { activity_type: 'transport', carbon_emissions: 80, date: today },
    { activity_type: 'food', carbon_emissions: 40, date: today },
    { activity_type: 'waste', carbon_emissions: 15, date: today },
    { activity_type: 'facilities', carbon_emissions: 25, date: today },
    { activity_type: 'water', carbon_emissions: 10, date: today },
  ];

  const plan = buildCoachPlan({ activities });

  // Recommendations array returned
  assert.ok(Array.isArray(plan.recommendations));
  assert.ok(plan.recommendations.length >= 15);

  // High-impact categories prioritized
  const topRec = plan.recommendations[0];
  assert.equal(topRec.impactLevel, 'high');
  assert.ok(topRec.reason.includes('Electricity'));
  assert.ok(topRec.savingsCalculation.includes('reduction'));

  // Covers all key sectors
  const categoriesPresent = new Set(plan.recommendations.map((r) => r.category));
  assert.ok(categoriesPresent.has('electricity'));
  assert.ok(categoriesPresent.has('transport'));
  assert.ok(categoriesPresent.has('food'));
  assert.ok(categoriesPresent.has('water'));
  assert.ok(categoriesPresent.has('waste'));
  assert.ok(categoriesPresent.has('facilities'));
});

test('evaluates goal progress distinguishing actual recorded reductions from hypothetical savings', () => {
  const goal = {
    id: 1,
    period: 'weekly',
    category: 'electricity',
    target_kg: 35.0,
    baseline_kg: 50.0,
    started_at: '2026-11-01T00:00:00Z',
  };

  // Scenario 1: Actual recorded emissions dropped to 30 kg (below baseline 50 kg)
  const subsequentActivities = [
    { activity_type: 'electricity', carbon_emissions: 30.0, date: '2026-11-03' },
  ];
  const completedActions = [
    { estimated_potential_savings_kg: 10.0, completed_at: '2026-11-02' },
  ];

  const eval1 = evaluateGoalProgress({
    goal,
    activities: subsequentActivities,
    completedActions,
  });

  assert.equal(eval1.actualRecordedKg, 30.0);
  assert.equal(eval1.actualChangeKg, 20.0); // 50 - 30 = 20 kg reduction
  assert.equal(eval1.actualReductionPct, 40.0); // 40% reduction
  assert.equal(eval1.isTargetAchieved, true);
  assert.equal(eval1.hypotheticalSavingsKg, 10.0);
  assert.equal(eval1.verificationStatus, 'verified_reduction');

  // Scenario 2: Action marked complete, but NO subsequent records logged yet
  const eval2 = evaluateGoalProgress({
    goal,
    activities: [], // No activities yet
    completedActions: [{ estimated_potential_savings_kg: 7.5, completed_at: '2026-11-02' }],
  });

  assert.equal(eval2.actualRecordedKg, 0);
  assert.equal(eval2.hypotheticalSavingsKg, 7.5);
  // Must NOT claim verified reduction without records
  assert.equal(eval2.verificationStatus, 'participation_only');
  assert.match(eval2.verificationMessage, /subsequent activity records have not yet confirmed/i);
});
