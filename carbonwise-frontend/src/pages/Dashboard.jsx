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
  CheckCircle2,
  ChevronRight,
  CloudSun,
  Database,
  ExternalLink,
  Flame,
  Globe,
  History,
  Info,
  Leaf,
  MapPin,
  Plus,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
  Target,
  Thermometer,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wind,
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
  transport: { label: 'Transport', unit: 'km', factor: 0.21, icon: '🚗', color: '#10b981' },
  electricity: { label: 'Electricity', unit: 'kWh', factor: 0.5, icon: '⚡', color: '#38bdf8' },
  food: { label: 'Food', unit: 'meals', factor: 2.5, icon: '🍖', color: '#f59e0b' },
  flight: { label: 'Flight', unit: 'km', factor: 0.255, icon: '✈️', color: '#a855f7' },
  shopping: { label: 'Shopping', unit: 'items', factor: 5.0, icon: '🛍️', color: '#ec4899' },
};

const round = (val, d = 1) => (val != null && !Number.isNaN(Number(val)) ? Number(val).toFixed(d) : '0.0');

const Dashboard = () => {
  const [period, setPeriod] = useState('30');
  const [intelligence, setIntelligence] = useState(null);
  const [activities, setActivities] = useState([]);
  const [coachPlan, setCoachPlan] = useState(null);
  const [regions, setRegions] = useState([]);
  const [selectedRegionId, setSelectedRegionId] = useState('');
  const [envSummary, setEnvSummary] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [aiInsights, setAiInsights] = useState(null);
  const [loading, setLoading] = useState(true);

  // Quick Activity Log state
  const [logType, setLogType] = useState('transport');
  const [logValue, setLogValue] = useState('');
  const [isLogging, setIsLogging] = useState(false);
  const [logSuccess, setLogSuccess] = useState(false);

  // Initial Data Load
  const loadDashboard = useCallback(async () => {
    try {
      const [intelRes, actRes, coachRes, regRes, alertRes] = await Promise.allSettled([
        api.get(`/intelligence?period=${period}`),
        api.get('/activities'),
        api.get('/coach/plan'),
        api.get('/environment/regions'),
        api.get('/environment/alerts'),
      ]);

      if (intelRes.status === 'fulfilled') setIntelligence(intelRes.value.data);
      if (actRes.status === 'fulfilled') setActivities(Array.isArray(actRes.value.data) ? actRes.value.data : actRes.value.data?.activities || []);
      if (coachRes.status === 'fulfilled') setCoachPlan(coachRes.value.data);
      if (alertRes.status === 'fulfilled') setAlerts(alertRes.value.data || []);

      if (regRes.status === 'fulfilled' && regRes.value.data?.length > 0) {
        const list = regRes.value.data;
        setRegions(list);
        if (!selectedRegionId) setSelectedRegionId(String(list[0].id));
      }
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  }, [period, selectedRegionId]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Load Environmental Telemetry for selected region
  useEffect(() => {
    if (!selectedRegionId) return;
    let isMounted = true;
    const fetchEnvData = async () => {
      try {
        const [sumRes, aiRes] = await Promise.allSettled([
          api.get(`/environment/regions/${selectedRegionId}/summary`),
          api.get(`/environment/regions/${selectedRegionId}/ai-insights`),
        ]);
        if (isMounted) {
          if (sumRes.status === 'fulfilled') setEnvSummary(sumRes.value.data);
          if (aiRes.status === 'fulfilled') setAiInsights(aiRes.value.data);
        }
      } catch (err) {
        console.warn('Environmental telemetry fetch error:', err);
      }
    };
    fetchEnvData();
    return () => { isMounted = false; };
  }, [selectedRegionId]);

  // Quick Activity Log submission
  const handleQuickLog = async (e) => {
    e.preventDefault();
    const val = parseFloat(logValue);
    if (!val || val <= 0) return;

    try {
      setIsLogging(true);
      await api.post('/activities', {
        activity_type: logType,
        details: { value: val, unit: EMISSION_CONFIG[logType]?.unit },
      });
      setLogValue('');
      setLogSuccess(true);
      setTimeout(() => setLogSuccess(false), 3000);
      await loadDashboard();
    } catch (err) {
      console.error('Failed to log activity:', err);
    } finally {
      setIsLogging(false);
    }
  };

  // Toggle Action Status
  const handleToggleAction = async (actionId, currentStatus) => {
    const nextStatus = currentStatus === 'completed' ? 'planned' : 'completed';
    try {
      await api.patch(`/coach/actions/${actionId}`, { status: nextStatus });
      setCoachPlan((prev) => prev && {
        ...prev,
        actions: prev.actions.map((a) => (a.id === actionId ? { ...a, status: nextStatus } : a)),
      });
    } catch (err) {
      console.error('Error toggling action plan status:', err);
    }
  };

  // Acknowledge Alert
  const handleAckAlert = async (alertId) => {
    try {
      await api.patch(`/environment/alerts/${alertId}`, { status: 'acknowledged' });
      setAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, status: 'acknowledged' } : a)));
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    }
  };

  // Delete Activity
  const handleDeleteActivity = async (id) => {
    if (!window.confirm('Delete this activity entry?')) return;
    try {
      await api.delete(`/activities/${id}`);
      await loadDashboard();
    } catch (err) {
      console.error('Failed to delete activity:', err);
    }
  };

  // Key KPI Calculations
  const currentFootprint = intelligence?.totals?.currentPeriod || 0;
  const previousFootprint = intelligence?.totals?.previousPeriod || 0;
  const percentageChange = intelligence?.comparison?.percentageChange;
  const isReduction = percentageChange != null && percentageChange < 0;

  const topCategory = intelligence?.largestSources?.[0];
  const eligibleSavings = intelligence?.recommendations?.reduce((sum, r) => sum + (r.potentialSavingsKg || 0), 0) || 0;

  const completedActionsCount = coachPlan?.actions?.filter((a) => a.status === 'completed').length || 0;
  const totalActionsCount = coachPlan?.actions?.length || 7;
  const actionProgressPercent = totalActionsCount ? Math.round((completedActionsCount / totalActionsCount) * 100) : 0;

  // Environmental telemetry indicators
  const currentTemp = envSummary?.current?.temperature;
  const currentAqi = envSummary?.current?.us_aqi;
  const currentPm25 = envSummary?.current?.pm2_5;
  const tempAnomaly = envSummary?.metrics?.find((m) => m.metric === 'temperature')?.anomaly;

  // Trend Chart Data (Actual daily + Moving average projection)
  const chartData = useMemo(() => {
    const trends = intelligence?.trends || [];
    const labels = trends.map((t) => t.date?.slice(5) || '');
    const dataPoints = trends.map((t) => t.emissions || 0);

    // Compute simple moving average line
    const movingAvg = dataPoints.map((val, idx, arr) => {
      const slice = arr.slice(Math.max(0, idx - 2), idx + 1);
      return round(slice.reduce((a, b) => a + b, 0) / slice.length);
    });

    return {
      labels: labels.length ? labels : ['No Data'],
      datasets: [
        {
          label: 'Daily Footprint (kg CO₂e)',
          data: dataPoints.length ? dataPoints : [0],
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.12)',
          borderWidth: 2.2,
          pointRadius: trends.length > 20 ? 0 : 3,
          tension: 0.35,
          fill: true,
        },
        {
          label: '3-Day Moving Average Trajectory',
          data: movingAvg.length ? movingAvg : [0],
          borderColor: '#38bdf8',
          borderWidth: 1.8,
          borderDash: [5, 4],
          pointRadius: 0,
          fill: false,
        },
      ],
    };
  }, [intelligence]);

  // Category Breakdown Donut Chart
  const donutData = useMemo(() => {
    const breakdown = intelligence?.categoryBreakdown || [];
    if (!breakdown.length) {
      return {
        labels: ['No Activity Recorded'],
        datasets: [{ data: [1], backgroundColor: ['#1e293b'] }],
      };
    }
    return {
      labels: breakdown.map((c) => c.label),
      datasets: [
        {
          data: breakdown.map((c) => c.emissions),
          backgroundColor: breakdown.map((c) => EMISSION_CONFIG[c.category]?.color || '#10b981'),
          borderWidth: 2,
          borderColor: '#0f182a',
        },
      ],
    };
  }, [intelligence]);

  if (loading) {
    return (
      <Layout>
        <div className="dashboard-container" style={{ padding: '80px 20px', textAlign: 'center' }}>
          <RefreshCw size={32} className="spin icon-mint" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ color: '#ffffff', fontSize: '1.25rem', marginBottom: '8px' }}>Initializing Carbon & Climate Intelligence...</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Aggregating activity telemetry, predictive baselines, and environmental observations.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="dashboard-container">
        {/* Top Control Header: Location & Period Filter */}
        <div className="dashboard-region-bar">
          <div className="region-bar-left">
            <span className="summary-status-badge live">
              <span className="live-dot" /> Live System Active
            </span>
            <span className="region-bar-label">Monitoring Node:</span>
            <select
              value={selectedRegionId}
              onChange={(e) => setSelectedRegionId(e.target.value)}
              className="region-bar-select"
              aria-label="Select Region"
            >
              {regions.map((reg) => (
                <option key={reg.id} value={reg.id}>
                  {reg.name} ({reg.country})
                </option>
              ))}
            </select>
          </div>

          <div className="region-bar-right">
            <span className="region-bar-label">Analysis Scope:</span>
            <div className="timeframe-selector">
              <button
                className={`btn-timeframe ${period === '7' ? 'active' : ''}`}
                onClick={() => setPeriod('7')}
              >
                7 Days
              </button>
              <button
                className={`btn-timeframe ${period === '30' ? 'active' : ''}`}
                onClick={() => setPeriod('30')}
              >
                30 Days
              </button>
              <button
                className={`btn-timeframe ${period === '90' ? 'active' : ''}`}
                onClick={() => setPeriod('90')}
              >
                90 Days
              </button>
              <button
                className={`btn-timeframe ${period === '365' ? 'active' : ''}`}
                onClick={() => setPeriod('365')}
              >
                1 Year
              </button>
            </div>
            <Link to="/reports" className="btn-refresh-telemetry">
              <span>Audit Report PDF</span>
              <ExternalLink size={13} />
            </Link>
          </div>
        </div>

        {/* ========================================================
            ROW 1: FOUR UNIFIED KPI CARDS
        ======================================================== */}
        <div className="dashboard-summary-strip">
          {/* Card 1: Total Footprint */}
          <div className="summary-metric-card">
            <div className="summary-card-header">
              <span className="summary-card-title">Total Footprint ({period}D)</span>
              <span className="summary-card-icon-wrap mint">
                <Leaf size={18} />
              </span>
            </div>
            <div className="summary-card-value-row">
              <span className="summary-card-value">{round(currentFootprint)}</span>
              <span className="summary-card-unit">kg CO₂e</span>
            </div>
            <div className="summary-card-footer">
              <span className={`summary-status-badge ${isReduction ? 'normal' : percentageChange > 0 ? 'warning' : 'blue'}`}>
                {percentageChange != null ? (
                  isReduction ? (
                    <><ArrowDownRight size={13} /> {Math.abs(percentageChange)}% vs last {period}d</>
                  ) : (
                    <><ArrowUpRight size={13} /> +{percentageChange}% vs last {period}d</>
                  )
                ) : (
                  'Initial Baseline Cycle'
                )}
              </span>
              <span className="summary-card-sub">
                Previous period: {round(previousFootprint)} kg CO₂e
              </span>
            </div>
          </div>

          {/* Card 2: Highest Emission Category */}
          <div className="summary-metric-card">
            <div className="summary-card-header">
              <span className="summary-card-title">Primary Emission Driver</span>
              <span className="summary-card-icon-wrap amber">
                <Flame size={18} />
              </span>
            </div>
            <div className="summary-card-value-row">
              <span className="summary-card-value">
                {topCategory ? `${topCategory.contributionPercentage}%` : '0%'}
              </span>
              <span className="summary-card-unit">{topCategory ? topCategory.label : 'None'}</span>
            </div>
            <div className="summary-card-footer">
              <span className="summary-status-badge warning">
                Potential Savings: ~{round(eligibleSavings)} kg CO₂e
              </span>
              <span className="summary-card-sub">
                {topCategory ? `${round(topCategory.emissions)} kg in ${topCategory.label}` : 'Log activities to track'}
              </span>
            </div>
          </div>

          {/* Card 3: Decarbonization Action Progress */}
          <div className="summary-metric-card">
            <div className="summary-card-header">
              <span className="summary-card-title">Decarbonization Plan</span>
              <span className="summary-card-icon-wrap blue">
                <Target size={18} />
              </span>
            </div>
            <div className="summary-card-value-row">
              <span className="summary-card-value">{actionProgressPercent}%</span>
              <span className="summary-card-unit">completed</span>
            </div>
            <div className="summary-card-footer">
              <span className="summary-status-badge blue">
                {completedActionsCount} of {totalActionsCount} actions logged
              </span>
              <span className="summary-card-sub">
                <Link to="/action-plan" className="card-action-link">
                  Open Action Plan <ChevronRight size={13} />
                </Link>
              </span>
            </div>
          </div>

          {/* Card 4: Live Environmental Context */}
          <div className="summary-metric-card">
            <div className="summary-card-header">
              <span className="summary-card-title">Local Climate Telemetry</span>
              <span className="summary-card-icon-wrap purple">
                <Thermometer size={18} />
              </span>
            </div>
            <div className="summary-card-value-row">
              <span className="summary-card-value">
                {currentTemp != null ? `${round(currentTemp)}°C` : '—'}
              </span>
              <span className="summary-card-unit">
                {currentAqi != null ? `AQI ${round(currentAqi, 0)}` : 'Open-Meteo'}
              </span>
            </div>
            <div className="summary-card-footer">
              <span className={`summary-status-badge ${tempAnomaly ? 'warning' : 'live'}`}>
                {tempAnomaly ? `Anomaly (Z: +${round(tempAnomaly.robustZ)}σ)` : 'Ambient Weather Nominal'}
              </span>
              <span className="summary-card-sub">
                PM2.5: {currentPm25 != null ? `${round(currentPm25, 1)} µg/m³` : 'Standard Network'}
              </span>
            </div>
          </div>
        </div>

        {/* ========================================================
            ROW 2: INTERACTIVE CHART & INSTANT ACTIVITY LOGGER
        ======================================================== */}
        <div className="dashboard-grid-middle">
          {/* Left: Carbon Footprint Trends & Projections */}
          <div className="tracker-card card-chart-large">
            <div className="tracker-card-header">
              <div>
                <h2 className="card-section-title">
                  <TrendingUp size={18} className="icon-mint" />
                  Carbon Footprint Trajectory & Historical Variance
                </h2>
                <p className="card-subtitle-small">
                  Observed daily greenhouse gas emissions vs. 3-day trailing trajectory ({period}-day scope)
                </p>
              </div>
              <Link to="/carbon-intelligence" className="card-action-link">
                Intelligence Engine <ChevronRight size={14} />
              </Link>
            </div>

            <div className="dashboard-main-chart-wrapper" style={{ height: '310px' }}>
              <Line
                data={chartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      display: true,
                      position: 'top',
                      labels: { color: '#94a3b8', font: { size: 12, family: 'DM Sans' } },
                    },
                    tooltip: {
                      backgroundColor: '#0f182a',
                      titleColor: '#ffffff',
                      bodyColor: '#cbd5e1',
                      borderColor: '#1e2c44',
                      borderWidth: 1,
                      padding: 10,
                    },
                  },
                  scales: {
                    x: {
                      grid: { color: 'rgba(255, 255, 255, 0.04)' },
                      ticks: { color: '#64748b', font: { size: 11 } },
                    },
                    y: {
                      beginAtZero: true,
                      grid: { color: 'rgba(255, 255, 255, 0.05)' },
                      ticks: { color: '#64748b', font: { size: 11 } },
                    },
                  },
                }}
              />
            </div>

            <div className="chart-footer-stat-bar">
              <span>
                <strong>Total Scope Emissions:</strong> {round(currentFootprint)} kg CO₂e
              </span>
              <span>
                <strong>Daily Average:</strong> {round(intelligence?.totals?.daily || 0)} kg CO₂e/day
              </span>
              <span>
                <strong>Target Status:</strong> {isReduction ? 'Decarbonizing' : 'Baseline Growth'}
              </span>
            </div>
          </div>

          {/* Right: Category Distribution & Instant Logger */}
          <div className="tracker-card card-regional-panel">
            <div className="tracker-card-header">
              <div>
                <h2 className="card-section-title">
                  <Zap size={18} className="icon-mint" />
                  Instant Activity Logger (Track)
                </h2>
                <p className="card-subtitle-small">Log carbon activities with automated emission factor calculation</p>
              </div>
            </div>

            {/* Quick Log Form */}
            <form onSubmit={handleQuickLog} className="quick-activity-box">
              <div className="quick-log-row">
                <select
                  value={logType}
                  onChange={(e) => setLogType(e.target.value)}
                  className="quick-select"
                  aria-label="Activity Type"
                >
                  {Object.entries(EMISSION_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.icon} {v.label} ({v.factor} kg/{v.unit})
                    </option>
                  ))}
                </select>

                <div className="quick-input-wrap">
                  <input
                    type="number"
                    step="any"
                    min="0.1"
                    placeholder={`Quantity (${EMISSION_CONFIG[logType]?.unit})`}
                    value={logValue}
                    onChange={(e) => setLogValue(e.target.value)}
                    className="quick-input"
                    required
                  />
                  <span className="quick-unit-tag">{EMISSION_CONFIG[logType]?.unit}</span>
                </div>
              </div>

              <div className="quick-calc-preview">
                <span>Calculated Emission:</span>
                <strong>
                  {logValue ? `${round(parseFloat(logValue) * EMISSION_CONFIG[logType]?.factor)} kg CO₂e` : '0.0 kg CO₂e'}
                </strong>
              </div>

              <button type="submit" disabled={isLogging || !logValue} className="btn-log-action">
                <Plus size={15} />
                <span>{isLogging ? 'Calculating & Saving...' : 'Log Activity Now'}</span>
              </button>

              {logSuccess && (
                <div className="log-success-pill">
                  <CheckCircle2 size={13} /> Activity recorded in PostgreSQL! Stats updated.
                </div>
              )}
            </form>

            {/* Category Doughnut Chart */}
            <div className="donut-summary-wrap" style={{ height: '140px', marginTop: '14px' }}>
              <Doughnut
                data={donutData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      display: true,
                      position: 'right',
                      labels: { color: '#94a3b8', boxWidth: 10, font: { size: 10 } },
                    },
                  },
                  cutout: '70%',
                }}
              />
            </div>
          </div>
        </div>

        {/* ========================================================
            ROW 3: ADAPTIVE ACTION PLAN & ENVIRONMENTAL TELEMETRY
        ======================================================== */}
        <div className="dashboard-grid-bottom">
          {/* Left: 7-Day Adaptive Climate Action Plan */}
          <div className="tracker-card card-anomalies-overview">
            <div className="tracker-card-header">
              <div>
                <h2 className="card-section-title">
                  <Target size={18} className="icon-mint" />
                  Adaptive Eco-Coach Action Plan (Reduce)
                </h2>
                <p className="card-subtitle-small">Personalized recommendations targeted at your highest emission sources</p>
              </div>
              <Link to="/action-plan" className="card-action-link">
                Full Plan <ChevronRight size={14} />
              </Link>
            </div>

            <div className="action-checklist-feed">
              {coachPlan?.actions?.slice(0, 4).map((action) => {
                const isDone = action.status === 'completed';
                return (
                  <div key={action.id} className={`action-checklist-item ${isDone ? 'done' : ''}`}>
                    <button
                      type="button"
                      onClick={() => handleToggleAction(action.id, action.status)}
                      className={`action-check-btn ${isDone ? 'checked' : ''}`}
                      title={isDone ? 'Mark as planned' : 'Mark as completed'}
                    >
                      {isDone ? <CheckCircle2 size={16} /> : <div className="check-empty" />}
                    </button>
                    <div className="action-item-body">
                      <div className="action-item-top">
                        <strong className={isDone ? 'line-through' : ''}>{action.title}</strong>
                        <span className="action-category-tag">{action.category}</span>
                      </div>
                      <p>{action.explanation}</p>
                      {action.estimatedPotentialSavingsKg > 0 && (
                        <small className="action-savings-tag">
                          Potential savings: ~{round(action.estimatedPotentialSavingsKg)} kg CO₂e
                        </small>
                      )}
                    </div>
                  </div>
                );
              })}
              {(!coachPlan?.actions || coachPlan.actions.length === 0) && (
                <div className="empty-state-notice">
                  <Sparkles size={24} className="icon-mint" />
                  <span>No actions configured yet. Log activities to generate your first adaptive plan.</span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Environmental Telemetry & Anomaly Alerts */}
          <div className="tracker-card card-alerts-overview">
            <div className="tracker-card-header">
              <div>
                <h2 className="card-section-title">
                  <Bell size={18} className="icon-amber" />
                  Live Climate & Anomaly Alerts
                </h2>
                <p className="card-subtitle-small">Atmospheric deviations and ambient air quality telemetry</p>
              </div>
              <Link to="/alerts" className="card-action-link">
                Alerts ({alerts.length}) <ChevronRight size={14} />
              </Link>
            </div>

            {/* AI Insights Banner */}
            {aiInsights?.narrative && (
              <div className="ai-insights-inline-banner">
                <Sparkles size={16} className="icon-mint" style={{ flexShrink: 0 }} />
                <p>{aiInsights.narrative}</p>
              </div>
            )}

            <div className="alerts-list-compact">
              {alerts.length > 0 ? (
                alerts.slice(0, 3).map((alert) => (
                  <div key={alert.id} className={`alert-card-row ${alert.severity}`}>
                    <div className="alert-card-header-line">
                      <span className={`alert-severity-pill ${alert.severity}`}>
                        {alert.severity?.toUpperCase()}
                      </span>
                      <span className="alert-time-stamp">
                        {new Date(alert.created_at || alert.observed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="alert-card-body-text">
                      <strong>{alert.metric?.toUpperCase()} Alert: Observed {round(alert.observed_value)}</strong>
                      <p>{alert.explanation || `Threshold exceeded (${round(alert.threshold_value)}). Statistical anomaly flagged.`}</p>
                    </div>
                    {alert.status === 'open' && (
                      <button onClick={() => handleAckAlert(alert.id)} className="btn-ack-alert">
                        Acknowledge
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="empty-state-notice">
                  <CheckCircle2 size={24} className="icon-mint" />
                  <span>Atmospheric parameters in your region remain within normal seasonal baselines.</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ========================================================
            ROW 4: RECENT ACTIVITY LEDGER
        ======================================================== */}
        <div className="tracker-card recent-activities-card">
          <div className="tracker-card-header">
            <div>
              <h2 className="card-section-title">
                <History size={18} className="icon-mint" />
                Verified Activity Ledger (Recent Entries)
              </h2>
              <p className="card-subtitle-small">
                Stored in PostgreSQL with deterministic emission factors
              </p>
            </div>
            <Link to="/activities" className="card-action-link">
              Full Activity Log ({activities.length}) <ChevronRight size={14} />
            </Link>
          </div>

          <div className="activity-table-wrapper">
            {activities.length > 0 ? (
              <table className="custom-data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Logged Quantity</th>
                    <th>Calculated CO₂e</th>
                    <th>Emission Factor</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {activities.slice(0, 6).map((act) => {
                    const cfg = EMISSION_CONFIG[act.activity_type] || {};
                    return (
                      <tr key={act.id}>
                        <td className="mono">{act.date ? new Date(act.date).toLocaleDateString() : 'Today'}</td>
                        <td>
                          <span className="category-cell-badge">
                            {cfg.icon || '📌'} {cfg.label || act.activity_type}
                          </span>
                        </td>
                        <td>
                          {act.details?.value || '—'} {cfg.unit || act.details?.unit}
                        </td>
                        <td>
                          <strong className="text-mint">{round(act.carbon_emissions)} kg</strong>
                        </td>
                        <td className="text-muted mono">
                          {cfg.factor ? `${cfg.factor} kg/${cfg.unit}` : 'Standard'}
                        </td>
                        <td>
                          <button
                            onClick={() => handleDeleteActivity(act.id)}
                            className="btn-trash-inline"
                            title="Delete entry"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="empty-state-notice">
                <Leaf size={24} className="icon-mint" />
                <span>No activities recorded yet. Use the Quick Activity Logger above to record your first entry.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
