const { EMISSION_FACTORS, buildIntelligence, getPeriodBounds, parseActivity } = require('./carbonIntelligenceService');

const ACTION_STATUSES = new Set(['recommended', 'planned', 'in_progress', 'completed', 'skipped', 'dismissed']);
const GOAL_PERIODS = new Set(['weekly', 'monthly']);
const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

// Comprehensive Catalog of Science-Based Climate Actions across all sectors
const ACTION_CATALOG = {
  electricity: [
    {
      actionType: 'reduce_electricity_waste',
      title: 'Reduce unnecessary electricity usage & standby power',
      explanation: 'Unplug idle chargers, switch off power strips, and turn off lighting and displays when rooms are vacant.',
      target: 'Eliminate standby loads and cut unneeded lighting daily.',
      reductionRate: 0.12,
      defaultReductionKg: 8.5,
      impactLevel: 'high',
      rationale: 'Avoids passive phantom electrical loads across workspace and home.',
      calcFormula: (emissions) => `12% reduction of recent electricity footprint (${emissions} kg CO₂e) through standby power elimination`,
    },
    {
      actionType: 'ac_efficiency',
      title: 'Optimize air-conditioning & heating temperature setpoints',
      explanation: 'Adjust cooling thermostat up to 24°C (75°F) or heating down to 20°C (68°F) to significantly reduce compressor run cycles.',
      target: 'Maintain 24°C cooling setpoint and use ceiling fans.',
      reductionRate: 0.15,
      defaultReductionKg: 12.0,
      impactLevel: 'high',
      rationale: 'HVAC compressors are the largest domestic and commercial electricity loads.',
      calcFormula: (emissions) => `15% reduction of recent electricity footprint (${emissions} kg CO₂e) via 2°C thermostat setback`,
    },
    {
      actionType: 'energy_efficient_equipment',
      title: 'Use energy-efficient equipment & LED lighting',
      explanation: 'Replace remaining incandescent/halogen bulbs with high-efficiency LEDs and utilize power-saving computer/appliance modes.',
      target: 'Audit 5 primary lamps or office machines for eco-mode activation.',
      reductionRate: 0.10,
      defaultReductionKg: 6.0,
      impactLevel: 'medium',
      rationale: 'LED retrofits deliver up to 80% lumen-per-watt efficiency gains over legacy fixtures.',
      calcFormula: (emissions) => `10% reduction of electricity baseline (${emissions} kg CO₂e) via LED and eco-mode equipment`,
    },
    {
      actionType: 'renewable_electricity',
      title: 'Consider renewable electricity tariff or solar micro-generation',
      explanation: 'Inquire with your utility about certified green power tariffs or evaluate rooftop/community solar options.',
      target: 'Explore 1 renewable energy supply option this month.',
      reductionRate: 0.40,
      defaultReductionKg: 25.0,
      impactLevel: 'high',
      rationale: 'Transitioning to renewable electricity tariffs permanently abates scope 2 grid intensity.',
      calcFormula: (emissions) => `40% potential decarbonization of electricity footprint (${emissions} kg CO₂e) via zero-carbon tariff`,
    },
  ],

  transport: [
    {
      actionType: 'public_transit',
      title: 'Prefer public transportation when practical',
      explanation: 'Substitute regular vehicle commutes with bus, metro, or commuter rail where convenient transit routes exist.',
      target: 'Replace 2 solo car commutes with public transit this week.',
      reductionRate: 0.25,
      defaultReductionKg: 14.0,
      impactLevel: 'high',
      rationale: 'Public transit emits 60-80% less CO₂e per passenger-kilometer than single-occupancy cars.',
      calcFormula: (emissions) => `25% reduction of transport footprint (${emissions} kg CO₂e) by switching routine trips to transit`,
    },
    {
      actionType: 'combine_trips',
      title: 'Combine errands into single chained trips',
      explanation: 'Group separate shopping, pickup, and errand trips into a single consolidated loop to avoid repeat cold-engine fuel burn.',
      target: 'Chain errands into 1 consolidated route this week.',
      reductionRate: 0.15,
      defaultReductionKg: 7.5,
      impactLevel: 'medium',
      rationale: 'Chaining trips avoids repeated cold-start engine inefficiencies where fuel consumption is doubled.',
      calcFormula: (emissions) => `15% reduction of transport footprint (${emissions} kg CO₂e) by trip chaining`,
    },
    {
      actionType: 'walk_cycle',
      title: 'Walk or cycle for short journeys under 3 km',
      explanation: 'Leave the car parked for neighborhood trips, short commutes, and local store visits in favorable weather.',
      target: 'Complete 3 neighborhood trips by foot or bicycle.',
      reductionRate: 0.15,
      defaultReductionKg: 6.0,
      impactLevel: 'medium',
      rationale: 'Short trips under 3 km account for disproportionate cold-engine emissions and are ideal for zero-carbon active mobility.',
      calcFormula: (emissions) => `15% reduction of transport footprint (${emissions} kg CO₂e) through active zero-emission travel`,
    },
    {
      actionType: 'carpooling',
      title: 'Consider carpooling or ridesharing for regular routes',
      explanation: 'Share rides with colleagues, neighbors, or classmates for shared recurring destinations.',
      target: 'Share 2 commuting trips with a travel partner.',
      reductionRate: 0.20,
      defaultReductionKg: 10.0,
      impactLevel: 'medium',
      rationale: 'Doubling vehicle occupancy divides per-capita fuel consumption and emissions in half.',
      calcFormula: (emissions) => `20% reduction of transport footprint (${emissions} kg CO₂e) through 2-person carpool occupancy`,
    },
  ],

  food: [
    {
      actionType: 'reduce_food_waste',
      title: 'Reduce food waste with portion planning and proper storage',
      explanation: 'Plan meal menus, store fresh produce with humidity controls, and consume leftovers before expiration.',
      target: 'Achieve zero plate or refrigerator food spoilage this week.',
      reductionRate: 0.20,
      defaultReductionKg: 8.0,
      impactLevel: 'high',
      rationale: 'Uneaten food embodies the entire agricultural supply chain and generates methane in disposal.',
      calcFormula: (emissions) => `20% reduction of food footprint (${emissions} kg CO₂e) by preventing food spoilage`,
    },
    {
      actionType: 'lower_emission_meals',
      title: 'Choose lower-emission plant-forward meal alternatives',
      explanation: 'Swap beef or lamb for lentils, beans, grains, or poultry for several meals throughout the week.',
      target: 'Replace 2 high-impact meat meals with plant-based recipes.',
      reductionRate: 0.25,
      defaultReductionKg: 12.5,
      impactLevel: 'high',
      rationale: 'Plant proteins produce 10x-50x less greenhouse gas emissions per gram of protein than ruminant livestock.',
      calcFormula: (emissions) => `25% reduction of dietary footprint (${emissions} kg CO₂e) via plant-forward protein substitution`,
    },
    {
      actionType: 'food_purchasing_storage',
      title: 'Improve food purchasing and local seasonal selection',
      explanation: 'Buy seasonal regional produce and prioritize products with minimal air-freight and excess packaging.',
      target: 'Source seasonal regional ingredients for 3 meals.',
      reductionRate: 0.10,
      defaultReductionKg: 4.0,
      impactLevel: 'low',
      rationale: 'Local seasonal produce reduces refrigerated cold-chain transit emissions.',
      calcFormula: (emissions) => `10% reduction of food footprint (${emissions} kg CO₂e) through seasonal and smart purchasing`,
    },
  ],

  water: [
    {
      actionType: 'reduce_water_waste',
      title: 'Reduce unnecessary water consumption & shower duration',
      explanation: 'Shorten hot showers to under 5 minutes and avoid letting taps run continuously while washing or brushing.',
      target: 'Limit showers to 5 minutes for 5 consecutive days.',
      reductionRate: 0.20,
      defaultReductionKg: 3.5,
      impactLevel: 'medium',
      rationale: 'Hot water requires substantial thermal gas or electrical water heater power.',
      calcFormula: (emissions) => `20% reduction of water-related footprint (${emissions} kg CO₂e) by shortening hot water draw`,
    },
    {
      actionType: 'water_efficiency_fixtures',
      title: 'Improve water efficiency with aerators & leak repairs',
      explanation: 'Inspect faucet washers, toilet flappers, and install low-flow aerators on sinks and showerheads.',
      target: 'Inspect home or workspace fixtures for silent drips or leaks.',
      reductionRate: 0.15,
      defaultReductionKg: 2.5,
      impactLevel: 'low',
      rationale: 'Low-flow aerators reduce water flow by 30% while maintaining effective spray velocity.',
      calcFormula: (emissions) => `15% reduction of water footprint (${emissions} kg CO₂e) through high-efficiency aerators`,
    },
  ],

  waste: [
    {
      actionType: 'improve_recycling',
      title: 'Improve recycling and clean material sorting',
      explanation: 'Rinse plastics, cans, and glass before placing in municipal recycling to prevent batch contamination.',
      target: 'Correctly sort and rinse 100% of recyclable containers.',
      reductionRate: 0.25,
      defaultReductionKg: 5.0,
      impactLevel: 'medium',
      rationale: 'Recycled aluminum and clean polymers save 70-95% of the energy needed for virgin extraction.',
      calcFormula: (emissions) => `25% reduction of waste footprint (${emissions} kg CO₂e) through clean recycling diversion`,
    },
    {
      actionType: 'separate_organic_waste',
      title: 'Separate organic waste for composting',
      explanation: 'Divert fruit peels, vegetable scraps, and coffee grounds to a home compost bin or city organics pickup.',
      target: 'Compost 100% of kitchen vegetable and organic scraps.',
      reductionRate: 0.35,
      defaultReductionKg: 7.0,
      impactLevel: 'high',
      rationale: 'Composting aerates organic matter, preventing anaerobic decomposition that produces methane (CH₄).',
      calcFormula: (emissions) => `35% reduction of waste footprint (${emissions} kg CO₂e) by diverting organics from landfill`,
    },
    {
      actionType: 'reduce_single_use',
      title: 'Reduce single-use materials and adopt durable reusables',
      explanation: 'Use reusable water bottles, shopping bags, and food containers instead of disposable single-use items.',
      target: 'Refuse single-use disposable bags and drinkware all week.',
      reductionRate: 0.15,
      defaultReductionKg: 3.0,
      impactLevel: 'low',
      rationale: 'Preventing single-use packaging eliminates upstream manufacturing, freight, and post-consumer waste.',
      calcFormula: (emissions) => `15% reduction of waste footprint (${emissions} kg CO₂e) through reusable material adoption`,
    },
  ],

  facilities: [
    {
      actionType: 'facility_lighting',
      title: 'Improve lighting efficiency and daylight harvesting',
      explanation: 'Maximize natural daylight, shut off lights in empty conference rooms, and inspect motion sensor timers.',
      target: 'Audit lighting schedules across active facility zones.',
      reductionRate: 0.15,
      defaultReductionKg: 8.0,
      impactLevel: 'medium',
      rationale: 'Commercial lighting accounts for 15-20% of total facility electrical demand.',
      calcFormula: (emissions) => `15% reduction of facility emissions (${emissions} kg CO₂e) through lighting optimization`,
    },
    {
      actionType: 'building_energy_monitoring',
      title: 'Monitor building energy consumption and off-hours baseload',
      explanation: 'Check energy meter readings during weekend and night periods to identify unneeded baseline power draw.',
      target: 'Identify and power down 2 off-hours continuous equipment loads.',
      reductionRate: 0.15,
      defaultReductionKg: 10.0,
      impactLevel: 'high',
      rationale: 'Off-hours baseload energy waste often accounts for 20-30% of commercial utility spend.',
      calcFormula: (emissions) => `15% reduction of facility footprint (${emissions} kg CO₂e) via off-hours baseload reduction`,
    },
    {
      actionType: 'cooling_equipment_efficiency',
      title: 'Improve cooling and equipment efficiency with routine maintenance',
      explanation: 'Clean air conditioning filters, clear outdoor compressor intake grilles, and service air handlers.',
      target: 'Inspect and clean air filters or ventilation louvers.',
      reductionRate: 0.20,
      defaultReductionKg: 12.0,
      impactLevel: 'high',
      rationale: 'Clogged HVAC air filters increase fan motor energy draw by 15% and degrade cooling heat exchange.',
      calcFormula: (emissions) => `20% reduction of facility emissions (${emissions} kg CO₂e) via cooling equipment maintenance`,
    },
  ],

  flight: [
    {
      actionType: 'avoid_flight',
      title: 'Avoid or consolidate one flight journey',
      explanation: 'Consider rail, remote attendance, or combining trips when the choice is practical.',
      target: 'Review 1 upcoming flight decision this week.',
      reductionRate: 0.10,
      defaultReductionKg: 50.0,
      impactLevel: 'high',
      rationale: 'Aviation creates high-altitude radiative forcing and represents the highest per-hour carbon activity.',
      calcFormula: (emissions) => `10% reduction of flight emissions (${emissions} kg CO₂e) via rail or virtual alternatives`,
    },
  ],

  shopping: [
    {
      actionType: 'pause_purchases',
      title: 'Pause one non-essential purchase',
      explanation: 'Delay or avoid one non-essential purchase and choose a durable option when buying is needed.',
      target: 'Avoid 1 non-essential item this week.',
      reductionRate: 0.15,
      defaultReductionKg: 5.0,
      impactLevel: 'low',
      rationale: 'Manufacturing and retail distribution represent heavy embodied scope 3 lifecycle carbon.',
      calcFormula: (emissions) => `15% reduction of shopping footprint (${emissions} kg CO₂e) through mindful purchasing`,
    },
  ],

  other: [
    {
      actionType: 'sustainable_purchasing',
      title: 'Prioritize durable equipment and eco-certified supplies',
      explanation: 'Extend electronics life cycles, repair existing gear before replacing, and choose certified low-carbon suppliers.',
      target: 'Repair or maintain 1 existing device rather than buying new.',
      reductionRate: 0.10,
      defaultReductionKg: 5.0,
      impactLevel: 'low',
      rationale: 'Embodied carbon in manufactured consumer electronics typically exceeds 80% of total lifetime emissions.',
      calcFormula: (emissions) => `10% reduction of general footprint (${emissions} kg CO₂e) through durable procurement`,
    },
  ],
};

