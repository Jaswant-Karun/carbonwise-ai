const test = require('node:test');
const assert = require('node:assert/strict');
const {
  calculateEmissions,
  convertUnitQuantity,
  findFactor,
  SCIENTIFIC_EMISSION_FACTORS,
  CONVERSIONS,
  round,
} = require('../src/services/emissionEngineService');
const {
  addActivity,
  getActivity,
  deleteActivity,
} = require('../src/controllers/activityController');
const {
  getFactors,
  calculate,
  getSummary,
  getActivityEmission,
} = require('../src/controllers/emissionController');
const db = require('../src/config/db');

test('Carbon Emission Calculation Engine - Comprehensive Verification', async (t) => {
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
      send() {
        return this;
      },
    };
    return res;
  };

  let testUserId;
  let testActivityId;

  // Setup test user
  const userRes = await db.query(
    `INSERT INTO users (name, email, password) VALUES ('Engine Test User', $1, 'hashedpass') RETURNING id`,
    [`engine_test_${Date.now()}@example.com`]
  );
  testUserId = userRes.rows[0].id;

  await t.test('1. Centralized Factor Registry Integrity', () => {
    assert.ok(SCIENTIFIC_EMISSION_FACTORS.length >= 25);

    // Verify all factors have required scientific metadata
    for (const f of SCIENTIFIC_EMISSION_FACTORS) {
      assert.ok(f.category, 'Factor must have a category');
      assert.ok(f.activityKey, 'Factor must have an activityKey');
      assert.ok(f.name, 'Factor must have a human readable name');
      assert.ok(f.unit, 'Factor must have a unit');
      assert.ok(typeof f.factorKgCo2e === 'number' && f.factorKgCo2e >= 0, 'Factor must have non-negative kg CO2e rate');
      assert.ok(['Scope 1', 'Scope 2', 'Scope 3', 'Scope 1/2', 'Scope 1/3', 'Scope 2/3'].includes(f.scope), 'Factor must have a valid GHG Protocol scope');
      assert.ok(f.source, 'Factor must cite a documented scientific or government source');
      assert.ok(f.region, 'Factor must specify geographic applicability');
      assert.ok(f.version, 'Factor must have version tracking');
      assert.ok(f.methodology, 'Factor must describe calculation methodology');
    }

    // Verify key regional factors exist
    const usGrid = findFactor('electricity', 'grid_us', 'US');
    assert.ok(usGrid);
    assert.equal(usGrid.factorKgCo2e, 0.386);

    const inGrid = findFactor('electricity', 'grid_in', 'IN');
    assert.ok(inGrid);
    assert.equal(inGrid.factorKgCo2e, 0.716);

    const euGrid = findFactor('electricity', 'grid_eu', 'EU');
    assert.ok(euGrid);
    assert.equal(euGrid.factorKgCo2e, 0.255);
  });

  await t.test('2. Unit Conversion Handling', () => {
    // Miles to KM
    const km = convertUnitQuantity(100, 'miles', 'km');
    assert.equal(round(km, 2), 160.93);

    // Liters to m3
    const m3 = convertUnitQuantity(2500, 'liters', 'm3');
    assert.equal(m3, 2.5);

    // Gallons to Liters
    const litersFromGal = convertUnitQuantity(10, 'gallons', 'liters');
    assert.equal(round(litersFromGal, 2), 37.85);

    // Tonnes to KG
    const kg = convertUnitQuantity(3.5, 'tonnes', 'kg');
    assert.equal(kg, 3500);

    // MWh to kWh
    const kwh = convertUnitQuantity(2.5, 'mwh', 'kwh');
    assert.equal(kwh, 2500);
  });

  await t.test('3. Calculation Engine: Output in both kg CO2e and tonnes CO2e', () => {
    const res = calculateEmissions({
      category: 'transport',
      details: {
        transportMode: 'car_petrol',
        distanceKm: 1000,
        passengers: 1,
      },
    });

    // 1000 km * 0.192 = 192.0 kg CO2e
    assert.equal(res.emissionsKg, 192.0);
    // 192.0 / 1000 = 0.192 tonnes CO2e
    assert.equal(res.emissionsTonnes, 0.192);
    assert.equal(res.isEstimate, true);
    assert.ok(res.methodology.includes('tailpipe'));
    assert.ok(res.factorUsed.source.includes('DEFRA'));
  });

  await t.test('4. Avoid Double-Counting: Carpooling Passenger Allocation', () => {
    const solo = calculateEmissions({
      category: 'transport',
      details: { transportMode: 'car_petrol', distanceKm: 100, passengers: 1 },
    });
    const carpool4 = calculateEmissions({
      category: 'transport',
      details: { transportMode: 'car_petrol', distanceKm: 100, passengers: 4 },
    });

    // Solo = 19.2 kg, Carpool (4 pax) = 4.8 kg
    assert.equal(solo.emissionsKg, 19.2);
    assert.equal(carpool4.emissionsKg, 4.8);
    assert.equal(carpool4.emissionsTonnes, 0.0048);
    assert.ok(carpool4.assumptions.includes('divided across 4 passenger(s)'));
  });

  await t.test('5. Avoid Double-Counting: On-Site Solar Generation Net Deduction', () => {
    const gridOnly = calculateEmissions({
      category: 'electricity',
      details: { kwh: 500, energySource: 'grid', solarGenerationKwh: 0 },
    });
    const withSolar = calculateEmissions({
      category: 'electricity',
      details: { kwh: 500, energySource: 'grid', solarGenerationKwh: 200 },
    });

    // Grid only = 500 * 0.50 = 250 kg
    assert.equal(gridOnly.emissionsKg, 250.0);
    // With solar = (300 net * 0.50) + (200 solar * 0.02) = 150 + 4 = 154.0 kg
    assert.equal(withSolar.emissionsKg, 154.0);
    assert.ok(withSolar.assumptions.includes('solar self-consumption'));
  });

  await t.test('6. Connected Activity Log to Emission Record in PostgreSQL', async () => {
    const addReq = {
      user: { id: testUserId },
      body: {
        activity_type: 'transport',
        details: {
          transportMode: 'car_hybrid',
          distanceKm: 200,
          passengers: 2,
        },
        notes: 'Intercity hybrid car travel',
        date: '2026-11-10',
      },
    };
    const addRes = mockRes();
    await addActivity(addReq, addRes);

    assert.equal(addRes.statusCode, 201);
    testActivityId = addRes.body.id;
    // (200 * 0.109) / 2 = 10.9 kg
    assert.equal(Number(addRes.body.carbon_emissions), 10.9);
    assert.equal(Number(addRes.body.details.emissions_tonnes), 0.0109);
    assert.equal(addRes.body.details.is_estimate, true);

    // Verify linked record in activity_emissions table
    const emissionAuditReq = {
      user: { id: testUserId },
      params: { activityId: testActivityId },
    };
    const emissionAuditRes = mockRes();
    await getActivityEmission(emissionAuditReq, emissionAuditRes);

    assert.equal(emissionAuditRes.statusCode, 200);
    assert.equal(emissionAuditRes.body.activity_id, testActivityId);
    assert.equal(Number(emissionAuditRes.body.emissions_kg), 10.9);
    assert.equal(Number(emissionAuditRes.body.emissions_tonnes), 0.0109);
    assert.ok(emissionAuditRes.body.factor_source.includes('DEFRA'));
    assert.equal(emissionAuditRes.body.is_estimate, true);
  });

  await t.test('7. Summary Endpoint: Category-wise, Total, and Scope Breakdown', async () => {
    // Add an electricity activity for test user
    await addActivity(
      {
        user: { id: testUserId },
        body: {
          activity_type: 'electricity',
          details: { kwh: 100, energySource: 'grid' },
          date: '2026-11-11',
        },
      },
      mockRes()
    );

    const summaryReq = { user: { id: testUserId } };
    const summaryRes = mockRes();
    await getSummary(summaryReq, summaryRes);

    assert.equal(summaryRes.statusCode, 200);
    assert.ok(summaryRes.body.totals.emissionsKg > 0);
    assert.ok(summaryRes.body.totals.emissionsTonnes > 0);
    assert.equal(summaryRes.body.totals.activityCount, 2);

    assert.ok(Array.isArray(summaryRes.body.categoryBreakdown));
    assert.ok(summaryRes.body.categoryBreakdown.length >= 2);

    const transCat = summaryRes.body.categoryBreakdown.find((c) => c.category === 'transport');
    assert.ok(transCat);
    assert.equal(transCat.emissionsKg, 10.9);
    assert.equal(transCat.emissionsTonnes, 0.0109);

    assert.ok(Array.isArray(summaryRes.body.scopeBreakdown));
    assert.ok(summaryRes.body.standards.avoidedDoubleCountingPrinciples.length > 0);
  });

  await t.test('8. Standalone Calculate Endpoint', async () => {
    const calcReq = {
      body: {
        category: 'water',
        subType: 'tap_hot',
        quantity: 500,
        unit: 'liters',
      },
    };
    const calcRes = mockRes();
    await calculate(calcReq, calcRes);

    assert.equal(calcRes.statusCode, 200);
    // 0.5 m3 * 5.80 = 2.9 kg CO2e
    assert.equal(calcRes.body.emissionsKg, 2.9);
    assert.equal(calcRes.body.emissionsTonnes, 0.0029);
    assert.equal(calcRes.body.isEstimate, true);
  });

  await t.test('9. Centralized Factors Lookup Endpoint', async () => {
    const factorsReq = { query: { category: 'transport' } };
    const factorsRes = mockRes();
    await getFactors(factorsReq, factorsRes);

    assert.equal(factorsRes.statusCode, 200);
    assert.ok(Array.isArray(factorsRes.body));
    assert.ok(factorsRes.body.length > 0);
    assert.ok(factorsRes.body.every((f) => f.category === 'transport'));
  });

  // Cleanup
  t.after(async () => {
    if (testUserId) {
      await db.query('DELETE FROM users WHERE id = $1', [testUserId]);
    }
  });
});
