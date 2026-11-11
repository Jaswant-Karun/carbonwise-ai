const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateActivityEmissions, EMISSION_FACTORS } = require('../src/services/carbonIntelligenceService');

test('Activity Management - Emission Calculation Engine', async (t) => {
  await t.test('Category A: Food and Diet calculations', () => {
    // Vegan meals
    const vegan = calculateActivityEmissions('food', { mealType: 'vegan', quantity: 3 });
    assert.equal(vegan, 2.7); // 3 * 0.9

    // Vegetarian meals
    const veg = calculateActivityEmissions('food', { mealType: 'vegetarian', quantity: 2 });
    assert.equal(veg, 3.0); // 2 * 1.5

    // High meat (beef/lamb) + food waste
    const beefWithWaste = calculateActivityEmissions('food', {
      mealType: 'meat_high',
      quantity: 2,
      foodWasteKg: 1.0,
    });
    // (2 * 7.2) + (1.0 * 2.5) = 14.4 + 2.5 = 16.9
    assert.equal(beefWithWaste, 16.9);

    // Seafood and dairy
    const seafood = calculateActivityEmissions('food', { mealType: 'seafood', quantity: 1 });
    assert.equal(seafood, 2.8);

    const dairy = calculateActivityEmissions('food', { mealType: 'dairy', quantity: 2 });
    assert.equal(dairy, 3.8); // 2 * 1.9
  });

  await t.test('Category B: Electricity and Energy calculations', () => {
    // Grid electricity
    const grid = calculateActivityEmissions('electricity', { kwh: 100, energySource: 'grid' });
    assert.equal(grid, 50.0); // 100 * 0.50

    // Coal-heavy grid
    const coal = calculateActivityEmissions('electricity', { kwh: 100, energySource: 'coal' });
    assert.equal(coal, 90.0); // 100 * 0.90

    // Solar self-consumption offset
    const solarOffset = calculateActivityEmissions('electricity', {
      kwh: 150,
      energySource: 'grid',
      solarGenerationKwh: 50,
    });
    // (100 net * 0.50) + (50 solar * 0.02) = 50 + 1 = 51.0
    assert.equal(solarOffset, 51.0);

    // Diesel generator
    const generator = calculateActivityEmissions('electricity', {
      energySource: 'diesel_generator',
      generatorFuelLiters: 10,
    });
    // 10 liters * 2.68 = 26.8
    assert.equal(generator, 26.8);
  });

  await t.test('Category C: Transportation calculations', () => {
    // Petrol car with 1 passenger
    const soloPetrol = calculateActivityEmissions('transport', {
      transportMode: 'car_petrol',
      distanceKm: 50,
      passengers: 1,
    });
    assert.equal(soloPetrol, 9.6); // 50 * 0.192

    // Petrol car carpooled with 4 passengers
    const carpool = calculateActivityEmissions('transport', {
      transportMode: 'car_petrol',
      distanceKm: 50,
      passengers: 4,
    });
    assert.equal(carpool, 2.4); // (50 * 0.192) / 4

    // Electric vehicle
    const ev = calculateActivityEmissions('transport', {
      transportMode: 'car_ev',
      distanceKm: 100,
      passengers: 1,
    });
    assert.equal(ev, 5.3); // 100 * 0.053

    // Public transit: Train and Bus
    const train = calculateActivityEmissions('transport', {
      transportMode: 'train',
      distanceKm: 200,
    });
    assert.equal(train, 7.0); // 200 * 0.035

    const bus = calculateActivityEmissions('transport', {
      transportMode: 'bus',
      distanceKm: 25,
    });
    assert.equal(bus, 2.05); // 25 * 0.082

    // Flight economy vs business
    const flightEco = calculateActivityEmissions('transport', {
      transportMode: 'flight_economy',
      distanceKm: 1000,
    });
    assert.equal(flightEco, 255.0); // 1000 * 0.255

    // Walking / cycling
    const walk = calculateActivityEmissions('transport', {
      transportMode: 'walking_cycling',
      distanceKm: 15,
    });
    assert.equal(walk, 0.0);
  });

  await t.test('Category D: Water Usage calculations', () => {
    // Cold municipal water
    const coldTap = calculateActivityEmissions('water', {
      volumeLiters: 1000,
      waterSource: 'tap_cold',
    });
    assert.equal(coldTap, 0.35); // 1000 * 0.00035

    // Hot water with heating footprint
    const hotWater = calculateActivityEmissions('water', {
      volumeLiters: 500,
      isHotWater: true,
    });
    assert.equal(hotWater, 2.9); // 500 * 0.0058

    // Cubic meters conversion (1 m3 = 1000 L)
    const cubicMeters = calculateActivityEmissions('water', {
      unit: 'm3',
      cubicMeters: 2,
      waterSource: 'tap_cold',
    });
    assert.equal(cubicMeters, 0.7); // 2000 * 0.00035
  });

  await t.test('Category E: Waste Management calculations', () => {
    // Landfilled mixed waste
    const landfill = calculateActivityEmissions('waste', {
      wasteQuantityKg: 10,
      treatmentMethod: 'landfill',
      wasteType: 'mixed',
    });
    assert.equal(landfill, 5.8); // 10 * 0.58

    // Composted organic food waste
    const composted = calculateActivityEmissions('waste', {
      wasteQuantityKg: 20,
      treatmentMethod: 'composted',
      wasteType: 'organic',
    });
    assert.equal(composted, 2.0); // 20 * 0.10

    // Recycled materials
    const recycled = calculateActivityEmissions('waste', {
      wasteQuantityKg: 15,
      treatmentMethod: 'recycled',
      wasteType: 'plastic',
    });
    assert.equal(recycled, 0.75); // 15 * 0.05
  });

  await t.test('Category F: Facilities and Buildings calculations', () => {
    // Facility direct kWh
    const facKwh = calculateActivityEmissions('facilities', {
      kwh: 200,
    });
    assert.equal(facKwh, 100.0); // 200 * 0.50

    // HVAC operating hours + kw rating
    const hvac = calculateActivityEmissions('facilities', {
      hvacHours: 10,
      hvacKwRating: 4.0,
    });
    // 10 * 4.0 * 0.50 = 20.0
    assert.equal(hvac, 20.0);

    // Refrigerant leakage (e.g. 0.05 kg R-410A)
    const leak = calculateActivityEmissions('facilities', {
      refrigerantLeakageKg: 0.05,
    });
    // 0.05 * 1430 = 71.5
    assert.equal(leak, 71.5);
  });

  await t.test('Category G: Other Emission Sources calculations', () => {
    // Laptop procurement
    const laptop = calculateActivityEmissions('other', {
      sourceType: 'electronics_laptop',
      quantity: 2,
    });
    assert.equal(laptop, 420.0); // 2 * 210

    // Smartphone
    const phone = calculateActivityEmissions('other', {
      sourceType: 'electronics_phone',
      quantity: 1,
    });
    assert.equal(phone, 70.0);

    // Spend amount ($100 spend on goods)
    const spend = calculateActivityEmissions('other', {
      spendAmount: 100,
    });
    assert.equal(spend, 45.0); // 100 * 0.45
  });

  await t.test('Validation: Rejects negative values and non-existent categories', () => {
    assert.throws(() => {
      calculateActivityEmissions('transport', { value: -10 });
    }, /required|non-negative/i);

    assert.throws(() => {
      calculateActivityEmissions('unknown_space_mission', { value: 10 });
    }, /required/i);
  });

  await t.test('Backward Compatibility: Simple value payload continues to compute correctly', () => {
    assert.equal(calculateActivityEmissions('transport', { value: 100 }), 21.0);
    assert.equal(calculateActivityEmissions('electricity', { value: 50 }), 25.0);
    assert.equal(calculateActivityEmissions('food', { value: 4 }), 10.0);
    assert.equal(calculateActivityEmissions('flight', { value: 200 }), 51.0);
    assert.equal(calculateActivityEmissions('shopping', { value: 2 }), 10.0);
  });
});