// Fallback legacy templates matching existing test contracts exactly
const fallbackTemplates = {
  transport: {
    title: 'Reduce one car journey',
    explanation: 'Replace one practical car journey with walking, cycling, public transport, or trip consolidation.',
    target: 'Replace or combine 1 journey this week.',
  },
  electricity: {
    title: 'Cut avoidable electricity use',
    explanation: 'Switch off standby devices and unused lights, and use efficient settings where practical.',
    target: 'Reduce electricity-related activity by 15% this week.',
  },
  food: {
    title: 'Choose a lower-impact meal',
    explanation: 'Swap one higher-emission meal for a plant-forward or lower-impact alternative.',
    target: 'Choose 2 lower-impact meals this week.',
  },
  flight: {
    title: 'Avoid or consolidate one flight journey',
    explanation: 'Consider rail, remote attendance, or combining trips when the choice is practical.',
    target: 'Review 1 upcoming flight decision this week.',
  },
  shopping: {
    title: 'Pause one non-essential purchase',
    explanation: 'Delay or avoid one non-essential purchase and choose a durable option when buying is needed.',
    target: 'Avoid 1 non-essential item this week.',
  },
};

const validateStatus = (status) => {
  const normalized = typeof status === 'string' ? status.trim().toLowerCase() : '';
  if (!ACTION_STATUSES.has(normalized)) throw new Error('Invalid action status.');
  return normalized;
};

