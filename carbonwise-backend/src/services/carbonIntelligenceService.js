const EMISSION_FACTORS = {
  transport: { label: 'Transport', unit: 'km', factor: 0.21, reductionRate: 0.2, rationale: 'Combine trips, use public transport, walk, or cycle for short journeys.' },
  electricity: { label: 'Electricity', unit: 'kWh', factor: 0.5, reductionRate: 0.15, rationale: 'Reduce standby power and shift usage to efficient appliances and lighting.' },
  food: { label: 'Food', unit: 'meal', factor: 2.5, reductionRate: 0.25, rationale: 'Replace some high-emission meals with plant-forward alternatives.' },
  flight: { label: 'Flights', unit: 'km', factor: 0.255, reductionRate: 0.1, rationale: 'Prefer rail or virtual meetings where practical and consolidate trips.' },
  shopping: { label: 'Shopping', unit: 'item', factor: 5, reductionRate: 0.15, rationale: 'Buy fewer, longer-lasting items and choose lower-impact alternatives.' },
  water: { label: 'Water', unit: 'liters', factor: 0.001, reductionRate: 0.15, rationale: 'Fix water leaks, use aerated fixtures, and shorten hot showers.' },
  waste: { label: 'Waste', unit: 'kg', factor: 0.58, reductionRate: 0.25, rationale: 'Compost organics, recycle plastics, and reduce single-use packaging.' },
  facilities: { label: 'Facilities', unit: 'kWh', factor: 0.5, reductionRate: 0.15, rationale: 'Optimize facility heating/cooling schedules, smart thermostats, and LED retrofits.' },
  other: { label: 'Other', unit: 'items', factor: 5.0, reductionRate: 0.1, rationale: 'Extend electronic device lifespans and purchase eco-certified goods.' },
};

const CATEGORY_ALIASES = {
  transportation: 'transport',
  driving: 'transport',
  travel: 'transport',
  transit: 'transport',
  energy: 'electricity',
  power: 'electricity',
  diet: 'food',
  dining: 'food',
  meals: 'food',
  water_usage: 'water',
  waste_management: 'waste',
  garbage: 'waste',
  buildings: 'facilities',
  facility: 'facilities',
  office: 'facilities',
  goods: 'other',
  electronics: 'other',
  purchases: 'other',
};

const normalizeCategory = (category) => {
  if (typeof category !== 'string') return '';
  const clean = category.trim().toLowerCase();
  return CATEGORY_ALIASES[clean] || clean;
};

const getEmissionFactor = (category) => {
  const normalizedCategory = normalizeCategory(category);
  return EMISSION_FACTORS[normalizedCategory] || null;
};

