const test = require('node:test');
const assert = require('node:assert/strict');
const {
  median,
  medianAbsoluteDeviation,
  percentile,
  getSeason,
  calculateBaseline,
  evaluateDataQuality,
  detectAtmosphericAnomaly,
  analyzeRegionAnomalies,
  MIN_BASELINE_SAMPLES,
  PHYSICAL_BOUNDS,
} = require('../src/services/climateAnomalyService');

test('statistical utilities: median, MAD, and percentiles compute accurately', () => {
  // Odd length array
  assert.equal(median([1, 2, 10, 12, 100]), 10);
  // Even length array
  assert.equal(median([10, 20, 30, 40]), 25);
  // Empty or invalid
  assert.equal(median([]), null);
  assert.equal(median(null), null);

  // MAD of [2, 4, 4, 4, 5, 5, 7, 9] (median = 4.5, deviations = [2.5, 0.5, 0.5, 0.5, 0.5, 0.5, 2.5, 4.5], sorted = [0.5, 0.5, 0.5, 0.5, 0.5, 2.5, 2.5, 4.5] -> median = 0.5)
  const madVal = medianAbsoluteDeviation([2, 4, 4, 4, 5, 5, 7, 9]);
  assert.equal(madVal, 0.5);

  // Percentiles
  const series = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  assert.equal(percentile(series, 0), 10);
  assert.equal(percentile(series, 50), 55);
  assert.equal(percentile(series, 100), 100);
});

test('seasonal grouping: maps calendar dates to correct meteorological seasons', () => {
  assert.equal(getSeason('2026-01-15T12:00:00Z'), 'winter');
  assert.equal(getSeason('2026-02-28T12:00:00Z'), 'winter');
  assert.equal(getSeason('2026-04-10T12:00:00Z'), 'spring');
  assert.equal(getSeason('2026-07-20T12:00:00Z'), 'summer');
  assert.equal(getSeason('2026-10-18T12:00:00Z'), 'autumn');
  assert.equal(getSeason('2026-12-05T12:00:00Z'), 'winter');
});

test('insufficient history: explicitly reports Insufficient baseline data without fabricating numbers', () => {
  const shortHistory = [
    { value: 22.4, observed_at: '2026-07-01T10:00:00Z' },
    { value: 23.1, observed_at: '2026-07-02T10:00:00Z' },
    { value: 21.9, observed_at: '2026-07-03T10:00:00Z' },
  ]; // Only 3 samples, minimum is 7

  const baseline = calculateBaseline(shortHistory, '2026-07-04T10:00:00Z');
  assert.equal(baseline.status, 'insufficient_history');
  assert.equal(baseline.sampleCount, 3);
  assert.equal(baseline.baseline, null);
  assert.equal(baseline.mad, null);
  assert.equal(baseline.confidenceScore, 0.0);
  assert.equal(baseline.explanation, 'Insufficient baseline data');

  // Atmospheric anomaly evaluation with insufficient baseline must not hallucinate
  const anomaly = detectAtmosphericAnomaly({
    metric: 'temperature',
    observedValue: 34.5,
    unit: '°C',
    baselineInfo: baseline,
  });

  assert.equal(anomaly.isAnomaly, false);
  assert.equal(anomaly.status, 'insufficient_history');
  assert.equal(anomaly.baselineValue, null);
  assert.equal(anomaly.deviation, null);
  assert.match(anomaly.explanation, /Insufficient baseline data/);
});

test('normal conditions: values within historical baseline produce no anomaly', () => {
  // 14 days of summer temperatures around 25°C
  const history = [
    24.1, 24.8, 25.2, 25.0, 24.5, 25.6, 25.1,
    24.9, 25.3, 25.0, 24.7, 25.4, 25.2, 24.8,
  ].map((val, idx) => ({
    value: val,
    observed_at: `2026-07-${String(idx + 1).padStart(2, '0')}T12:00:00Z`,
  }));

  const baseline = calculateBaseline(history, '2026-07-15T12:00:00Z');
  assert.equal(baseline.status, 'sufficient');
  assert.equal(baseline.baseline, 25.05);
  assert.ok(baseline.confidenceScore >= 0.7);

  const evaluation = detectAtmosphericAnomaly({
    metric: 'temperature',
    observedValue: 25.5,
    unit: '°C',
    baselineInfo: baseline,
  });

  assert.equal(evaluation.isAnomaly, false);
  assert.equal(evaluation.severity, 'normal');
  assert.match(evaluation.explanation, /within expected seasonal baseline range/);
});

