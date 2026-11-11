const db = require('../config/db');

// Unit Conversion Coefficients
const CONVERSIONS = {
  // Mass
  kg_to_tonnes: (v) => v / 1000,
  tonnes_to_kg: (v) => v * 1000,
  lbs_to_kg: (v) => v * 0.45359237,
  kg_to_lbs: (v) => v / 0.45359237,

  // Distance
  miles_to_km: (v) => v * 1.609344,
  km_to_miles: (v) => v / 1.609344,

  // Volume
  m3_to_liters: (v) => v * 1000,
  liters_to_m3: (v) => v / 1000,
  gallons_to_liters: (v) => v * 3.785411784,
  liters_to_gallons: (v) => v / 3.785411784,

  // Energy
  mwh_to_kwh: (v) => v * 1000,
  kwh_to_mwh: (v) => v / 1000,
  mj_to_kwh: (v) => v / 3.6,
  kwh_to_mj: (v) => v * 3.6,
};

const round = (val, d = 2) => Math.round((val + Number.EPSILON) * 10 ** d) / 10 ** d;

/**
 * Standard Scientific Emission Factors Registry
 * All factors are sourced from peer-reviewed or government standards:
 * - DEFRA (UK Department for Environment, Food & Rural Affairs) 2024
 * - IPCC (Intergovernmental Panel on Climate Change) 6th Assessment Report (AR6)
 * - US EPA eGRID 2024
 * - IEA (International Energy Agency) 2023
 * - Poore & Nemecek (Science 2018 / Our World in Data)
 */