const calculateActivityEmissions = (categoryInput, details) => {
  const category = normalizeCategory(categoryInput);
  const factor = getEmissionFactor(category);
  if (!factor) {
    const error = new Error('Activity category and non-negative numeric value are required.');
    error.statusCode = 400;
    throw error;
  }

  // If details is a simple number or null/undefined
  if (typeof details !== 'object' || details === null) {
    const value = Number(details);
    if (!Number.isFinite(value) || value < 0) {
      const error = new Error('Activity category and non-negative numeric value are required.');
      error.statusCode = 400;
      throw error;
    }
    return round(value * factor.factor);
  }

  // Check if this is a simple payload: e.g. { value: 100 } with no category-specific subfields
  const hasSubcategory = Boolean(
    details.mealType || details.foodType || details.foodWasteKg ||
    details.energySource || details.solarGenerationKwh || details.generatorFuelLiters ||
    details.transportMode || details.passengers || details.distanceKm ||
    details.waterSource || details.volumeLiters || details.isHotWater || details.cubicMeters ||
    details.wasteType || details.wasteQuantityKg || details.treatmentMethod ||
    details.facilityType || details.areaSqMeters || details.hvacHours || details.refrigerantLeakageKg ||
    details.sourceType || details.spendAmount
  );

  if (!hasSubcategory && details.value !== undefined) {
    const value = Number(details.value);
    if (!Number.isFinite(value) || value < 0) {
      const error = new Error('Activity category and non-negative numeric value are required.');
      error.statusCode = 400;
      throw error;
    }
    return round(value * factor.factor);
  }

  // Rich, dynamic domain calculations based on SDG-13 / GHG Protocol factors:
  let totalEmissions = 0;

  switch (category) {
    case 'food': {
      const mealType = details.mealType || details.foodType || 'meat_average';
      const quantity = Number(details.quantity ?? details.value ?? 1);
      if (!Number.isFinite(quantity) || quantity < 0) throw new Error('Food quantity must be non-negative.');

      const mealFactors = {
        vegan: 0.9,
        vegetarian: 1.5,
        dairy: 1.9,
        seafood: 2.8,
        meat_average: 3.5,
        meat_high: 7.2,
      };
      const mealFactor = mealFactors[mealType] || factor.factor;
      totalEmissions = quantity * mealFactor;

      const wasteKg = Number(details.foodWasteKg || 0);
      if (Number.isFinite(wasteKg) && wasteKg > 0) {
        totalEmissions += wasteKg * 2.5; // Food waste methane emission factor
      }
      break;
    }

    case 'electricity': {
      const kwh = Number(details.kwh ?? details.value ?? 0);
      if (!Number.isFinite(kwh) || kwh < 0) throw new Error('Electricity kWh must be non-negative.');

      const source = details.energySource || 'grid';
      const sourceFactors = {
        grid: 0.50,
        coal: 0.90,
        natural_gas: 0.45,
        renewable: 0.02,
        solar: 0.02,
      };

      if (source === 'diesel_generator') {
        const liters = Number(details.generatorFuelLiters ?? (kwh / 3.0));
        totalEmissions = liters * 2.68;
      } else {
        const baseFactor = sourceFactors[source] || factor.factor;
        const solarOffsetKwh = Math.max(0, Number(details.solarGenerationKwh || 0));
        const netKwh = Math.max(0, kwh - solarOffsetKwh);
        totalEmissions = (netKwh * baseFactor) + (solarOffsetKwh * 0.02);
      }
      break;
    }

    case 'transport':
    case 'flight': {
      const distance = Number(details.distanceKm ?? details.distance ?? details.value ?? 0);
      if (!Number.isFinite(distance) || distance < 0) throw new Error('Travel distance must be non-negative.');

      const mode = details.transportMode || (category === 'flight' ? 'flight_economy' : 'car_petrol');
      const passengers = Math.max(1, Number(details.passengers || 1));

      const transportFactors = {
        car_petrol: 0.192 / passengers,
        car_diesel: 0.171 / passengers,
        car_hybrid: 0.109 / passengers,
        car_electric: 0.053 / passengers,
        car_ev: 0.053 / passengers,
        motorbike: 0.103,
        bus: 0.082,
        train: 0.035,
        flight_economy: 0.255,
        flight_business: 0.380,
        walking_cycling: 0.0,
      };

      const rate = transportFactors[mode] !== undefined ? transportFactors[mode] : factor.factor;
      totalEmissions = distance * rate;
      break;
    }

    case 'water': {
      let liters = Number(details.volumeLiters ?? details.liters ?? details.value ?? 0);
      if (details.unit === 'm3' || details.unit === 'cubic_meters' || details.cubicMeters) {
        liters = Number(details.cubicMeters || details.value || 0) * 1000;
      }
      if (!Number.isFinite(liters) || liters < 0) throw new Error('Water volume must be non-negative.');

      const source = details.waterSource || (details.isHotWater ? 'tap_hot' : 'tap_cold');
      const waterFactors = {
        tap_cold: 0.00035,
        tap_hot: 0.0058,
        bottled: 0.16,
        groundwater: 0.0006,
        recycled: 0.0001,
      };
      const rate = waterFactors[source] || factor.factor;
      totalEmissions = liters * rate;
      break;
    }

    case 'waste': {
      const kg = Number(details.wasteQuantityKg ?? details.wasteKg ?? details.value ?? 0);
      if (!Number.isFinite(kg) || kg < 0) throw new Error('Waste quantity must be non-negative.');

      const treatment = details.treatmentMethod || 'landfill';
      const wasteType = details.wasteType || 'mixed';

      let rate = factor.factor; // default 0.58
      if (treatment === 'recycled') {
        rate = 0.05;
      } else if (treatment === 'composted') {
        rate = 0.10;
      } else if (wasteType === 'organic' || wasteType === 'food') {
        rate = 0.95;
      } else if (wasteType === 'plastic') {
        rate = 0.04;
      }
      totalEmissions = kg * rate;
      break;
    }

    case 'facilities': {
      const facilityKwh = Number(details.kwh ?? details.value ?? 0);
      if (facilityKwh > 0) {
        totalEmissions += facilityKwh * 0.50;
      } else if (details.areaSqMeters) {
        const area = Number(details.areaSqMeters);
        const days = Number(details.days || 1);
        totalEmissions += area * days * 0.08;
      }
      if (details.hvacHours) {
        const hours = Number(details.hvacHours);
        const kw = Number(details.hvacKwRating || 3.5);
        totalEmissions += hours * kw * 0.50;
      }
      if (details.refrigerantLeakageKg) {
        const refKg = Number(details.refrigerantLeakageKg);
        totalEmissions += refKg * 1430; // R-410A GWP
      }
      if (totalEmissions === 0 && Number.isFinite(Number(details.value))) {
        totalEmissions = Number(details.value) * factor.factor;
      }
      break;
    }

    case 'other':
    case 'shopping': {
      const subType = details.sourceType || details.subType || 'general';
      const qty = Number(details.quantity ?? details.value ?? 1);
      const otherRates = {
        electronics_laptop: 210,
        electronics_phone: 70,
        electronics_monitor: 150,
        clothing_apparel: 12,
        furniture: 45,
        paper_goods: 1.2,
        general: factor.factor,
      };
      if (details.spendAmount) {
        totalEmissions = Number(details.spendAmount) * 0.45;
      } else {
        const unitRate = otherRates[subType] || factor.factor;
        totalEmissions = qty * unitRate;
      }
      break;
    }

    default:
      totalEmissions = Number(details.value || 0) * factor.factor;
  }

  return round(Math.max(0, totalEmissions));
};

