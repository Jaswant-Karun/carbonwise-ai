const METRICS = {
  temperature: { unit: '°C', label: 'Temperature', endpoint: 'weather' },
  pm2_5: { unit: 'µg/m³', label: 'PM2.5', endpoint: 'air_quality' },
  us_aqi: { unit: 'AQI', label: 'US AQI', endpoint: 'air_quality' },
};

const SOURCE_DEFINITIONS = {
  weather: { name: 'Open-Meteo Weather', provider: 'open-meteo', metric: 'temperature', unit: '°C' },
  air_quality: { name: 'Open-Meteo Air Quality', provider: 'open-meteo', metric: 'pm2_5', unit: 'µg/m³' },
};

const round = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const validateRegion = ({ name, latitude, longitude }) => {
  const normalizedName = typeof name === 'string' ? name.trim() : '';
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!normalizedName || normalizedName.length > 120) throw Object.assign(new Error('Region name is required.'), { statusCode: 400 });
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw Object.assign(new Error('Latitude must be between -90 and 90.'), { statusCode: 400 });
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) throw Object.assign(new Error('Longitude must be between -180 and 180.'), { statusCode: 400 });
  return { name: normalizedName, latitude: round(lat), longitude: round(lon) };
};

const buildObservations = (weather, airQuality, sourceIds, regionId) => {
  const observations = [];
  const weatherTimes = weather?.hourly?.time || [];
  const weatherValues = weather?.hourly?.temperature_2m || [];
  const weatherValue = weather?.current?.temperature_2m;
  const weatherObservedAt = weather?.current?.time;
  if (Number.isFinite(Number(weatherValue))) {
    observations.push({
      sourceId: sourceIds.weather, regionId, metric: 'temperature',
      value: Number(weatherValue), unit: METRICS.temperature.unit,
      observedAt: weatherObservedAt || weatherTimes[weatherTimes.length - 1],
      metadata: { source: 'open-meteo', variable: 'temperature_2m', observationType: weatherObservedAt ? 'current' : 'hourly' },
    });
  } else if (weatherTimes.length && weatherValues.length) {
    const index = weatherTimes.length - 1;
    observations.push({
      sourceId: sourceIds.weather, regionId, metric: 'temperature',
      value: Number(weatherValues[index]), unit: METRICS.temperature.unit,
      observedAt: weatherTimes[index],       metadata: { source: 'open-meteo', variable: 'temperature_2m', observationType: 'hourly' },
    });
  }
  const airTimes = airQuality?.hourly?.time || [];
  const pmValues = airQuality?.hourly?.pm2_5 || [];
  const aqiValues = airQuality?.hourly?.us_aqi || [];
  const currentPm = airQuality?.current?.pm2_5;
  const currentAqi = airQuality?.current?.us_aqi;
  const currentAirTime = airQuality?.current?.time;
  if (Number.isFinite(Number(currentPm))) {
    observations.push({
      sourceId: sourceIds.airQuality, regionId, metric: 'pm2_5',
      value: Number(currentPm), unit: METRICS.pm2_5.unit,
      observedAt: currentAirTime || airTimes[airTimes.length - 1],
      metadata: { source: 'open-meteo', variable: 'pm2_5', observationType: currentAirTime ? 'current' : 'hourly' },
    });
    if (Number.isFinite(Number(currentAqi))) {
      observations.push({
        sourceId: sourceIds.airQuality, regionId, metric: 'us_aqi',
        value: Number(currentAqi), unit: METRICS.us_aqi.unit,
        observedAt: currentAirTime || airTimes[airTimes.length - 1],
        metadata: { source: 'open-meteo', variable: 'us_aqi', observationType: currentAirTime ? 'current' : 'hourly' },
      });
    }
  } else if (airTimes.length && pmValues.length) {
    const index = airTimes.length - 1;
    observations.push({
      sourceId: sourceIds.airQuality, regionId, metric: 'pm2_5',
      value: Number(pmValues[index]), unit: METRICS.pm2_5.unit,
      observedAt: airTimes[index], metadata: { source: 'open-meteo', variable: 'pm2_5' },
    });
    if (aqiValues.length && Number.isFinite(Number(aqiValues[index]))) {
      observations.push({
        sourceId: sourceIds.airQuality, regionId, metric: 'us_aqi',
        value: Number(aqiValues[index]), unit: METRICS.us_aqi.unit,
        observedAt: airTimes[index], metadata: { source: 'open-meteo', variable: 'us_aqi' },
      });
    }
  }
  return observations.filter((item) => Number.isFinite(item.value));
};

module.exports = { METRICS, SOURCE_DEFINITIONS, buildObservations, validateRegion };