const SCIENTIFIC_EMISSION_FACTORS = [
  // --- A. FOOD AND DIET (Scope 3) ---
  {
    category: 'food',
    activityKey: 'vegan',
    name: '100% Plant-Based / Vegan Meal',
    unit: 'meal',
    factorKgCo2e: 0.90,
    scope: 'Scope 3',
    source: 'Poore & Nemecek (Science 2018 / Our World in Data)',
    region: 'Global',
    version: '2024.1',
    methodology: 'Cradle-to-plate lifecycle analysis of pulses, grains, fruits and vegetables',
    reductionRate: 0.25,
  },
  {
    category: 'food',
    activityKey: 'vegetarian',
    name: 'Vegetarian Meal (with dairy/eggs)',
    unit: 'meal',
    factorKgCo2e: 1.50,
    scope: 'Scope 3',
    source: 'Poore & Nemecek (Science 2018) / DEFRA 2024',
    region: 'Global',
    version: '2024.1',
    methodology: 'Lifecycle GHG emissions of vegetarian diet including dairy and egg products',
    reductionRate: 0.20,
  },
  {
    category: 'food',
    activityKey: 'dairy',
    name: 'Dairy Products & Cheese',
    unit: 'serving',
    factorKgCo2e: 1.90,
    scope: 'Scope 3',
    source: 'FAO / Poore & Nemecek (Science 2018)',
    region: 'Global',
    version: '2024.1',
    methodology: 'Bovine milk and cheese production life cycle assessment',
    reductionRate: 0.15,
  },
  {
    category: 'food',
    activityKey: 'seafood',
    name: 'Fish & Seafood Meal',
    unit: 'meal',
    factorKgCo2e: 2.80,
    scope: 'Scope 3',
    source: 'Poore & Nemecek (Science 2018)',
    region: 'Global',
    version: '2024.1',
    methodology: 'Wild catch fuel consumption and aquaculture feed life cycle',
    reductionRate: 0.15,
  },
  {
    category: 'food',
    activityKey: 'meat_average',
    name: 'Average Non-Veg Meal (Poultry/Pork/Mixed)',
    unit: 'meal',
    factorKgCo2e: 3.50,
    scope: 'Scope 3',
    source: 'UK DEFRA 2024 / IPCC Tier 1 Average',
    region: 'Global',
    version: '2024.1',
    methodology: 'Weighted average of monogastric poultry and swine production systems',
    reductionRate: 0.25,
  },
  {
    category: 'food',
    activityKey: 'meat_high',
    name: 'High-Carbon Meat Meal (Beef / Lamb)',
    unit: 'meal',
    factorKgCo2e: 7.20,
    scope: 'Scope 3',
    source: 'Poore & Nemecek (Science 2018 / Beef LCA)',
    region: 'Global',
    version: '2024.1',
    methodology: 'Ruminant enteric fermentation, pasture land-use change, and manure management',
    reductionRate: 0.35,
  },
  {
    category: 'food',
    activityKey: 'food_waste',
    name: 'Discarded Food Waste',
    unit: 'kg',
    factorKgCo2e: 2.50,
    scope: 'Scope 3',
    source: 'IPCC 2019 Refinement on Solid Waste',
    region: 'Global',
    version: '2024.1',
    methodology: 'Anaerobic decomposition and fugitive methane release from organic waste in landfills',
    reductionRate: 0.30,
  },

  // --- B. ELECTRICITY AND ENERGY (Scope 2 / Scope 1) ---
  {
    category: 'electricity',
    activityKey: 'grid',
    name: 'National Electricity Grid Average',
    unit: 'kWh',
    factorKgCo2e: 0.50,
    scope: 'Scope 2',
    source: 'IEA 2023 World Energy Outlook Grid Average',
    region: 'Global',
    version: '2024.1',
    methodology: 'Location-based grid generation emission factor including transmission and distribution losses',
    reductionRate: 0.15,
  },
  {
    category: 'electricity',
    activityKey: 'grid_us',
    name: 'US Electricity Grid Average',
    unit: 'kWh',
    factorKgCo2e: 0.386,
    scope: 'Scope 2',
    source: 'US EPA eGRID 2024 (Subregion Average)',
    region: 'US',
    version: '2024.1',
    methodology: 'EPA location-based national generation emission factor',
    reductionRate: 0.15,
  },
  {
    category: 'electricity',
    activityKey: 'grid_eu',
    name: 'European Union Electricity Grid Average',
    unit: 'kWh',
    factorKgCo2e: 0.255,
    scope: 'Scope 2',
    source: 'European Environment Agency (EEA 2024)',
    region: 'EU',
    version: '2024.1',
    methodology: 'EU-27 average greenhouse gas emission intensity of electricity generation',
    reductionRate: 0.15,
  },
  {
    category: 'electricity',
    activityKey: 'grid_in',
    name: 'India Central Electricity Authority Grid Average',
    unit: 'kWh',
    factorKgCo2e: 0.716,
    scope: 'Scope 2',
    source: 'CEA India CO2 Baseline Database v19 (2023)',
    region: 'IN',
    version: '2024.1',
    methodology: 'Weighted average specific emissions of Indian regional power grids',
    reductionRate: 0.20,
  },
  {
    category: 'electricity',
    activityKey: 'grid_uk',
    name: 'UK Electricity Grid Average',
    unit: 'kWh',
    factorKgCo2e: 0.207,
    scope: 'Scope 2',
    source: 'UK DEFRA 2024 Greenhouse Gas Reporting Factors',
    region: 'UK',
    version: '2024.1',
    methodology: 'UK national grid generation factor including supply chain losses',
    reductionRate: 0.15,
  },
  {
    category: 'electricity',
    activityKey: 'coal',
    name: 'Coal-Fired Electricity Generation',
    unit: 'kWh',
    factorKgCo2e: 0.90,
    scope: 'Scope 2',
    source: 'IPCC AR6 WGIII Chapter 6 (Energy Systems)',
    region: 'Global',
    version: '2024.1',
    methodology: 'Direct combustion emissions of sub-bituminous coal power plants',
    reductionRate: 0.40,
  },
  {
    category: 'electricity',
    activityKey: 'natural_gas',
    name: 'Natural Gas Generation (Combined Cycle)',
    unit: 'kWh',
    factorKgCo2e: 0.45,
    scope: 'Scope 2',
    source: 'IPCC AR6 WGIII Chapter 6',
    region: 'Global',
    version: '2024.1',
    methodology: 'Combustion and fugitive upstream methane emissions of NGCC power generation',
    reductionRate: 0.20,
  },
  {
    category: 'electricity',
    activityKey: 'renewable',
    name: '100% Certified Renewable Tariff / Green Power',
    unit: 'kWh',
    factorKgCo2e: 0.02,
    scope: 'Scope 2',
    source: 'NREL Life Cycle Assessment Harmonization (Wind/Hydro)',
    region: 'Global',
    version: '2024.1',
    methodology: 'Embodied life-cycle manufacturing and maintenance of renewable infrastructure',
    reductionRate: 0.05,
  },
  {
    category: 'electricity',
    activityKey: 'solar',
    name: 'On-Site Rooftop Solar Self-Consumption',
    unit: 'kWh',
    factorKgCo2e: 0.02,
    scope: 'Scope 2',
    source: 'NREL Life Cycle Assessment Harmonization (PV)',
    region: 'Global',
    version: '2024.1',
    methodology: 'Embodied life-cycle manufacturing of silicon photovoltaic panels',
    reductionRate: 0.05,
  },
  {
    category: 'electricity',
    activityKey: 'diesel_generator',
    name: 'On-Site Diesel Generator Fuel Consumption',
    unit: 'L',
    factorKgCo2e: 2.68,
    scope: 'Scope 1',
    source: 'UK DEFRA 2024 Liquid Fuels',
    region: 'Global',
    version: '2024.1',
    methodology: 'Direct stationary combustion of 100% mineral diesel fuel',
    reductionRate: 0.30,
  },

  // --- C. TRANSPORTATION (Scope 1 / Scope 3) ---
  {
    category: 'transport',
    activityKey: 'car_petrol',
    name: 'Petrol / Gasoline Passenger Car',
    unit: 'km',
    factorKgCo2e: 0.192,
    scope: 'Scope 1',
    source: 'UK DEFRA 2024 Passenger Vehicles (Average Petrol)',
    region: 'Global',
    version: '2024.1',
    methodology: 'Direct tailpipe fuel combustion plus upstream fuel supply emissions',
    reductionRate: 0.20,
  },
  {
    category: 'transport',
    activityKey: 'car_diesel',
    name: 'Diesel Passenger Car',
    unit: 'km',
    factorKgCo2e: 0.171,
    scope: 'Scope 1',
    source: 'UK DEFRA 2024 Passenger Vehicles (Average Diesel)',
    region: 'Global',
    version: '2024.1',
    methodology: 'Direct tailpipe diesel combustion emissions for average passenger car',
    reductionRate: 0.20,
  },
  {
    category: 'transport',
    activityKey: 'car_hybrid',
    name: 'Hybrid Electric Passenger Car',
    unit: 'km',
    factorKgCo2e: 0.109,
    scope: 'Scope 1',
    source: 'UK DEFRA 2024 Passenger Vehicles (Hybrid)',
    region: 'Global',
    version: '2024.1',
    methodology: 'Combined internal combustion and regenerative braking hybrid cycle',
    reductionRate: 0.15,
  },
  {
    category: 'transport',
    activityKey: 'car_ev',
    name: 'Battery Electric Vehicle (EV)',
    unit: 'km',
    factorKgCo2e: 0.053,
    scope: 'Scope 2',
    source: 'IEA Global EV Outlook 2023 / DEFRA 2024',
    region: 'Global',
    version: '2024.1',
    methodology: 'Grid charging electricity consumption (approx. 0.18 kWh/km at world average grid)',
    reductionRate: 0.10,
  },
  {
    category: 'transport',
    activityKey: 'motorbike',
    name: 'Motorcycle / Scooter',
    unit: 'km',
    factorKgCo2e: 0.103,
    scope: 'Scope 1',
    source: 'UK DEFRA 2024 Motorbikes (Medium)',
    region: 'Global',
    version: '2024.1',
    methodology: 'Tailpipe emissions for two-wheeled motor vehicles between 125cc and 500cc',
    reductionRate: 0.15,
  },
  {
    category: 'transport',
    activityKey: 'bus',
    name: 'Public Transit Bus',
    unit: 'km',
    factorKgCo2e: 0.082,
    scope: 'Scope 3',
    source: 'UK DEFRA 2024 Public Passenger Transport (Local Bus)',
    region: 'Global',
    version: '2024.1',
    methodology: 'Average passenger-kilometer allocation for municipal transit fleets',
    reductionRate: 0.10,
  },
  {
    category: 'transport',
    activityKey: 'train',
    name: 'Commuter / Passenger Train',
    unit: 'km',
    factorKgCo2e: 0.035,
    scope: 'Scope 3',
    source: 'UK DEFRA 2024 Public Passenger Transport (National Rail)',
    region: 'Global',
    version: '2024.1',
    methodology: 'Electric and diesel passenger train operations allocated per passenger-km',
    reductionRate: 0.05,
  },
  {
    category: 'transport',
    activityKey: 'flight_short_haul',
    name: 'Flight - Economy Class (< 1,000 km)',
    unit: 'km',
    factorKgCo2e: 0.255,
    scope: 'Scope 3',
    source: 'UK DEFRA 2024 Domestic / Short-Haul Aviation (incl. RF)',
    region: 'Global',
    version: '2024.1',
    methodology: 'Jet fuel combustion, high-altitude radiative forcing (RF index 1.9), and landing/takeoff cycles',
    reductionRate: 0.20,
  },
  {
    category: 'transport',
    activityKey: 'flight_long_haul',
    name: 'Flight - Economy Class (> 1,000 km)',
    unit: 'km',
    factorKgCo2e: 0.195,
    scope: 'Scope 3',
    source: 'UK DEFRA 2024 Long-Haul Aviation (Economy, incl. RF)',
    region: 'Global',
    version: '2024.1',
    methodology: 'Long-distance cruise efficiency allocated per passenger-km with radiative forcing',
    reductionRate: 0.20,
  },
  {
    category: 'transport',
    activityKey: 'flight_business',
    name: 'Flight - Business Class',
    unit: 'km',
    factorKgCo2e: 0.380,
    scope: 'Scope 3',
    source: 'UK DEFRA 2024 Passenger Flights (Business Class)',
    region: 'Global',
    version: '2024.1',
    methodology: 'Aviation emissions adjusted for cabin area occupancy multiplier (1.9x economy)',
    reductionRate: 0.25,
  },
  {
    category: 'transport',
    activityKey: 'walking_cycling',
    name: 'Active Mobility (Walking / Cycling)',
    unit: 'km',
    factorKgCo2e: 0.00,
    scope: 'Scope 1',
    source: 'GHG Protocol Active Mobility Zero-Direct Standard',
    region: 'Global',
    version: '2024.1',
    methodology: 'Zero direct tailpipe emissions from human-powered locomotion',
    reductionRate: 0.00,
  },

  // --- D. WATER USAGE (Scope 3 / Scope 1) ---
  {
    category: 'water',
    activityKey: 'tap_cold',
    name: 'Municipal Cold Tap Water Supply',
    unit: 'm3',
    factorKgCo2e: 0.35,
    scope: 'Scope 3',
    source: 'UK DEFRA 2024 Water Supply & Wastewater Treatment',
    region: 'Global',
    version: '2024.1',
    methodology: 'Pumping, purification, filtration and municipal distribution energy intensity (0.35 kg/m³)',
    reductionRate: 0.15,
  },
  {
    category: 'water',
    activityKey: 'tap_hot',
    name: 'Domestic Hot Water (including heating energy)',
    unit: 'm3',
    factorKgCo2e: 5.80,
    scope: 'Scope 2',
    source: 'UK DEFRA 2024 / US DOE Domestic Water Heating',
    region: 'Global',
    version: '2024.1',
    methodology: 'Water supply plus thermal energy required to elevate water temperature by 40°C (approx. 5.8 kg CO₂e/m³)',
    reductionRate: 0.20,
  },
  {
    category: 'water',
    activityKey: 'bottled',
    name: 'Packaged / Bottled Drinking Water',
    unit: 'm3',
    factorKgCo2e: 160.0,
    scope: 'Scope 3',
    source: 'Ecoinvent 3.9 Packaged Water Life Cycle Assessment',
    region: 'Global',
    version: '2024.1',
    methodology: 'PET plastic bottle molding, purification, packaging, and refrigerated road transport',
    reductionRate: 0.35,
  },
  {
    category: 'water',
    activityKey: 'groundwater',
    name: 'Borewell / Pumped Groundwater',
    unit: 'm3',
    factorKgCo2e: 0.60,
    scope: 'Scope 2',
    source: 'FAO Energy Intensity of Groundwater Extraction',
    region: 'Global',
    version: '2024.1',
    methodology: 'Submersible electrical pump energy consumption per cubic meter of deep water lift',
    reductionRate: 0.15,
  },
  {
    category: 'water',
    activityKey: 'recycled',
    name: 'Rainwater Harvested / Graywater Reuse',
    unit: 'm3',
    factorKgCo2e: 0.10,
    scope: 'Scope 3',
    source: 'WateReuse Association LCA Standards',
    region: 'Global',
    version: '2024.1',
    methodology: 'Low-energy gravity filtration and disinfection for non-potable on-site reuse',
    reductionRate: 0.10,
  },

  // --- E. WASTE MANAGEMENT (Scope 3) ---
  {
    category: 'waste',
    activityKey: 'landfill_mixed',
    name: 'Mixed Solid Waste (Landfill Disposal)',
    unit: 'kg',
    factorKgCo2e: 0.58,
    scope: 'Scope 3',
    source: 'UK DEFRA 2024 Waste Disposal (Commercial / Municipal Mixed)',
    region: 'Global',
    version: '2024.1',
    methodology: 'Anaerobic decay of mixed biodegradable waste in managed landfills without methane capture',
    reductionRate: 0.25,
  },
  {
    category: 'waste',
    activityKey: 'landfill_organic',
    name: 'Organic / Food Waste (Landfill Disposal)',
    unit: 'kg',
    factorKgCo2e: 0.95,
    scope: 'Scope 3',
    source: 'IPCC 2019 Refinement on Waste / Methane GWP-100',
    region: 'Global',
    version: '2024.1',
    methodology: 'High-methane fugitive emission factor from unmanaged anaerobic landfilling of food scraps',
    reductionRate: 0.35,
  },
  {
    category: 'waste',
    activityKey: 'landfill_plastic',
    name: 'Plastic Waste (Direct Landfill)',
    unit: 'kg',
    factorKgCo2e: 0.04,
    scope: 'Scope 3',
    source: 'UK DEFRA 2024 Waste Disposal (Plastics)',
    region: 'Global',
    version: '2024.1',
    methodology: 'Direct handling and transport emissions of non-biodegradable inert plastic disposal',
    reductionRate: 0.25,
  },
  {
    category: 'waste',
    activityKey: 'recycled_plastic',
    name: 'Plastic Waste (Recycling Facility)',
    unit: 'kg',
    factorKgCo2e: 0.05,
    scope: 'Scope 3',
    source: 'UK DEFRA 2024 Waste Recycling (Plastics)',
    region: 'Global',
    version: '2024.1',
    methodology: 'Collection, sorting, cleaning, and mechanical shredding into secondary polymer pellets',
    reductionRate: 0.10,
  },
  {
    category: 'waste',
    activityKey: 'recycled_paper',
    name: 'Paper & Cardboard (Recycling Facility)',
    unit: 'kg',
    factorKgCo2e: 0.04,
    scope: 'Scope 3',
    source: 'UK DEFRA 2024 Waste Recycling (Paper & Cardboard)',
    region: 'Global',
    version: '2024.1',
    methodology: 'Pulping, de-inking, and reprocessing of secondary fiber',
    reductionRate: 0.10,
  },
  {
    category: 'waste',
    activityKey: 'recycled_metal',
    name: 'Metal & Aluminum (Recycling Facility)',
    unit: 'kg',
    factorKgCo2e: 0.06,
    scope: 'Scope 3',
    source: 'UK DEFRA 2024 Waste Recycling (Scrap Metal)',
    region: 'Global',
    version: '2024.1',
    methodology: 'Collection, magnetic separation, and electric arc secondary smelting',
    reductionRate: 0.10,
  },
  {
    category: 'waste',
    activityKey: 'composted_organic',
    name: 'Composted Organic Scraps',
    unit: 'kg',
    factorKgCo2e: 0.10,
    scope: 'Scope 3',
    source: 'UK DEFRA 2024 Composting Standards',
    region: 'Global',
    version: '2024.1',
    methodology: 'Aerobic composting with active mechanical aeration preventing methane formation',
    reductionRate: 0.10,
  },
  {
    category: 'waste',
    activityKey: 'incineration',
    name: 'Waste-to-Energy Incineration',
    unit: 'kg',
    factorKgCo2e: 0.40,
    scope: 'Scope 3',
    source: 'UK DEFRA 2024 Waste Disposal (Energy Recovery)',
    region: 'Global',
    version: '2024.1',
    methodology: 'Thermal oxidation of municipal waste with partial electrical energy recovery offset',
    reductionRate: 0.15,
  },

  // --- F. FACILITIES AND BUILDINGS (Scope 1 / Scope 2) ---
  {
    category: 'facilities',
    activityKey: 'building_electricity',
    name: 'Commercial Building Electricity',
    unit: 'kWh',
    factorKgCo2e: 0.50,
    scope: 'Scope 2',
    source: 'IEA 2023 Commercial Building Energy Intensity',
    region: 'Global',
    version: '2024.1',
    methodology: 'HVAC, lighting, and server energy consumption calculated via national electricity grid factor',
    reductionRate: 0.15,
  },
  {
    category: 'facilities',
    activityKey: 'area_benchmark',
    name: 'Facility Floor Area Energy Benchmark',
    unit: 'm2_day',
    factorKgCo2e: 0.08,
    scope: 'Scope 1/2',
    source: 'ASHRAE 90.1 / CIBSE Energy Benchmark TM46',
    region: 'Global',
    version: '2024.1',
    methodology: 'Typical conditioned commercial office energy benchmark per square meter per operating day',
    reductionRate: 0.15,
  },
  {
    category: 'facilities',
    activityKey: 'refrigerant_r410a',
    name: 'AC Refrigerant Fugitive Leakage (R-410A)',
    unit: 'kg',
    factorKgCo2e: 2088.0,
    scope: 'Scope 1',
    source: 'IPCC 6th Assessment Report (AR6) GWP-100',
    region: 'Global',
    version: '2024.1',
    methodology: 'Direct high global warming potential fluorinated gas leakage from chiller and split AC systems',
    reductionRate: 0.50,
  },

  // --- G. OTHER EMISSION SOURCES (Scope 3) ---
  {
    category: 'other',
    activityKey: 'electronics_laptop',
    name: 'Laptop Computer (Embodied Carbon)',
    unit: 'unit',
    factorKgCo2e: 210.0,
    scope: 'Scope 3',
    source: 'Dell / Apple Product Environmental Carbon Reports',
    region: 'Global',
    version: '2024.1',
    methodology: 'Cradle-to-gate semiconductor manufacturing, PCB assembly, battery chemistry and transport',
    reductionRate: 0.15,
  },
  {
    category: 'other',
    activityKey: 'electronics_phone',
    name: 'Smartphone (Embodied Carbon)',
    unit: 'unit',
    factorKgCo2e: 70.0,
    scope: 'Scope 3',
    source: 'Apple / Fairphone Environmental Life Cycle Reports',
    region: 'Global',
    version: '2024.1',
    methodology: 'Silicon wafer fabrication, aluminum chassis CNC milling, display module and lithium battery',
    reductionRate: 0.15,
  },
  {
    category: 'other',
    activityKey: 'electronics_monitor',
    name: 'External 27" Monitor / Display',
    unit: 'unit',
    factorKgCo2e: 150.0,
    scope: 'Scope 3',
    source: 'HP / Dell Product Carbon Footprint Reports',
    region: 'Global',
    version: '2024.1',
    methodology: 'IPS panel glass fabrication, LED backlighting array and power supply electronics',
    reductionRate: 0.15,
  },
  {
    category: 'other',
    activityKey: 'clothing_apparel',
    name: 'Apparel / Clothing Garment',
    unit: 'item',
    factorKgCo2e: 12.0,
    scope: 'Scope 3',
    source: 'WRAP UK Sustainable Clothing Action Plan',
    region: 'Global',
    version: '2024.1',
    methodology: 'Agricultural fiber cultivation, synthetic polyester yarn extrusion, dyeing and finishing',
    reductionRate: 0.15,
  },
  {
    category: 'other',
    activityKey: 'furniture',
    name: 'Office Furniture (Desk / Chair)',
    unit: 'unit',
    factorKgCo2e: 45.0,
    scope: 'Scope 3',
    source: 'FIRA (Furniture Industry Research Association UK)',
    region: 'Global',
    version: '2024.1',
    methodology: 'Steel frame stamping, engineered particle board, foam upholstery and logistics',
    reductionRate: 0.15,
  },
  {
    category: 'other',
    activityKey: 'paper_goods',
    name: 'Office Paper & Cardboard Stationery',
    unit: 'kg',
    factorKgCo2e: 1.20,
    scope: 'Scope 3',
    source: 'UK DEFRA 2024 Material Production (Paper)',
    region: 'Global',
    version: '2024.1',
    methodology: 'Virgin wood pulp chemical processing, thermal drying and mill transport',
    reductionRate: 0.10,
  },
  {
    category: 'other',
    activityKey: 'general_goods_spend',
    name: 'Procured Goods & Services by Expenditure',
    unit: '$',
    factorKgCo2e: 0.45,
    scope: 'Scope 3',
    source: 'Carnegie Mellon EEIO / US EPA USEEIO v2.0',
    region: 'Global',
    version: '2024.1',
    methodology: 'Macroeconomic input-output carbon intensity per dollar of corporate spend',
    reductionRate: 0.15,
  },
];

