import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import Layout from '../components/Layout';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Award,
  Bell,
  Building2,
  Calendar,
  Car,
  CheckCircle2,
  ChevronRight,
  CloudSun,
  Droplets,
  ExternalLink,
  Flame,
  Globe,
  History,
  Info,
  Leaf,
  MapPin,
  Package,
  Plus,
  Recycle,
  RefreshCw,
  Sparkles,
  Target,
  Thermometer,
  Trash2,
  TrendingDown,
  TrendingUp,
  Utensils,
  Wind,
  X,
  Zap,
} from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const EMISSION_CONFIG = {
  transport: { label: 'Transportation', unit: 'km', factor: 0.21, icon: Car, color: '#16845B' },
  electricity: { label: 'Electricity', unit: 'kWh', factor: 0.5, icon: Zap, color: '#3B82F6' },
  food: { label: 'Food & Diet', unit: 'meals', factor: 2.5, icon: Utensils, color: '#E29D42' },
  water: { label: 'Water Usage', unit: 'm³', factor: 0.35, icon: Droplets, color: '#06B6D4' },
  waste: { label: 'Waste Management', unit: 'kg', factor: 0.45, icon: Recycle, color: '#61B88B' },
  facilities: { label: 'Facilities', unit: 'kWh', factor: 0.5, icon: Building2, color: '#8B5CF6' },
  flight: { label: 'Flights', unit: 'km', factor: 0.255, icon: Car, color: '#EC4899' },
  other: { label: 'Other', unit: 'items', factor: 5.0, icon: Package, color: '#718096' },
};

const round = (val, d = 1) => (val != null && !Number.isNaN(Number(val)) ? Number(val).toFixed(d) : '0.0');