const validateGoal = ({ period, targetKg, category }) => {
  if (!GOAL_PERIODS.has(period)) throw new Error('Goal period must be weekly or monthly.');
  const target = Number(targetKg);
  if (!Number.isFinite(target) || target <= 0 || target > 100000) throw new Error('Goal target must be between 0 and 100000 kg CO₂.');
  if (category && !EMISSION_FACTORS[category]) throw new Error('Goal category has no supported emission factor.');
  return { period, targetKg: round(target), category: category || null };
};

const buildFallbackActions = ({ intelligence, completedHistory = [] }) => {
  const completionByCategory = completedHistory.reduce((counts, action) => {
    counts[action.category] = (counts[action.category] || 0) + 1;
    return counts;
  }, {});

  const sources = intelligence.largestSources.length
    ? intelligence.largestSources
    : [{ category: 'transport', label: 'Transport', emissions: 0, contributionPercentage: 0 }];

  return Array.from({ length: 7 }, (_, index) => {
    const source = sources[index % sources.length];
    const catTemplates = ACTION_CATALOG[source.category] || [];
    const templateIndex = Math.floor(index / sources.length) % Math.max(1, catTemplates.length);
    const richTemplate = catTemplates[templateIndex];
    const fallbackTemplate = fallbackTemplates[source.category] || {
      title: `Review ${source.label.toLowerCase()} emissions`,
      explanation: `Review your ${source.label.toLowerCase()} activity and identify one practical reduction.`,
      target: `Review 1 ${source.label.toLowerCase()} choice this week.`,
    };

    const factor = EMISSION_FACTORS[source.category];
    const reductionRate = richTemplate?.reductionRate || factor?.reductionRate || 0.1;
    const potentialSavingsKg = round(source.emissions * reductionRate);
    const completedBefore = completionByCategory[source.category] || 0;

    const baseTitle = richTemplate?.title || fallbackTemplate.title;
    const title = `${completedBefore ? `${baseTitle} again` : baseTitle}${index >= sources.length ? ` — day ${index + 1}` : ''}`;
    const explanation = completedBefore
      ? `${richTemplate?.explanation || fallbackTemplate.explanation} You have completed ${completedBefore} related action${completedBefore === 1 ? '' : 's'} before; try a slightly more consistent version.`
      : (richTemplate?.explanation || fallbackTemplate.explanation);

    const rank = (index % sources.length) + 1;
    const reason = source.emissions > 0
      ? `${source.label} is your #${rank} emission driver, representing ${source.contributionPercentage}% (${source.emissions} kg CO₂e) of your recent activity.`
      : `General conservation recommendation for ${source.label.toLowerCase()}.`;

    const savingsCalculation = source.emissions > 0 && richTemplate?.calcFormula
      ? richTemplate.calcFormula(source.emissions)
      : (source.emissions > 0 ? `${Math.round(reductionRate * 100)}% reduction of baseline ${source.emissions} kg CO₂e = ${potentialSavingsKg} kg CO₂e` : 'No baseline history recorded yet.');

    return {
      dayNumber: index + 1,
      category: source.category,
      actionType: richTemplate?.actionType || `${source.category}_action_${index + 1}`,
      title,
      explanation,
      suggestedTarget: richTemplate?.target || fallbackTemplate.target,
      estimatedPotentialSavingsKg: source.emissions > 0 ? potentialSavingsKg : null,
      estimatedPotentialSavingsTonnes: source.emissions > 0 ? round(potentialSavingsKg / 1000.0) : null,
      impactLevel: index === 0 ? 'high' : (richTemplate?.impactLevel || (index < 3 ? 'high' : 'medium')),
      reason,
      savingsCalculation,
      sourceEmissionsKg: source.emissions,
      status: 'planned',
      isEstimate: true,
    };
  });
};