test('outlier detection: flags extreme high temperature and cold snap with robust Z-scores', () => {
  const history = [
    20.0, 20.5, 21.0, 20.2, 20.8, 21.2, 20.5,
    20.1, 20.9, 21.1, 20.4, 20.6, 20.3, 20.7,
  ].map((val, idx) => ({
    value: val,
    observed_at: `2026-04-${String(idx + 1).padStart(2, '0')}T12:00:00Z`,
  }));

  const baseline = calculateBaseline(history, '2026-04-15T12:00:00Z');

  // Heatwave spike: 37°C when baseline is ~20.5°C
  const heatwave = detectAtmosphericAnomaly({
    metric: 'temperature',
    observedValue: 37.0,
    unit: '°C',
    baselineInfo: baseline,
  });

  assert.equal(heatwave.isAnomaly, true);
  assert.equal(heatwave.anomalyType, 'temperature_heat_anomaly');
  assert.ok(heatwave.robustZScore >= 3.0);
  assert.ok(['warning', 'critical'].includes(heatwave.severity));

  // Sudden freeze / cold snap: -2°C
  const coldsnap = detectAtmosphericAnomaly({
    metric: 'temperature',
    observedValue: -2.0,
    unit: '°C',
    baselineInfo: baseline,
  });

  assert.equal(coldsnap.isAnomaly, true);
  assert.equal(coldsnap.anomalyType, 'temperature_cold_anomaly');
  assert.ok(coldsnap.robustZScore <= -3.0);
  assert.ok(['warning', 'critical'].includes(coldsnap.severity));
});

test('extreme precipitation: flags heavy rainfall using seasonal percentiles and flood thresholds', () => {
  // Dry and light rain history
  const history = [
    0, 0, 0, 0.5, 0, 1.2, 0, 0, 0, 2.0, 0, 0, 0.2, 0,
  ].map((val, idx) => ({
    value: val,
    observed_at: `2026-08-${String(idx + 1).padStart(2, '0')}T12:00:00Z`,
  }));

  const baseline = calculateBaseline(history, '2026-08-15T12:00:00Z');

  // Downpour of 65 mm (flash flood danger)
  const heavyRain = detectAtmosphericAnomaly({
    metric: 'precipitation',
    observedValue: 65.0,
    unit: 'mm',
    baselineInfo: baseline,
  });

  assert.equal(heavyRain.isAnomaly, true);
  assert.equal(heavyRain.severity, 'critical');
  assert.equal(heavyRain.anomalyType, 'extreme_precipitation_hazard');
  assert.equal(heavyRain.detectionMethod, 'seasonal_percentile_threshold');
});

test('distinguishes short-term weather spikes from persistent multi-day events without declaring climate change', () => {
  const history = [
    22, 22.5, 22, 23, 22.5, 22, 22.5, 23, 22, 22.5,
  ].map((val, idx) => ({
    value: val,
    observed_at: `2026-06-${String(idx + 1).padStart(2, '0')}T12:00:00Z`,
  }));

  const baseline = calculateBaseline(history, '2026-06-15T12:00:00Z');

  // 1. Single hour spike with normal trailing context
  const singleSpikeRecent = Array(20).fill(22.5).map((v) => ({ value: v }));
  const isolatedSpike = detectAtmosphericAnomaly({
    metric: 'temperature',
    observedValue: 36.0,
    unit: '°C',
    baselineInfo: baseline,
    recentObservations: singleSpikeRecent,
  });

  assert.equal(isolatedSpike.isAnomaly, true);
  assert.equal(isolatedSpike.durationType, 'short_term');
  assert.equal(isolatedSpike.isPersistent, false);
  // Must NOT declare climate change
  assert.match(isolatedSpike.explanation, /does not declare permanent climate change/i);

  // 2. Persistent multi-day elevated condition
  const persistentRecent = Array(24).fill(35.5).map((v) => ({ value: v }));
  const prolongedEvent = detectAtmosphericAnomaly({
    metric: 'temperature',
    observedValue: 36.0,
    unit: '°C',
    baselineInfo: baseline,
    recentObservations: persistentRecent,
  });

  assert.equal(prolongedEvent.isAnomaly, true);
  assert.equal(prolongedEvent.durationType, 'persistent_trend');
  assert.equal(prolongedEvent.isPersistent, true);
  assert.match(prolongedEvent.explanation, /Persistent environmental anomaly/i);
});

