// Real, scientifically grounded fallback and demo dataset for CarbonWise AI
// Used when deployed on static hosts (e.g. Vercel preview) or when the local backend is offline.

export const demoUser = {
  id: 999,
  name: 'Sustainability Ambassador',
  email: 'demo@carbonwise.ai',
  role: 'demo_user',
};

export const demoActivities = [
  {
    id: 101,
    activity_type: 'electricity',
    details: { kwh: 120, energySource: 'grid', solarGenerationKwh: 30 },
    carbon_emissions: 46.5,
    date: new Date(Date.now() - 1 * 86400000).toISOString().split('T')[0],
    notes: 'Home office and server rack usage with 30 kWh rooftop solar offset',
  },
  {
    id: 102,
    activity_type: 'transport',
    details: { transportMode: 'car_hybrid', distanceKm: 85, passengers: 2 },
    carbon_emissions: 4.63,
    date: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0],
    notes: 'Commute to regional sustainability symposium with colleague',
  },
  {
    id: 103,
    activity_type: 'food',
    details: { dietType: 'vegetarian', mealCount: 3, foodWasteKg: 0.2 },
    carbon_emissions: 5.1,
    date: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0],
    notes: 'Three vegetarian meals with organic compost separation',
  },
  {
    id: 104,
    activity_type: 'facilities',
    details: { floorAreaSqM: 140, hvacType: 'heat_pump', operationalHours: 12 },
    carbon_emissions: 18.2,
    date: new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0],
    notes: 'Energy-efficient commercial building heat pump operation',
  },
  {
    id: 105,
    activity_type: 'waste',
    details: { landfillKg: 3.5, recycledKg: 12.0, compostedKg: 4.5 },
    carbon_emissions: 2.1,
    date: new Date(Date.now() - 4 * 86400000).toISOString().split('T')[0],
    notes: 'Weekly office waste sorting with 82% diversion from landfill',
  },
  {
    id: 106,
    activity_type: 'water',
    details: { cubicMeters: 4.2, treatmentType: 'municipal' },
    carbon_emissions: 1.45,
    date: new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0],
    notes: 'Low-flow facility fixtures and greywater recycling',
  },
];

export const demoSummary = {
  totalEmissions: '77.98',
  totalEmissionsKg: 77.98,
  activityCount: 6,
  dateRange: {
    start: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  },
  byType: {
    electricity: 46.5,
    transportation: 4.63,
    transport: 4.63,
    food: 5.1,
    facilities: 18.2,
    waste: 2.1,
    water: 1.45,
  },
  totals: {
    emissionsKg: 77.98,
    scope1: 4.63,
    scope2: 46.5,
    scope3: 26.85,
  },
  insights: [
    {
      icon: '⚡',
      title: 'Primary Driver: Operational Electricity',
      description: 'Electricity accounts for 59.6% of total logged footprint. Shifting high-draw loads to solar peak hours can save ~12 kg CO₂e weekly.',
      impact: 'high',
    },
    {
      icon: '🚗',
      title: 'Mobility Efficiency',
      description: 'Hybrid vehicle carpooling reduced commuting footprint by 58% compared to single-occupancy gasoline transit.',
      impact: 'medium',
    },
    {
      icon: '🥗',
      title: 'Plant-Forward Nutrition Impact',
      description: 'Vegetarian meal planning saved approximately 7.2 kg CO₂e compared to standard regional dietary baselines.',
      impact: 'medium',
    },
    {
      icon: '🏢',
      title: 'HVAC Heat Pump Performance',
      description: 'Smart thermostat setback during unoccupied hours saved 4.8 kWh of thermal energy yesterday.',
      impact: 'low',
    },
    {
      icon: '🗑️',
      title: '82% Landfill Diversion Rate',
      description: 'Dedicated organic composting prevented 3.8 kg of potential anaerobic landfill methane emissions.',
      impact: 'low',
    },
  ],
};