/**
 * Seed scientific emission factors into PostgreSQL
 */
const seedEmissionFactors = async () => {
  try {
    for (const item of SCIENTIFIC_EMISSION_FACTORS) {
      await db.query(
        `INSERT INTO emission_factors
          (category, activity_key, name, unit, factor_kg_co2e, scope, source, region, version, methodology, reduction_rate, is_estimate)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, TRUE)
         ON CONFLICT (category, activity_key, region, version)
         DO UPDATE SET
           factor_kg_co2e = EXCLUDED.factor_kg_co2e,
           source = EXCLUDED.source,
           methodology = EXCLUDED.methodology,
           updated_at = CURRENT_TIMESTAMP`,
        [
          item.category,
          item.activityKey,
          item.name,
          item.unit,
          item.factorKgCo2e,
          item.scope,
          item.source,
          item.region,
          item.version,
          item.methodology,
          item.reductionRate,
        ]
      );
    }
  } catch (err) {
    console.warn('[emissionEngine] Seed emission factors warning:', err.message);
  }
};

/**
 * Normalizes category names
 */
const CATEGORY_ALIASES = {
  transportation: 'transport',
  driving: 'transport',
  transit: 'transport',
  travel: 'transport',
  flight: 'transport',
  electricity: 'electricity',
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
  shopping: 'other',
  purchases: 'other',
};