test('data quality: separates sensor errors (implausible, flatline, missing, stale) from environmental anomalies', () => {
  // 1. Implausible temperature: 85°C (exceeds physical bounds [-60, 60])
  const implausible = evaluateDataQuality('temperature', 85.0);
  assert.equal(implausible.isValid, false);
  assert.equal(implausible.category, 'data_quality');
  assert.equal(implausible.issueType, 'implausible_value');
  assert.equal(implausible.severity, 'critical');
  assert.match(implausible.explanation, /Physically implausible/);

  // 2. Flatline sensor: 4 identical consecutive temperature values
  const flatlineRows = [{ value: 21.4 }, { value: 21.4 }, { value: 21.4 }, { value: 21.4 }];
  const flatline = evaluateDataQuality('temperature', 21.4, flatlineRows);
  assert.equal(flatline.isValid, false);
  assert.equal(flatline.category, 'data_quality');
  assert.equal(flatline.issueType, 'flatline_sensor');
  assert.match(flatline.explanation, /sensor flatline/);

  // 3. Missing / unparseable value
  const missing = evaluateDataQuality('us_aqi', NaN);
  assert.equal(missing.isValid, false);
  assert.equal(missing.issueType, 'missing_value');

  // 4. Stale observation (> 120 minutes old)
  const threeHoursAgo = new Date(Date.now() - 180 * 60000).toISOString();
  const stale = evaluateDataQuality('wind_speed', 15.0, [], { latestObservedAt: threeHoursAgo });
  assert.equal(stale.isValid, true); // Still plausible, but notes staleness
  assert.equal(stale.issues.length, 1);
  assert.equal(stale.issues[0].issueType, 'stale_feed');
});

test('regional analysis: combines data quality, baselines, and anomalies across multiple metrics', () => {
  const mockObservations = {
    temperature: [
      { value: 39.5, unit: '°C', observed_at: '2026-07-15T12:00:00Z' },
      ...Array(15).fill({ value: 24.0, unit: '°C', observed_at: '2026-07-01T12:00:00Z' }),
    ],
    precipitation: [
      { value: 55.0, unit: 'mm', observed_at: '2026-07-15T12:00:00Z' },
      ...Array(15).fill({ value: 0.0, unit: 'mm', observed_at: '2026-07-01T12:00:00Z' }),
    ],
    wind_speed: [
      { value: 12.0, unit: 'km/h', observed_at: '2026-07-15T12:00:00Z' },
      ...Array(15).fill({ value: 10.0, unit: 'km/h', observed_at: '2026-07-01T12:00:00Z' }),
    ],
    surface_pressure: [
      { value: 1250.0, unit: 'hPa', observed_at: '2026-07-15T12:00:00Z' }, // Implausible
    ],
  };

  const analysis = analyzeRegionAnomalies(mockObservations, { regionId: 10 });
  assert.equal(analysis.hasAnomalies, true);
  assert.equal(analysis.hasDataQualityIssues, true);

  // Temperature should be flagged as heat anomaly
  const tempAnomaly = analysis.activeAnomalies.find((a) => a.metric === 'temperature');
  assert.ok(tempAnomaly);
  assert.equal(tempAnomaly.anomalyType, 'temperature_heat_anomaly');

  // Precipitation should be flagged as extreme hazard
  const rainAnomaly = analysis.activeAnomalies.find((a) => a.metric === 'precipitation');
  assert.ok(rainAnomaly);
  assert.equal(rainAnomaly.severity, 'critical');

  // Surface pressure should be in dataQualityIssues, NOT atmospheric anomalies
  const pressureIssue = analysis.dataQualityIssues.find((i) => i.metric === 'surface_pressure');
  assert.ok(pressureIssue);
  assert.equal(pressureIssue.issueType, 'implausible_value');
  assert.ok(!analysis.activeAnomalies.some((a) => a.metric === 'surface_pressure'));
});