// Generates full catalog of prioritized recommendations across all sectors for the user
const generateAllRecommendations = ({ intelligence, completedHistory = [] }) => {
  const completionByCategory = completedHistory.reduce((counts, action) => {
    counts[action.category] = (counts[action.category] || 0) + 1;
    return counts;
  }, {});

  const categoryMap = intelligence.categories || {};
  const totalEmissions = intelligence.totals?.currentPeriod || 0;
  const recommendations = [];

  // Iterate over each sector defined in ACTION_CATALOG
  Object.keys(ACTION_CATALOG).forEach((catKey) => {
    const templates = ACTION_CATALOG[catKey];
    const catData = categoryMap[catKey] || { emissions: 0, label: catKey.charAt(0).toUpperCase() + catKey.slice(1) };
    const emissions = catData.emissions || 0;
    const share = totalEmissions > 0 ? round((emissions / totalEmissions) * 100, 1) : 0;
    const completedCount = completionByCategory[catKey] || 0;

    templates.forEach((template, idx) => {
      const reductionRate = template.reductionRate;
      const potentialSavingsKg = emissions > 0
        ? round(emissions * reductionRate)
        : template.defaultReductionKg;
      const potentialSavingsTonnes = round(potentialSavingsKg / 1000.0, 4);

      let impactLevel = template.impactLevel;
      if (share > 30) impactLevel = 'high';
      else if (share < 5 && emissions > 0) impactLevel = 'low';

      const reason = emissions > 0
        ? `${catData.label} accounts for ${share}% (${emissions} kg CO₂e) of your recent recorded footprint.`
        : `Baseline conservation recommendation for ${catData.label.toLowerCase()} (no specific activity logged yet).`;

      const savingsCalculation = emissions > 0
        ? template.calcFormula(emissions)
        : `Estimated benchmark: ~${potentialSavingsKg} kg CO₂e saved per standard household reduction cycle.`;

      recommendations.push({
        id: `${catKey}-${template.actionType}`,
        category: catKey,
        categoryLabel: catData.label,
        actionType: template.actionType,
        title: completedCount > 0 && idx === 0 ? `${template.title} (Level ${completedCount + 1})` : template.title,
        explanation: template.explanation,
        suggestedTarget: template.target,
        estimatedPotentialSavingsKg: potentialSavingsKg,
        estimatedPotentialSavingsTonnes: potentialSavingsTonnes,
        impactLevel,
        reason,
        savingsCalculation,
        categorySharePct: share,
        categoryEmissionsKg: emissions,
        status: 'recommended',
        isEstimate: true,
      });
    });
  });

  // Sort: High impact first, then by largest potential savings
  recommendations.sort((a, b) => {
    const impactWeight = { high: 3, medium: 2, low: 1 };
    const diff = (impactWeight[b.impactLevel] || 0) - (impactWeight[a.impactLevel] || 0);
    if (diff !== 0) return diff;
    return (b.estimatedPotentialSavingsKg || 0) - (a.estimatedPotentialSavingsKg || 0);
  });

  return recommendations;
};