const normalizeCategory = (cat) => {
  if (!cat || typeof cat !== 'string') return '';
  const clean = cat.trim().toLowerCase();
  return CATEGORY_ALIASES[clean] || clean;
};

/**
 * Finds matching factor in registry
 */
const findFactor = (category, activityKey, region = 'Global') => {
  const normCat = normalizeCategory(category);
  const key = activityKey ? activityKey.trim().toLowerCase() : '';

  // 1. Try exact match on category + activityKey + region
  let match = SCIENTIFIC_EMISSION_FACTORS.find(
    (f) => f.category === normCat && f.activityKey === key && f.region.toLowerCase() === region.toLowerCase()
  );

  // 2. Fall back to Global region
  if (!match) {
    match = SCIENTIFIC_EMISSION_FACTORS.find(
      (f) => f.category === normCat && f.activityKey === key
    );
  }

  // 3. Fall back to category default
  if (!match) {
    match = SCIENTIFIC_EMISSION_FACTORS.find((f) => f.category === normCat);
  }

  return match || null;
};

/**
 * Converts arbitrary units to the factor's standard unit
 */
const convertUnitQuantity = (quantity, fromUnit, targetUnit) => {
  const q = Number(quantity);
  if (!Number.isFinite(q)) return 0;
  if (!fromUnit || !targetUnit || fromUnit.toLowerCase() === targetUnit.toLowerCase()) {
    return q;
  }

  const from = fromUnit.toLowerCase();
  const to = targetUnit.toLowerCase();

  // Volume
  if ((from === 'liters' || from === 'l') && (to === 'm3' || to === 'cubic_meters')) {
    return CONVERSIONS.liters_to_m3(q);
  }
  if ((from === 'm3' || from === 'cubic_meters') && (to === 'liters' || to === 'l')) {
    return CONVERSIONS.m3_to_liters(q);
  }
  if (from === 'gallons' && (to === 'liters' || to === 'l')) {
    return CONVERSIONS.gallons_to_liters(q);
  }
  if (from === 'gallons' && (to === 'm3' || to === 'cubic_meters')) {
    return CONVERSIONS.liters_to_m3(CONVERSIONS.gallons_to_liters(q));
  }

  // Distance
  if (from === 'miles' && to === 'km') {
    return CONVERSIONS.miles_to_km(q);
  }
  if (from === 'km' && to === 'miles') {
    return CONVERSIONS.km_to_miles(q);
  }

  // Mass
  if (from === 'tonnes' && to === 'kg') {
    return CONVERSIONS.tonnes_to_kg(q);
  }
  if (from === 'kg' && to === 'tonnes') {
    return CONVERSIONS.kg_to_tonnes(q);
  }
  if (from === 'lbs' && to === 'kg') {
    return CONVERSIONS.lbs_to_kg(q);
  }

  // Energy
  if (from === 'mwh' && to === 'kwh') {
    return CONVERSIONS.mwh_to_kwh(q);
  }
  if (from === 'mj' && to === 'kwh') {
    return CONVERSIONS.mj_to_kwh(q);
  }

  return q;
};

