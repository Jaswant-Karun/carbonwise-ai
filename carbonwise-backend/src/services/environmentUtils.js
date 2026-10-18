const METRICS = {
  temperature: { unit: '°C', label: 'Temperature', endpoint: 'weather', variable: 'temperature_2m' },
  relative_humidity: { unit: '%', label: 'Relative Humidity', endpoint: 'weather', variable: 'relative_humidity_2m' },
  precipitation: { unit: 'mm', label: 'Precipitation', endpoint: 'weather', variable: 'precipitation' },
  wind_speed: { unit: 'km/h', label: 'Wind Speed', endpoint: 'weather', variable: 'wind_speed_10m' },
  surface_pressure: { unit: 'hPa', label: 'Atmospheric Pressure', endpoint: 'weather', variable: 'surface_pressure' },
  pm2_5: { unit: 'µg/m³', label: 'PM2.5', endpoint: 'air_quality', variable: 'pm2_5' },
  pm10: { unit: 'µg/m³', label: 'PM10', endpoint: 'air_quality', variable: 'pm10' },
  us_aqi: { unit: 'AQI', label: 'US AQI', endpoint: 'air_quality', variable: 'us_aqi' },
};

const SOURCE_DEFINITIONS = {
  weather: { name: 'Open-Meteo Weather', provider: 'open-meteo', metric: 'temperature', unit: '°C' },
  relative_humidity: { name: 'Open-Meteo Weather', provider: 'open-meteo', metric: 'relative_humidity', unit: '%' },
  precipitation: { name: 'Open-Meteo Weather', provider: 'open-meteo', metric: 'precipitation', unit: 'mm' },
  wind_speed: { name: 'Open-Meteo Weather', provider: 'open-meteo', metric: 'wind_speed', unit: 'km/h' },
  surface_pressure: { name: 'Open-Meteo Weather', provider: 'open-meteo', metric: 'surface_pressure', unit: 'hPa' },
  air_quality: { name: 'Open-Meteo Air Quality', provider: 'open-meteo', metric: 'pm2_5', unit: 'µg/m³' },
  pm10: { name: 'Open-Meteo Air Quality', provider: 'open-meteo', metric: 'pm10', unit: 'µg/m³' },
  us_aqi: { name: 'Open-Meteo Air Quality', provider: 'open-meteo', metric: 'us_aqi', unit: 'AQI' },
};

const round = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const validateRegion = ({ name, latitude, longitude, country = null, admin1 = null, timezone = 'UTC' }) => {
  const normalizedName = typeof name === 'string' ? name.trim() : '';
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!normalizedName || normalizedName.length > 120) {
    throw Object.assign(new Error('Region name is required (max 120 chars).'), { statusCode: 400 });
  }
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw Object.assign(new Error('Latitude must be between -90 and 90.'), { statusCode: 400 });
  }
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
    throw Object.assign(new Error('Longitude must be between -180 and 180.'), { statusCode: 400 });
  }
  return {
    name: normalizedName,
    latitude: round(lat),
    longitude: round(lon),
    country: typeof country === 'string' ? country.trim().slice(0, 100) : null,
    admin1: typeof admin1 === 'string' ? admin1.trim().slice(0, 100) : null,
    timezone: typeof timezone === 'string' ? timezone.trim().slice(0, 60) : 'UTC',
  };
};

