const test = require('node:test');
const assert = require('node:assert/strict');
const { buildObservations, validateRegion, METRICS } = require('../src/services/environmentUtils');
const { searchLocations, _cache } = require('../src/services/environmentService');

test('validates environmental regions without accepting invalid coordinates', () => {
  assert.deepEqual(validateRegion({ name: 'Campus', latitude: '12.34', longitude: '56.78' }), {
    name: 'Campus',
    latitude: 12.34,
    longitude: 56.78,
    country: null,
    admin1: null,
    timezone: 'UTC',
  });
  assert.throws(() => validateRegion({ name: 'Campus', latitude: 91, longitude: 0 }), /Latitude/);
  assert.throws(() => validateRegion({ name: 'Campus', latitude: 0, longitude: 185 }), /Longitude/);
  assert.throws(() => validateRegion({ name: '', latitude: 10, longitude: 10 }), /Region name/);
});

test('validates regional metadata enrichment (country, admin1, timezone)', () => {
  const result = validateRegion({
    name: 'Berlin Hub',
    latitude: 52.52,
    longitude: 13.41,
    country: 'Germany',
    admin1: 'Land Berlin',
    timezone: 'Europe/Berlin',
  });
  assert.equal(result.name, 'Berlin Hub');
  assert.equal(result.country, 'Germany');
  assert.equal(result.admin1, 'Land Berlin');
  assert.equal(result.timezone, 'Europe/Berlin');
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

test('normalizes multi-metric variables: humidity, rain, wind, pressure, pm10', () => {
  const observations = buildObservations(
    {
      current: {
        time: '2026-05-12T12:00',
        temperature_2m: 22.5,
        relative_humidity_2m: 65,
        precipitation: 4.2,
        wind_speed_10m: 18.5,
        surface_pressure: 1013.2,
      },
    },
    {
      current: {
        time: '2026-05-12T12:00',
        pm2_5: 14.2,
        pm10: 28.6,
        us_aqi: 55,
      },
    },
    { weather: 1, airQuality: 2 },
    99,
  );

  const metricsFound = observations.map((o) => o.metric);
  assert.ok(metricsFound.includes('temperature'));
  assert.ok(metricsFound.includes('relative_humidity'));
  assert.ok(metricsFound.includes('precipitation'));
  assert.ok(metricsFound.includes('wind_speed'));
  assert.ok(metricsFound.includes('surface_pressure'));
  assert.ok(metricsFound.includes('pm2_5'));
  assert.ok(metricsFound.includes('pm10'));
  assert.ok(metricsFound.includes('us_aqi'));

  const humidity = observations.find((o) => o.metric === 'relative_humidity');
  assert.equal(humidity.value, 65);
  assert.equal(humidity.unit, '%');

  const rain = observations.find((o) => o.metric === 'precipitation');
  assert.equal(rain.value, 4.2);
  assert.equal(rain.unit, 'mm');

  const wind = observations.find((o) => o.metric === 'wind_speed');
  assert.equal(wind.value, 18.5);
  assert.equal(wind.unit, 'km/h');
});

test('handles provider empty or corrupt response gracefully without throwing', () => {
  const observations = buildObservations(null, undefined, { weather: 1, airQuality: 2 }, 12);
  assert.deepEqual(observations, []);

  const corrupt = buildObservations(
    { current: { temperature_2m: 'invalid-string' } },
    { current: { pm2_5: NaN } },
    { weather: 1, airQuality: 2 },
    12,
  );
  assert.deepEqual(corrupt, []);
});

test('searchLocations caches results and handles empty or short queries safely', async () => {
  const shortResult = await searchLocations('a');
  assert.deepEqual(shortResult, []);

  const emptyResult = await searchLocations('');
  assert.deepEqual(emptyResult, []);

  // Pre-seed cache entry
  _cache.set('geo:tokyo', {
    timestamp: Date.now(),
    data: [{ id: 1850147, name: 'Tokyo', country: 'Japan', latitude: 35.69, longitude: 139.69 }],
  });

  const cachedResult = await searchLocations('Tokyo');
  assert.equal(cachedResult.length, 1);
  assert.equal(cachedResult[0].name, 'Tokyo');
});