const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

const parseActivity = (activity) => {
  let date = '';
  if (typeof activity.date === 'string') {
    date = activity.date.slice(0, 10);
  } else if (activity.date instanceof Date) {
    date = activity.date.toISOString().slice(0, 10);
  }
  const emissions = Number(activity.carbon_emissions);
  const category = typeof activity.activity_type === 'string'
    ? normalizeCategory(activity.activity_type)
    : '';

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !category || !Number.isFinite(emissions) || emissions < 0) {
    return null;
  }

  return { date, category, emissions };
};

const dateFromIso = (isoDate) => new Date(`${isoDate}T12:00:00Z`);
const isoDate = (date) => date.toISOString().slice(0, 10);
const addDays = (iso, amount) => {
  const date = dateFromIso(iso);
  date.setUTCDate(date.getUTCDate() + amount);
  return isoDate(date);
};

const sum = (activities) => round(activities.reduce((total, activity) => total + activity.emissions, 0));

const dailyTotals = (activities, startDate, endDate) => {
  const totals = {};
  for (let cursor = startDate; cursor <= endDate; cursor = addDays(cursor, 1)) {
    totals[cursor] = 0;
  }
  activities.forEach((activity) => {
    if (activity.date >= startDate && activity.date <= endDate) {
      totals[activity.date] = round((totals[activity.date] || 0) + activity.emissions);
    }
  });
  return totals;
};

const categoryTotals = (activities) => {
  const totals = {};
  activities.forEach((activity) => {
    totals[activity.category] = round((totals[activity.category] || 0) + activity.emissions);
  });
  return totals;
};

const comparePeriods = (current, previous) => {
  const absoluteChange = round(current - previous);
  const percentageChange = previous === 0
    ? (current === 0 ? 0 : null)
    : round((absoluteChange / previous) * 100);

  return {
    current: round(current),
    previous: round(previous),
    absoluteChange,
    percentageChange,
    status: previous === 0 ? (current === 0 ? 'unchanged' : 'new') : absoluteChange > 0 ? 'increase' : absoluteChange < 0 ? 'decrease' : 'unchanged',
  };
};

const standardDeviation = (values, mean) => {
  if (values.length === 0) return 0;
  return Math.sqrt(values.reduce((total, value) => total + ((value - mean) ** 2), 0) / values.length);
};

