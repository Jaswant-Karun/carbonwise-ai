/**
 * NASA POWER API Client
 * Provides access to NASA Prediction Of Worldwide Energy Resources (POWER)
 * Daily Solar & Meteorological datasets for historical climate baseline calculations.
 *
 * Attribution:
 * "These data were obtained from the NASA Langley Research Center POWER Project
 *  funded through the NASA Earth Science/Applied Science Program."
 */

const fetch = global.fetch;

// In-memory cache for NASA POWER daily time series (24h TTL)
const nasaCache = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const round = (val, dec = 2) => (val == null || Number.isNaN(Number(val)) ? null : Number(Number(val).toFixed(dec)));

/**
 * Format a Date to YYYYMMDD string for NASA POWER API
 */
const formatDateToYmd = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
};

/**
 * Format YYYYMMDD string to ISO YYYY-MM-DD
 */
const parseYmdToIso = (ymd) => {
  const str = String(ymd);
  if (str.length !== 8) return str;
  return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`;
};

/**
 * Fetch daily historical data from NASA POWER API
 * @param {Object} params
 * @param {number} params.latitude
 * @param {number} params.longitude
 * @param {Date|string} params.startDate
 * @param {Date|string} params.endDate
 * @param {string[]} [params.parameters] e.g. ['T2M', 'PRECTOTCORR', 'RH2M', 'WS10M']
 */
const fetchNasaPowerDaily = async ({
  latitude,
  longitude,
  startDate,
  endDate,
  parameters = ['T2M', 'PRECTOTCORR', 'RH2M', 'WS10M'],
}) => {
  const lat = round(latitude, 4);
  const lon = round(longitude, 4);
  const startStr = formatDateToYmd(startDate);
  const endStr = formatDateToYmd(endDate);

  const cacheKey = `nasa:${lat},${lon}:${startStr}-${endStr}:${parameters.sort().join(',')}`;
  const cached = nasaCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return { ...cached.data, cached: true };
  }

  const urlParams = new URLSearchParams({
    parameters: parameters.join(','),
    community: 'RE',
    longitude: String(lon),
    latitude: String(lat),
    start: startStr,
    end: endStr,
    format: 'JSON',
  });

  const url = `https://power.larc.nasa.gov/api/temporal/daily/point?${urlParams.toString()}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000); // 12s timeout

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`NASA POWER API HTTP ${res.status}: ${res.statusText}`);
    }

    const json = await res.json();
    const rawParams = json.properties?.parameter || {};

    // Transform NASA parameter format into clean daily timeseries
    // NASA sentinel for missing / unavailable data is -999 or -999.0
    const timeKeys = Object.keys(rawParams.T2M || rawParams.PRECTOTCORR || {});
    const dailyRecords = [];
    const missingDates = [];

    timeKeys.forEach((ymd) => {
      const isoDate = parseYmdToIso(ymd);
      const t2mRaw = rawParams.T2M?.[ymd];
      const precipRaw = rawParams.PRECTOTCORR?.[ymd];
      const rhRaw = rawParams.RH2M?.[ymd];
      const wsRaw = rawParams.WS10M?.[ymd];

      const isT2mValid = t2mRaw != null && t2mRaw > -900;
      const isPrecipValid = precipRaw != null && precipRaw > -900;
      const isRhValid = rhRaw != null && rhRaw > -900;
      const isWsValid = wsRaw != null && wsRaw > -900;

      if (!isT2mValid && !isPrecipValid) {
        missingDates.push(isoDate);
        return;
      }

      dailyRecords.push({
        date: isoDate,
        temperature: isT2mValid ? round(t2mRaw) : null,
        precipitation: isPrecipValid ? round(precipRaw) : null,
        relative_humidity: isRhValid ? round(rhRaw) : null,
        // NASA WS10M is in m/s; convert to km/h (1 m/s = 3.6 km/h)
        wind_speed: isWsValid ? round(wsRaw * 3.6) : null,
      });
    });

    const result = {
      source: 'NASA POWER Project',
      attribution:
        'NASA Langley Research Center POWER Project (Prediction Of Worldwide Energy Resources)',
      latitude: lat,
      longitude: lon,
      startDate: parseYmdToIso(startStr),
      endDate: parseYmdToIso(endStr),
      dailyRecords,
      missingDates,
      totalDays: dailyRecords.length,
      cached: false,
    };

    nasaCache.set(cacheKey, { timestamp: Date.now(), data: result });
    return result;
  } catch (error) {
    console.warn(`NASA POWER API request deferred (${error.message}). Falling back to local or alternative datasets.`);
    return {
      source: 'NASA POWER Project (Unavailable)',
      attribution: 'NASA Langley Research Center POWER Project',
      error: error.message,
      dailyRecords: [],
      missingDates: [],
      totalDays: 0,
      cached: false,
    };
  }
};

/**
 * Compute climatological reference normal for a location
 * Defaults to reference comparison window (e.g. 1991-2020 or recent 10-year baseline)
 */
const calculateReferenceBaseline = (dailyRecords) => {
  if (!dailyRecords || dailyRecords.length === 0) {
    return {
      status: 'insufficient_history',
      sampleDays: 0,
      temperatureMean: null,
      precipitationDailyMean: null,
      precipitationAnnualEstimate: null,
      explanation: 'Insufficient reference dataset to calculate climate normal.',
    };
  }

  const temps = dailyRecords.map((r) => r.temperature).filter((t) => t != null);
  const precips = dailyRecords.map((r) => r.precipitation).filter((p) => p != null);

  const tempMean = temps.length ? temps.reduce((a, b) => a + b, 0) / temps.length : null;
  const precipDailyMean = precips.length ? precips.reduce((a, b) => a + b, 0) / precips.length : null;
  const precipAnnualEstimate = precipDailyMean != null ? precipDailyMean * 365.25 : null;

  return {
    status: 'sufficient',
    sampleDays: dailyRecords.length,
    temperatureMean: round(tempMean),
    precipitationDailyMean: round(precipDailyMean),
    precipitationAnnualEstimate: round(precipAnnualEstimate),
    explanation: `Calculated from ${dailyRecords.length} daily NASA POWER observations.`,
  };
};

module.exports = {
  fetchNasaPowerDaily,
  calculateReferenceBaseline,
  formatDateToYmd,
  parseYmdToIso,
  _nasaCache: nasaCache,
};
