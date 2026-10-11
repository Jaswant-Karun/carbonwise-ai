const test = require('node:test');
const assert = require('node:assert/strict');
const { buildObservations, validateRegion } = require('../src/services/environmentService');

test('validates environmental regions without accepting invalid coordinates', () => {
  assert.deepEqual(validateRegion({ name: 'Campus', latitude: '12.34', longitude: '56.78' }), {
    name: 'Campus',
    latitude: 12.34,
    longitude: 56.78,
  });
  assert.throws(() => validateRegion({ name: 'Campus', latitude: 91, longitude: 0 }), /Latitude/);
});

test('normalizes provider observations and omits missing values', () => {
  const observations = buildObservations(
    { hourly: { time: ['2026-01-01T00:00'], temperature_2m: [25] } },
    { hourly: { time: ['2026-01-01T00:00'], pm2_5: [12.5], us_aqi: [42] } },
    { weather: 1, airQuality: 2 },
    10,
  );
  assert.equal(observations.length, 3);
  assert.deepEqual(observations.map((item) => item.metric), ['temperature', 'pm2_5', 'us_aqi']);
  assert.equal(observations[1].value, 12.5);
});
