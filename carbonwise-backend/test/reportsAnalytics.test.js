const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/config/db');
const { initDb } = require('../src/models/schema');
const {
  resolveDateRange,
  formatActivityDetails,
  getDetailedReport,
  generateCSV,
  generatePDF,
  getMonthlySustainabilityReport,
} = require('../src/services/reportAnalyticsService');
const {
  getDetailedReport: getDetailedReportController,
  downloadCSV: downloadCSVController,
  generatePDFReport,
  getMonthlySustainability: getMonthlySustainabilityController,
} = require('../src/controllers/reportController');

test('Detailed Carbon Emission Reports & Analytics - Comprehensive Verification', async (t) => {
  await initDb();

  const mockRes = () => {
    const res = {
      statusCode: 200,
      headers: {},
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      setHeader(name, val) {
        this.headers[name] = val;
        return this;
      },
      json(data) {
        this.body = data;
        return this;
      },
      send(data) {
        this.body = data;
        return this;
      },
      write(chunk) {
        if (!this.chunks) this.chunks = [];
        this.chunks.push(chunk);
      },
      end() {
        this.ended = true;
      },
    };
    return res;
  };

  let testUserId;

  // Setup test user
  const userRes = await db.query(
    `INSERT INTO users (name, email, password) VALUES ('Reports Test User', $1, 'hashedpass') RETURNING id`,
    [`reports_test_${Date.now()}@example.com`]
  );
  testUserId = userRes.rows[0].id;

  await t.test('1. Date Range Resolution Across All 9 Supported Filters', () => {
    const refDate = new Date('2026-11-15T12:00:00Z');

    // 1. Today
    const rToday = resolveDateRange('today', null, null, refDate);
    assert.equal(rToday.startDate, '2026-11-15');
    assert.equal(rToday.endDate, '2026-11-15');
    assert.equal(rToday.prevStartDate, '2026-11-14');

    // 2. Last 7 Days
    const r7d = resolveDateRange('7d', null, null, refDate);
    assert.equal(r7d.endDate, '2026-11-15');
    assert.equal(r7d.startDate, '2026-11-09');

    // 3. Last 30 Days
    const r30d = resolveDateRange('30d', null, null, refDate);
    assert.equal(r30d.endDate, '2026-11-15');
    assert.equal(r30d.startDate, '2026-10-17');

    // 4. Current Month
    const rCurMonth = resolveDateRange('current_month', null, null, refDate);
    assert.equal(rCurMonth.startDate, '2026-11-01');
    assert.equal(rCurMonth.endDate, '2026-11-30');
    assert.equal(rCurMonth.prevStartDate, '2026-10-01');

    // 5. Previous Month
    const rPrevMonth = resolveDateRange('previous_month', null, null, refDate);
    assert.equal(rPrevMonth.startDate, '2026-10-01');
    assert.equal(rPrevMonth.endDate, '2026-10-31');

    // 6. Last 3 Months
    const r3m = resolveDateRange('3m', null, null, refDate);
    assert.equal(r3m.endDate, '2026-11-15');
    assert.ok(r3m.startDate < '2026-09-01');

    // 7. Last 6 Months
    const r6m = resolveDateRange('6m', null, null, refDate);
    assert.equal(r6m.endDate, '2026-11-15');
    assert.ok(r6m.startDate < '2026-06-01');

    // 8. Current Year
    const rYear = resolveDateRange('current_year', null, null, refDate);
    assert.equal(rYear.startDate, '2026-01-01');
    assert.equal(rYear.endDate, '2026-12-31');

    // 9. Custom Range
    const rCustom = resolveDateRange('custom', '2026-05-01', '2026-05-15', refDate);
    assert.equal(rCustom.startDate, '2026-05-01');
    assert.equal(rCustom.endDate, '2026-05-15');
    assert.ok(rCustom.prevStartDate < rCustom.startDate);
  });

  await t.test('2. Empty State Handling (No Fabricated Data)', async () => {
    const report = await getDetailedReport(testUserId, { filter: '30d' });
    assert.equal(report.meta.hasData, false);
    assert.equal(report.totals.emissionsKg, 0);
    assert.equal(report.totals.emissionsTonnes, 0);
    assert.equal(report.totals.activityCount, 0);
    assert.equal(report.highestActivities.length, 0);
    assert.equal(report.categoryBreakdown.length, 7);
    report.categoryBreakdown.forEach((cat) => {
      assert.equal(cat.emissionsKg, 0);
      assert.equal(cat.percentage, 0);
    });
  });

  await t.test('3. Database Seed & Sector-Wise Emissions Breakdown', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
    const tenDaysAgo = new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10);

    // Insert activities across multiple sectors
    const activitiesToSeed = [
      { type: 'food', emissions: 7.0, date: today, details: { mealType: 'meat_high', quantity: 1 } },
      { type: 'electricity', emissions: 50.0, date: today, details: { kwh: 100, energySource: 'grid' } },
      { type: 'transport', emissions: 19.2, date: threeDaysAgo, details: { transportMode: 'car_petrol', distanceKm: 100, passengers: 1 } },
      { type: 'water', emissions: 2.9, date: threeDaysAgo, details: { volume: 500, unit: 'liters', waterSource: 'tap_hot' } },
      { type: 'waste', emissions: 5.8, date: tenDaysAgo, details: { wasteType: 'mixed', wasteQuantityKg: 10, treatmentMethod: 'landfill' } },
      { type: 'facilities', emissions: 40.0, date: tenDaysAgo, details: { facilityType: 'office', facilityKwh: 80 } },
      { type: 'other', emissions: 15.0, date: tenDaysAgo, details: { sourceType: 'electronics_phone', quantity: 1 } },
    ];

    for (const a of activitiesToSeed) {
      await db.query(
        `INSERT INTO activities (user_id, activity_type, carbon_emissions, date, details)
         VALUES ($1, $2, $3, $4::date, $5::jsonb)`,
        [testUserId, a.type, a.emissions, a.date, JSON.stringify(a.details)]
      );
    }

    const report = await getDetailedReport(testUserId, { filter: '30d' });
    assert.equal(report.meta.hasData, true);
    // Total: 7.0 + 50.0 + 19.2 + 2.9 + 5.8 + 40.0 + 15.0 = 139.9 kg
    assert.equal(report.totals.emissionsKg, 139.9);
    assert.equal(report.totals.emissionsTonnes, 0.1399);
    assert.equal(report.totals.activityCount, 7);

    // Verify all 7 individual sector emissions are present and match
    assert.equal(report.sectorEmissions.food, 7.0);
    assert.equal(report.sectorEmissions.electricity, 50.0);
    assert.equal(report.sectorEmissions.transport, 19.2);
    assert.equal(report.sectorEmissions.water, 2.9);
    assert.equal(report.sectorEmissions.waste, 5.8);
    assert.equal(report.sectorEmissions.facilities, 40.0);
    assert.equal(report.sectorEmissions.other, 15.0);

    // Verify percentages sum to ~100%
    const totalShare = report.categoryBreakdown.reduce((sum, c) => sum + c.percentage, 0);
    assert.ok(Math.abs(totalShare - 100) < 1.0);
  });

  await t.test('4. Periodic Rollups: Daily, Weekly, Monthly, and Annual', async () => {
    const report = await getDetailedReport(testUserId, { filter: '30d' });

    // Daily rollups (should contain 30 calendar days)
    assert.ok(Array.isArray(report.dailyRollup));
    assert.equal(report.dailyRollup.length, 30);
    const activeDays = report.dailyRollup.filter((d) => d.emissionsKg > 0);
    assert.ok(activeDays.length >= 3);

    // Weekly rollups
    assert.ok(Array.isArray(report.weeklyRollup));
    assert.ok(report.weeklyRollup.length >= 1);

    // Monthly rollups
    assert.ok(Array.isArray(report.monthlyRollup));
    assert.ok(report.monthlyRollup.length >= 1);

    // Annual rollups
    assert.ok(Array.isArray(report.annualRollup));
    assert.ok(report.annualRollup.length >= 1);
  });

  await t.test('5. Highest-Emission Activities Ranking', async () => {
    const report = await getDetailedReport(testUserId, { filter: '30d' });
    assert.ok(Array.isArray(report.highestActivities));
    assert.equal(report.highestActivities.length, 7);

    // Highest must be electricity (50.0 kg), second facilities (40.0 kg)
    assert.equal(report.highestActivities[0].category, 'electricity');
    assert.equal(report.highestActivities[0].emissionsKg, 50.0);
    assert.equal(report.highestActivities[1].category, 'facilities');
    assert.equal(report.highestActivities[1].emissionsKg, 40.0);
  });

  await t.test('6. CSV Export Generation', async () => {
    const csv = await generateCSV(testUserId, { filter: '30d' });
    assert.ok(csv.startsWith('Activity ID,Date,Category,Activity Details'));
    assert.ok(csv.includes('electricity'));
    assert.ok(csv.includes('50'));
    assert.ok(csv.includes('transport'));
    assert.ok(csv.includes('# SUMMARY AUDIT TOTALS'));
    assert.ok(csv.includes('139.9'));
  });

  await t.test('7. PDF Generation Buffer Verification', async () => {
    const { Writable } = require('node:stream');
    const chunks = [];
    const mockResObj = new Writable({
      write(chunk, encoding, callback) {
        chunks.push(chunk);
        callback();
      },
    });
    mockResObj.setHeader = () => {};

    await generatePDF(testUserId, { filter: '30d' }, mockResObj);

    await new Promise((resolve) => {
      mockResObj.on('finish', resolve);
      // Fallback timeout in case already finished
      setTimeout(resolve, 300);
    });

    const fullBuffer = Buffer.concat(chunks);
    assert.ok(fullBuffer.length > 500);
    // Valid PDF starts with %PDF-
    assert.equal(fullBuffer.subarray(0, 5).toString('ascii'), '%PDF-');
  });

  await t.test('8. Monthly Sustainability Report Generator', async () => {
    const monthlyReport = await getMonthlySustainabilityReport(testUserId);
    assert.ok(monthlyReport.monthKey);
    assert.ok(monthlyReport.monthName);
    assert.ok(monthlyReport.report);
    assert.ok(Array.isArray(monthlyReport.recommendations));
    assert.ok(monthlyReport.recommendations.length >= 2);
  });

  await t.test('9. Controller Endpoints HTTP Integration', async () => {
    // 1. Detailed Analytics endpoint
    const req1 = { user: { id: testUserId }, query: { filter: '30d' } };
    const res1 = mockRes();
    await getDetailedReportController(req1, res1);
    assert.equal(res1.statusCode, 200);
    assert.equal(res1.body.totals.emissionsKg, 139.9);

    // 2. CSV endpoint
    const req2 = { user: { id: testUserId }, query: { filter: '7d' } };
    const res2 = mockRes();
    await downloadCSVController(req2, res2);
    assert.equal(res2.statusCode, 200);
    assert.equal(res2.headers['Content-Type'], 'text/csv');
    assert.ok(res2.body.includes('Activity ID'));

    // 3. Monthly Sustainability endpoint
    const req3 = { user: { id: testUserId }, query: {} };
    const res3 = mockRes();
    await getMonthlySustainabilityController(req3, res3);
    assert.equal(res3.statusCode, 200);
    assert.ok(res3.body.monthName);
  });
});