/**
 * Core Calculation Engine
 * Calculates emissions in both kg CO2e and tonnes CO2e.
 * Avoids double-counting, handles conversions, and documents assumptions.
 */
const calculateEmissions = ({
  category: rawCategory,
  subType,
  quantity,
  unit,
  region = 'Global',
  details = {},
}) => {
  const category = normalizeCategory(rawCategory);

  // Validate non-negative quantities across all payload variants
  const numericFields = ['value', 'kwh', 'km', 'liters', 'quantity', 'foodWasteKg', 'generatorFuelLiters', 'facilityKwh', 'spendAmount'];
  for (const field of numericFields) {
    if (details[field] !== undefined && details[field] !== null) {
      const num = Number(details[field]);
      if (Number.isFinite(num) && num < 0) {
        const error = new Error(`Activity ${field} must be a non-negative number.`);
        error.statusCode = 400;
        throw error;
      }
    }
  }

  // If simple numeric value is passed directly in details (legacy support)
  const isSimplePayload =
    details.value !== undefined &&
    !details.mealType &&
    !details.transportMode &&
    !details.energySource &&
    !details.waterSource &&
    !details.wasteType &&
    !details.facilityType &&
    !details.sourceType;

  if (isSimplePayload && !subType) {
    const defaultFactor = findFactor(category, 'default', region);
    const val = Number(details.value);
    if (!Number.isFinite(val) || val < 0) {
      const error = new Error('Activity category and non-negative numeric value are required.');
      error.statusCode = 400;
      throw error;
    }
    const rate = defaultFactor ? defaultFactor.factorKgCo2e : 0.50;
    const kg = round(val * rate);
    return {
      emissionsKg: kg,
      emissionsTonnes: round(kg / 1000, 4),
      factorUsed: {
        key: defaultFactor?.activityKey || category,
        name: defaultFactor?.name || `${category} standard factor`,
        factorKgCo2e: rate,
        unit: defaultFactor?.unit || 'units',
        scope: defaultFactor?.scope || 'Scope 3',
        source: defaultFactor?.source || 'GHG Protocol / DEFRA 2024',
        region: defaultFactor?.region || 'Global',
        version: defaultFactor?.version || '2024.1',
      },
      quantity: val,
      unit: defaultFactor?.unit || 'units',
      scope: defaultFactor?.scope || 'Scope 3',
      methodology: defaultFactor?.methodology || 'Activity data multiplied by standard emission factor',
      assumptions: 'Single activity parameter; standard global average assumed.',
      isEstimate: true,
    };
  }

  // Multi-Sector Rich Calculations
  let key = subType;
  let rawQty = quantity;
  let rawUnit = unit;
  let assumptions = [];
  let calculatedKg = 0;
  let matchedFactor = null;

  switch (category) {
    case 'food': {
      key = details.mealType || subType || 'meat_average';
      matchedFactor = findFactor('food', key, region);
      const meals = Number(details.quantity ?? rawQty ?? details.value ?? 1);
      if (!Number.isFinite(meals) || meals < 0) throw new Error('Meal quantity must be non-negative.');

      calculatedKg = meals * matchedFactor.factorKgCo2e;
      rawUnit = matchedFactor.unit;
      rawQty = meals;
      assumptions.push(`${meals} ${matchedFactor.name} meal(s) at ${matchedFactor.factorKgCo2e} kg CO₂e/meal.`);

      const wasteKg = Number(details.foodWasteKg || 0);
      if (wasteKg > 0) {
        const wasteFactor = findFactor('food', 'food_waste', region);
        const wasteEmissions = wasteKg * (wasteFactor ? wasteFactor.factorKgCo2e : 2.50);
        calculatedKg += wasteEmissions;
        assumptions.push(`Includes ${wasteKg} kg food waste at 2.50 kg CO₂e/kg (IPCC landfill methane release).`);
      }
      break;
    }

    case 'electricity': {
      const source = details.energySource || subType || 'grid';
      key = source;

      if (source === 'diesel_generator') {
        matchedFactor = findFactor('electricity', 'diesel_generator', region);
        const liters = Number(details.generatorFuelLiters ?? rawQty ?? (Number(details.kwh || details.value || 0) / 3));
        calculatedKg = liters * matchedFactor.factorKgCo2e;
        rawUnit = 'L';
        rawQty = liters;
        assumptions.push(`Stationary diesel generator fuel combustion: ${liters} liters.`);
      } else {
        matchedFactor = findFactor('electricity', key, region) || findFactor('electricity', 'grid', region);
        const kwh = Number(details.kwh ?? rawQty ?? details.value ?? 0);
        const solarOffset = Math.max(0, Number(details.solarGenerationKwh || 0));
        // Avoid double-counting: subtract on-site solar generation from grid import
        const netKwh = Math.max(0, kwh - solarOffset);
        calculatedKg = (netKwh * matchedFactor.factorKgCo2e) + (solarOffset * 0.02);
        rawUnit = 'kWh';
        rawQty = kwh;

        if (solarOffset > 0) {
          assumptions.push(`Deducted ${solarOffset} kWh on-site solar self-consumption from gross grid draw to avoid double-counting.`);
        }
        assumptions.push(`Net grid consumption ${netKwh} kWh at ${matchedFactor.factorKgCo2e} kg CO₂e/kWh (${matchedFactor.source}).`);
      }
      break;
    }

    case 'transport': {
      const mode = details.transportMode || subType || (rawCategory === 'flight' ? 'flight_short_haul' : 'car_petrol');
      key = mode;
      matchedFactor = findFactor('transport', key, region) || findFactor('transport', 'car_petrol', region);

      let distance = Number(details.distanceKm ?? rawQty ?? details.value ?? 0);
      if (rawUnit === 'miles') {
        distance = CONVERSIONS.miles_to_km(distance);
        assumptions.push(`Converted input from miles to ${round(distance, 1)} km.`);
      }

      const passengers = Math.max(1, Number(details.passengers || 1));
      let factorRate = matchedFactor.factorKgCo2e;

      // Avoid double-counting: Allocate vehicle footprint proportionately among passengers
      if (mode.startsWith('car_')) {
        factorRate = factorRate / passengers;
        assumptions.push(`Shared vehicle trip: emission divided across ${passengers} passenger(s) (${round(factorRate, 4)} kg CO₂e/passenger-km).`);
      } else {
        assumptions.push(`Public/Shared transport factor: ${factorRate} kg CO₂e/passenger-km.`);
      }

      calculatedKg = distance * factorRate;
      rawUnit = 'km';
      rawQty = distance;
      break;
    }

    case 'water': {
      const source = details.waterSource || subType || (details.isHotWater ? 'tap_hot' : 'tap_cold');
      key = source;
      matchedFactor = findFactor('water', key, region) || findFactor('water', 'tap_cold', region);

      let vol = Number(details.volume ?? rawQty ?? details.value ?? 0);
      const inputUnit = details.unit || rawUnit || 'liters';

      // Convert to m3 (the factor unit)
      let m3 = vol;
      if (inputUnit === 'liters' || inputUnit === 'L') {
        m3 = CONVERSIONS.liters_to_m3(vol);
        assumptions.push(`Converted ${vol} Liters to ${round(m3, 3)} m³.`);
      } else if (inputUnit === 'gallons') {
        const lit = CONVERSIONS.gallons_to_liters(vol);
        m3 = CONVERSIONS.liters_to_m3(lit);
        assumptions.push(`Converted ${vol} US Gallons to ${round(m3, 3)} m³.`);
      }

      calculatedKg = m3 * matchedFactor.factorKgCo2e;
      rawUnit = 'm3';
      rawQty = m3;
      assumptions.push(`${matchedFactor.name}: ${round(m3, 3)} m³ at ${matchedFactor.factorKgCo2e} kg CO₂e/m³.`);
      break;
    }

    case 'waste': {
      const treatment = details.treatmentMethod || 'landfill';
      const wasteType = details.wasteType || 'mixed';
      key = `${treatment}_${wasteType}`;

      matchedFactor =
        findFactor('waste', key, region) ||
        findFactor('waste', `${treatment}_plastic`, region) ||
        findFactor('waste', 'landfill_mixed', region);

      let kg = Number(details.wasteQuantityKg ?? rawQty ?? details.value ?? 0);
      if (rawUnit === 'tonnes') {
        kg = CONVERSIONS.tonnes_to_kg(kg);
        assumptions.push(`Converted input from tonnes to ${kg} kg.`);
      }

      calculatedKg = kg * matchedFactor.factorKgCo2e;
      rawUnit = 'kg';
      rawQty = kg;
      assumptions.push(`${matchedFactor.name}: ${kg} kg at ${matchedFactor.factorKgCo2e} kg CO₂e/kg.`);
      break;
    }

    case 'facilities': {
      matchedFactor = findFactor('facilities', 'building_electricity', region);
      const kwh = Number(details.facilityKwh ?? details.kwh ?? rawQty ?? 0);

      if (kwh > 0) {
        calculatedKg = kwh * matchedFactor.factorKgCo2e;
        rawUnit = 'kWh';
        rawQty = kwh;
        assumptions.push(`Facility metered power: ${kwh} kWh at ${matchedFactor.factorKgCo2e} kg CO₂e/kWh.`);
      } else if (details.areaSqMeters) {
        const areaFactor = findFactor('facilities', 'area_benchmark', region);
        const area = Number(details.areaSqMeters);
        const days = Number(details.days || 1);
        calculatedKg = area * days * areaFactor.factorKgCo2e;
        rawUnit = 'm2_day';
        rawQty = area * days;
        assumptions.push(`Facility area benchmark (${area} m² × ${days} days) at ${areaFactor.factorKgCo2e} kg CO₂e/m²/day.`);
      } else if (details.hvacHours) {
        const hrs = Number(details.hvacHours);
        const kw = Number(details.hvacKwRating || 3.5);
        calculatedKg = hrs * kw * 0.50;
        rawUnit = 'kWh';
        rawQty = hrs * kw;
        assumptions.push(`HVAC cooling: ${hrs} operating hours × ${kw} kW unit rating.`);
      }

      if (details.refrigerantLeakageKg) {
        const refFactor = findFactor('facilities', 'refrigerant_r410a', region);
        const refKg = Number(details.refrigerantLeakageKg);
        calculatedKg += refKg * refFactor.factorKgCo2e;
        assumptions.push(`AC Refrigerant leakage (${refKg} kg R-410A) at GWP-100 ${refFactor.factorKgCo2e} kg CO₂e/kg.`);
      }
      break;
    }

    case 'other': {
      key = details.sourceType || subType || 'general_goods_spend';
      matchedFactor = findFactor('other', key, region) || findFactor('other', 'general_goods_spend', region);

      if (key === 'general_goods_spend' || details.spendAmount) {
        const spend = Number(details.spendAmount ?? rawQty ?? 0);
        calculatedKg = spend * matchedFactor.factorKgCo2e;
        rawUnit = '$';
        rawQty = spend;
        assumptions.push(`EEIO economic input-output factor ($${spend} spend × ${matchedFactor.factorKgCo2e} kg CO₂e/$).`);
      } else {
        const units = Number(details.quantity ?? rawQty ?? 1);
        calculatedKg = units * matchedFactor.factorKgCo2e;
        rawUnit = 'unit';
        rawQty = units;
        assumptions.push(`Product carbon footprint (${units} unit(s) × ${matchedFactor.factorKgCo2e} kg CO₂e/unit).`);
      }
      break;
    }

    default: {
      matchedFactor = findFactor(category, 'default', region) || {
        category,
        activityKey: 'default',
        name: 'Standard Factor',
        factorKgCo2e: 0.50,
        unit: 'units',
        scope: 'Scope 3',
        source: 'GHG Protocol Average',
        region: 'Global',
        version: '2024.1',
      };
      calculatedKg = Number(rawQty || details.value || 0) * matchedFactor.factorKgCo2e;
      rawUnit = 'units';
      rawQty = Number(rawQty || details.value || 0);
      assumptions.push(`Default category multiplier.`);
    }
  }

  const finalKg = round(Math.max(0, calculatedKg));
  const finalTonnes = round(finalKg / 1000, 4);

  return {
    emissionsKg: finalKg,
    emissionsTonnes: finalTonnes,
    factorUsed: {
      key: matchedFactor?.activityKey || key || category,
      name: matchedFactor?.name || `${category} Factor`,
      factorKgCo2e: matchedFactor?.factorKgCo2e || 0.50,
      unit: rawUnit || matchedFactor?.unit || 'units',
      scope: matchedFactor?.scope || 'Scope 3',
      source: matchedFactor?.source || 'Documented GHG Standard',
      region: matchedFactor?.region || region,
      version: matchedFactor?.version || '2024.1',
    },
    quantity: rawQty,
    unit: rawUnit || matchedFactor?.unit || 'units',
    scope: matchedFactor?.scope || 'Scope 3',
    methodology: matchedFactor?.methodology || 'Activity data multiplied by scientific emission factor',
    assumptions: assumptions.join(' '),
    isEstimate: true,
  };
};