const validateActions = (actions) => {
  if (!Array.isArray(actions) || actions.length < 1 || actions.length > 7) {
    throw new Error('A coach plan must contain between 1 and 7 actions.');
  }
  return actions.map((action, index) => {
    if (!action || typeof action !== 'object' || typeof action.title !== 'string' || !action.title.trim()) {
      throw new Error(`Action ${index + 1} has an invalid title.`);
    }
    if (!action.category || !EMISSION_FACTORS[action.category]) {
      throw new Error(`Action ${index + 1} has an unsupported category.`);
    }
    if (typeof action.explanation !== 'string' || !action.explanation.trim()
      || typeof action.suggestedTarget !== 'string' || !action.suggestedTarget.trim()) {
      throw new Error(`Action ${index + 1} must include an explanation and suggested target.`);
    }
    const savings = action.estimatedPotentialSavingsKg == null ? null : Number(action.estimatedPotentialSavingsKg);
    if (savings !== null && (!Number.isFinite(savings) || savings < 0)) {
      throw new Error(`Action ${index + 1} has an invalid estimated saving.`);
    }
    return {
      dayNumber: Number.isInteger(action.dayNumber) ? action.dayNumber : index + 1,
      category: action.category,
      actionType: action.actionType || `${action.category}_${index + 1}`,
      title: action.title.trim().slice(0, 160),
      explanation: action.explanation.trim().slice(0, 500),
      suggestedTarget: action.suggestedTarget.trim().slice(0, 240),
      estimatedPotentialSavingsKg: savings === null ? null : round(savings),
      estimatedPotentialSavingsTonnes: savings === null ? null : round(savings / 1000.0, 4),
      impactLevel: action.impactLevel || 'high',
      reason: action.reason || 'Recommended based on your activity pattern.',
      savingsCalculation: action.savingsCalculation || 'Documented formula based on standard emission factors.',
      sourceEmissionsKg: Number.isFinite(Number(action.sourceEmissionsKg)) ? round(Number(action.sourceEmissionsKg)) : null,
      status: action.status || 'planned',
    };
  });
};

