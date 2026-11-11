import React, { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import Layout from '../components/Layout';
import {
  AlertCircle,
  Building2,
  Calendar,
  Car,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Database,
  Droplets,
  Edit3,
  FileText,
  Filter,
  History,
  Info,
  Leaf,
  Package,
  Plus,
  Recycle,
  RefreshCw,
  Scale,
  Search,
  Trash2,
  Utensils,
  X,
  Zap,
} from 'lucide-react';

const CATEGORIES = [
  {
    id: 'food',
    name: 'Food & Diet',
    icon: Utensils,
    color: '#F59E0B',
    description: 'Meals, meat, dairy, diet choices & food waste',
  },
  {
    id: 'electricity',
    name: 'Electricity & Energy',
    icon: Zap,
    color: '#38BDF8',
    description: 'Grid power, solar, fuels & backup generators',
  },
  {
    id: 'transport',
    name: 'Transportation',
    icon: Car,
    color: '#10B981',
    description: 'Car, bike, public transit, rail & flights',
  },
  {
    id: 'water',
    name: 'Water Usage',
    icon: Droplets,
    color: '#06B6D4',
    description: 'Municipal tap, hot water, bottled & groundwater',
  },
  {
    id: 'waste',
    name: 'Waste Management',
    icon: Recycle,
    color: '#84CC16',
    description: 'Landfill, recycling, organics composting & sorting',
  },
  {
    id: 'facilities',
    name: 'Facilities & Buildings',
    icon: Building2,
    color: '#8B5CF6',
    description: 'Facility power, HVAC cooling, area & refrigerants',
  },
  {
    id: 'other',
    name: 'Other Emission Sources',
    icon: Package,
    color: '#EC4899',
    description: 'Electronics, hardware, apparel & purchased goods',
  },
];

const round = (val, d = 2) => (val != null && !Number.isNaN(Number(val)) ? Number(val).toFixed(d) : '0.00');

// Client-side live emission preview calculator
const computeLiveEstimate = (cat, form) => {
  let kg = 0;
  let formula = '';

  switch (cat) {
    case 'food': {
      const mealRates = {
        vegan: 0.9,
        vegetarian: 1.5,
        dairy: 1.9,
        seafood: 2.8,
        meat_average: 3.5,
        meat_high: 7.2,
      };
      const rate = mealRates[form.mealType] || 2.5;
      const count = Number(form.quantity || 1);
      const waste = Number(form.foodWasteKg || 0);
      kg = count * rate + waste * 2.5;
      formula = `${count} meals × ${rate} kg CO₂ + ${waste} kg waste × 2.5`;
      break;
    }
    case 'electricity': {
      const kwh = Number(form.kwh || 0);
      if (form.energySource === 'diesel_generator') {
        const liters = Number(form.generatorFuelLiters || kwh / 3);
        kg = liters * 2.68;
        formula = `${liters} L diesel × 2.68 kg CO₂/L`;
      } else {
        const sourceRates = {
          grid: 0.5,
          coal: 0.9,
          natural_gas: 0.45,
          renewable: 0.02,
          solar: 0.02,
        };
        const rate = sourceRates[form.energySource] || 0.5;
        const solar = Math.max(0, Number(form.solarGenerationKwh || 0));
        const net = Math.max(0, kwh - solar);
        kg = net * rate + solar * 0.02;
        formula = `${net} net kWh × ${rate} kg CO₂ + ${solar} solar kWh × 0.02`;
      }
      break;
    }
    case 'transport': {
      const dist = Number(form.distanceKm || 0);
      const pax = Math.max(1, Number(form.passengers || 1));
      const transportRates = {
        car_petrol: 0.192 / pax,
        car_diesel: 0.171 / pax,
        car_hybrid: 0.109 / pax,
        car_ev: 0.053 / pax,
        motorbike: 0.103,
        bus: 0.082,
        train: 0.035,
        flight_economy: 0.255,
        flight_business: 0.38,
        walking_cycling: 0.0,
      };
      const rate = transportRates[form.transportMode] ?? 0.21;
      kg = dist * rate;
      formula = `${dist} km × ${round(rate, 3)} kg CO₂/km (${pax} pax)`;
      break;
    }
    case 'water': {
      let liters = Number(form.volume || 0);
      if (form.unit === 'm3') liters *= 1000;
      const waterRates = {
        tap_cold: 0.00035,
        tap_hot: 0.0058,
        bottled: 0.16,
        groundwater: 0.0006,
        recycled: 0.0001,
      };
      const rate = waterRates[form.waterSource] || 0.001;
      kg = liters * rate;
      formula = `${liters} L × ${round(rate, 5)} kg CO₂/L`;
      break;
    }
    case 'waste': {
      const wasteKg = Number(form.wasteQuantityKg || 0);
      let rate = 0.58;
      if (form.treatmentMethod === 'recycled') rate = 0.05;
      else if (form.treatmentMethod === 'composted') rate = 0.1;
      else if (form.wasteType === 'organic') rate = 0.95;
      else if (form.wasteType === 'plastic') rate = 0.04;
      kg = wasteKg * rate;
      formula = `${wasteKg} kg × ${rate} kg CO₂/kg (${form.treatmentMethod})`;
      break;
    }
    case 'facilities': {
      if (form.estimationMethod === 'hvac') {
        const hrs = Number(form.hvacHours || 0);
        const kw = Number(form.hvacKwRating || 3.5);
        kg = hrs * kw * 0.5;
        formula = `${hrs} hrs × ${kw} kW × 0.50 kg CO₂/kWh`;
      } else if (form.estimationMethod === 'area_benchmark') {
        const area = Number(form.areaSqMeters || 0);
        const days = Number(form.days || 1);
        kg = area * days * 0.08;
        formula = `${area} m² × ${days} days × 0.08 kg/m²/day`;
      } else {
        const kwh = Number(form.facilityKwh || 0);
        kg = kwh * 0.5;
        formula = `${kwh} kWh × 0.50 kg CO₂/kWh`;
      }
      if (form.refrigerantLeakageKg) {
        const refKg = Number(form.refrigerantLeakageKg);
        kg += refKg * 1430;
        formula += ` + ${refKg} kg ref × 1430 (R-410A)`;
      }
      break;
    }
    case 'other': {
      if (form.sourceType === 'general_goods_spend') {
        const spend = Number(form.spendAmount || 0);
        kg = spend * 0.45;
        formula = `$${spend} spend × 0.45 kg CO₂/$`;
      } else {
        const rates = {
          electronics_laptop: 210,
          electronics_phone: 70,
          electronics_monitor: 150,
          clothing_apparel: 12,
          furniture: 45,
          paper_goods: 1.2,
        };
        const rate = rates[form.sourceType] || 5.0;
        const qty = Number(form.quantity || 1);
        kg = qty * rate;
        formula = `${qty} unit(s) × ${rate} kg CO₂e/unit`;
      }
      break;
    }
    default:
      kg = Number(form.value || 0) * 0.5;
      formula = `${form.value || 0} × 0.5`;
  }

  return { kg: Math.max(0, kg), formula };
};

const defaultFormData = (cat) => {
  const today = new Date().toISOString().slice(0, 10);
  switch (cat) {
    case 'food':
      return { mealType: 'meat_average', quantity: 1, foodWasteKg: '', mealFrequency: 'single', date: today, notes: '' };
    case 'electricity':
      return { kwh: '', energySource: 'grid', generatorFuelLiters: '', solarGenerationKwh: '', billReference: '', date: today, notes: '' };
    case 'transport':
      return { transportMode: 'car_petrol', distanceKm: '', passengers: 1, tripType: 'one_way', date: today, notes: '' };
    case 'water':
      return { volume: '', unit: 'liters', waterSource: 'tap_cold', isHotWater: false, period: 'daily', date: today, notes: '' };
    case 'waste':
      return { wasteType: 'mixed', wasteQuantityKg: '', treatmentMethod: 'landfill', date: today, notes: '' };
    case 'facilities':
      return { facilityType: 'office', estimationMethod: 'direct_kwh', facilityKwh: '', hvacHours: '', hvacKwRating: '3.5', areaSqMeters: '', days: '1', refrigerantLeakageKg: '', date: today, notes: '' };
    case 'other':
      return { sourceType: 'electronics_laptop', quantity: 1, spendAmount: '', itemDescription: '', date: today, notes: '' };
    default:
      return { value: '', date: today, notes: '' };
  }
};

const formatActivityDetails = (act) => {
  const d = act.details || {};
  switch (act.activity_type) {
    case 'food':
      return `${d.mealType ? d.mealType.replace('_', ' ') : 'Food meal'} (${d.quantity || d.value || 1} meals)${d.foodWasteKg ? ` + ${d.foodWasteKg} kg waste` : ''}`;
    case 'electricity':
      return `${d.kwh || d.value || 0} kWh (${d.energySource || 'Grid'})${d.solarGenerationKwh ? ` [${d.solarGenerationKwh} kWh solar]` : ''}`;
    case 'transport':
      return `${d.transportMode ? d.transportMode.replace('_', ' ') : 'Transport'}: ${d.distanceKm || d.value || 0} km (${d.passengers || 1} pax)`;
    case 'water':
      return `${d.volume || d.value || 0} ${d.unit || 'L'} (${d.waterSource ? d.waterSource.replace('_', ' ') : 'Tap'})`;
    case 'waste':
      return `${d.wasteQuantityKg || d.value || 0} kg ${d.wasteType || 'Mixed'} (${d.treatmentMethod || 'Landfill'})`;
    case 'facilities':
      return `${d.facilityType ? d.facilityType.replace('_', ' ') : 'Building'} - ${d.facilityKwh ? `${d.facilityKwh} kWh` : d.areaSqMeters ? `${d.areaSqMeters} m²` : 'Energy'}`;
    case 'other':
      return `${d.sourceType ? d.sourceType.replace('_', ' ') : 'Procurement'} (${d.quantity || 1} units)`;
    default:
      return `${d.value || act.carbon_emissions} units`;
  }
};

const ActivityTracker = () => {
  const [activities, setActivities] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('transport');
  const [form, setForm] = useState(defaultFormData('transport'));
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastSaved, setLastSaved] = useState(null);

  // Filters & Search & Pagination
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterDateRange, setFilterDateRange] = useState('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Edit Modal State
  const [editingActivity, setEditingActivity] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [updating, setUpdating] = useState(false);

  // Scientific Factors Browser Modal State
  const [showFactorsModal, setShowFactorsModal] = useState(false);
  const [factorsList, setFactorsList] = useState([]);
  const [factorsLoading, setFactorsLoading] = useState(false);
  const [factorCategoryFilter, setFactorCategoryFilter] = useState('all');
  const [factorSearch, setFactorSearch] = useState('');

  // Inspector Modal for Connected activity_emissions
  const [inspectingActivity, setInspectingActivity] = useState(null);
  const [inspectingEmission, setInspectingEmission] = useState(null);
  const [inspectingLoading, setInspectingLoading] = useState(false);

  // Load factors on demand
  const handleOpenFactorsModal = async () => {
    setShowFactorsModal(true);
    if (factorsList.length === 0) {
      setFactorsLoading(true);
      try {
        const res = await api.get('/emissions/factors');
        setFactorsList(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error('Error loading factors:', err);
      } finally {
        setFactorsLoading(false);
      }
    }
  };

  // Inspect connected calculation record
  const handleInspectCalculation = async (act) => {
    setInspectingActivity(act);
    setInspectingLoading(true);
    try {
      const res = await api.get(`/emissions/activity/${act.id}`);
      setInspectingEmission(res.data);
    } catch {
      const d = act.details || {};
      setInspectingEmission({
        activity_id: act.id,
        activity_type: act.activity_type,
        emissions_kg: Number(act.carbon_emissions),
        emissions_tonnes: d.emissions_tonnes || Number(act.carbon_emissions) / 1000,
        scope: d.scope || 'Scope 3',
        methodology: d.methodology || 'Activity data multiplied by verified scientific emission factor.',
        assumptions: d.assumptions
          ? (Array.isArray(d.assumptions) ? d.assumptions : [d.assumptions])
          : ['GHG Protocol Corporate Standard factor applied.', 'Zero double counting: passenger allocation and solar net deduction preserved.'],
        factor_source: d.factor_source || 'UK DEFRA 2024 / IPCC AR6',
        factor_used: d.factor_used,
        is_estimate: true,
      });
    } finally {
      setInspectingLoading(false);
    }
  };

  // Filtered factors for factors modal
  const filteredFactors = useMemo(() => {
    let list = factorsList;
    if (factorCategoryFilter !== 'all') {
      list = list.filter((f) => f.category?.toLowerCase() === factorCategoryFilter.toLowerCase());
    }
    if (factorSearch.trim()) {
      const q = factorSearch.trim().toLowerCase();
      list = list.filter(
        (f) =>
          f.name?.toLowerCase().includes(q) ||
          f.activity_key?.toLowerCase().includes(q) ||
          f.source?.toLowerCase().includes(q) ||
          f.category?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [factorsList, factorCategoryFilter, factorSearch]);

  // Switch category and reset form
  const handleCategorySwitch = (catId) => {
    setSelectedCategory(catId);
    setForm(defaultFormData(catId));
  };

  const fetchActivities = async () => {
    setLoading(true);
    try {
      const res = await api.get('/activities');
      setActivities(Array.isArray(res.data) ? res.data : res.data?.activities || []);
    } catch (err) {
      console.error('Error fetching activities:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, []);

  // Live estimate calculation for the active form
  const liveEstimate = useMemo(() => {
    return computeLiveEstimate(selectedCategory, form);
  }, [selectedCategory, form]);

  // Live estimate calculation for the edit modal
  const editEstimate = useMemo(() => {
    if (!editingActivity || !editForm) return { kg: 0, formula: '' };
    return computeLiveEstimate(editingActivity.activity_type, editForm);
  }, [editingActivity, editForm]);

  // Form submit (Add Activity)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        activity_type: selectedCategory,
        details: { ...form },
        date: form.date || new Date().toISOString().slice(0, 10),
        notes: form.notes || undefined,
      };

      const res = await api.post('/activities', payload);
      const saved = res.data;
      setLastSaved(saved);
      setTimeout(() => setLastSaved(null), 5000);

      // Reset form
      setForm(defaultFormData(selectedCategory));
      await fetchActivities();
    } catch (err) {
      alert(err.response?.data?.message || 'Error recording activity. Please verify inputs.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (act) => {
    setEditingActivity(act);
    const d = act.details || {};
    setEditForm({
      ...d,
      date: act.date ? new Date(act.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      notes: d.notes || '',
    });
  };

  // Save Edit
  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editingActivity) return;
    setUpdating(true);
    try {
      const payload = {
        activity_type: editingActivity.activity_type,
        details: { ...editForm },
        date: editForm.date,
        notes: editForm.notes || undefined,
      };

      const res = await api.put(`/activities/${editingActivity.id}`, payload);
      setActivities((prev) => prev.map((a) => (a.id === editingActivity.id ? res.data : a)));
      setEditingActivity(null);
      setEditForm(null);
    } catch (err) {
      alert(err.response?.data?.message || 'Error updating activity.');
    } finally {
      setUpdating(false);
    }
  };

  // Delete Activity
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this recorded activity from your ledger?')) return;
    try {
      await api.delete(`/activities/${id}`);
      setActivities((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      alert(err.response?.data?.message || 'Could not delete activity.');
    }
  };

  // Filter & Search Logic
  const filteredActivities = useMemo(() => {
    let result = activities;

    // Category filter
    if (filterCategory !== 'all') {
      result = result.filter((a) => a.activity_type === filterCategory);
    }

    // Date filter
    const now = new Date();
    if (filterDateRange === 'today') {
      const todayIso = now.toISOString().slice(0, 10);
      result = result.filter((a) => a.date && a.date.slice(0, 10) === todayIso);
    } else if (filterDateRange === '7d') {
      const past7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      result = result.filter((a) => a.date && a.date.slice(0, 10) >= past7);
    } else if (filterDateRange === '30d') {
      const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      result = result.filter((a) => a.date && a.date.slice(0, 10) >= past30);
    } else if (filterDateRange === '90d') {
      const past90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      result = result.filter((a) => a.date && a.date.slice(0, 10) >= past90);
    } else if (filterDateRange === 'custom') {
      if (customStartDate) result = result.filter((a) => a.date && a.date.slice(0, 10) >= customStartDate);
      if (customEndDate) result = result.filter((a) => a.date && a.date.slice(0, 10) <= customEndDate);
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((a) => {
        const typeMatch = a.activity_type.toLowerCase().includes(q);
        const notesMatch = a.details?.notes && a.details.notes.toLowerCase().includes(q);
        const detailsStr = JSON.stringify(a.details || {}).toLowerCase();
        const detailsMatch = detailsStr.includes(q);
        return typeMatch || notesMatch || detailsMatch;
      });
    }

    return result;
  }, [activities, filterCategory, filterDateRange, customStartDate, customEndDate, searchQuery]);

  // Aggregate Stats for Filtered Data
  const stats = useMemo(() => {
    const totalEmissions = filteredActivities.reduce((acc, a) => acc + (parseFloat(a.carbon_emissions) || 0), 0);
    const count = filteredActivities.length;
    const avg = count > 0 ? totalEmissions / count : 0;
    const max = filteredActivities.reduce((m, a) => Math.max(m, parseFloat(a.carbon_emissions) || 0), 0);
    return { totalEmissions, count, avg, max };
  }, [filteredActivities]);

  // Pagination Slice
  const totalPages = Math.ceil(filteredActivities.length / pageSize) || 1;
  const paginatedActivities = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredActivities.slice(start, start + pageSize);
  }, [filteredActivities, currentPage, pageSize]);

  const activeCategoryConfig = CATEGORIES.find((c) => c.id === selectedCategory) || CATEGORIES[0];
  const ActiveIcon = activeCategoryConfig.icon;

  return (
    <Layout>
      <div className="dashboard-container">
        {/* Top Header Summary Strip */}
        <div className="dashboard-region-bar">
          <div className="region-bar-left">
            <span className="summary-status-badge live">
              <span className="live-dot" /> Carbon Activity Ledger
            </span>
            <span className="region-bar-label">Total Recorded:</span>
            <strong style={{ color: '#ffffff' }}>{activities.length} entries</strong>
          </div>
          <div className="region-bar-right">
            <span className="data-freshness-pill">
              <Leaf size={13} />
              <span>GHG Protocol Corporate & Personal Standard</span>
            </span>
          </div>
        </div>

        {/* Success Banner when an activity is saved */}
        {lastSaved && (
          <div className="activity-saved-toast">
            <CheckCircle2 size={18} />
            <span>
              Activity Recorded! Estimated footprint: <strong>{round(lastSaved.carbon_emissions)} kg CO₂e</strong> saved to your ledger.
            </span>
          </div>
        )}

        {/* 2-Column Desktop Grid: Dynamic Logger on Left, Activity History on Right */}
        <div className="dashboard-grid-middle" style={{ alignItems: 'start' }}>
          {/* Left Column: Dynamic Logging Card */}
          <div className="tracker-card" style={{ position: 'sticky', top: '16px' }}>
            <div className="tracker-card-header" style={{ marginBottom: '14px' }}>
              <div>
                <h2 className="card-section-title">
                  <Plus size={18} className="icon-mint" />
                  Log Carbon Activity
                </h2>
                <p className="card-subtitle-small">
                  Dynamic emission inputs customized per sector
                </p>
              </div>
            </div>

            {/* Category Switcher Tabs */}
            <div className="activity-cat-grid">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isActive = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleCategorySwitch(cat.id)}
                    className={`activity-cat-btn ${isActive ? 'active' : ''}`}
                    title={cat.description}
                  >
                    <Icon size={16} style={{ color: cat.color }} />
                    <span>{cat.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Dynamic Form per Category */}
            <form onSubmit={handleSubmit} className="dynamic-form-fields">
              {/* Category-Specific Form Fields */}

              {/* 1. FOOD AND DIET */}
              {selectedCategory === 'food' && (
                <>
                  <div className="form-field-group">
                    <label className="field-label">Diet & Meal Type</label>
                    <select
                      className="field-select"
                      value={form.mealType}
                      onChange={(e) => setForm({ ...form, mealType: e.target.value })}
                    >
                      <option value="vegan">🌱 100% Plant-Based / Vegan (0.90 kg CO₂e/meal)</option>
                      <option value="vegetarian">🥗 Vegetarian with Dairy/Eggs (1.50 kg CO₂e/meal)</option>
                      <option value="dairy">🧀 Dairy & Cheese Heavy (1.90 kg CO₂e/serving)</option>
                      <option value="seafood">🐟 Fish & Seafood (2.80 kg CO₂e/meal)</option>
                      <option value="meat_average">🍗 Average Non-Veg / Poultry / Pork (3.50 kg CO₂e/meal)</option>
                      <option value="meat_high">🥩 High-Carbon Meat / Beef / Lamb (7.20 kg CO₂e/meal)</option>
                    </select>
                  </div>

                  <div className="form-grid-2col">
                    <div className="form-field-group">
                      <label className="field-label">Number of Meals</label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        className="field-input"
                        placeholder="e.g. 2"
                        value={form.quantity}
                        onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-field-group">
                      <label className="field-label">Food Waste (Optional, kg)</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        className="field-input"
                        placeholder="e.g. 0.3 kg"
                        value={form.foodWasteKg}
                        onChange={(e) => setForm({ ...form, foodWasteKg: e.target.value })}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* 2. ELECTRICITY AND ENERGY */}
              {selectedCategory === 'electricity' && (
                <>
                  <div className="form-field-group">
                    <label className="field-label">Energy Source & Tariff</label>
                    <select
                      className="field-select"
                      value={form.energySource}
                      onChange={(e) => setForm({ ...form, energySource: e.target.value })}
                    >
                      <option value="grid">⚡ National Grid Average (0.50 kg CO₂e/kWh)</option>
                      <option value="coal">🏭 Coal-Dominated Grid (0.90 kg CO₂e/kWh)</option>
                      <option value="natural_gas">🔥 Natural Gas Generation (0.45 kg CO₂e/kWh)</option>
                      <option value="renewable">🌿 100% Certified Renewable Tariff (0.02 kg CO₂e/kWh)</option>
                      <option value="solar">☀️ On-Site Solar Self-Consumption (0.02 kg CO₂e/kWh)</option>
                      <option value="diesel_generator">⛽ Diesel Backup Generator (2.68 kg CO₂e/L)</option>
                    </select>
                  </div>

                  {form.energySource === 'diesel_generator' ? (
                    <div className="form-field-group">
                      <label className="field-label">Generator Fuel Consumed (Liters)</label>
                      <input
                        type="number"
                        min="0.1"
                        step="any"
                        className="field-input"
                        placeholder="e.g. 15 Liters"
                        value={form.generatorFuelLiters}
                        onChange={(e) => setForm({ ...form, generatorFuelLiters: e.target.value })}
                        required
                      />
                    </div>
                  ) : (
                    <div className="form-grid-2col">
                      <div className="form-field-group">
                        <label className="field-label">Metered Electricity (kWh)</label>
                        <input
                          type="number"
                          min="0.1"
                          step="any"
                          className="field-input"
                          placeholder="e.g. 120 kWh"
                          value={form.kwh}
                          onChange={(e) => setForm({ ...form, kwh: e.target.value })}
                          required
                        />
                      </div>
                      <div className="form-field-group">
                        <label className="field-label">Solar Offset (kWh, Optional)</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          className="field-input"
                          placeholder="e.g. 40 kWh"
                          value={form.solarGenerationKwh}
                          onChange={(e) => setForm({ ...form, solarGenerationKwh: e.target.value })}
                        />
                      </div>
                    </div>
                  )}

                  <div className="form-field-group">
                    <label className="field-label">Bill Reference / Meter ID (Optional)</label>
                    <input
                      type="text"
                      className="field-input"
                      placeholder="e.g. Meter #BESCOM-89102"
                      value={form.billReference}
                      onChange={(e) => setForm({ ...form, billReference: e.target.value })}
                    />
                  </div>
                </>
              )}

              {/* 3. TRANSPORTATION */}
              {selectedCategory === 'transport' && (
                <>
                  <div className="form-field-group">
                    <label className="field-label">Vehicle & Mode of Travel</label>
                    <select
                      className="field-select"
                      value={form.transportMode}
                      onChange={(e) => setForm({ ...form, transportMode: e.target.value })}
                    >
                      <option value="car_petrol">🚗 Petrol / Gasoline Car (0.192 kg/km)</option>
                      <option value="car_diesel">🚙 Diesel Passenger Car (0.171 kg/km)</option>
                      <option value="car_hybrid">🔋 Hybrid Electric Car (0.109 kg/km)</option>
                      <option value="car_ev">⚡ Battery Electric Vehicle / EV (0.053 kg/km)</option>
                      <option value="motorbike">🏍️ Motorcycle / Scooter (0.103 kg/km)</option>
                      <option value="bus">🚌 Public Transit Bus (0.082 kg/p-km)</option>
                      <option value="train">🚆 Commuter / Passenger Train (0.035 kg/p-km)</option>
                      <option value="flight_economy">✈️ Commercial Flight - Economy (0.255 kg/km)</option>
                      <option value="flight_business">🛫 Commercial Flight - Business Class (0.380 kg/km)</option>
                      <option value="walking_cycling">🚲 Walking or Cycling (Zero Emissions - 0.00)</option>
                    </select>
                  </div>

                  <div className="form-grid-2col">
                    <div className="form-field-group">
                      <label className="field-label">Distance (Kilometers)</label>
                      <input
                        type="number"
                        min="0.1"
                        step="any"
                        className="field-input"
                        placeholder="e.g. 35 km"
                        value={form.distanceKm}
                        onChange={(e) => setForm({ ...form, distanceKm: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-field-group">
                      <label className="field-label">Number of Passengers</label>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        step="1"
                        className="field-input"
                        placeholder="1"
                        value={form.passengers}
                        onChange={(e) => setForm({ ...form, passengers: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                </>
              )}

              {/* 4. WATER USAGE */}
              {selectedCategory === 'water' && (
                <>
                  <div className="form-field-group">
                    <label className="field-label">Water Source & Grade</label>
                    <select
                      className="field-select"
                      value={form.waterSource}
                      onChange={(e) => setForm({ ...form, waterSource: e.target.value })}
                    >
                      <option value="tap_cold">🚰 Municipal Cold Tap Water (0.35 kg CO₂/m³)</option>
                      <option value="tap_hot">♨️ Hot Water (Water Heater Electric/Gas - 5.80 kg CO₂/m³)</option>
                      <option value="bottled">🍾 Bottled / Packaged Drinking Water (160 kg CO₂/m³)</option>
                      <option value="groundwater">🚜 Borewell / Pumped Groundwater (0.60 kg CO₂/m³)</option>
                      <option value="recycled">🌧️ Rainwater Harvested / Graywater (0.10 kg CO₂/m³)</option>
                    </select>
                  </div>

                  <div className="form-grid-2col">
                    <div className="form-field-group">
                      <label className="field-label">Measured Consumption</label>
                      <input
                        type="number"
                        min="0.1"
                        step="any"
                        className="field-input"
                        placeholder="e.g. 450"
                        value={form.volume}
                        onChange={(e) => setForm({ ...form, volume: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-field-group">
                      <label className="field-label">Unit of Measure</label>
                      <select
                        className="field-select"
                        value={form.unit}
                        onChange={(e) => setForm({ ...form, unit: e.target.value })}
                      >
                        <option value="liters">Liters (L)</option>
                        <option value="m3">Cubic Meters (m³ = 1,000 L)</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              {/* 5. WASTE MANAGEMENT */}
              {selectedCategory === 'waste' && (
                <>
                  <div className="form-grid-2col">
                    <div className="form-field-group">
                      <label className="field-label">Waste Material</label>
                      <select
                        className="field-select"
                        value={form.wasteType}
                        onChange={(e) => setForm({ ...form, wasteType: e.target.value })}
                      >
                        <option value="mixed">🗑️ Mixed Municipal Waste</option>
                        <option value="organic">🥬 Kitchen & Organic Scraps</option>
                        <option value="plastic">🥤 Plastic Packaging & Bottles</option>
                        <option value="paper">📦 Paper, Cardboard & Documents</option>
                        <option value="metal">🥫 Aluminum & Scrap Metal</option>
                        <option value="electronic">💻 E-Waste & Peripherals</option>
                      </select>
                    </div>

                    <div className="form-field-group">
                      <label className="field-label">Treatment Method</label>
                      <select
                        className="field-select"
                        value={form.treatmentMethod}
                        onChange={(e) => setForm({ ...form, treatmentMethod: e.target.value })}
                      >
                        <option value="landfill">Landfill Disposal (High Methane)</option>
                        <option value="recycled">Recycling Plant / Sorting</option>
                        <option value="composted">Aerobic Composting</option>
                        <option value="incineration">Waste-to-Energy Incineration</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-field-group">
                    <label className="field-label">Waste Quantity (Kilograms)</label>
                    <input
                      type="number"
                      min="0.1"
                      step="any"
                      className="field-input"
                      placeholder="e.g. 8.5 kg"
                      value={form.wasteQuantityKg}
                      onChange={(e) => setForm({ ...form, wasteQuantityKg: e.target.value })}
                      required
                    />
                  </div>
                </>
              )}

              {/* 6. FACILITIES AND BUILDINGS */}
              {selectedCategory === 'facilities' && (
                <>
                  <div className="form-grid-2col">
                    <div className="form-field-group">
                      <label className="field-label">Building / Facility Type</label>
                      <select
                        className="field-select"
                        value={form.facilityType}
                        onChange={(e) => setForm({ ...form, facilityType: e.target.value })}
                      >
                        <option value="office">🏢 Commercial Office Space</option>
                        <option value="retail">🏬 Retail Store / Showroom</option>
                        <option value="warehouse">📦 Logistics Warehouse</option>
                        <option value="residential">🏠 Residential Building</option>
                        <option value="data_center">🖥️ Server Room / Data Center</option>
                      </select>
                    </div>

                    <div className="form-field-group">
                      <label className="field-label">Estimation Basis</label>
                      <select
                        className="field-select"
                        value={form.estimationMethod}
                        onChange={(e) => setForm({ ...form, estimationMethod: e.target.value })}
                      >
                        <option value="direct_kwh">Direct Metered Energy (kWh)</option>
                        <option value="hvac">HVAC / Cooling Operating Hours</option>
                        <option value="area_benchmark">Floor Area & Occupancy Benchmark</option>
                      </select>
                    </div>
                  </div>

                  {form.estimationMethod === 'direct_kwh' && (
                    <div className="form-field-group">
                      <label className="field-label">Facility Electricity Consumed (kWh)</label>
                      <input
                        type="number"
                        min="0.1"
                        step="any"
                        className="field-input"
                        placeholder="e.g. 250 kWh"
                        value={form.facilityKwh}
                        onChange={(e) => setForm({ ...form, facilityKwh: e.target.value })}
                        required
                      />
                    </div>
                  )}

                  {form.estimationMethod === 'hvac' && (
                    <div className="form-grid-2col">
                      <div className="form-field-group">
                        <label className="field-label">HVAC Hours Active</label>
                        <input
                          type="number"
                          min="0.5"
                          step="any"
                          className="field-input"
                          placeholder="e.g. 8.5 hours"
                          value={form.hvacHours}
                          onChange={(e) => setForm({ ...form, hvacHours: e.target.value })}
                          required
                        />
                      </div>
                      <div className="form-field-group">
                        <label className="field-label">Cooling Unit Power (kW)</label>
                        <input
                          type="number"
                          min="0.5"
                          step="any"
                          className="field-input"
                          placeholder="e.g. 3.5 kW"
                          value={form.hvacKwRating}
                          onChange={(e) => setForm({ ...form, hvacKwRating: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                  )}

                  {form.estimationMethod === 'area_benchmark' && (
                    <div className="form-grid-2col">
                      <div className="form-field-group">
                        <label className="field-label">Floor Area (m²)</label>
                        <input
                          type="number"
                          min="1"
                          step="any"
                          className="field-input"
                          placeholder="e.g. 150 m²"
                          value={form.areaSqMeters}
                          onChange={(e) => setForm({ ...form, areaSqMeters: e.target.value })}
                          required
                        />
                      </div>
                      <div className="form-field-group">
                        <label className="field-label">Active Days</label>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          className="field-input"
                          placeholder="1"
                          value={form.days}
                          onChange={(e) => setForm({ ...form, days: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                  )}

                  <div className="form-field-group">
                    <label className="field-label">AC Refrigerant Leakage (Optional, kg R-410A)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      className="field-input"
                      placeholder="e.g. 0.05 kg"
                      value={form.refrigerantLeakageKg}
                      onChange={(e) => setForm({ ...form, refrigerantLeakageKg: e.target.value })}
                    />
                  </div>
                </>
              )}

              {/* 7. OTHER EMISSION SOURCES */}
              {selectedCategory === 'other' && (
                <>
                  <div className="form-field-group">
                    <label className="field-label">Equipment or Product Type</label>
                    <select
                      className="field-select"
                      value={form.sourceType}
                      onChange={(e) => setForm({ ...form, sourceType: e.target.value })}
                    >
                      <option value="electronics_laptop">💻 Laptop Computer (Embodied 210 kg CO₂e)</option>
                      <option value="electronics_phone">📱 Smartphone (Embodied 70 kg CO₂e)</option>
                      <option value="electronics_monitor">🖥️ External 27" Monitor (Embodied 150 kg CO₂e)</option>
                      <option value="clothing_apparel">👕 Clothing & Apparel (12 kg CO₂e/item)</option>
                      <option value="furniture">🪑 Office Furniture & Desk (45 kg CO₂e/unit)</option>
                      <option value="paper_goods">📄 Paper Goods & Stationery (1.2 kg CO₂e/kg)</option>
                      <option value="general_goods_spend">💳 General Goods Procurement by Spend ($)</option>
                    </select>
                  </div>

                  {form.sourceType === 'general_goods_spend' ? (
                    <div className="form-field-group">
                      <label className="field-label">Total Spend Amount ($ USD)</label>
                      <input
                        type="number"
                        min="1"
                        step="any"
                        className="field-input"
                        placeholder="e.g. $150"
                        value={form.spendAmount}
                        onChange={(e) => setForm({ ...form, spendAmount: e.target.value })}
                        required
                      />
                    </div>
                  ) : (
                    <div className="form-field-group">
                      <label className="field-label">Quantity (Units / Items)</label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        className="field-input"
                        placeholder="e.g. 2"
                        value={form.quantity}
                        onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                        required
                      />
                    </div>
                  )}

                  <div className="form-field-group">
                    <label className="field-label">Procured Item Name / Description (Optional)</label>
                    <input
                      type="text"
                      className="field-input"
                      placeholder="e.g. Dell Latitude 7420 for developer"
                      value={form.itemDescription}
                      onChange={(e) => setForm({ ...form, itemDescription: e.target.value })}
                    />
                  </div>
                </>
              )}

              {/* COMMON FIELDS: Date & Optional Notes */}
              <div className="form-grid-2col">
                <div className="form-field-group">
                  <label className="field-label">Activity Date</label>
                  <input
                    type="date"
                    className="field-input"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    required
                  />
                </div>
                <div className="form-field-group">
                  <label className="field-label">Optional Notes & Purpose</label>
                  <input
                    type="text"
                    className="field-input"
                    placeholder="e.g. Client meeting in South Bay"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </div>
              </div>

              {/* Real-time Dynamic GHG Preview Box */}
              <div className="live-calc-box">
                <div className="live-calc-header">
                  <span>Instant GHG Footprint Preview:</span>
                  <span className="mono" style={{ color: activeCategoryConfig.color }}>
                    {activeCategoryConfig.name}
                  </span>
                </div>
                <div className="live-calc-value" style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
                  <span>{round(liveEstimate.kg)} <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>kg CO₂e</span></span>
                  <span style={{ fontSize: '0.9rem', color: '#94a3b8', fontWeight: 400 }}>
                    ({round(liveEstimate.kg / 1000, 4)} t CO₂e)
                  </span>
                </div>
                <div className="live-calc-formula">
                  {liveEstimate.formula}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <span className="estimate-notice-pill">
                    <Info size={12} />
                    Estimated • GHG Protocol Aligned
                  </span>
                  <span className="source-citation-badge">
                    DEFRA 2024 / IPCC AR6
                  </span>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="btn-log-action"
                disabled={submitting}
                style={{ width: '100%', marginTop: '6px' }}
              >
                <Plus size={16} />
                <span>{submitting ? 'Recording Activity...' : 'Save Activity Record'}</span>
              </button>
            </form>
          </div>

          {/* Right Column: Complete Activity History Ledger */}
          <div className="tracker-card card-chart-large">
            <div className="tracker-card-header" style={{ marginBottom: '14px' }}>
              <div>
                <h2 className="card-section-title">
                  <History size={18} className="icon-mint" />
                  Activity History & Emission Ledger
                </h2>
                <p className="card-subtitle-small">
                  Filter, search, inspect, edit, or delete recorded entries
                </p>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="ledger-toolbar">
              {/* Text Search */}
              <div className="search-input-wrap">
                <Search size={15} />
                <input
                  type="text"
                  placeholder="Search activities, notes, subcategories..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    style={{ position: 'absolute', right: '8px', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="filter-group-wrap">
                {/* Category Filter */}
                <select
                  className="filter-select-compact"
                  value={filterCategory}
                  onChange={(e) => {
                    setFilterCategory(e.target.value);
                    setCurrentPage(1);
                  }}
                  aria-label="Filter by Category"
                >
                  <option value="all">All Categories ({activities.length})</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>

                {/* Date Range Filter */}
                <select
                  className="filter-select-compact"
                  value={filterDateRange}
                  onChange={(e) => {
                    setFilterDateRange(e.target.value);
                    setCurrentPage(1);
                  }}
                  aria-label="Filter by Date Range"
                >
                  <option value="all">All Dates</option>
                  <option value="today">Today</option>
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                  <option value="90d">Last 90 Days</option>
                  <option value="custom">Custom Range...</option>
                </select>

                {/* Page Size */}
                <select
                  className="filter-select-compact"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  aria-label="Page Size"
                >
                  <option value={10}>10 / page</option>
                  <option value={20}>20 / page</option>
                  <option value={50}>50 / page</option>
                </select>

                {/* Factors Registry Explorer Button */}
                <button
                  type="button"
                  onClick={handleOpenFactorsModal}
                  className="btn-factors-explorer"
                  title="Browse centralized database of scientific emission factors"
                >
                  <Database size={13} />
                  <span>Factor Registry</span>
                </button>
              </div>
            </div>

            {/* Custom Date Pickers if 'custom' selected */}
            {filterDateRange === 'custom' && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
                <span className="field-label">From:</span>
                <input
                  type="date"
                  className="filter-select-compact"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                />
                <span className="field-label">To:</span>
                <input
                  type="date"
                  className="filter-select-compact"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                />
              </div>
            )}

            {/* Metric Summary Strip for Current Selection */}
            <div className="dashboard-summary-strip" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px' }}>
              <div className="summary-metric-card" style={{ padding: '10px 14px' }}>
                <span className="summary-card-title">Filtered Emissions</span>
                <div className="summary-card-value-row" style={{ margin: '2px 0 0' }}>
                  <span className="summary-card-value" style={{ fontSize: '1.25rem' }}>{round(stats.totalEmissions)}</span>
                  <span className="summary-card-unit">kg CO₂e</span>
                </div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>
                  ≈ {round(stats.totalEmissions / 1000, 3)} tonnes CO₂e
                </div>
              </div>
              <div className="summary-metric-card" style={{ padding: '10px 14px' }}>
                <span className="summary-card-title">Matching Entries</span>
                <div className="summary-card-value-row" style={{ margin: '2px 0 0' }}>
                  <span className="summary-card-value" style={{ fontSize: '1.25rem' }}>{stats.count}</span>
                  <span className="summary-card-unit">records</span>
                </div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>
                  PostgreSQL audit ledger
                </div>
              </div>
              <div className="summary-metric-card" style={{ padding: '10px 14px' }}>
                <span className="summary-card-title">Average / Activity</span>
                <div className="summary-card-value-row" style={{ margin: '2px 0 0' }}>
                  <span className="summary-card-value" style={{ fontSize: '1.25rem' }}>{round(stats.avg)}</span>
                  <span className="summary-card-unit">kg CO₂e</span>
                </div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>
                  ≈ {round(stats.avg / 1000, 4)} tonnes CO₂e
                </div>
              </div>
              <div className="summary-metric-card" style={{ padding: '10px 14px' }}>
                <span className="summary-card-title">Peak Entry</span>
                <div className="summary-card-value-row" style={{ margin: '2px 0 0' }}>
                  <span className="summary-card-value" style={{ fontSize: '1.25rem' }}>{round(stats.max)}</span>
                  <span className="summary-card-unit">kg CO₂e</span>
                </div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>
                  Single highest footprint
                </div>
              </div>
            </div>

            {/* Activity Table */}
            <div className="activity-table-wrapper" style={{ minHeight: '320px' }}>
              {loading ? (
                <div className="empty-state-notice">
                  <RefreshCw size={24} className="spin icon-mint" />
                  <span>Loading activity ledger from PostgreSQL...</span>
                </div>
              ) : paginatedActivities.length === 0 ? (
                <div className="empty-state-notice">
                  <Leaf size={28} className="icon-mint" />
                  <span>No activities found matching your criteria. Use the form on the left to record an entry.</span>
                </div>
              ) : (
                <table className="custom-data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '95px' }}>Date</th>
                      <th style={{ width: '150px' }}>Category</th>
                      <th>Activity Details</th>
                      <th>Notes / Reference</th>
                      <th style={{ width: '155px' }}>Emission (Dual Unit)</th>
                      <th style={{ width: '80px', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedActivities.map((act) => {
                      const catConfig = CATEGORIES.find((c) => c.id === act.activity_type) || CATEGORIES[0];
                      const Icon = catConfig.icon;
                      const dateStr = act.date ? new Date(act.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Today';
                      const tonnesVal = act.details?.emissions_tonnes ?? (Number(act.carbon_emissions) / 1000);

                      return (
                        <tr key={act.id}>
                          <td className="mono" style={{ whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
                            {dateStr}
                          </td>
                          <td>
                            <span className="category-cell-badge">
                              <Icon size={14} style={{ color: catConfig.color }} />
                              <span style={{ textTransform: 'capitalize' }}>{catConfig.name}</span>
                            </span>
                          </td>
                          <td style={{ fontSize: '0.8rem' }}>
                            <strong style={{ color: '#ffffff' }}>{formatActivityDetails(act)}</strong>
                          </td>
                          <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            {act.details?.notes || act.details?.billReference || act.details?.itemDescription || '—'}
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
                                <strong className="text-mint" style={{ fontSize: '0.86rem' }}>
                                  {round(act.carbon_emissions)} kg
                                </strong>
                                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                                  ({round(tonnesVal, 4)} t)
                                </span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <button
                                  type="button"
                                  onClick={() => handleInspectCalculation(act)}
                                  className={`btn-scope-pill ${(act.details?.scope || 'Scope 3').toLowerCase().replace(' ', '-')}`}
                                  title="Inspect scientific methodology & verified factors"
                                >
                                  <Info size={10} />
                                  <span>{act.details?.scope || 'Scope 3'}</span>
                                </button>
                              </div>
                            </div>
                          </td>
                          <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <button
                              onClick={() => openEditModal(act)}
                              className="btn-edit-inline"
                              title="Edit this activity"
                              type="button"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              onClick={() => handleDelete(act.id)}
                              className="btn-trash-inline"
                              title="Delete from ledger"
                              type="button"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="pagination-container">
                <div>
                  Showing {Math.min((currentPage - 1) * pageSize + 1, filteredActivities.length)}–
                  {Math.min(currentPage * pageSize, filteredActivities.length)} of {filteredActivities.length} activities
                </div>
                <div className="pagination-controls">
                  <button
                    type="button"
                    className="page-btn"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  {Array.from({ length: totalPages }).map((_, idx) => {
                    const pageNum = idx + 1;
                    if (
                      pageNum === 1 ||
                      pageNum === totalPages ||
                      (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                    ) {
                      return (
                        <button
                          key={pageNum}
                          type="button"
                          className={`page-btn ${pageNum === currentPage ? 'active' : ''}`}
                          onClick={() => setCurrentPage(pageNum)}
                        >
                          {pageNum}
                        </button>
                      );
                    }
                    if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
                      return <span key={pageNum} style={{ padding: '0 2px' }}>...</span>;
                    }
                    return null;
                  })}
                  <button
                    type="button"
                    className="page-btn"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Edit Activity Modal */}
        {editingActivity && editForm && (
          <div className="modal-overlay" onClick={() => setEditingActivity(null)}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Edit3 size={18} className="icon-mint" />
                  <h3 style={{ margin: 0, fontSize: '1rem', color: '#ffffff' }}>
                    Edit Activity #{editingActivity.id}
                  </h3>
                </div>
                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={() => setEditingActivity(null)}
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleUpdate} className="dynamic-form-fields">
                <div className="form-field-group">
                  <label className="field-label">Category</label>
                  <input
                    type="text"
                    className="field-input"
                    value={editingActivity.activity_type.toUpperCase()}
                    disabled
                    style={{ opacity: 0.7 }}
                  />
                </div>

                {/* Edit fields by category */}
                {editingActivity.activity_type === 'food' && (
                  <>
                    <div className="form-field-group">
                      <label className="field-label">Diet & Meal Type</label>
                      <select
                        className="field-select"
                        value={editForm.mealType || 'meat_average'}
                        onChange={(e) => setEditForm({ ...editForm, mealType: e.target.value })}
                      >
                        <option value="vegan">🌱 100% Plant-Based / Vegan</option>
                        <option value="vegetarian">🥗 Vegetarian with Dairy/Eggs</option>
                        <option value="dairy">🧀 Dairy & Cheese</option>
                        <option value="seafood">🐟 Fish & Seafood</option>
                        <option value="meat_average">🍗 Average Non-Veg / Poultry</option>
                        <option value="meat_high">🥩 High-Carbon Meat / Beef</option>
                      </select>
                    </div>
                    <div className="form-grid-2col">
                      <div className="form-field-group">
                        <label className="field-label">Quantity (Meals)</label>
                        <input
                          type="number"
                          min="1"
                          className="field-input"
                          value={editForm.quantity || editForm.value || 1}
                          onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                          required
                        />
                      </div>
                      <div className="form-field-group">
                        <label className="field-label">Food Waste (kg)</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          className="field-input"
                          value={editForm.foodWasteKg || ''}
                          onChange={(e) => setEditForm({ ...editForm, foodWasteKg: e.target.value })}
                        />
                      </div>
                    </div>
                  </>
                )}

                {editingActivity.activity_type === 'electricity' && (
                  <>
                    <div className="form-field-group">
                      <label className="field-label">Energy Source</label>
                      <select
                        className="field-select"
                        value={editForm.energySource || 'grid'}
                        onChange={(e) => setEditForm({ ...editForm, energySource: e.target.value })}
                      >
                        <option value="grid">⚡ National Grid Average</option>
                        <option value="coal">🏭 Coal-Dominated Grid</option>
                        <option value="natural_gas">🔥 Natural Gas</option>
                        <option value="renewable">🌿 Certified Renewable</option>
                        <option value="solar">☀️ Solar Self-Consumption</option>
                        <option value="diesel_generator">⛽ Diesel Generator</option>
                      </select>
                    </div>
                    <div className="form-grid-2col">
                      <div className="form-field-group">
                        <label className="field-label">Electricity (kWh)</label>
                        <input
                          type="number"
                          min="0.1"
                          step="any"
                          className="field-input"
                          value={editForm.kwh || editForm.value || ''}
                          onChange={(e) => setEditForm({ ...editForm, kwh: e.target.value })}
                          required
                        />
                      </div>
                      <div className="form-field-group">
                        <label className="field-label">Solar Offset (kWh)</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          className="field-input"
                          value={editForm.solarGenerationKwh || ''}
                          onChange={(e) => setEditForm({ ...editForm, solarGenerationKwh: e.target.value })}
                        />
                      </div>
                    </div>
                  </>
                )}

                {editingActivity.activity_type === 'transport' && (
                  <>
                    <div className="form-field-group">
                      <label className="field-label">Mode of Travel</label>
                      <select
                        className="field-select"
                        value={editForm.transportMode || 'car_petrol'}
                        onChange={(e) => setEditForm({ ...editForm, transportMode: e.target.value })}
                      >
                        <option value="car_petrol">🚗 Petrol / Gasoline Car</option>
                        <option value="car_diesel">🚙 Diesel Car</option>
                        <option value="car_hybrid">🔋 Hybrid Electric</option>
                        <option value="car_ev">⚡ Battery Electric EV</option>
                        <option value="motorbike">🏍️ Motorcycle</option>
                        <option value="bus">🚌 Public Bus</option>
                        <option value="train">🚆 Passenger Train</option>
                        <option value="flight_economy">✈️ Commercial Flight - Economy</option>
                        <option value="flight_business">🛫 Flight - Business Class</option>
                        <option value="walking_cycling">🚲 Walking or Cycling</option>
                      </select>
                    </div>
                    <div className="form-grid-2col">
                      <div className="form-field-group">
                        <label className="field-label">Distance (km)</label>
                        <input
                          type="number"
                          min="0.1"
                          step="any"
                          className="field-input"
                          value={editForm.distanceKm || editForm.value || ''}
                          onChange={(e) => setEditForm({ ...editForm, distanceKm: e.target.value })}
                          required
                        />
                      </div>
                      <div className="form-field-group">
                        <label className="field-label">Passengers</label>
                        <input
                          type="number"
                          min="1"
                          className="field-input"
                          value={editForm.passengers || 1}
                          onChange={(e) => setEditForm({ ...editForm, passengers: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                  </>
                )}

                {editingActivity.activity_type === 'water' && (
                  <div className="form-grid-2col">
                    <div className="form-field-group">
                      <label className="field-label">Water Consumption</label>
                      <input
                        type="number"
                        min="0.1"
                        step="any"
                        className="field-input"
                        value={editForm.volume || editForm.value || ''}
                        onChange={(e) => setEditForm({ ...editForm, volume: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-field-group">
                      <label className="field-label">Source & Grade</label>
                      <select
                        className="field-select"
                        value={editForm.waterSource || 'tap_cold'}
                        onChange={(e) => setEditForm({ ...editForm, waterSource: e.target.value })}
                      >
                        <option value="tap_cold">🚰 Cold Municipal Tap</option>
                        <option value="tap_hot">♨️ Hot Water</option>
                        <option value="bottled">🍾 Bottled Water</option>
                        <option value="groundwater">🚜 Groundwater</option>
                      </select>
                    </div>
                  </div>
                )}

                {editingActivity.activity_type === 'waste' && (
                  <div className="form-grid-2col">
                    <div className="form-field-group">
                      <label className="field-label">Quantity (kg)</label>
                      <input
                        type="number"
                        min="0.1"
                        step="any"
                        className="field-input"
                        value={editForm.wasteQuantityKg || editForm.value || ''}
                        onChange={(e) => setEditForm({ ...editForm, wasteQuantityKg: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-field-group">
                      <label className="field-label">Treatment Method</label>
                      <select
                        className="field-select"
                        value={editForm.treatmentMethod || 'landfill'}
                        onChange={(e) => setEditForm({ ...editForm, treatmentMethod: e.target.value })}
                      >
                        <option value="landfill">Landfill</option>
                        <option value="recycled">Recycling</option>
                        <option value="composted">Composting</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Common fields in edit */}
                <div className="form-grid-2col">
                  <div className="form-field-group">
                    <label className="field-label">Date</label>
                    <input
                      type="date"
                      className="field-input"
                      value={editForm.date || ''}
                      onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-field-group">
                    <label className="field-label">Notes</label>
                    <input
                      type="text"
                      className="field-input"
                      value={editForm.notes || ''}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    />
                  </div>
                </div>

                {/* Live edit preview */}
                <div className="live-calc-box">
                  <div className="live-calc-header">
                    <span>Recalculated Emission:</span>
                    <span className="mono" style={{ color: 'var(--color-mint)' }}>
                      {round(editEstimate.kg)} kg CO₂e
                    </span>
                  </div>
                  <div className="live-calc-formula">{editEstimate.formula}</div>
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                  <button
                    type="button"
                    className="page-btn"
                    onClick={() => setEditingActivity(null)}
                    style={{ padding: '8px 16px' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-log-action"
                    disabled={updating}
                    style={{ padding: '8px 18px' }}
                  >
                    <CheckCircle2 size={15} />
                    <span>{updating ? 'Saving...' : 'Update Activity'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Scientific Emission Calculation Inspector Modal */}
        {inspectingActivity && (
          <div
            className="modal-overlay"
            onClick={() => {
              setInspectingActivity(null);
              setInspectingEmission(null);
            }}
          >
            <div
              className="modal-card"
              style={{ maxWidth: '640px' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Scale size={18} className="icon-mint" />
                  <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#ffffff' }}>
                    Scientific Emission Calculation • Activity #{inspectingActivity.id}
                  </h3>
                </div>
                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={() => {
                    setInspectingActivity(null);
                    setInspectingEmission(null);
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              {inspectingLoading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                  <RefreshCw size={24} className="spin icon-mint" style={{ margin: '0 auto 8px' }} />
                  <div>Retrieving linked calculation record from PostgreSQL...</div>
                </div>
              ) : inspectingEmission ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Scope & Estimation Status */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <span
                      className={`btn-scope-pill ${(inspectingEmission.scope || 'Scope 3').toLowerCase().replace(' ', '-')}`}
                      style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                    >
                      {inspectingEmission.scope || 'Scope 3'} Protocol
                    </span>
                    <span className="estimate-notice-pill">
                      <Info size={13} />
                      Estimated Value • Factor Model
                    </span>
                  </div>

                  {/* Dual Emissions Card */}
                  <div
                    className="math-step-card"
                    style={{ background: 'rgba(16, 185, 129, 0.05)', borderColor: 'rgba(16, 185, 129, 0.25)' }}
                  >
                    <span className="math-step-title" style={{ color: '#10b981' }}>
                      Calculated Carbon Footprint (Dual Reporting)
                    </span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px', flexWrap: 'wrap' }}>
                      <div>
                        <span style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ffffff', fontFamily: 'JetBrains Mono' }}>
                          {round(inspectingEmission.emissions_kg)}
                        </span>
                        <span style={{ fontSize: '0.85rem', color: '#10b981', marginLeft: '4px', fontWeight: 600 }}>
                          kg CO₂e
                        </span>
                      </div>
                      <span style={{ color: '#64748b', fontSize: '1.2rem' }}>=</span>
                      <div>
                        <span style={{ fontSize: '1.6rem', fontWeight: 800, color: '#38bdf8', fontFamily: 'JetBrains Mono' }}>
                          {round(inspectingEmission.emissions_tonnes, 4)}
                        </span>
                        <span style={{ fontSize: '0.85rem', color: '#38bdf8', marginLeft: '4px', fontWeight: 600 }}>
                          tonnes CO₂e
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Sourced Emission Factor Info */}
                  <div className="math-step-card">
                    <span className="math-step-title">Centralized Emission Factor Reference</span>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.8rem' }}>
                      <div>
                        <span style={{ color: '#94a3b8' }}>Activity Key: </span>
                        <strong className="mono" style={{ color: '#ffffff' }}>
                          {inspectingEmission.factor_used ||
                            inspectingActivity.details?.transportMode ||
                            inspectingActivity.details?.mealType ||
                            inspectingActivity.activity_type}
                        </strong>
                      </div>
                      <div>
                        <span style={{ color: '#94a3b8' }}>GHG Scope: </span>
                        <strong style={{ color: '#ffffff' }}>{inspectingEmission.scope || 'Scope 3'}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#94a3b8' }}>Scientific Source: </span>
                        <span className="source-citation-badge">
                          {inspectingEmission.factor_source ||
                            inspectingActivity.details?.factor_source ||
                            'UK DEFRA / DESNZ 2024'}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: '#94a3b8' }}>Regional Baseline: </span>
                        <strong style={{ color: '#ffffff' }}>
                          {inspectingEmission.region || 'Global / UK DEFRA'}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Methodology & Calculation Formula */}
                  <div className="math-step-card">
                    <span className="math-step-title">Methodology & Formula</span>
                    <div className="math-step-content">
                      {inspectingEmission.methodology ||
                        'Activity data quantity multiplied by verified scientific emission factor with lifecycle adjustments.'}
                    </div>
                  </div>

                  {/* Assumptions & Double Counting Safeguards */}
                  <div className="math-step-card">
                    <span className="math-step-title">Double-Counting Prevention & Assumptions</span>
                    <ul className="assumption-list">
                      {(Array.isArray(inspectingEmission.assumptions)
                        ? inspectingEmission.assumptions
                        : [inspectingEmission.assumptions || 'Standard activity data multiplication; passenger allocation applied where relevant.']
                      ).map((asmp, i) => (
                        <li key={i}>{asmp}</li>
                      ))}
                      <li>Double-counting safeguarded: carpooling trip emissions divided across passengers; on-site solar generation deducted from grid power.</li>
                    </ul>
                  </div>

                  {/* Database Connection Trace */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '0.72rem',
                      color: '#64748b',
                      borderTop: '1px solid rgba(255,255,255,0.06)',
                      paddingTop: '10px',
                    }}
                  >
                    <span>Linked PostgreSQL Record: activity_emissions #{inspectingEmission.id || inspectingActivity.id}</span>
                    <span style={{ color: '#10b981' }}>✓ Connected & Synchronized</span>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* Centralized Scientific Emission Factors Registry Modal */}
        {showFactorsModal && (
          <div className="modal-overlay" onClick={() => setShowFactorsModal(false)}>
            <div
              className="modal-card"
              style={{ maxWidth: '840px' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Database size={18} className="icon-mint" />
                  <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#ffffff' }}>
                    Centralized Scientific Emission Factors Registry
                  </h3>
                </div>
                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={() => setShowFactorsModal(false)}
                >
                  <X size={18} />
                </button>
              </div>

              <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>
                Centralized registry of peer-reviewed emission factors stored in PostgreSQL with verifiable citations (UK DEFRA 2024, US EPA eGRID 2024, IPCC AR6, Poore & Nemecek 2018).
              </p>

              {/* Filter and Search */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Search factor name, key, or source..."
                  className="field-input"
                  style={{ flex: 1, minWidth: '200px' }}
                  value={factorSearch}
                  onChange={(e) => setFactorSearch(e.target.value)}
                />
                <select
                  className="filter-select-compact"
                  value={factorCategoryFilter}
                  onChange={(e) => setFactorCategoryFilter(e.target.value)}
                >
                  <option value="all">All Categories ({factorsList.length})</option>
                  <option value="food">Food & Diet</option>
                  <option value="electricity">Electricity & Energy</option>
                  <option value="transport">Transportation</option>
                  <option value="water">Water Usage</option>
                  <option value="waste">Waste Management</option>
                  <option value="facilities">Facilities & Buildings</option>
                  <option value="other">Other Sources</option>
                </select>
              </div>

              {/* Factors Table */}
              <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
                {factorsLoading ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                    <RefreshCw size={24} className="spin icon-mint" style={{ margin: '0 auto 8px' }} />
                    <div>Querying emission_factors table in PostgreSQL...</div>
                  </div>
                ) : filteredFactors.length === 0 ? (
                  <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>
                    No emission factors matched your search query.
                  </div>
                ) : (
                  <table className="custom-data-table" style={{ fontSize: '0.78rem' }}>
                    <thead>
                      <tr>
                        <th>Category</th>
                        <th>Activity / Material</th>
                        <th>Factor (kg CO₂e)</th>
                        <th>Unit</th>
                        <th>Scope</th>
                        <th>Documented Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredFactors.map((f, idx) => (
                        <tr key={f.id || idx}>
                          <td style={{ textTransform: 'capitalize', color: '#38bdf8' }}>{f.category}</td>
                          <td>
                            <strong style={{ color: '#ffffff' }}>{f.name || f.activity_key}</strong>
                          </td>
                          <td className="mono" style={{ color: '#10b981', fontWeight: 600 }}>
                            {f.factor_kg_co2e ?? f.factorKgCo2e}
                          </td>
                          <td className="mono" style={{ color: '#94a3b8' }}>{f.unit}</td>
                          <td>
                            <span
                              className={`btn-scope-pill ${(f.scope || 'Scope 3').toLowerCase().replace(' ', '-')}`}
                            >
                              {f.scope}
                            </span>
                          </td>
                          <td>
                            <span className="source-citation-badge">{f.source}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ActivityTracker;