/**
 * Links and records calculated emissions to an activity log in PostgreSQL
 */
const recordActivityEmission = async ({
  activityId,
  userId,
  calculation,
}) => {
  try {
    const res = await db.query(
      `INSERT INTO activity_emissions
        (activity_id, user_id, category, sub_type, quantity, unit, factor_value, factor_source, factor_version, factor_region, emissions_kg, emissions_tonnes, scope, methodology, assumptions, is_estimate)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, TRUE)
       RETURNING *`,
      [
        activityId,
        userId,
        calculation.factorUsed?.category || 'general',
        calculation.factorUsed?.key || null,
        calculation.quantity || 0,
        calculation.unit || 'units',
        calculation.factorUsed?.factorKgCo2e || 0,
        calculation.factorUsed?.source || 'Standard',
        calculation.factorUsed?.version || '2024.1',
        calculation.factorUsed?.region || 'Global',
        calculation.emissionsKg,
        calculation.emissionsTonnes,
        calculation.scope || 'Scope 3',
        calculation.methodology || 'Activity Data × Emission Factor',
        calculation.assumptions || '',
      ]
    );
    return res.rows[0];
  } catch (err) {
    console.warn('[emissionEngine] Could not link activity emission:', err.message);
    return null;
  }
};

module.exports = {
  SCIENTIFIC_EMISSION_FACTORS,
  CONVERSIONS,
  seedEmissionFactors,
  normalizeCategory,
  findFactor,
  convertUnitQuantity,
  calculateEmissions,
  recordActivityEmission,
  round,
};
