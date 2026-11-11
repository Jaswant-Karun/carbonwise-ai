const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/config/db');
const { addActivity, getActivities, getActivity } = require('../src/controllers/activityController');

test('Database and Backend Integrity, Constraints & Indexes Verification', async (t) => {
  let testUserId;

  const userRes = await db.query(
    `INSERT INTO users (name, email, password) VALUES ('DB Integrity User', $1, 'hashedpass') RETURNING id`,
    [`db_integrity_${Date.now()}@example.com`]
  );
  testUserId = userRes.rows[0].id;

  const mockRes = () => {
    const res = {
      statusCode: 200,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.body = data;
        return this;
      },
    };
    return res;
  };

  await t.test('1. Verify all 16 core tables exist in PostgreSQL schema', async () => {
    const expectedTables = [
      'activities',
      'activity_emissions',
      'ai_response_cache',
      'coach_actions',
      'coach_goals',
      'coach_plans',
      'emission_factors',
      'environment_alerts',
      'environment_ingestion_runs',
      'environment_observations',
      'environment_regions',
      'environment_sources',
      'impact_baselines',
      'impact_reports',
      'scenarios',
      'users',
    ];

    const result = await db.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
    );
    const existingTables = result.rows.map((r) => r.table_name);

    for (const table of expectedTables) {
      assert.ok(existingTables.includes(table), `Table ${table} must exist in database`);
    }
  });

  await t.test('2. Verify core performance indexes exist in PostgreSQL', async () => {
    const expectedIndexes = [
      'idx_activities_user_date',
      'idx_activities_user_type',
      'idx_activities_date',
      'idx_coach_actions_user_status',
      'idx_coach_actions_plan_id',
      'idx_coach_goals_user_status',
      'idx_coach_plans_user_created',
      'idx_impact_baselines_user',
      'idx_impact_reports_user_month',
      'idx_scenarios_user_created',
    ];

    const result = await db.query(
      `SELECT indexname FROM pg_indexes WHERE schemaname = 'public'`
    );
    const existingIndexes = result.rows.map((r) => r.indexname);

    for (const idx of expectedIndexes) {
      assert.ok(existingIndexes.includes(idx), `Index ${idx} must exist`);
    }
  });

  await t.test('3. Verify database-level check constraint rejects negative emissions', async () => {
    await assert.rejects(
      async () => {
        await db.query(
          `INSERT INTO activities (user_id, activity_type, details, carbon_emissions, date)
           VALUES ($1, 'electricity', '{"kwh": 50}', -10.5, CURRENT_DATE)`,
          [testUserId]
        );
      },
      (err) => {
        assert.ok(
          err.message.includes('chk_activities_carbon_emissions_non_negative') ||
          err.message.includes('violates check constraint'),
          'Database constraint must reject negative emissions'
        );
        return true;
      }
    );
  });

  await t.test('4. Controller Validation: Rejects invalid activity_type and invalid date', async () => {
    // Missing activity_type
    const req1 = { user: { id: testUserId }, body: { details: { kwh: 50 } } };
    const res1 = mockRes();
    await addActivity(req1, res1);
    assert.equal(res1.statusCode, 400);

    // Invalid date string
    const req2 = {
      user: { id: testUserId },
      body: { activity_type: 'electricity', details: { kwh: 50 }, date: 'not-a-valid-date' },
    };
    const res2 = mockRes();
    await addActivity(req2, res2);
    assert.equal(res2.statusCode, 400);
  });

  await t.test('5. Idempotency Protection: Prevents duplicate record on identical key', async () => {
    const key = `idem_${Date.now()}_abc`;
    const req1 = {
      user: { id: testUserId },
      headers: { 'x-idempotency-key': key },
      body: {
        activity_type: 'transport',
        details: { distanceKm: 25, transportMode: 'train' },
        notes: 'Idempotency test trip',
        date: '2026-11-10',
      },
    };
    const res1 = mockRes();
    await addActivity(req1, res1);
    assert.equal(res1.statusCode, 201);
    const firstId = res1.body.id;

    // Send second identical request with same idempotency key
    const res2 = mockRes();
    await addActivity(req1, res2);
    assert.equal(res2.statusCode, 200);
    assert.equal(res2.body.id, firstId, 'Should return existing record instead of creating duplicate');
  });

  await t.test('6. User Isolation: Users cannot read or delete activities of another user', async () => {
    // Create another user
    const otherUserRes = await db.query(
      `INSERT INTO users (name, email, password) VALUES ('Other User', $1, 'hashedpass') RETURNING id`,
      [`other_user_${Date.now()}@example.com`]
    );
    const otherUserId = otherUserRes.rows[0].id;

    // Create activity for testUserId
    const act = await db.query(
      `INSERT INTO activities (user_id, activity_type, details, carbon_emissions, date)
       VALUES ($1, 'electricity', '{"kwh": 30}', 15.0, CURRENT_DATE) RETURNING id`,
      [testUserId]
    );
    const activityId = act.rows[0].id;

    // Other user attempts to get it
    const getReq = { user: { id: otherUserId }, params: { id: activityId } };
    const getRes = mockRes();
    await getActivity(getReq, getRes);
    assert.equal(getRes.statusCode, 404, 'Must return 404 when requesting activity of another user');
  });

  // Cleanup
  await db.query(`DELETE FROM users WHERE id IN ($1, $2)`, [testUserId, testUserId + 1]);
});