test('Activity Management - Controller CRUD, Filtering, Search & Pagination', async (t) => {
  const {
    addActivity,
    getActivities,
    getActivity,
    updateActivity,
    deleteActivity,
  } = require('../src/controllers/activityController');
  const db = require('../src/config/db');

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
  let createdActivityId;

  // Setup test user
  const userRes = await db.query(
    `INSERT INTO users (name, email, password) VALUES ('Activity Test User', $1, 'hashedpass') RETURNING id`,
    [`activity_test_${Date.now()}@example.com`]
  );
  testUserId = userRes.rows[0].id;

  await t.test('1. Record rich activity with notes and dynamic category details', async () => {
    const req = {
      user: { id: testUserId },
      body: {
        activity_type: 'transport',
        details: {
          transportMode: 'car_petrol',
          distanceKm: 60,
          passengers: 2,
        },
        notes: 'Client site visit commute via outer ring road',
        date: '2026-11-10',
      },
    };
    const res = mockRes();
    await addActivity(req, res);

    assert.equal(res.statusCode, 201);
    assert.ok(res.body.id);
    createdActivityId = res.body.id;
    assert.equal(res.body.activity_type, 'transport');
    assert.equal(res.body.details.notes, 'Client site visit commute via outer ring road');
    // 60 km * (0.192 / 2) = 5.76 kg CO2e
    assert.equal(Number(res.body.carbon_emissions), 5.76);
  });

  await t.test('2. Retrieve activity by ID and verify ownership', async () => {
    const req = { user: { id: testUserId }, params: { id: createdActivityId } };
    const res = mockRes();
    await getActivity(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.id, createdActivityId);
    assert.equal(res.body.details.transportMode, 'car_petrol');
  });

  await t.test('3. Edit/update activity: Change vehicle to EV and update notes', async () => {
    const req = {
      user: { id: testUserId },
      params: { id: createdActivityId },
      body: {
        activity_type: 'transport',
        details: {
          transportMode: 'car_ev',
          distanceKm: 60,
          passengers: 2,
        },
        notes: 'Switched commute to shared electric vehicle',
      },
    };
    const res = mockRes();
    await updateActivity(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.id, createdActivityId);
    assert.equal(res.body.details.notes, 'Switched commute to shared electric vehicle');
    // 60 km * (0.053 / 2) = 1.59 kg CO2e
    assert.equal(Number(res.body.carbon_emissions), 1.59);
  });

  await t.test('4. Add multiple activities to test search, filter, and pagination', async () => {
    // Add electricity activity
    await addActivity(
      {
        user: { id: testUserId },
        body: {
          activity_type: 'electricity',
          details: { kwh: 120, energySource: 'solar_grid', solarGenerationKwh: 60 },
          notes: 'Rooftop solar monthly inverter sync',
          date: '2026-11-11',
        },
      },
      mockRes()
    );

    // Add water activity
    await addActivity(
      {
        user: { id: testUserId },
        body: {
          activity_type: 'water',
          details: { volumeLiters: 1500, waterSource: 'tap_hot' },
          notes: 'Facility boiler quarterly reading',
          date: '2026-11-09',
        },
      },
      mockRes()
    );

    // Filter by category: electricity
    const filterReq = {
      user: { id: testUserId },
      query: { category: 'electricity' },
    };
    const filterRes = mockRes();
    await getActivities(filterReq, filterRes);
    assert.ok(Array.isArray(filterRes.body));
    assert.equal(filterRes.body.length, 1);
    assert.equal(filterRes.body.every((a) => a.activity_type === 'electricity'), true);

    // Search by note content: 'solar'
    const searchReq = {
      user: { id: testUserId },
      query: { search: 'solar' },
    };
    const searchRes = mockRes();
    await getActivities(searchReq, searchRes);
    assert.equal(searchRes.body.length, 1);
    assert.equal(searchRes.body[0].activity_type, 'electricity');

    // Paginated query
    const pageReq = {
      user: { id: testUserId },
      query: { page: '1', limit: '2', paginated: 'true' },
    };
    const pageRes = mockRes();
    await getActivities(pageReq, pageRes);
    assert.equal(pageRes.body.page, 1);
    assert.equal(pageRes.body.limit, 2);
    assert.equal(pageRes.body.total, 3);
    assert.equal(pageRes.body.totalPages, 2);
    assert.equal(pageRes.body.activities.length, 2);
  });

  await t.test('5. Delete activity and verify removal', async () => {
    const req = { user: { id: testUserId }, params: { id: createdActivityId } };
    const res = mockRes();
    await deleteActivity(req, res);
    assert.equal(res.statusCode, 204);

    // Verify 404 on subsequent get
    const checkRes = mockRes();
    await getActivity(req, checkRes);
    assert.equal(checkRes.statusCode, 404);
  });

  t.after(async () => {
    if (testUserId) {
      await db.query('DELETE FROM users WHERE id = $1', [testUserId]);
    }
  });
});