export const demoIntelligence = {
  period: { days: 30, currentStart: '2026-10-12', currentEnd: '2026-11-11', previousStart: '2026-09-12', previousEnd: '2026-10-11' },
  totals: {
    daily: 2.6,
    weekly: 18.2,
    monthly: 77.98,
    currentPeriod: 77.98,
    previousPeriod: 89.4,
  },
  comparison: {
    current: 77.98,
    previous: 89.4,
    absoluteChange: -11.42,
    percentageChange: -12.8,
    status: 'decrease',
  },
  categoryBreakdown: [
    { category: 'electricity', label: 'Electricity', emissions: 46.5, contributionPercentage: 60 },
    { category: 'facilities', label: 'Facilities', emissions: 18.2, contributionPercentage: 23 },
    { category: 'food', label: 'Food & Diet', emissions: 5.1, contributionPercentage: 7 },
    { category: 'transport', label: 'Transportation', emissions: 4.63, contributionPercentage: 6 },
    { category: 'waste', label: 'Waste Management', emissions: 2.1, contributionPercentage: 3 },
    { category: 'water', label: 'Water Usage', emissions: 1.45, contributionPercentage: 2 },
  ],
  largestSources: [
    { category: 'electricity', label: 'Electricity', emissions: 46.5, contributionPercentage: 60 },
    { category: 'facilities', label: 'Facilities', emissions: 18.2, contributionPercentage: 23 },
    { category: 'food', label: 'Food & Diet', emissions: 5.1, contributionPercentage: 7 },
    { category: 'transport', label: 'Transportation', emissions: 4.63, contributionPercentage: 6 },
  ],
  trends: [
    { date: '2026-11-05', emissions: 2.4 },
    { date: '2026-11-06', emissions: 3.1 },
    { date: '2026-11-07', emissions: 1.8 },
    { date: '2026-11-08', emissions: 4.2 },
    { date: '2026-11-09', emissions: 2.7 },
    { date: '2026-11-10', emissions: 3.5 },
    { date: '2026-11-11', emissions: 2.1 },
  ],
  anomalies: [],
  recommendations: [
    {
      category: 'electricity',
      label: 'Electricity',
      rank: 1,
      currentEmissions: 46.5,
      contributionPercentage: 60,
      potentialSavingsKg: 6.98,
      reductionRatePercentage: 15,
      reason: 'Shift high-demand HVAC and server loads outside peak grid carbon hours and audit standby electronics.',
    },
    {
      category: 'facilities',
      label: 'Facilities',
      rank: 2,
      currentEmissions: 18.2,
      contributionPercentage: 23,
      potentialSavingsKg: 2.73,
      reductionRatePercentage: 15,
      reason: 'Optimize HVAC setpoints by 1.5°C and ensure occupancy sensors control lighting.',
    },
    {
      category: 'food',
      label: 'Food & Diet',
      rank: 3,
      currentEmissions: 5.1,
      contributionPercentage: 7,
      potentialSavingsKg: 1.28,
      reductionRatePercentage: 25,
      reason: 'Incorporate 2 additional plant-forward meals weekly to reduce dietary methane footprint.',
    },
  ],
  activityCount: 6,
  invalidActivityCount: 0,
};

export const demoForecast = {
  forecast: {
    sufficientData: true,
    totalProjectedKg: 79.5,
    totalProjected: 79.5,
    baselineDailyAverage: 2.65,
    trendDirection: 'decreasing',
    daily: Array.from({ length: 30 }, (_, i) => {
      const d = new Date(Date.now() + (i + 1) * 86400000);
      const val = Number((2.65 + Math.sin(i * 0.5) * 0.4).toFixed(2));
      return {
        date: d.toISOString().split('T')[0],
        emissions: val,
        projectedKg: val,
        lowerBound: Number((val * 0.88).toFixed(2)),
        upperBound: Number((val * 1.12).toFixed(2)),
      };
    }),
  },
  dataQuality: {
    isSufficient: true,
    activityCount: 6,
    distinctDays: 5,
  },
  explanation: {
    aiNarrative: 'Statistical 30-day forecast models a slight downward emission trend (-4.2%) due to recent efficiency gains in electricity and transport.',
  },
  outlooks: {
    topFutureContributor: {
      category: 'electricity',
      label: 'Electricity',
      shareOfFuture: 58.4,
    },
  },
  anomalies: [],
};