const buildCoachPlan = ({ activities, completedHistory = [], previousActions = [], today }) => {
  const parsedActivities = activities.map(parseActivity);
  const valid = parsedActivities.filter(Boolean);
  let referenceToday = today;
  if (!referenceToday && valid.length > 0) {
    const dates = valid.map((a) => a.date).sort();
    const latestDate = dates[dates.length - 1];
    const todayIso = new Date().toISOString().slice(0, 10);
    const defaultBounds = getPeriodBounds(30, todayIso);
    if (latestDate < defaultBounds.currentStart) {
      referenceToday = latestDate;
    }
  }
  const bounds = getPeriodBounds(30, referenceToday);
  const intelligence = buildIntelligence({
    activities,
    periodDays: 30,
    ...bounds,
  });

  const actions = validateActions(buildFallbackActions({ intelligence, completedHistory, previousActions }));
  const recommendations = generateAllRecommendations({ intelligence, completedHistory });

  return {
    highestImpactCategories: intelligence.largestSources.map((source) => ({
      category: source.category,
      label: source.label,
      emissionsKg: source.emissions,
      contributionPercentage: source.contributionPercentage,
    })),
    actions,
    recommendations,
    activityCount: intelligence.activityCount,
    invalidActivityCount: parsedActivities.length - parsedActivities.filter(Boolean).length,
    isEstimate: true,
    narrativeSource: 'deterministic',
  };
};