const detectAnomalies = (currentDaily, previousDaily) => {
  const baselineValues = Object.values(previousDaily);
  const baselineMean = baselineValues.length ? sum(baselineValues) / baselineValues.length : 0;
  const baselineStdDev = standardDeviation(baselineValues, baselineMean);
  const threshold = baselineMean === 0
    ? 5
    : Math.max(baselineMean * 1.5, baselineMean + (2 * baselineStdDev));

  return Object.entries(currentDaily)
    .filter(([, emissions]) => emissions >= threshold && (baselineMean === 0 ? emissions > 0 : emissions > baselineMean))
    .map(([date, emissions]) => ({
      date,
      emissions: round(emissions),
      baselineDailyAverage: round(baselineMean),
      threshold: round(threshold),
      explanation: baselineMean === 0
        ? `This day recorded ${round(emissions)} kg CO₂ after no measurable emissions in the equivalent baseline days.`
        : `This day recorded ${round(emissions)} kg CO₂, above the ${round(threshold)} kg rule threshold (baseline average plus two standard deviations, with a 1.5× minimum).`,
    }));
};

const buildRecommendations = (currentActivities, currentTotal) => {
  const totals = categoryTotals(currentActivities);

  return Object.entries(totals)
    .map(([category, emissions]) => {
      const factor = EMISSION_FACTORS[category];
      const reductionRate = factor?.reductionRate || 0.1;
      const potentialSavingsKg = round(emissions * reductionRate);
      const contributionPercentage = currentTotal === 0 ? 0 : round((emissions / currentTotal) * 100);

      return {
        category,
        label: factor?.label || category.replace(/^\w/, (letter) => letter.toUpperCase()),
        rank: 0,
        currentEmissions: round(emissions),
        contributionPercentage,
        potentialSavingsKg,
        reductionRatePercentage: round(reductionRate * 100),
        reason: factor?.rationale || 'Review this activity category and reduce unnecessary usage where practical.',
      };
    })
    .sort((a, b) => b.potentialSavingsKg - a.potentialSavingsKg || b.currentEmissions - a.currentEmissions)
    .map((recommendation, index) => ({ ...recommendation, rank: index + 1 }));
};

const buildIntelligence = ({ activities, currentStart, currentEnd, previousStart, previousEnd, periodDays }) => {
  const parsedActivities = activities.map(parseActivity);
  const validActivities = parsedActivities.filter(Boolean);
  const invalidActivityCount = parsedActivities.length - validActivities.length;
  const currentActivities = validActivities.filter((activity) => activity.date >= currentStart && activity.date <= currentEnd);
  const previousActivities = validActivities.filter((activity) => activity.date >= previousStart && activity.date <= previousEnd);
  const currentTotal = sum(currentActivities);
  const previousTotal = sum(previousActivities);
  const categories = categoryTotals(currentActivities);
  const daily = dailyTotals(currentActivities, currentStart, currentEnd);
  const previousDaily = dailyTotals(previousActivities, previousStart, previousEnd);
  const categoryBreakdown = Object.entries(categories)
    .map(([category, emissions]) => ({
      category,
      label: EMISSION_FACTORS[category]?.label || category.replace(/^\w/, (letter) => letter.toUpperCase()),
      emissions: round(emissions),
      contributionPercentage: currentTotal === 0 ? 0 : round((emissions / currentTotal) * 100),
    }))
    .sort((a, b) => b.emissions - a.emissions);

  return {
    period: { days: periodDays, currentStart, currentEnd, previousStart, previousEnd },
    totals: {
      daily: round(currentTotal / periodDays),
      weekly: round(currentTotal / periodDays * 7),
      monthly: round(currentTotal / periodDays * 30),
      currentPeriod: currentTotal,
      previousPeriod: previousTotal,
    },
    comparison: comparePeriods(currentTotal, previousTotal),
    categoryBreakdown,
    largestSources: categoryBreakdown.slice(0, 3),
    trends: Object.entries(daily).map(([date, emissions]) => ({ date, emissions: round(emissions) })),
    anomalies: detectAnomalies(daily, previousDaily),
    recommendations: buildRecommendations(currentActivities, currentTotal),
    activityCount: currentActivities.length,
    invalidActivityCount,
  };
};

const getPeriodBounds = (periodDays, today = isoDate(new Date())) => {
  const currentStart = addDays(today, -(periodDays - 1));
  const previousEnd = addDays(currentStart, -1);
  const previousStart = addDays(previousEnd, -(periodDays - 1));
  return { currentStart, currentEnd: today, previousStart, previousEnd };
};

module.exports = {
  EMISSION_FACTORS,
  addDays,
  buildIntelligence,
  calculateActivityEmissions,
  comparePeriods,
  detectAnomalies,
  getEmissionFactor,
  getPeriodBounds,
  parseActivity,
};