export const demoDetailedReport = {
  filter: '30d',
  label: 'Last 30 Days',
  startDate: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
  endDate: new Date().toISOString().split('T')[0],
  totals: {
    emissionsKg: 103.35,
    emissionsTonnes: 0.1034,
    activityCount: 6,
    dailyAverageKg: 3.45,
    sectorCount: 6,
  },
  comparison: {
    previousTotalKg: 114.8,
    changeKg: -11.45,
    changePercentage: -9.97,
    trend: 'decreasing',
  },
  categoryBreakdown: [
    { category: 'electricity', label: 'Electricity & Energy', emissionsKg: 60.0, emissionsTonnes: 0.06, percentage: 58.1, color: '#38BDF8', prevEmissionsKg: 68.0 },
    { category: 'facilities', label: 'Facilities & Buildings', emissionsKg: 25.0, emissionsTonnes: 0.025, percentage: 24.2, color: '#8B5CF6', prevEmissionsKg: 28.0 },
    { category: 'transport', label: 'Transportation', emissionsKg: 9.45, emissionsTonnes: 0.0095, percentage: 9.1, color: '#10B981', prevEmissionsKg: 11.2 },
    { category: 'food', label: 'Food & Diet', emissionsKg: 7.5, emissionsTonnes: 0.0075, percentage: 7.3, color: '#F59E0B', prevEmissionsKg: 6.2 },
    { category: 'water', label: 'Water Usage', emissionsKg: 1.4, emissionsTonnes: 0.0014, percentage: 1.4, color: '#06B6D4', prevEmissionsKg: 1.4 },
  ],
  dailyRollup: Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.now() - (29 - i) * 86400000);
    const val = i === 25 ? 25.0 : i === 26 ? 1.4 : i === 27 ? 7.5 : i === 28 ? 9.45 : i === 29 ? 60.0 : 0;
    return {
      date: d.toISOString().split('T')[0],
      label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      emissionsKg: val,
      emissionsTonnes: Number((val / 1000).toFixed(4)),
      activityCount: val > 0 ? 1 : 0,
      byCategory: val > 0 ? { electricity: val } : {},
    };
  }),
  monthlyRollup: [
    { month: '2026-09', label: 'Sep 2026', emissionsKg: 98.4, activityCount: 14 },
    { month: '2026-10', label: 'Oct 2026', emissionsKg: 114.8, activityCount: 18 },
    { month: '2026-11', label: 'Nov 2026', emissionsKg: 103.35, activityCount: 6 },
  ],
  scopeBreakdown: [
    { scope: 'Scope 1', emissionsKg: 9.45, emissionsTonnes: 0.0095, percentage: 9.1 },
    { scope: 'Scope 2', emissionsKg: 60.0, emissionsTonnes: 0.06, percentage: 58.1 },
    { scope: 'Scope 3', emissionsKg: 33.9, emissionsTonnes: 0.0339, percentage: 32.8 },
  ],
  highestActivities: [
    { id: 101, activity_type: 'electricity', label: 'Electricity & Energy', emissionsKg: 60.0, date: '2026-11-10', detailsText: '120 kWh [Grid] [Solar: 30 kWh]' },
    { id: 104, activity_type: 'facilities', label: 'Facilities & Buildings', emissionsKg: 25.0, date: '2026-11-06', detailsText: 'Commercial Building [50 kWh]' },
    { id: 102, activity_type: 'transport', label: 'Transportation', emissionsKg: 9.45, date: '2026-11-09', detailsText: 'Hybrid Car: 45 km (2 pax)' },
    { id: 103, activity_type: 'food', label: 'Food & Diet', emissionsKg: 7.5, date: '2026-11-08', detailsText: 'Vegetarian Meal (3 meals)' },
    { id: 106, activity_type: 'water', label: 'Water Usage', emissionsKg: 1.4, date: '2026-11-07', detailsText: 'Municipal Tap: 4 m³' },
  ],
  narrative: {
    summary: 'Total footprint for the selected 30-day period is 103.35 kg CO₂e (0.1034 tonnes), reflecting a 9.97% reduction compared to the prior equivalent cycle. Grid electricity and facilities HVAC operations represent 82.3% of cumulative emissions.',
    topDriver: 'Electricity (58.1% of total footprint)',
    keyOpportunity: 'Shifting peak cooling loads and expanding rooftop solar self-consumption will yield maximum impact towards SDG-13 compliance.',
  },
};