// Evaluates real recorded emissions progress towards user's reduction targets vs hypothetical modeled savings
const evaluateGoalProgress = ({ goal, activities = [], completedActions = [] }) => {
  const startedAtIso = goal.started_at ? new Date(goal.started_at).toISOString().slice(0, 10) : '2000-01-01';
  const baselineKg = Number(goal.baseline_kg) || 0;
  const targetKg = Number(goal.target_kg) || 0;

  // Filter activities logged strictly since the goal started
  const relevantActivities = activities.filter((act) => {
    const actDate = act.date instanceof Date ? act.date.toISOString().slice(0, 10) : String(act.date).slice(0, 10);
    const dateMatches = actDate >= startedAtIso;
    if (!dateMatches) return false;
    if (goal.category) {
      const actCat = (act.activity_type || act.category || '').toLowerCase();
      return actCat === goal.category.toLowerCase();
    }
    return true;
  });

  const actualRecordedKg = round(relevantActivities.reduce((sum, act) => sum + (Number(act.carbon_emissions) || 0), 0));
  const actualRecordedTonnes = round(actualRecordedKg / 1000.0, 4);

  // Actual reduction = baseline - actualRecorded (positive = real reduction occurred)
  const actualChangeKg = round(baselineKg - actualRecordedKg);
  const actualReductionPct = baselineKg > 0 ? round((actualChangeKg / baselineKg) * 100, 1) : 0;
  const isTargetAchieved = actualRecordedKg <= targetKg;

  // Hypothetical savings from completed actions
  const hypotheticalSavingsKg = round(completedActions.reduce((sum, act) => sum + (Number(act.estimated_potential_savings_kg) || 0), 0));
  const hypotheticalSavingsTonnes = round(hypotheticalSavingsKg / 1000.0, 4);
  const completedActionsCount = completedActions.length;

  let verificationStatus = 'awaiting_records';
  let verificationMessage = 'Awaiting subsequent activity records to measure actual emission changes.';

  if (relevantActivities.length > 0) {
    if (actualChangeKg > 0) {
      verificationStatus = 'verified_reduction';
      verificationMessage = `Verified Reduction: Recorded emissions decreased by ${actualChangeKg} kg CO₂e (${actualReductionPct}%) relative to pre-goal baseline.`;
    } else if (actualChangeKg < 0) {
      verificationStatus = 'emissions_increased';
      verificationMessage = `Recorded emissions (${actualRecordedKg} kg) currently exceed baseline (${baselineKg} kg) by ${Math.abs(actualChangeKg)} kg CO₂e.`;
    } else {
      verificationStatus = 'participation_only';
      verificationMessage = `Recorded emissions match baseline (${baselineKg} kg). Continue logging activities to verify sustained reductions.`;
    }
  } else if (completedActionsCount > 0) {
    verificationStatus = 'participation_only';
    verificationMessage = `Participation recorded (${completedActionsCount} action${completedActionsCount === 1 ? '' : 's'} completed), but subsequent activity records have not yet confirmed lower emissions.`;
  }

  return {
    ...goal,
    targetKg,
    baselineKg,
    actualRecordedKg,
    actualRecordedTonnes,
    actualChangeKg,
    actualReductionPct,
    isTargetAchieved,
    hypotheticalSavingsKg,
    hypotheticalSavingsTonnes,
    completedActionsCount,
    verificationStatus,
    verificationMessage,
  };
};

module.exports = {
  ACTION_CATALOG,
  ACTION_STATUSES,
  GOAL_PERIODS,
  buildCoachPlan,
  buildFallbackActions,
  evaluateGoalProgress,
  generateAllRecommendations,
  validateActions,
  validateGoal,
  validateStatus,
};
