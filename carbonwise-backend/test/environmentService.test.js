const test = require('node:test');
const assert = require('node:assert/strict');
const { buildObservations, validateRegion } = require('../src/services/environmentUtils');

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

test('prefers current provider values over forecast-hour values', () => {
  const observations = buildObservations(
    {
      current: { time: '2026-01-01T10:00', temperature_2m: 24 },
      hourly: { time: ['2026-01-01T23:00'], temperature_2m: [31] },
    },
    {
      current: { time: '2026-01-01T10:00', pm2_5: 8, us_aqi: 20 },
      hourly: { time: ['2026-01-01T23:00'], pm2_5: [55], us_aqi: [140] },
    },
    { weather: 1, airQuality: 2 },
    10,
  );
  assert.deepEqual(observations.map((item) => item.value), [24, 8, 20]);
});
