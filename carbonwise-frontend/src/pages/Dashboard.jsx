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
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  Car,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Droplets,
  Factory,
  Flame,
  Info,
  Leaf,
  Plus,
  Recycle,
  RefreshCw,
  Sparkles,
  Trash2,
  Users,
  Utensils,
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
  transport: { label: 'Transportation', unit: 'km', factor: 0.21, icon: Car, color: '#38BDF8' },
  electricity: { label: 'Electricity', unit: 'kWh', factor: 0.5, icon: Zap, color: '#10B981' },
  food: { label: 'Food & Diet', unit: 'meals', factor: 2.5, icon: Utensils, color: '#8B5CF6' },
  water: { label: 'Water Usage', unit: 'm³', factor: 0.35, icon: Droplets, color: '#06B6D4' },
  waste: { label: 'Waste Management', unit: 'kg', factor: 0.45, icon: Recycle, color: '#F59E0B' },
  facilities: { label: 'Facilities', unit: 'kWh', factor: 0.5, icon: Building2, color: '#A78BFA' },
  flight: { label: 'Flights', unit: 'km', factor: 0.255, icon: Car, color: '#EC4899' },
  other: { label: 'Other', unit: 'items', factor: 5.0, icon: Flame, color: '#94A3B8' },
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
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeframeInterval, setTimeframeInterval] = useState('daily');
  const [showLedger, setShowLedger] = useState(false);

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

  // Event Listeners for Header Actions
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

  // Calculated Metrics from backend or matching reference mockup
  const currentFootprint = intelligence?.totals?.currentPeriod || 0;
  const isZeroHistory = activities.length === 0 && currentFootprint === 0;

  // Display footprint in tCO2e
  const displayTotalEmissions = isZeroHistory ? '12,456' : round(currentFootprint > 1000 ? currentFootprint / 1000 : currentFootprint, 0);
  const displayScope1 = isZeroHistory ? '3,234' : round((currentFootprint * 0.26) / (currentFootprint > 1000 ? 1000 : 1), 0);
  const displayScope2 = isZeroHistory ? '4,556' : round((currentFootprint * 0.366) / (currentFootprint > 1000 ? 1000 : 1), 0);
  const displayScope3 = isZeroHistory ? '4,666' : round((currentFootprint * 0.374) / (currentFootprint > 1000 ? 1000 : 1), 0);

  // Dynamic forecast number from forecastData or reference baseline
  const displayForecastTotal = forecastData?.forecast?.totalProjected
    ? (forecastData.forecast.totalProjected > 1000 ? round(forecastData.forecast.totalProjected / 1000, 0) : round(forecastData.forecast.totalProjected, 0))
    : '14,350';

  // Dynamic target progress from coachPlan or reference milestone
  const targetProgressPercent = coachPlan?.summary?.completionRatePercentage != null
    ? Math.max(10, Math.min(100, Math.round(coachPlan.summary.completionRatePercentage)))
    : 42;

  // Recent alerts from backend or reference feed
  const displayAlerts = alerts.length > 0
    ? alerts.slice(0, 3).map((a) => ({
        id: a.id,
        severity: a.severity || 'warning',
        title: a.title || `${a.metric || 'Atmospheric'} anomaly excursion`,
        time: a.created_at ? new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent',
      }))
    : [
        { id: 1, severity: 'critical', title: 'High emissions detected from transportation', time: 'May 12, 2024 10:30 AM' },
        { id: 2, severity: 'warning', title: 'Energy consumption above average', time: 'May 12, 2024 09:15 AM' },
        { id: 3, severity: 'success', title: 'New low-emission milestone achieved!', time: 'May 11, 2024 04:45 PM' },
      ];

  // Stacked Bar Chart Data (Scope 1, Scope 2, Scope 3)
  const stackedBarData = useMemo(() => {
    const labels = [
      'May 12', 'May 16', 'May 19', 'May 23', 'May 26',
      'May 30', 'Jun 2', 'Jun 6', 'Jun 9', 'Jun 12'
    ];
    return {
      labels,
      datasets: [
        {
          label: 'Scope 1',
          data: [190, 240, 210, 260, 220, 250, 210, 240, 230, 210],
          backgroundColor: '#10B981',
          borderRadius: 4,
          stack: 'emissions',
        },
        {
          label: 'Scope 2',
          data: [320, 370, 340, 410, 360, 390, 340, 420, 380, 350],
          backgroundColor: '#38BDF8',
          borderRadius: 4,
          stack: 'emissions',
        },
        {
          label: 'Scope 3',
          data: [290, 310, 330, 350, 320, 340, 330, 360, 340, 320],
          backgroundColor: '#8B5CF6',
          borderRadius: 4,
          stack: 'emissions',
        },
      ],
    };
  }, []);

  const stackedBarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: '#94A3B8',
          font: { family: 'DM Sans', size: 11, weight: 600 },
          usePointStyle: true,
          boxWidth: 8,
          padding: 16,
        },
      },
      tooltip: {
        backgroundColor: '#0F172A',
        titleColor: '#FFFFFF',
        bodyColor: '#E2E8F0',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
      },
    },
    scales: {
      x: {
        stacked: true,
        grid: { display: false },
        ticks: { color: '#64748B', font: { family: 'DM Sans', size: 10 } },
      },
      y: {
        stacked: true,
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#64748B', font: { family: 'DM Sans', size: 10 } },
      },
    },
  };

  // Forecast Dual-Segment Chart (Historical Solid + Predicted Dashed Line)
  const forecastChartData = useMemo(() => {
    return {
      labels: ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'],
      datasets: [
        {
          label: 'Historical',
          data: [16200, 15400, 16800, 17200, null, null],
          borderColor: '#10B981',
          backgroundColor: 'transparent',
          borderWidth: 2.2,
          tension: 0.35,
          pointRadius: 0,
        },
        {
          label: 'Forecast',
          data: [null, null, null, 17200, 15600, 14350],
          borderColor: '#34D399',
          borderDash: [5, 5],
          backgroundColor: 'rgba(16, 185, 129, 0.06)',
          borderWidth: 2,
          tension: 0.35,
          pointRadius: 0,
          fill: true,
        },
      ],
    };
  }, []);

  const forecastChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0F172A',
        titleColor: '#FFFFFF',
        bodyColor: '#34D399',
        borderColor: 'rgba(52, 211, 153, 0.2)',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
        callbacks: {
          label: (context) => ` ${context.dataset.label}: ${context.parsed.y} tCO₂e`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#64748B', font: { family: 'DM Sans', size: 10 } },
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: {
          color: '#64748B',
          font: { family: 'DM Sans', size: 10 },
          callback: (v) => `${v / 1000}K`,
        },
      },
    },
  };

  // Top Emission Sources Donut Chart
  const donutChartData = useMemo(() => {
    return {
      labels: ['Electricity', 'Transportation', 'Purchased Goods', 'Other Sources'],
      datasets: [
        {
          data: [4556, 3234, 2456, 2210],
          backgroundColor: ['#10B981', '#38BDF8', '#8B5CF6', '#F59E0B'],
          borderWidth: 0,
          hoverOffset: 4,
        },
      ],
    };
  }, []);

  const donutChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '72%',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0F172A',
        titleColor: '#FFFFFF',
        bodyColor: '#E2E8F0',
        padding: 10,
        cornerRadius: 8,
        callbacks: {
          label: (context) => ` ${context.label}: ${context.parsed} tCO₂e`,
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
        <div style={{ display: 'grid', placeItems: 'center', minHeight: '60vh', color: '#94A3B8' }}>
          <RefreshCw size={32} className="spin" style={{ color: '#10B981', marginBottom: '16px' }} />
          <h2 style={{ color: '#FFFFFF', fontSize: '1.2rem', marginBottom: '6px' }}>Synchronizing AI Carbon Tracker...</h2>
          <p style={{ fontSize: '0.82rem' }}>Loading multi-scope carbon accounting, forecasts, and live telemetry.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="dashboard-content">
        {/* ========================================================
            ROW 1: TOP GRID (Overview, Emissions by Region, AI Insights)
        ======================================================== */}
        <div className="dashboard-grid-top">
          {/* Card 1: Overview */}
          <div className="tracker-card card-overview">
            <div className="tracker-card-header">
              <h3 className="card-section-title">Overview</h3>
            </div>

            <div className="overview-headline">
              <span className="overview-subhead">Total Emissions</span>
              <div className="overview-number-row">
                <span className="overview-number">{displayTotalEmissions}</span>
                <span className="overview-unit">tCO₂e</span>
              </div>
              <div className="overview-trend-pill">
                <ArrowDownRight size={13} />
                <span>8.4% vs Apr 12 - May 12, 2024</span>
              </div>
            </div>

            <div className="scope-breakdown-list">
              {/* Scope 1 */}
              <div className="scope-row">
                <div className="scope-left">
                  <span className="scope-icon-badge scope-1-badge">
                    <Factory size={15} />
                  </span>
                  <div>
                    <strong>Scope 1</strong>
                    <small>Direct Emissions</small>
                  </div>
                </div>
                <div className="scope-right">
                  <span className="scope-val">{displayScope1} tCO₂e</span>
                  <span className="scope-change" style={{ color: '#10B981' }}>▼ 6.1%</span>
                </div>
              </div>

              {/* Scope 2 */}
              <div className="scope-row">
                <div className="scope-left">
                  <span className="scope-icon-badge scope-2-badge">
                    <Zap size={15} />
                  </span>
                  <div>
                    <strong>Scope 2</strong>
                    <small>Indirect Electricity</small>
                  </div>
                </div>
                <div className="scope-right">
                  <span className="scope-val">{displayScope2} tCO₂e</span>
                  <span className="scope-change" style={{ color: '#38BDF8' }}>▼ 9.3%</span>
                </div>
              </div>

              {/* Scope 3 */}
              <div className="scope-row">
                <div className="scope-left">
                  <span className="scope-icon-badge scope-3-badge">
                    <Users size={15} />
                  </span>
                  <div>
                    <strong>Scope 3</strong>
                    <small>Supply Chain & Transit</small>
                  </div>
                </div>
                <div className="scope-right">
                  <span className="scope-val">{displayScope3} tCO₂e</span>
                  <span className="scope-change" style={{ color: '#A78BFA' }}>▼ 9.7%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Emissions by Region */}
          <div className="tracker-card card-emissions-region">
            <div className="tracker-card-header">
              <h3 className="card-section-title">Emissions by Region</h3>
              <select
                value={selectedRegionId}
                onChange={(e) => setSelectedRegionId(e.target.value)}
                className="region-selector-clean"
                aria-label="Filter region"
              >
                <option value="">All Regions</option>
                {regions.map((reg) => (
                  <option key={reg.id} value={reg.id}>
                    {reg.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="interactive-map-container">
              <svg viewBox="0 0 900 450" className="vector-world-map">
                <defs>
                  <radialGradient id="mapGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#10B981" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
                  </radialGradient>
                </defs>

                {/* Stylized dark continent land masses */}
                <path
                  d="M130,95 Q170,80 230,85 Q280,95 290,130 Q280,170 230,175 Q180,180 140,150 Z"
                  fill="#121F35"
                  stroke="#1E293B"
                  strokeWidth="1"
                />
                <path
                  d="M230,185 Q270,195 295,240 Q310,290 280,335 Q250,330 230,270 Q215,220 230,185 Z"
                  fill="#121F35"
                  stroke="#1E293B"
                  strokeWidth="1"
                />
                <path
                  d="M420,85 Q490,75 520,105 Q515,145 460,150 Q430,140 420,85 Z"
                  fill="#121F35"
                  stroke="#1E293B"
                  strokeWidth="1"
                />
                <path
                  d="M430,165 Q485,165 520,205 Q520,265 480,310 Q445,290 435,225 Z"
                  fill="#121F35"
                  stroke="#1E293B"
                  strokeWidth="1"
                />
                <path
                  d="M530,80 Q660,70 780,110 Q810,180 750,225 Q650,210 570,185 Q540,140 530,80 Z"
                  fill="#121F35"
                  stroke="#1E293B"
                  strokeWidth="1"
                />
                <path
                  d="M710,275 Q775,260 810,290 Q810,335 765,345 Q720,335 710,275 Z"
                  fill="#121F35"
                  stroke="#1E293B"
                  strokeWidth="1"
                />

                {/* Pulsing Regional Nodes matching Image 1 */}
                <g transform="translate(240, 130)">
                  <circle r="22" fill="url(#mapGlow)" opacity="0.4" />
                  <circle r="14" fill="#10B981" opacity="0.75" />
                  <circle r="7" fill="#34D399" />
                  <circle r="28" fill="none" stroke="#34D399" strokeWidth="1" className="pulse-ring" />
                </g>
                <g transform="translate(275, 270)">
                  <circle r="18" fill="url(#mapGlow)" opacity="0.35" />
                  <circle r="11" fill="#10B981" opacity="0.75" />
                  <circle r="5" fill="#34D399" />
                </g>
                <g transform="translate(470, 115)">
                  <circle r="16" fill="url(#mapGlow)" opacity="0.4" />
                  <circle r="10" fill="#10B981" opacity="0.8" />
                  <circle r="4" fill="#34D399" />
                </g>
                <g transform="translate(740, 145)">
                  <circle r="15" fill="url(#mapGlow)" opacity="0.35" />
                  <circle r="9" fill="#10B981" opacity="0.8" />
                  <circle r="4" fill="#34D399" />
                </g>
                <g transform="translate(765, 305)">
                  <circle r="16" fill="url(#mapGlow)" opacity="0.4" />
                  <circle r="10" fill="#10B981" opacity="0.8" />
                  <circle r="5" fill="#34D399" />
                </g>
              </svg>

              <div className="map-legend-bar">
                <span>tCO₂e</span>
                <span style={{ color: '#64748B', fontSize: '0.68rem' }}>Low</span>
                <div className="gradient-track" />
                <span style={{ color: '#34D399', fontSize: '0.68rem' }}>High</span>
              </div>
            </div>
          </div>

          {/* Card 3: AI Insights */}
          <div className="tracker-card card-ai-insights">
            <div className="tracker-card-header">
              <h3 className="card-section-title">
                <Sparkles size={16} className="sparkle-icon" />
                <span>AI Insights</span>
              </h3>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', margin: 'auto 0' }}>
              <div style={{ flex: 1 }}>
                <p style={{ color: '#FFFFFF', fontSize: '0.84rem', fontWeight: 600, lineHeight: 1.45, marginBottom: '12px' }}>
                  Emissions from your energy consumption are the highest contributor.
                </p>
                <div className="ai-recommendation-box">
                  <span className="ai-rec-tag">AI Recommendation:</span>
                  <p>Switch to renewable energy sources could reduce emissions by up to 18%.</p>
                </div>
              </div>

              {/* Holographic Glowing Plant Motif matching Image 1 */}
              <div className="ai-leaf-spotlight">
                <div className="hologram-radar-ring">
                  <div className="hologram-leaf-badge">
                    <Leaf size={24} className="hologram-leaf-icon" />
                  </div>
                </div>
              </div>
            </div>

            <div className="ai-card-actions" style={{ marginTop: '14px' }}>
              <Link to="/action-plan" className="btn-ai-action">
                <span>Explore Reduction Actions</span>
                <ChevronRight size={14} />
              </Link>
            </div>
          </div>
        </div>

        {/* ========================================================
            ROW 2: MIDDLE GRID (Emissions Over Time & Forecast)
        ======================================================== */}
        <div className="dashboard-grid-middle">
          {/* Card 4: Emissions Over Time */}
          <div className="tracker-card card-time-series">
            <div className="tracker-card-header">
              <h3 className="card-section-title">Emissions Over Time</h3>
              <div className="timeframe-toggle">
                <button
                  type="button"
                  className={`toggle-btn ${timeframeInterval === 'daily' ? 'active' : ''}`}
                  onClick={() => setTimeframeInterval('daily')}
                >
                  Daily
                </button>
                <button
                  type="button"
                  className={`toggle-btn ${timeframeInterval === 'weekly' ? 'active' : ''}`}
                  onClick={() => setTimeframeInterval('weekly')}
                >
                  Weekly
                </button>
                <button
                  type="button"
                  className={`toggle-btn ${timeframeInterval === 'monthly' ? 'active' : ''}`}
                  onClick={() => setTimeframeInterval('monthly')}
                >
                  Monthly
                </button>
              </div>
            </div>

            <div className="time-series-chart-wrapper">
              <Bar data={stackedBarData} options={stackedBarOptions} />
            </div>
          </div>

          {/* Card 5: Emissions Forecast ⓘ */}
          <div className="tracker-card card-forecast">
            <div className="tracker-card-header">
              <h3 className="card-section-title">
                <span>Emissions Forecast</span>
                <Info size={14} className="forecast-info-icon" title="Statistical multi-horizon forecast engine" />
              </h3>
            </div>

            <div className="forecast-headline-row">
              <div className="forecast-number-group">
                <span className="forecast-number">{displayForecastTotal}</span>
                <span className="forecast-unit">tCO₂e</span>
              </div>
              <div className="forecast-period-desc">Projected for Jul 12 - Aug 12, 2024</div>
              <div className="forecast-trend-tag" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34D399' }}>
                <ArrowDownRight size={12} />
                <span>5.2% vs current period</span>
              </div>
            </div>

            <div className="forecast-chart-wrapper">
              <Line data={forecastChartData} options={forecastChartOptions} />
            </div>
          </div>
        </div>

        {/* ========================================================
            ROW 3: BOTTOM GRID (Top Emission Sources, Progress to Target, Recent Alerts)
        ======================================================== */}
        <div className="dashboard-grid-bottom">
          {/* Card 6: Top Emission Sources */}
          <div className="tracker-card card-donut-sources">
            <div className="tracker-card-header">
              <h3 className="card-section-title">Top Emission Sources</h3>
            </div>

            <div className="donut-flex-container">
              <div className="donut-chart-box">
                <Doughnut data={donutChartData} options={donutChartOptions} />
                <div className="donut-center-overlay">
                  <strong>12,456</strong>
                  <small>tCO₂e</small>
                </div>
              </div>

              <div className="donut-legend-list">
                <div className="legend-row">
                  <span className="legend-dot dot-green" />
                  <span className="legend-name">Electricity</span>
                  <span className="legend-val">4,556 tCO₂e</span>
                  <span className="legend-pct">36.6%</span>
                </div>
                <div className="legend-row">
                  <span className="legend-dot dot-blue" />
                  <span className="legend-name">Transportation</span>
                  <span className="legend-val">3,234 tCO₂e</span>
                  <span className="legend-pct">26.0%</span>
                </div>
                <div className="legend-row">
                  <span className="legend-dot dot-purple" />
                  <span className="legend-name">Purchased Goods</span>
                  <span className="legend-val">2,456 tCO₂e</span>
                  <span className="legend-pct">19.7%</span>
                </div>
                <div className="legend-row">
                  <span className="legend-dot dot-amber" />
                  <span className="legend-name">Other Sources</span>
                  <span className="legend-val">2,210 tCO₂e</span>
                  <span className="legend-pct">17.7%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 7: Progress to Target ⓘ */}
          <div className="tracker-card card-target-progress">
            <div className="tracker-card-header">
              <h3 className="card-section-title">
                <span>Progress to Target</span>
                <Info size={14} className="forecast-info-icon" title="Net Zero science-based milestone" />
              </h3>
            </div>

            <div className="target-year-label">
              Net Zero Target: <strong>2040</strong>
            </div>

            <div className="radial-gauge-container">
              <svg className="radial-gauge-svg" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" className="gauge-track" strokeWidth="9" />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  className="gauge-fill"
                  strokeWidth="9"
                  strokeDasharray="264"
                  strokeDashoffset={Math.round(264 * (1 - targetProgressPercent / 100))}
                />
              </svg>
              <div className="gauge-center-text">
                <span className="gauge-percent">{targetProgressPercent}%</span>
                <span className="gauge-label">Progress</span>
              </div>
            </div>

            <div className="target-stats-split">
              <div>
                <span className="target-subhead">Remaining</span>
                <strong style={{ color: '#FFFFFF', fontSize: '0.82rem' }}>7,223 tCO₂e</strong>
              </div>
              <div className="text-right">
                <span className="target-subhead">Reduce by</span>
                <strong style={{ color: '#34D399', fontSize: '0.82rem' }}>3.2% per year</strong>
              </div>
            </div>
          </div>

          {/* Card 8: Recent Alerts */}
          <div className="tracker-card card-recent-alerts">
            <div className="tracker-card-header">
              <h3 className="card-section-title">Recent Alerts</h3>
              <Link to="/alerts" className="view-all-link">
                View all
              </Link>
            </div>

            <div className="recent-alerts-list">
              {displayAlerts.map((al) => (
                <div className="alert-item-box" key={al.id}>
                  <div className={`alert-indicator-dot dot-${al.severity === 'critical' ? 'critical' : al.severity === 'success' ? 'success' : 'warning'}`}>
                    {al.severity === 'success' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                  </div>
                  <div className="alert-item-copy">
                    <strong>{al.title}</strong>
                    <small>{al.time}</small>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ========================================================
            COLLAPSIBLE ACTIVITY LEDGER (LIVE CRUD MANAGEMENT)
        ======================================================== */}
        <div className="tracker-card" style={{ marginTop: '18px' }}>
          <div
            className="tracker-card-header"
            style={{ cursor: 'pointer', marginBottom: showLedger ? '16px' : 0 }}
            onClick={() => setShowLedger(!showLedger)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 className="card-section-title">
                <span>Verified Carbon Activity Ledger</span>
                <span style={{ fontSize: '0.72rem', color: '#34D399', fontWeight: 600, background: 'rgba(16, 185, 129, 0.15)', padding: '2px 8px', borderRadius: '6px' }}>
                  {activities.length} Recorded
                </span>
              </h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                className="btn-quick-log"
                onClick={(e) => { e.stopPropagation(); setIsQuickAddOpen(true); }}
              >
                <Plus size={13} style={{ display: 'inline', marginRight: '4px' }} />
                Record Activity
              </button>
              {showLedger ? <ChevronUp size={16} color="#94A3B8" /> : <ChevronDown size={16} color="#94A3B8" />}
            </div>
          </div>

          {showLedger && (
            <div>
              {activities.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 10px', color: '#94A3B8' }}>
                  <Leaf size={28} style={{ color: '#10B981', margin: '0 auto 8px', display: 'block' }} />
                  <p style={{ fontSize: '0.84rem', color: '#FFFFFF' }}>No user-specific activities logged yet.</p>
                  <p style={{ fontSize: '0.76rem', marginTop: '4px' }}>Click "Record Activity" to add electricity, commute, food, or water usage.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#64748B', textAlign: 'left' }}>
                        <th style={{ padding: '8px 10px' }}>Category</th>
                        <th style={{ padding: '8px 10px' }}>Notes</th>
                        <th style={{ padding: '8px 10px' }}>Quantity</th>
                        <th style={{ padding: '8px 10px' }}>Emissions</th>
                        <th style={{ padding: '8px 10px' }}>Date</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activities.slice(0, 8).map((act) => {
                        const cfg = EMISSION_CONFIG[act.activity_type] || EMISSION_CONFIG.other;
                        return (
                          <tr key={act.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)', color: '#FFFFFF' }}>
                            <td style={{ padding: '10px' }}>
                              <span style={{ color: cfg.color, fontWeight: 600 }}>{cfg.label}</span>
                            </td>
                            <td style={{ padding: '10px', color: '#94A3B8' }}>{act.notes || `${cfg.label} usage`}</td>
                            <td style={{ padding: '10px' }}>{act.details?.value || act.quantity || 1} {act.details?.unit || cfg.unit}</td>
                            <td style={{ padding: '10px', color: '#34D399', fontWeight: 700 }}>
                              {round(act.carbon_emissions || act.calculated_co2e, 2)} kg CO₂e
                            </td>
                            <td style={{ padding: '10px', color: '#64748B' }}>{act.activity_date?.slice(0, 10)}</td>
                            <td style={{ padding: '10px', textAlign: 'right' }}>
                              <button
                                type="button"
                                onClick={() => handleDeleteActivity(act.id)}
                                style={{ background: 'transparent', border: 0, color: '#EF4444', cursor: 'pointer' }}
                                title="Delete activity"
                              >
                                <Trash2 size={14} />
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
          )}
        </div>

        {/* ========================================================
            MODAL: QUICK ADD ACTIVITY
        ======================================================== */}
        {isQuickAddOpen && (
          <div className="modal-overlay-backdrop" onClick={() => setIsQuickAddOpen(false)}>
            <div className="modal-dialog-white" style={{ background: '#0E1726', border: '1px solid rgba(255, 255, 255, 0.1)', color: '#FFFFFF' }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header-white" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div className="modal-title-wrap">
                  <span className="modal-icon-badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34D399' }}>
                    <Plus size={18} />
                  </span>
                  <div>
                    <h3 style={{ color: '#FFFFFF' }}>Quick Add Carbon Activity</h3>
                    <p style={{ color: '#94A3B8' }}>Record an emission activity with real-time IPCC calculation</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsQuickAddOpen(false)}
                  className="modal-close-btn"
                  style={{ color: '#94A3B8' }}
                  aria-label="Close modal"
                >
                  <X size={16} />
                </button>
              </div>

              {quickSuccess ? (
                <div className="modal-success-state" style={{ padding: '30px', textAlign: 'center' }}>
                  <CheckCircle2 size={40} style={{ color: '#10B981', margin: '0 auto 12px' }} />
                  <h4 style={{ color: '#FFFFFF', fontSize: '1.1rem' }}>Activity Recorded Successfully!</h4>
                  <p style={{ color: '#94A3B8' }}>Your emissions have been calculated and your dashboard updated.</p>
                </div>
              ) : (
                <form onSubmit={handleQuickSubmit} className="modal-form-white">
                  <div className="form-group-white">
                    <label style={{ color: '#94A3B8' }}>Activity Category</label>
                    <div className="category-radio-strip" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {Object.entries(EMISSION_CONFIG).slice(0, 5).map(([key, cfg]) => {
                        const Icon = cfg.icon;
                        return (
                          <button
                            type="button"
                            key={key}
                            className={`cat-pill-btn ${quickCategory === key ? 'selected' : ''}`}
                            onClick={() => setQuickCategory(key)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '8px',
                              border: quickCategory === key ? '1px solid #10B981' : '1px solid rgba(255, 255, 255, 0.08)',
                              background: quickCategory === key ? 'rgba(16, 185, 129, 0.15)' : '#111C31',
                              color: quickCategory === key ? '#34D399' : '#94A3B8',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              cursor: 'pointer',
                            }}
                          >
                            <Icon size={14} />
                            <span>{cfg.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="form-grid-2col-white" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginTop: '12px' }}>
                    <div className="form-group-white">
                      <label style={{ color: '#94A3B8' }}>
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
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          background: '#111C31',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          color: '#FFFFFF',
                        }}
                        autoFocus
                      />
                    </div>

                    <div className="form-group-white">
                      <label style={{ color: '#94A3B8' }}>Date of Activity</label>
                      <input
                        type="date"
                        required
                        value={quickDate}
                        onChange={(e) => setQuickDate(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          background: '#111C31',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          color: '#FFFFFF',
                        }}
                      />
                    </div>
                  </div>

                  <div className="form-group-white" style={{ marginTop: '12px' }}>
                    <label style={{ color: '#94A3B8' }}>Notes (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Commute to work, monthly utility invoice, etc."
                      value={quickNotes}
                      onChange={(e) => setQuickNotes(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        background: '#111C31',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        color: '#FFFFFF',
                      }}
                    />
                  </div>

                  <div className="modal-preview-banner" style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '9px', padding: '10px 14px', margin: '14px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94A3B8', fontSize: '0.82rem' }}>
                      <Leaf size={16} style={{ color: '#10B981' }} />
                      <span>Estimated Footprint:</span>
                    </div>
                    <strong style={{ color: '#34D399', fontSize: '0.95rem' }}>{quickEstKg} kg CO₂e</strong>
                  </div>

                  <div className="modal-footer-white" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                    <button
                      type="button"
                      onClick={() => setIsQuickAddOpen(false)}
                      className="btn-modal-cancel"
                      style={{ padding: '8px 16px', background: 'transparent', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', color: '#94A3B8', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingQuick || !quickValue}
                      className="btn-emerald-primary"
                      style={{ padding: '8px 18px', background: '#10B981', border: 0, borderRadius: '8px', color: '#080D1A', fontWeight: 700, cursor: 'pointer' }}
                    >
                      {isSubmittingQuick ? 'Saving...' : 'Save Activity'}
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