const buildObservations = (weather, airQuality, sourceIds, regionId) => {
  const observations = [];

  // Weather parameters to map
  const weatherMappings = [
    { metric: 'temperature', rawKey: 'temperature_2m', endpoint: 'weather' },
    { metric: 'relative_humidity', rawKey: 'relative_humidity_2m', endpoint: 'weather' },
    { metric: 'precipitation', rawKey: 'precipitation', endpoint: 'weather' },
    { metric: 'wind_speed', rawKey: 'wind_speed_10m', endpoint: 'weather' },
    { metric: 'surface_pressure', rawKey: 'surface_pressure', endpoint: 'weather' },
  ];

  // Air quality parameters to map
  const airMappings = [
    { metric: 'pm2_5', rawKey: 'pm2_5', endpoint: 'airQuality' },
    { metric: 'pm10', rawKey: 'pm10', endpoint: 'airQuality' },
    { metric: 'us_aqi', rawKey: 'us_aqi', endpoint: 'airQuality' },
  ];

  // Process weather variables
  const weatherTimes = weather?.hourly?.time || [];
  const currentWeatherTime = weather?.current?.time;

  for (const { metric, rawKey } of weatherMappings) {
    const currentValue = weather?.current?.[rawKey];
    const hourlyValues = weather?.hourly?.[rawKey] || [];
    const sourceId = sourceIds[metric] || sourceIds.weather;

    if (Number.isFinite(Number(currentValue))) {
      observations.push({
        sourceId,
        regionId,
        metric,
        value: Number(currentValue),
        unit: METRICS[metric]?.unit || '',
        observedAt: currentWeatherTime || (weatherTimes.length ? weatherTimes[weatherTimes.length - 1] : new Date().toISOString()),
        metadata: { source: 'open-meteo', variable: rawKey, observationType: currentWeatherTime ? 'current' : 'hourly' },
      });
    } else if (weatherTimes.length && hourlyValues.length) {
      const idx = weatherTimes.length - 1;
      const val = Number(hourlyValues[idx]);
      if (Number.isFinite(val)) {
        observations.push({
          sourceId,
          regionId,
          metric,
          value: val,
          unit: METRICS[metric]?.unit || '',
          observedAt: weatherTimes[idx],
          metadata: { source: 'open-meteo', variable: rawKey, observationType: 'hourly' },
        });
      }
    }
  }

  // Process air quality variables
  const airTimes = airQuality?.hourly?.time || [];
  const currentAirTime = airQuality?.current?.time;

  for (const { metric, rawKey } of airMappings) {
    const currentVal = airQuality?.current?.[rawKey];
    const hourlyVals = airQuality?.hourly?.[rawKey] || [];
    const sourceId = sourceIds[metric] || sourceIds.airQuality;

    if (Number.isFinite(Number(currentVal))) {
      observations.push({
        sourceId,
        regionId,
        metric,
        value: Number(currentVal),
        unit: METRICS[metric]?.unit || '',
        observedAt: currentAirTime || (airTimes.length ? airTimes[airTimes.length - 1] : new Date().toISOString()),
        metadata: { source: 'open-meteo', variable: rawKey, observationType: currentAirTime ? 'current' : 'hourly' },
      });
    } else if (airTimes.length && hourlyVals.length) {
      const idx = airTimes.length - 1;
      const val = Number(hourlyVals[idx]);
      if (Number.isFinite(val)) {
        observations.push({
          sourceId,
          regionId,
          metric,
          value: val,
          unit: METRICS[metric]?.unit || '',
          observedAt: airTimes[idx],
          metadata: { source: 'open-meteo', variable: rawKey, observationType: 'hourly' },
        });
      }
    }
  }

  return observations.filter((item) => Number.isFinite(item.value));
};

const geoCache = new Map();
const GEO_CACHE_TTL_MS = 15 * 60 * 1000;

const fetchJson = async (url, timeoutMs = 10000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      const error = new Error(`Environmental provider returned HTTP ${response.status}`);
      error.code = `HTTP_${response.status}`;
      error.statusCode = response.status;
      throw error;
    }
    return await response.json();
  } catch (err) {
    if (err.name === 'AbortError') {
      const timeoutErr = new Error('Environmental provider request timed out');
      timeoutErr.code = 'ETIMEDOUT';
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
};

const searchLocations = async (query) => {
  const cleanQuery = typeof query === 'string' ? query.trim() : '';
  if (!cleanQuery || cleanQuery.length < 2) return [];

  const cacheKey = `geo:${cleanQuery.toLowerCase()}`;
  const cached = geoCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < GEO_CACHE_TTL_MS) {
    return cached.data;
  }

  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cleanQuery)}&count=8&language=en&format=json`;
  try {
    const data = await fetchJson(url, 6000);
    const results = (data?.results || []).map((item) => ({
      id: item.id,
      name: item.name,
      latitude: round(item.latitude),
      longitude: round(item.longitude),
      country: item.country || null,
      admin1: item.admin1 || null,
      timezone: item.timezone || 'UTC',
      elevation: item.elevation != null ? round(item.elevation) : null,
    }));
    geoCache.set(cacheKey, { timestamp: Date.now(), data: results });
    return results;
  } catch (err) {
    console.warn('[geocoding] provider lookup failed:', err.message);
    return [];
  }
};

module.exports = {
  METRICS,
  SOURCE_DEFINITIONS,
  buildObservations,
  validateRegion,
  round,
  fetchJson,
  searchLocations,
  geoCache,
};