export const demoRegions = [
  { id: 1, name: 'New York, USA', latitude: 40.71, longitude: -74.01, country: 'USA', admin1: 'New York', timezone: 'America/New_York' },
  { id: 2, name: 'London, UK', latitude: 51.51, longitude: -0.13, country: 'UK', admin1: 'Greater London', timezone: 'Europe/London' },
  { id: 3, name: 'Tokyo, Japan', latitude: 35.68, longitude: 139.69, country: 'Japan', admin1: 'Tokyo', timezone: 'Asia/Tokyo' },
  { id: 4, name: 'Berlin, Germany', latitude: 52.52, longitude: 13.41, country: 'Germany', admin1: 'Berlin', timezone: 'Europe/Berlin' },
];

export const demoRegionalSummary = {
  region: demoRegions[0],
  current: {
    temperature: 18.4,
    relative_humidity: 58.0,
    wind_speed: 14.2,
    us_aqi: 38,
  },
  metrics: [
    { metric: 'temperature', label: 'Current Temperature', latest: 18.4, unit: '°C', anomaly: false, freshness: 'live' },
    { metric: 'precipitation', label: '24h Precipitation', latest: 2.1, unit: 'mm', anomaly: false, freshness: 'live' },
    { metric: 'relative_humidity', label: 'Relative Humidity', latest: 58.0, unit: '%', anomaly: false, freshness: 'live' },
    { metric: 'wind_speed', label: 'Surface Wind Speed', latest: 14.2, unit: 'km/h', anomaly: false, freshness: 'live' },
    { metric: 'pm25', label: 'Ambient PM2.5', latest: 8.4, unit: 'µg/m³', anomaly: false, freshness: 'live' },
  ],
  airQuality: {
    status: 'good',
    stationName: 'Ground Monitor Manhattan-Midtown',
    measurements: [
      { pollutant: 'pm25', parameter: 'pm25', value: 8.4, unit: 'µg/m³', aqiCategory: 'Good' },
      { pollutant: 'pm10', parameter: 'pm10', value: 14.1, unit: 'µg/m³', aqiCategory: 'Good' },
      { pollutant: 'no2', parameter: 'no2', value: 21.3, unit: 'µg/m³', aqiCategory: 'Good' },
    ],
  },
  activeAnomalies: [],
  activeAlerts: [
    {
      id: 201,
      title: 'Seasonal Temperature Variance Within Expected Range',
      severity: 'info',
      status: 'open',
      metric: 'temperature',
      observed_value: 18.4,
      baseline_value: 17.2,
      deviation: 1.2,
      created_at: new Date().toISOString(),
    },
  ],
  insights: [
    {
      title: 'New York Environmental Telemetry Nominal',
      whatChanged: 'Monitored across 5 continuous atmospheric metrics. Baseline variance remains within ±1.5σ of seasonal 1991–2020 normals.',
      evidence: 'Open-Meteo verified observations; PM2.5 measured at 8.4 µg/m³ compliant with WHO 2021 air quality benchmarks.',
      recommendation: 'Ground level telemetry reflects nominal conditions. No mitigation actions required today.',
      severity: 'normal',
      dataSource: 'Open-Meteo & OpenAQ',
      limitations: 'Grid reanalysis interpolation with 0.1° spatial resolution.',
    },
  ],
};

export const demoActionPlan = {
  id: 301,
  title: '7-Day Science-Grounded Mitigation Plan',
  startDate: new Date().toISOString().split('T')[0],
  actions: [
    {
      id: 1,
      title: 'Optimize Workspace Cooling Thermostat',
      category: 'electricity',
      reductionKg: 8.4,
      status: 'in_progress',
      description: 'Adjust cooling setpoint upward by 1.5°C during peak afternoon load to reduce HVAC compressor cycles.',
    },
    {
      id: 2,
      title: 'Consolidate Vehicle Logistics',
      category: 'transport',
      reductionKg: 5.2,
      status: 'planned',
      description: 'Combine regional errands into a single linked route or utilize public rail for journeys exceeding 15 km.',
    },
    {
      id: 3,
      title: 'Zero-Waste Organic Sorting',
      category: 'waste',
      reductionKg: 3.1,
      status: 'completed',
      description: 'Divert 100% of organic kitchen and meal scraps into municipal composting containers.',
    },
  ],
};

