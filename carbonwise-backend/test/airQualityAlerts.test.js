const test = require('node:test');
const assert = require('node:assert/strict');
const {
  AIR_QUALITY_STANDARDS,
  convertGasPpmToUg,
  evaluateAirQualityThresholds,
  fetchOpenAqMeasurements,
} = require('../src/services/airQualityService');

test('standards: defines WHO and EPA thresholds for PM2.5, PM10, NO2, O3, SO2, CO', () => {
  assert.ok(AIR_QUALITY_STANDARDS.pm2_5);
  assert.equal(AIR_QUALITY_STANDARDS.pm2_5.guideline, 15.0); // WHO 24h
  assert.equal(AIR_QUALITY_STANDARDS.pm2_5.thresholds.good, 12.0); // EPA Good

  assert.ok(AIR_QUALITY_STANDARDS.pm10);
  assert.equal(AIR_QUALITY_STANDARDS.pm10.guideline, 45.0);

  assert.ok(AIR_QUALITY_STANDARDS.no2);
  assert.ok(AIR_QUALITY_STANDARDS.o3);
  assert.ok(AIR_QUALITY_STANDARDS.so2);
  assert.ok(AIR_QUALITY_STANDARDS.co);
});

test('threshold evaluation: classifies PM2.5 concentrations accurately into WHO/EPA categories', () => {
  // Good: 8 µg/m³
  const good = evaluateAirQualityThresholds('pm2_5', 8.0, 'µg/m³');
  assert.equal(good.isExceeded, false);
  assert.equal(good.severity, 'normal');
  assert.equal(good.categoryLabel, 'Good');
  assert.match(good.explanation, /within clean air guidelines/);

  // Moderate: 24 µg/m³ (exceeds WHO 15 µg/m³, within EPA moderate)
  const moderate = evaluateAirQualityThresholds('pm2_5', 24.0, 'µg/m³');
  assert.equal(moderate.isExceeded, true);
  assert.equal(moderate.severity, 'info');
  assert.equal(moderate.categoryLabel, 'Moderate');
  assert.match(moderate.explanation, /exceeds the WHO guideline reference threshold/);
  // Must NOT claim a civil state of emergency or climate change
  assert.doesNotMatch(moderate.explanation, /civil emergency|climate change/i);

  // Unhealthy for sensitive groups: 45 µg/m³
  const unhealthySensitive = evaluateAirQualityThresholds('pm2_5', 45.0, 'µg/m³');
  assert.equal(unhealthySensitive.isExceeded, true);
  assert.equal(unhealthySensitive.severity, 'warning');
  assert.equal(unhealthySensitive.categoryLabel, 'Unhealthy for Sensitive Groups');

  // Hazardous: 280 µg/m³
  const hazardous = evaluateAirQualityThresholds('pm2_5', 280.0, 'µg/m³');
  assert.equal(hazardous.isExceeded, true);
  assert.equal(hazardous.severity, 'critical');
  assert.equal(hazardous.categoryLabel, 'Hazardous');
});

test('threshold evaluation: classifies PM10 and gas pollutants without mixing into climate change', () => {
  const pm10Alert = evaluateAirQualityThresholds('pm10', 180.0, 'µg/m³');
  assert.equal(pm10Alert.isExceeded, true);
  assert.equal(pm10Alert.severity, 'critical');
  assert.doesNotMatch(pm10Alert.explanation, /climate change|global warming/i);

  const no2Alert = evaluateAirQualityThresholds('no2', 120.0, 'µg/m³');
  assert.equal(no2Alert.isExceeded, true);
  assert.equal(no2Alert.severity, 'info');
});

test('unit normalization: converts NO2 and CO from ppm to µg/m³ or mg/m³ under standard conditions', () => {
  // 0.05 ppm NO2 (MW = 46.01, Vm = 24.45) -> (0.05 * 46.01 / 24.45) * 1000 = ~94.09 µg/m³
  const no2Ug = convertGasPpmToUg('no2', 0.05);
  assert.equal(no2Ug, 94.09);

  // 10 ppm CO (MW = 28.01, Vm = 24.45) -> (10 * 28.01 / 24.45) = ~11.46 mg/m³
  const coMg = convertGasPpmToUg('co', 10.0);
  assert.equal(coMg, 11.46);

  // Invalid or null
  assert.equal(convertGasPpmToUg('no2', null), null);
  assert.equal(convertGasPpmToUg('no2', NaN), null);
});

test('provider availability: handles unauthenticated OpenAQ gracefully with source link and auth message', async () => {
  // Without OPENAQ_API_KEY set, OpenAQ v3 returns 401 or auth_required
  const result = await fetchOpenAqMeasurements(48.85, 2.35); // Paris coordinates
  assert.ok(result.provider === 'openaq');
  assert.ok(['auth_required', 'data_unavailable', 'provider_unavailable', 'available'].includes(result.status));
  assert.match(result.sourceUrl, /https:\/\/openaq\.org/);
  assert.match(result.attribution, /OpenAQ/);

  // Crucial Requirement 9: Missing data must NOT be treated as clean air
  if (result.status === 'data_unavailable' || result.status === 'auth_required') {
    assert.deepEqual(result.measurements, []);
  }
});