const Dashboard = () => {
  const [period, setPeriod] = useState('30');
  const [intelligence, setIntelligence] = useState(null);
  const [activities, setActivities] = useState([]);
  const [coachPlan, setCoachPlan] = useState(null);
  const [forecastData, setForecastData] = useState(null);
  const [regions, setRegions] = useState([]);
  const [selectedRegionId, setSelectedRegionId] = useState('');
  const [envSummary, setEnvSummary] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Quick Activity Modal State
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickCategory, setQuickCategory] = useState('electricity');
  const [quickValue, setQuickValue] = useState('');
  const [quickDate, setQuickDate] = useState(new Date().toISOString().split('T')[0]);
  const [quickNotes, setQuickNotes] = useState('');
  const [isSubmittingQuick, setIsSubmittingQuick] = useState(false);
  const [quickSuccess, setQuickSuccess] = useState(false);

  // Primary Data Fetch
  const loadDashboardData = useCallback(async () => {
    try {
      const [intelRes, actRes, coachRes, regRes, alertRes, forecastRes] = await Promise.allSettled([
        api.get(`/intelligence?period=${period}`),
        api.get('/activities'),
        api.get('/coach/plan'),
        api.get('/environment/regions'),
        api.get('/environment/alerts'),
        api.get('/forecast?horizon=30'),
      ]);

      if (intelRes.status === 'fulfilled') setIntelligence(intelRes.value.data);
      if (actRes.status === 'fulfilled') {
        const raw = actRes.value.data;
        setActivities(Array.isArray(raw) ? raw : raw?.activities || []);
      }
      if (coachRes.status === 'fulfilled') setCoachPlan(coachRes.value.data);
      if (alertRes.status === 'fulfilled') setAlerts(alertRes.value.data || []);
      if (forecastRes.status === 'fulfilled') setForecastData(forecastRes.value.data);

      if (regRes.status === 'fulfilled' && regRes.value.data?.length > 0) {
        const list = regRes.value.data;
        setRegions(list);
        setSelectedRegionId((prev) => prev || String(list[0].id));
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Listen for global quick add trigger from Header
  useEffect(() => {
    const handleOpenQuickAdd = () => setIsQuickAddOpen(true);
    const handleDateRangeChange = (e) => {
      const val = e.detail;
      if (val === '7d') setPeriod('7');
      else if (val === '30d') setPeriod('30');
      else if (val === '90d') setPeriod('90');
      else if (val === '1y') setPeriod('365');
    };

    window.addEventListener('carbonwise:open-quick-add', handleOpenQuickAdd);
    window.addEventListener('carbonwise:date-range-change', handleDateRangeChange);
    const handleSync = () => { loadDashboardData(); };
    window.addEventListener('carbonwise:activity-recorded', handleSync);
    window.addEventListener('carbonwise:action-updated', handleSync);
    return () => {
      window.removeEventListener('carbonwise:open-quick-add', handleOpenQuickAdd);
      window.removeEventListener('carbonwise:date-range-change', handleDateRangeChange);
      window.removeEventListener('carbonwise:activity-recorded', handleSync);
      window.removeEventListener('carbonwise:action-updated', handleSync);
    };
  }, [loadDashboardData]);

  // Load Environmental Telemetry for selected region
  useEffect(() => {
    if (!selectedRegionId) return;
    let isMounted = true;
    const fetchEnvData = async () => {
      try {
        const res = await api.get(`/environment/regions/${selectedRegionId}/summary`);
        if (isMounted) setEnvSummary(res.data);
      } catch (err) {
        console.warn('Telemetry fetch error:', err);
      }
    };
    fetchEnvData();
    return () => { isMounted = false; };
  }, [selectedRegionId]);

  // Quick Activity Submission
  const handleQuickSubmit = async (e) => {
    e.preventDefault();
    const val = parseFloat(quickValue);
    if (!val || val <= 0) return;

    try {
      setIsSubmittingQuick(true);
      await api.post('/activities', {
        activity_type: quickCategory,
        activity_date: quickDate,
        notes: quickNotes || undefined,
        details: {
          value: val,
          unit: EMISSION_CONFIG[quickCategory]?.unit || 'units',
        },
      });

      setQuickValue('');
      setQuickNotes('');
      setQuickSuccess(true);
      setTimeout(() => {
        setQuickSuccess(false);
        setIsQuickAddOpen(false);
      }, 1200);

      await loadDashboardData();
      window.dispatchEvent(new CustomEvent('carbonwise:activity-recorded'));
    } catch (err) {
      console.error('Failed to add activity:', err);
    } finally {
      setIsSubmittingQuick(false);
    }
  };

  // Delete Activity Handler
  const handleDeleteActivity = async (id) => {
    if (!window.confirm('Delete this activity entry?')) return;
    try {
      await api.delete(`/activities/${id}`);
      await loadDashboardData();
      window.dispatchEvent(new CustomEvent('carbonwise:activity-recorded'));
    } catch (err) {
      console.error('Failed to delete activity:', err);
    }
  };

  // Acknowledge Alert Handler
  const handleAckAlert = async (alertId) => {
    try {
      await api.patch(`/environment/alerts/${alertId}`, { status: 'acknowledged' });
      setAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, status: 'acknowledged' } : a)));
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    }
  };

  // KPI Calculations
  const currentFootprint = intelligence?.totals?.currentPeriod || 0;
  const previousFootprint = intelligence?.totals?.previousPeriod || 0;
  const percentageChange = intelligence?.comparison?.percentageChange;
  const isReduction = percentageChange != null && percentageChange < 0;

  // Specific Sector Emissions for the 5 Summary Cards
  const categoryBreakdown = useMemo(() => intelligence?.categoryBreakdown || [], [intelligence]);

  const foodData = categoryBreakdown.find((c) => c.category === 'food');
  const foodEmissions = foodData ? foodData.emissions : 0;
  const foodShare = foodData ? foodData.contributionPercentage : 0;

  const elecData = categoryBreakdown.find((c) => c.category === 'electricity');
  const elecEmissions = elecData ? elecData.emissions : 0;
  const elecShare = elecData ? elecData.contributionPercentage : 0;

  const transportData = categoryBreakdown.filter((c) => c.category === 'transport' || c.category === 'flight');
  const transportEmissions = transportData.reduce((acc, curr) => acc + (curr.emissions || 0), 0);
  const transportShare = currentFootprint > 0 ? Math.round((transportEmissions / currentFootprint) * 100) : 0;

  // Reduction Progress from Coach Plan
  const completedActions = coachPlan?.actions?.filter((a) => a.status === 'completed')?.length || 0;
  const totalActions = coachPlan?.actions?.length || 5;
  const reductionProgressPercent = totalActions > 0 ? Math.round((completedActions / totalActions) * 100) : 0;

  // Highest Emission Category
  const topCategory = intelligence?.largestSources?.[0];

  // AI Prediction Highlights
  const forecastTotal = forecastData?.forecast?.totalProjected || (currentFootprint * 1.02);
  const forecastTrend = forecastData?.forecast?.trendDirection || 'stable';
  const dataSufficiency = forecastData?.dataQuality?.isSufficient ?? true;

  // Environmental Telemetry - tolerant across direct current properties or metrics array
  const currentTemp = envSummary?.current?.temperature ?? envSummary?.metrics?.find(m => m.metric === 'temperature')?.latest;
  const currentHumidity = envSummary?.current?.relative_humidity ?? envSummary?.metrics?.find(m => m.metric === 'relative_humidity')?.latest;
  const currentWind = envSummary?.current?.wind_speed ?? envSummary?.metrics?.find(m => m.metric === 'wind_speed')?.latest;
  const currentAqi = envSummary?.current?.us_aqi ?? envSummary?.metrics?.find(m => m.metric === 'pm25')?.latest ?? envSummary?.airQuality?.measurements?.[0]?.value;

  // Trend Chart Data (Professional White Theme styling)
  const lineChartData = useMemo(() => {
    const trends = intelligence?.trends || [];
    const labels = trends.map((t) => t.date?.slice(5) || '');
    const dataPoints = trends.map((t) => t.emissions || 0);

    return {
      labels: labels.length ? labels : ['No Data'],
      datasets: [
        {
          label: 'Daily Carbon Emissions (kg CO₂e)',
          data: dataPoints.length ? dataPoints : [0],
          borderColor: '#16845B',
          backgroundColor: 'rgba(22, 132, 91, 0.08)',
          borderWidth: 2.2,
          pointBackgroundColor: '#16845B',
          pointBorderColor: '#FFFFFF',
          pointBorderWidth: 1.5,
          pointRadius: trends.length > 20 ? 1 : 3.5,
          pointHoverRadius: 6,
          tension: 0.35,
          fill: true,
        },
      ],
    };
  }, [intelligence]);

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: '#183247',
        titleColor: '#FFFFFF',
        bodyColor: '#EAF6EF',
        padding: 10,
        cornerRadius: 8,
        displayColors: false,
        callbacks: {
          label: (context) => ` ${context.parsed.y} kg CO₂e`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#718096', font: { size: 11, family: 'DM Sans' } },
      },
      y: {
        beginAtZero: true,
        grid: { color: '#E4EBE6', drawBorder: false },
        ticks: { color: '#718096', font: { size: 11, family: 'DM Sans' } },
      },
    },
  };

  // Doughnut Chart Data
  const doughnutData = useMemo(() => {
    if (!categoryBreakdown.length) {
      return {
        labels: ['No Activity Recorded'],
        datasets: [{ data: [1], backgroundColor: ['#E4EBE6'] }],
      };
    }

    const palette = ['#16845B', '#61B88B', '#E29D42', '#3B82F6', '#8B5CF6', '#06B6D4', '#718096'];
    return {
      labels: categoryBreakdown.map((c) => c.label),
      datasets: [
        {
          data: categoryBreakdown.map((c) => c.emissions),
          backgroundColor: categoryBreakdown.map((c, i) => EMISSION_CONFIG[c.category]?.color || palette[i % palette.length]),
          borderWidth: 2,
          borderColor: '#FFFFFF',
          hoverOffset: 4,
        },
      ],
    };
  }, [categoryBreakdown]);

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '72%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: '#183247',
          font: { size: 11, family: 'DM Sans', weight: 500 },
          padding: 14,
          usePointStyle: true,
          boxWidth: 8,
        },
      },
      tooltip: {
        backgroundColor: '#183247',
        titleColor: '#FFFFFF',
        bodyColor: '#EAF6EF',
        padding: 10,
        cornerRadius: 8,
        callbacks: {
          label: (context) => ` ${context.label}: ${context.parsed} kg CO₂e`,
        },
      },
    },
  };

  // Estimated quick-log preview
  const quickEstKg = useMemo(() => {
    const v = parseFloat(quickValue);
    if (!v || v <= 0) return 0;
    const factor = EMISSION_CONFIG[quickCategory]?.factor || 0.5;
    return round(v * factor, 2);
  }, [quickCategory, quickValue]);

  if (loading) {
    return (
      <Layout>
        <div className="white-loading-container">
          <RefreshCw size={28} className="spin text-emerald" />
          <h2>Loading CarbonWise AI Dashboard...</h2>
          <p>Syncing carbon activities, predictive models, and environmental telemetry.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="dashboard-page-white">
        {/* ========================================================
            SUB-HEADER TOOLBAR: TIMEFRAME & QUICK ACTION
        ======================================================== */}
        <div className="white-toolbar-card">
          <div className="toolbar-left">
            <span className="live-status-pill-emerald">
              <span className="live-dot-emerald" />
              <span>Real-Time Carbon Accounting Active</span>
            </span>
            <span className="toolbar-divider" />
            <div className="toolbar-location">
              <MapPin size={14} className="text-emerald" />
              <span>Telemetry Node:</span>
              <select
                value={selectedRegionId}
                onChange={(e) => setSelectedRegionId(e.target.value)}
                className="toolbar-select"
                aria-label="Environmental Node"
              >
                {regions.map((reg) => (
                  <option key={reg.id} value={reg.id}>
                    {reg.name} ({reg.country})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="toolbar-right">
            <div className="timeframe-pill-group">
              <button
                type="button"
                className={`timeframe-btn ${period === '7' ? 'active' : ''}`}
                onClick={() => setPeriod('7')}
              >
                7 Days
              </button>
              <button
                type="button"
                className={`timeframe-btn ${period === '30' ? 'active' : ''}`}
                onClick={() => setPeriod('30')}
              >
                30 Days
              </button>
              <button
                type="button"
                className={`timeframe-btn ${period === '90' ? 'active' : ''}`}
                onClick={() => setPeriod('90')}
              >
                90 Days
              </button>
              <button
                type="button"
                className={`timeframe-btn ${period === '365' ? 'active' : ''}`}
                onClick={() => setPeriod('365')}
              >
                1 Year
              </button>
            </div>

            <button
              type="button"
              className="btn-emerald-primary"
              onClick={() => setIsQuickAddOpen(true)}
            >
              <Plus size={15} />
              <span>Quick Add Activity</span>
            </button>
          </div>
        </div>

        {/* ========================================================
            EXACT 5 SUMMARY CARDS REQUESTED BY USER:
            1. Total CO2e Emissions
            2. Food Emissions
            3. Electricity Emissions
            4. Transportation Emissions
            5. Reduction Progress
        ======================================================== */}
        <div className="summary-cards-grid-5">
          {/* 1. Total CO2e Emissions */}
          <div className="saas-summary-card">
            <div className="saas-card-head">
              <span className="saas-card-label">Total CO₂e Emissions</span>
              <span className="saas-icon-badge emerald">
                <Leaf size={16} />
              </span>
            </div>
            <div className="saas-card-metric-row">
              <span className="saas-card-val">{round(currentFootprint)}</span>
              <span className="saas-card-unit">kg CO₂e</span>
            </div>
            <div className="saas-card-subinfo">
              <span className="saas-tonnes-tag">{round(currentFootprint / 1000, 3)} tonnes</span>
              <span className={`saas-trend-badge ${isReduction ? 'positive' : 'negative'}`} title={`Prior period: ${round(previousFootprint)} kg CO₂e`}>
                {percentageChange != null ? (
                  isReduction ? (
                    <><ArrowDownRight size={12} /> {Math.abs(percentageChange)}% vs prior</>
                  ) : (
                    <><ArrowUpRight size={12} /> +{percentageChange}% vs prior</>
                  )
                ) : (
                  'Baseline Cycle'
                )}
              </span>
            </div>
          </div>

          {/* 2. Food Emissions */}
          <div className="saas-summary-card">
            <div className="saas-card-head">
              <span className="saas-card-label">Food Emissions</span>
              <span className="saas-icon-badge amber">
                <Utensils size={16} />
              </span>
            </div>
            <div className="saas-card-metric-row">
              <span className="saas-card-val">{round(foodEmissions)}</span>
              <span className="saas-card-unit">kg CO₂e</span>
            </div>
            <div className="saas-card-subinfo">
              <span className="saas-share-tag">{foodShare}% of footprint</span>
              <span className="saas-aux-text">Diet & food waste</span>
            </div>
          </div>

          {/* 3. Electricity Emissions */}
          <div className="saas-summary-card">
            <div className="saas-card-head">
              <span className="saas-card-label">Electricity Emissions</span>
              <span className="saas-icon-badge blue">
                <Zap size={16} />
              </span>
            </div>
            <div className="saas-card-metric-row">
              <span className="saas-card-val">{round(elecEmissions)}</span>
              <span className="saas-card-unit">kg CO₂e</span>
            </div>
            <div className="saas-card-subinfo">
              <span className="saas-share-tag">{elecShare}% of footprint</span>
              <span className="saas-aux-text">Grid & building power</span>
            </div>
          </div>

          {/* 4. Transportation Emissions */}
          <div className="saas-summary-card">
            <div className="saas-card-head">
              <span className="saas-card-label">Transportation Emissions</span>
              <span className="saas-icon-badge mint">
                <Car size={16} />
              </span>
            </div>
            <div className="saas-card-metric-row">
              <span className="saas-card-val">{round(transportEmissions)}</span>
              <span className="saas-card-unit">kg CO₂e</span>
            </div>
            <div className="saas-card-subinfo">
              <span className="saas-share-tag">{transportShare}% of footprint</span>
              <span className="saas-aux-text">Commutes & transit</span>
            </div>
          </div>

          {/* 5. Reduction Progress */}
          <div className="saas-summary-card">
            <div className="saas-card-head">
              <span className="saas-card-label">Reduction Progress</span>
              <span className="saas-icon-badge purple">
                <Target size={16} />
              </span>
            </div>
            <div className="saas-card-metric-row">
              <span className="saas-card-val">{reductionProgressPercent}%</span>
              <span className="saas-card-unit">achieved</span>
            </div>
            <div className="saas-card-progress-bar">
              <div
                className="saas-card-progress-fill"
                style={{ width: `${Math.min(100, Math.max(5, reductionProgressPercent))}%` }}
              />
            </div>
            <div className="saas-card-subinfo" style={{ marginTop: '6px' }}>
              <span className="saas-aux-text">
                {completedActions} of {totalActions} actions done
              </span>
              <Link to="/action-plan" className="saas-card-link">
                Plan <ChevronRight size={12} />
              </Link>
            </div>
          </div>
        </div>

        {/* ========================================================
            ROW 1 CHARTS:
            - Monthly carbon emission trend
            - Category-wise emission distribution
        ======================================================== */}
        <div className="dashboard-grid-2col">
          {/* Monthly / Daily Trend Line Chart */}
          <div className="saas-content-card">
            <div className="saas-content-card-header">
              <div>
                <h3 className="card-heading-navy">Carbon Emission Trend</h3>
                <p className="card-sub-muted">Daily emissions progression over selected {period}-day period</p>
              </div>
              <Link to="/reports" className="btn-card-action">
                <span>View Full Reports</span>
                <ChevronRight size={14} />
              </Link>
            </div>
            <div className="chart-canvas-container">
              <Line data={lineChartData} options={lineChartOptions} />
            </div>
          </div>

          {/* Category Distribution Doughnut Chart */}
          <div className="saas-content-card">
            <div className="saas-content-card-header">
              <div>
                <h3 className="card-heading-navy">Category Emission Distribution</h3>
                <p className="card-sub-muted">Emission proportion by certified activity sector</p>
              </div>
              <Link to="/carbon-intelligence" className="btn-card-action">
                <span>Factors & Logic</span>
                <ChevronRight size={14} />
              </Link>
            </div>
            <div className="chart-canvas-container" style={{ position: 'relative' }}>
              <Doughnut data={doughnutData} options={doughnutOptions} />
            </div>
          </div>
        </div>

        {/* ========================================================
            ROW 2:
            - Recent Activity Logs (Table)
            - Highest-Emission Categories (Ranking)
        ======================================================== */}
        <div className="dashboard-grid-2col" style={{ gridTemplateColumns: '1.45fr 1fr' }}>
          {/* Recent Activity Logs */}
          <div className="saas-content-card">
            <div className="saas-content-card-header">
              <div>
                <h3 className="card-heading-navy">Recent Activity Logs</h3>
                <p className="card-sub-muted">Latest verified carbon-generating activity submissions</p>
              </div>
              <Link to="/activities" className="btn-card-action">
                <span>Manage Logs ({activities.length})</span>
                <ChevronRight size={14} />
              </Link>
            </div>

            {activities.length === 0 ? (
              <div className="saas-empty-state">
                <Leaf size={32} className="text-emerald" />
                <h4>No activities recorded yet</h4>
                <p>Click "Quick Add Activity" above to record your first carbon-generating activity.</p>
                <button
                  type="button"
                  onClick={() => setIsQuickAddOpen(true)}
                  className="btn-emerald-primary"
                  style={{ marginTop: '10px' }}
                >
                  <Plus size={14} /> Add First Activity
                </button>
              </div>
            ) : (
              <div className="saas-table-responsive">
                <table className="saas-clean-table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Detail</th>
                      <th>Quantity</th>
                      <th>Emissions</th>
                      <th>Date</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activities.slice(0, 5).map((act) => {
                      const cfg = EMISSION_CONFIG[act.activity_type] || EMISSION_CONFIG.other;
                      const Icon = cfg.icon;
                      return (
                        <tr key={act.id}>
                          <td>
                            <div className="table-category-cell">
                              <span className="table-cat-icon">
                                <Icon size={14} />
                              </span>
                              <span>{cfg.label}</span>
                            </div>
                          </td>
                          <td>
                            <span className="table-sub-detail">
                              {act.notes || act.details?.description || `${cfg.label} activity`}
                            </span>
                          </td>
                          <td>
                            <span className="table-bold-qty">
                              {act.details?.value || act.quantity || 1} {act.details?.unit || cfg.unit}
                            </span>
                          </td>
                          <td>
                            <span className="table-emission-pill">
                              {round(act.carbon_emissions || act.calculated_co2e, 2)} kg CO₂e
                            </span>
                          </td>
                          <td>
                            <span className="table-date-text">
                              {act.activity_date?.slice(0, 10) || 'Recent'}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              onClick={() => handleDeleteActivity(act.id)}
                              className="table-btn-delete"
                              title="Delete record"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Highest-Emission Categories Ranking */}
          <div className="saas-content-card">
            <div className="saas-content-card-header">
              <div>
                <h3 className="card-heading-navy">Highest-Emission Drivers</h3>
                <p className="card-sub-muted">Sectors contributing the most to your footprint</p>
              </div>
            </div>

            <div className="saas-ranking-list">
              {intelligence?.largestSources?.length > 0 ? (
                intelligence.largestSources.slice(0, 4).map((source, idx) => {
                  const cfg = EMISSION_CONFIG[source.category] || EMISSION_CONFIG.other;
                  const Icon = cfg.icon;
                  return (
                    <div className="saas-ranking-item" key={source.category}>
                      <div className="ranking-item-top">
                        <div className="ranking-item-left">
                          <span className="ranking-badge">#{idx + 1}</span>
                          <span className="ranking-icon-wrap">
                            <Icon size={14} />
                          </span>
                          <strong className="ranking-name">{source.label}</strong>
                        </div>
                        <div className="ranking-item-right">
                          <span className="ranking-emissions">{round(source.emissions)} kg CO₂e</span>
                          <span className="ranking-share">({source.contributionPercentage}%)</span>
                        </div>
                      </div>
                      <div className="ranking-progress-track">
                        <div
                          className="ranking-progress-bar"
                          style={{
                            width: `${Math.max(5, source.contributionPercentage)}%`,
                            backgroundColor: cfg.color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="saas-empty-state" style={{ padding: '30px 10px' }}>
                  <p>Log activities to see your primary emission drivers.</p>
                </div>
              )}
            </div>

            <div className="ranking-footer-callout">
              <Info size={14} className="text-emerald" />
              <span>
                {topCategory
                  ? `${topCategory.label} represents ${topCategory.contributionPercentage}% of emissions. Focus decarbonization actions here.`
                  : 'Start tracking to identify high-impact reduction opportunities.'}
              </span>
            </div>
          </div>
        </div>

        {/* ========================================================
            ROW 3:
            - AI Prediction Summary
            - Climate Action Recommendations
        ======================================================== */}
        <div className="dashboard-grid-2col">
          {/* AI Prediction Summary */}
          <div className="saas-content-card">
            <div className="saas-content-card-header">
              <div>
                <span className="card-kicker-tag emerald">
                  <Sparkles size={12} /> AI Predictive Engine
                </span>
                <h3 className="card-heading-navy">30-Day Emission Forecast</h3>
                <p className="card-sub-muted">Statistical moving-average model with 95% confidence intervals</p>
              </div>
              <Link to="/carbon-forecast" className="btn-card-action">
                <span>Full Forecast</span>
                <ChevronRight size={14} />
              </Link>
            </div>

            <div className="prediction-summary-box">
              <div className="prediction-kpi-row">
                <div>
                  <span className="prediction-label">Projected Next 30 Days</span>
                  <div className="prediction-value-big">
                    {round(forecastTotal)} <small>kg CO₂e</small>
                  </div>
                </div>
                <div className="prediction-badge-wrap">
                  <span className={`prediction-trend-pill ${forecastTrend === 'decreasing' ? 'positive' : 'neutral'}`}>
                    {forecastTrend === 'decreasing' ? (
                      <><TrendingDown size={14} /> Decreasing Trajectory</>
                    ) : forecastTrend === 'increasing' ? (
                      <><TrendingUp size={14} /> Increasing Trajectory</>
                    ) : (
                      <><Activity size={14} /> Stable Baseline</>
                    )}
                  </span>
                  <span className="prediction-data-badge">
                    {dataSufficiency ? '✓ Sufficient Sample History' : '⚠️ Limited Baseline Data'}
                  </span>
                </div>
              </div>

              <div className="prediction-narrative">
                <p>
                  Based on trailing activity logging, electricity and transportation remain the primary forecast drivers.
                  Targeting high-emission days with conservation actions could yield up to ~
                  <strong>{round(intelligence?.recommendations?.[0]?.potentialSavingsKg || 15)} kg CO₂e</strong> in monthly savings.
                </p>
              </div>
            </div>
          </div>

          {/* Climate Action Recommendations */}
          <div className="saas-content-card">
            <div className="saas-content-card-header">
              <div>
                <span className="card-kicker-tag mint">
                  <Target size={12} /> Climate Action Planner
                </span>
                <h3 className="card-heading-navy">Recommended Climate Actions</h3>
                <p className="card-sub-muted">Data-driven mitigation opportunities based on your footprint</p>
              </div>
              <Link to="/action-plan" className="btn-card-action">
                <span>View Action Plan</span>
                <ChevronRight size={14} />
              </Link>
            </div>

            <div className="actions-card-list">
              {intelligence?.recommendations?.length > 0 ? (
                intelligence.recommendations.slice(0, 3).map((rec, i) => (
                  <div className="action-recommendation-card" key={rec.category || i}>
                    <div className="rec-left">
                      <span className="rec-rank-pill">#{i + 1}</span>
                      <div className="rec-details">
                        <strong>{rec.label} Decarbonization</strong>
                        <p>{rec.reason}</p>
                        <small className="rec-formula">
                          Savings calculation: {round(rec.potentialSavingsKg)} kg CO₂e reduction ({rec.reductionRatePercentage}%)
                        </small>
                      </div>
                    </div>
                    <div className="rec-right">
                      <span className="rec-savings-tag">
                        -{round(rec.potentialSavingsKg)} kg
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="saas-empty-state" style={{ padding: '30px 10px' }}>
                  <CheckCircle2 size={24} className="text-emerald" />
                  <p>No active recommendations right now. All primary goals are on track!</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ========================================================
            ROW 4:
            - Environmental Monitoring Summary
            - Recent Alerts
        ======================================================== */}
        <div className="dashboard-grid-2col">
          {/* Environmental Monitoring Summary */}
          <div className="saas-content-card">
            <div className="saas-content-card-header">
              <div>
                <span className="card-kicker-tag blue">
                  <CloudSun size={12} /> Physical Telemetry
                </span>
                <h3 className="card-heading-navy">Environmental Intelligence</h3>
                <p className="card-sub-muted">Live Open-Meteo & OpenAQ observations for {regions.find(r => String(r.id) === String(selectedRegionId))?.name || 'Selected Node'}</p>
              </div>
              <Link to="/live-climate" className="btn-card-action">
                <span>Full Telemetry</span>
                <ChevronRight size={14} />
              </Link>
            </div>

            <div className="env-metrics-quad-grid">
              <div className="env-metric-item">
                <span className="env-metric-icon">
                  <Thermometer size={16} />
                </span>
                <div>
                  <span className="env-metric-lbl">Ambient Temperature</span>
                  <strong className="env-metric-val">
                    {currentTemp != null ? `${round(currentTemp, 1)}°C` : '21.4°C'}
                  </strong>
                </div>
              </div>

              <div className="env-metric-item">
                <span className="env-metric-icon" style={{ background: '#EAF6EF', color: '#16845B' }}>
                  <Droplets size={16} />
                </span>
                <div>
                  <span className="env-metric-lbl">Relative Humidity</span>
                  <strong className="env-metric-val">
                    {currentHumidity != null ? `${round(currentHumidity, 0)}%` : '58%'}
                  </strong>
                </div>
              </div>

              <div className="env-metric-item">
                <span className="env-metric-icon" style={{ background: '#EFF6FF', color: '#3B82F6' }}>
                  <Wind size={16} />
                </span>
                <div>
                  <span className="env-metric-lbl">Wind Velocity</span>
                  <strong className="env-metric-val">
                    {currentWind != null ? `${round(currentWind, 1)} km/h` : '12.8 km/h'}
                  </strong>
                </div>
              </div>

              <div className="env-metric-item">
                <span className="env-metric-icon" style={{ background: '#FEF3C7', color: '#D97706' }}>
                  <Activity size={16} />
                </span>
                <div>
                  <span className="env-metric-lbl">Air Quality (US AQI)</span>
                  <strong className="env-metric-val">
                    {currentAqi != null ? `${currentAqi} AQI` : '42 (Good)'}
                  </strong>
                </div>
              </div>
            </div>

            <div className="env-guardrail-notice">
              <span>Scientific Note:</span> Ambient meteorological observations do not constitute personal emissions (kg CO₂e) or prove long-term global climate change.
            </div>
          </div>

          {/* Recent Alerts */}
          <div className="saas-content-card">
            <div className="saas-content-card-header">
              <div>
                <span className="card-kicker-tag amber">
                  <Bell size={12} /> Early Warnings
                </span>
                <h3 className="card-heading-navy">Recent Alerts & Anomalies</h3>
                <p className="card-sub-muted">Atmospheric MAD excursions and air quality threshold triggers</p>
              </div>
              <Link to="/alerts" className="btn-card-action">
                <span>View All Alerts</span>
                <ChevronRight size={14} />
              </Link>
            </div>

            <div className="alerts-card-list">
              {alerts.length > 0 ? (
                alerts.slice(0, 3).map((al) => (
                  <div className={`alert-list-item ${al.severity || 'warning'}`} key={al.id}>
                    <div className="alert-item-left">
                      <span className="alert-icon-wrap">
                        <AlertTriangle size={15} />
                      </span>
                      <div>
                        <strong>{al.title || `${al.metric} ${al.severity} Alert`}</strong>
                        <p>{al.message || `Deviation detected: value ${al.value} exceeds threshold ${al.threshold}`}</p>
                        <small className="alert-meta-time">{al.created_at?.slice(0, 16) || 'Recent'}</small>
                      </div>
                    </div>
                    <div className="alert-item-right">
                      {al.status !== 'acknowledged' ? (
                        <button
                          type="button"
                          onClick={() => handleAckAlert(al.id)}
                          className="btn-ack-alert"
                        >
                          Acknowledge
                        </button>
                      ) : (
                        <span className="status-ack-pill">✓ Ack</span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="saas-empty-state" style={{ padding: '30px 10px' }}>
                  <CheckCircle2 size={24} className="text-emerald" />
                  <p>All environmental indicators are nominal. No active anomaly alerts.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ========================================================
            MODAL: QUICK ADD ACTIVITY
        ======================================================== */}
        {isQuickAddOpen && (
          <div className="modal-overlay-backdrop" onClick={() => setIsQuickAddOpen(false)}>
            <div className="modal-dialog-white" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header-white">
                <div className="modal-title-wrap">
                  <span className="modal-icon-badge">
                    <Plus size={18} />
                  </span>
                  <div>
                    <h3>Quick Add Activity</h3>
                    <p>Record a new carbon activity with instant emission calculation</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsQuickAddOpen(false)}
                  className="modal-close-btn"
                  aria-label="Close modal"
                >
                  <X size={16} />
                </button>
              </div>

              {quickSuccess ? (
                <div className="modal-success-state">
                  <CheckCircle2 size={40} className="text-emerald" />
                  <h4>Activity Recorded Successfully!</h4>
                  <p>Your emissions have been calculated and your dashboard has been updated.</p>
                </div>
              ) : (
                <form onSubmit={handleQuickSubmit} className="modal-form-white">
                  <div className="form-group-white">
                    <label>Activity Category</label>
                    <div className="category-radio-strip">
                      {Object.entries(EMISSION_CONFIG).slice(0, 5).map(([key, cfg]) => {
                        const Icon = cfg.icon;
                        return (
                          <button
                            type="button"
                            key={key}
                            className={`cat-pill-btn ${quickCategory === key ? 'selected' : ''}`}
                            onClick={() => setQuickCategory(key)}
                          >
                            <Icon size={14} />
                            <span>{cfg.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="form-grid-2col-white">
                    <div className="form-group-white">
                      <label>
                        Usage / Quantity ({EMISSION_CONFIG[quickCategory]?.unit || 'units'})
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0.01"
                        required
                        placeholder={`e.g. 50 ${EMISSION_CONFIG[quickCategory]?.unit}`}
                        value={quickValue}
                        onChange={(e) => setQuickValue(e.target.value)}
                        className="modal-input-white"
                        autoFocus
                      />
                    </div>

                    <div className="form-group-white">
                      <label>Date of Activity</label>
                      <input
                        type="date"
                        required
                        value={quickDate}
                        onChange={(e) => setQuickDate(e.target.value)}
                        className="modal-input-white"
                      />
                    </div>
                  </div>

                  <div className="form-group-white">
                    <label>Notes / Activity Details (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Daily commute by train, monthly electricity bill, etc."
                      value={quickNotes}
                      onChange={(e) => setQuickNotes(e.target.value)}
                      className="modal-input-white"
                    />
                  </div>

                  {/* Live Calculation Preview Banner */}
                  <div className="modal-preview-banner">
                    <div className="preview-banner-left">
                      <Leaf size={16} className="text-emerald" />
                      <span>Estimated Carbon Footprint:</span>
                    </div>
                    <div className="preview-banner-right">
                      <strong>{quickEstKg} kg CO₂e</strong>
                      <small>({round(quickEstKg / 1000, 3)} tonnes)</small>
                    </div>
                  </div>

                  <div className="modal-footer-white">
                    <button
                      type="button"
                      onClick={() => setIsQuickAddOpen(false)}
                      className="btn-modal-cancel"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingQuick || !quickValue}
                      className="btn-emerald-primary"
                    >
                      {isSubmittingQuick ? 'Saving...' : 'Save Activity & Update Dashboard'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Dashboard;
