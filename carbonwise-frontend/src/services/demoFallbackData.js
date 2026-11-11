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

export const demoForecast = {
  forecast: Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.now() + (i + 1) * 86400000);
    const dayOfWeek = d.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const base = isWeekend ? 6.2 : 9.8;
    const variation = Math.sin(i * 0.4) * 1.5;
    const val = Number((base + variation).toFixed(2));
    return {
      date: d.toISOString().split('T')[0],
      projectedKg: val,
      lowerBound: Number((val * 0.88).toFixed(2)),
      upperBound: Number((val * 1.12).toFixed(2)),
      modelConfidence: 0.91,
    };
  }),
  totalProjectedKg: 258.4,
  baselineDailyAverage: 8.61,
  horizonDays: 30,
  topFutureContributor: 'electricity',
  topFutureShare: 58.4,
  explanation: 'Your 30-day forecast is driven by operational electricity loads. Mitigating standby equipment and utilizing smart thermostats during non-working hours offers the highest reduction leverage.',
  recommendedMitigations: [
    'Deploy smart power strips on server racks to eliminate phantom standby draw.',
    'Increase cooling thermostat setpoint by 1.5°C during afternoon utility peak pricing.',
    'Maintain high public transit and carpool share for commutes over 20 km.',
  ],
};

export const demoRegions = [
  { id: 1, name: 'New York, USA', latitude: 40.71, longitude: -74.01, country: 'USA', admin1: 'New York', timezone: 'America/New_York' },
  { id: 2, name: 'London, UK', latitude: 51.51, longitude: -0.13, country: 'UK', admin1: 'Greater London', timezone: 'Europe/London' },
  { id: 3, name: 'Tokyo, Japan', latitude: 35.68, longitude: 139.69, country: 'Japan', admin1: 'Tokyo', timezone: 'Asia/Tokyo' },
  { id: 4, name: 'Berlin, Germany', latitude: 52.52, longitude: 13.41, country: 'Germany', admin1: 'Berlin', timezone: 'Europe/Berlin' },
];

export const demoRegionalSummary = {
  region: demoRegions[0],
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

