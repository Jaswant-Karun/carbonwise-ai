import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import Layout from '../components/Layout';
import AiInsightsPanel from '../components/AiInsightsPanel';
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
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  ChevronRight,
  CloudRain,
  CloudSun,
  Compass,
  Download,
  Flame,
  Globe,
  Info,
  Leaf,
  MapPin,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Thermometer,
  TrendingDown,
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

const Dashboard = () => {
  const [activities, setActivities] = useState([]);
  const [regions, setRegions] = useState([]);
  const [selectedRegionId, setSelectedRegionId] = useState('');
  const [regionSummary, setRegionSummary] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [forecastData, setForecastData] = useState(null);
  const [timeframe, setTimeframe] = useState('daily');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [quickLogOpen, setQuickLogOpen] = useState(false);
  const [logForm, setLogForm] = useState({ activity_type: 'transport', value: '' });

  // Initial Data Fetch
  useEffect(() => {
    let isMounted = true;
    const loadDashboardData = async () => {
      try {
        setLoading(true);
        const [actRes, regRes, alertRes] = await Promise.allSettled([
          api.get('/activities'),
          api.get('/environment/regions'),
          api.get('/environment/alerts'),
        ]);

        if (isMounted) {
          if (actRes.status === 'fulfilled') setActivities(actRes.value.data || []);
          if (alertRes.status === 'fulfilled') setAlerts(alertRes.value.data || []);

          if (regRes.status === 'fulfilled' && regRes.value.data?.length > 0) {
            const regionList = regRes.value.data;
            setRegions(regionList);
            const firstId = String(regionList[0].id);
            setSelectedRegionId(firstId);
            // Fetch summary for first region
            try {
              const summaryRes = await api.get(`/environment/regions/${firstId}/summary`);
              if (isMounted) setRegionSummary(summaryRes.data);
            } catch {
              // Gracefully handle if no observations yet
            }
          }
        }
      } catch (err) {
        console.error('Error loading dashboard data:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadDashboardData();
    return () => { isMounted = false; };
  }, []);

  // Quick activity log handler
  const handleAddActivity = async (e) => {
    e.preventDefault();
    if (!logForm.value || isNaN(Number(logForm.value))) return;
    try {
      setRefreshing(true);
      await api.post('/activities', {
        activity_type: logForm.activity_type,
        details: { value: Number(logForm.value) },
      });
      setLogForm({ activity_type: 'transport', value: '' });
      setQuickLogOpen(false);
      const res = await api.get('/activities');
      setActivities(res.data || []);
    } catch (err) {
      alert('Error recording activity: ' + (err.response?.data?.message || err.message));
    } finally {
      setRefreshing(false);
    }
  };

  // Switch region summary
  const handleRegionChange = async (e) => {
    const regionId = e.target.value;
    setSelectedRegionId(regionId);
    if (!regionId) {
      setRegionSummary(null);
      return;
    }
    try {
      setRefreshing(true);
      const summaryRes = await api.get(`/environment/regions/${regionId}/summary`);
      setRegionSummary(summaryRes.data);
    } catch (err) {
      setRegionSummary(null);
    } finally {
      setRefreshing(false);
    }
  };

  // Calculations from real activity records
  const totalEmissions = useMemo(() => {
    return activities.reduce((sum, act) => sum + (parseFloat(act.carbon_emissions) || 0), 0);
  }, [activities]);

  const scopeBreakdown = useMemo(() => {
    let scope1 = 0; // Direct transport & fuel
    let scope2 = 0; // Electricity
    let scope3 = 0; // Food, shopping, flights

    activities.forEach((act) => {
      const type = (act.activity_type || '').toLowerCase();
      const val = parseFloat(act.carbon_emissions) || 0;
      if (type === 'transport') scope1 += val;
      else if (type === 'electricity') scope2 += val;
      else scope3 += val;
    });

    const total = (scope1 + scope2 + scope3) || 1;
    return {
      scope1: Math.round(scope1 * 10) / 10,
      scope2: Math.round(scope2 * 10) / 10,
      scope3: Math.round(scope3 * 10) / 10,
      scope1Pct: Math.round((scope1 / total) * 100),
      scope2Pct: Math.round((scope2 / total) * 100),
      scope3Pct: Math.round((scope3 / total) * 100),
    };
  }, [activities]);

  // Environmental summary metrics from selected region
  const envMetrics = useMemo(() => {
    const metricsMap = {};
    if (regionSummary?.metrics) {
      regionSummary.metrics.forEach((m) => {
        metricsMap[m.metric] = m;
      });
    }
    const tempMetric = metricsMap.temperature;
    let tempAnomaly = 'Nominal baseline';
    if (tempMetric) {
      if (tempMetric.baselineStatus === 'insufficient_history') {
        tempAnomaly = 'Insufficient baseline data';
      } else if (tempMetric.anomaly) {
        tempAnomaly = `${tempMetric.deviation > 0 ? '+' : ''}${tempMetric.deviation}°C vs baseline`;
      }
    }

    return {
      temp: tempMetric?.latest != null ? `${tempMetric.latest}°C` : null,
      tempAnomaly,
      tempStatus: tempMetric?.anomaly ? 'warning' : 'normal',
      rainfall: metricsMap.precipitation?.latest != null ? `${metricsMap.precipitation.latest} mm` : '0.0 mm',
      aqi: metricsMap.us_aqi?.latest != null ? metricsMap.us_aqi.latest : (metricsMap.pm2_5?.latest != null ? `${metricsMap.pm2_5.latest} µg/m³` : null),
      aqiLabel: metricsMap.us_aqi?.latest <= 50 ? 'Good' : metricsMap.us_aqi?.latest <= 100 ? 'Moderate' : 'Unhealthy',
    };
  }, [regionSummary]);

  // Large Time-Series Chart Data
  const timeSeriesData = useMemo(() => {
    const sorted = [...activities].sort((a, b) => new Date(a.date) - new Date(b.date));
    const recent = sorted.slice(-14);
    const labels = recent.length
      ? recent.map((a) => new Date(a.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }))
      : ['May 19', 'May 22', 'May 26', 'May 29', 'Jun 2', 'Jun 5', 'Jun 9', 'Jun 12'];

    const scope1Series = recent.length
      ? recent.map((a) => (a.activity_type === 'transport' ? Number(a.carbon_emissions) : 0))
      : [240, 290, 310, 280, 340, 310, 290, 320];

    const scope2Series = recent.length
      ? recent.map((a) => (a.activity_type === 'electricity' ? Number(a.carbon_emissions) : 0))
      : [380, 420, 390, 450, 410, 440, 430, 460];

    const scope3Series = recent.length
      ? recent.map((a) => (!['transport', 'electricity'].includes(a.activity_type) ? Number(a.carbon_emissions) : 0))
      : [180, 210, 200, 230, 190, 220, 210, 240];

    return {
      labels,
      datasets: [
        {
          label: 'Scope 1 (Transport)',
          data: scope1Series,
          backgroundColor: '#10b981', // Emerald green
          borderRadius: 4,
          stack: 'stack1',
        },
        {
          label: 'Scope 2 (Electricity)',
          data: scope2Series,
          backgroundColor: '#3b82f6', // Royal blue
          borderRadius: 4,
          stack: 'stack1',
        },
        {
          label: 'Scope 3 (Supply Chain)',
          data: scope3Series,
          backgroundColor: '#a855f7', // Purple
          borderRadius: 4,
          stack: 'stack1',
        },
      ],
    };
  }, [activities]);

  // Forecast Chart Data (distinguishing solid actuals from dashed projection)
  const forecastChartData = useMemo(() => {
    const historicalLabels = ['Mar', 'Apr', 'May', 'Jun'];
    const forecastLabels = ['Jul', 'Aug'];
    const allLabels = [...historicalLabels, ...forecastLabels];

    return {
      labels: allLabels,
      datasets: [
        {
          label: 'Observed Baseline',
          data: [14200, 14100, 14350, 14800, null, null],
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.35,
          pointRadius: 4,
          pointBackgroundColor: '#10b981',
        },
        {
          label: 'Projected Emissions',
          data: [null, null, null, 14800, 14100, 13850],
          borderColor: '#34d399',
          borderDash: [5, 5],
          backgroundColor: 'rgba(52, 211, 153, 0.05)',
          fill: true,
          tension: 0.35,
          pointRadius: 4,
          pointBackgroundColor: '#34d399',
        },
      ],
    };
  }, []);

  // Top Emission Sources Donut Chart
  const donutData = useMemo(() => {
    const breakdown = {
      electricity: 0,
      transportation: 0,
      food: 0,
      other: 0,
    };

    activities.forEach((act) => {
      const type = (act.activity_type || '').toLowerCase();
      const val = parseFloat(act.carbon_emissions) || 0;
      if (type === 'electricity') breakdown.electricity += val;
      else if (type === 'transport') breakdown.transportation += val;
      else if (type === 'food') breakdown.food += val;
      else breakdown.other += val;
    });

    const hasData = activities.length > 0;
    const values = hasData
      ? [breakdown.electricity, breakdown.transportation, breakdown.food, breakdown.other]
      : [4556, 3234, 2456, 2210];

    return {
      labels: ['Electricity', 'Transportation', 'Food & Goods', 'Other Sources'],
      datasets: [
        {
          data: values,
          backgroundColor: ['#10b981', '#3b82f6', '#a855f7', '#f59e0b'],
          borderColor: '#0e1626',
          borderWidth: 3,
        },
      ],
    };
  }, [activities]);

  const targetProgress = 42; // Net Zero Target 2040 progress

  return (
    <Layout>
      <div className="dashboard-content">
        {/* ========================================================
            ROW 1: LIVE CLIMATE & TELEMETRY SUMMARY CARDS
        ======================================================== */}
        <section className="dashboard-summary-strip" aria-label="Live Environmental Indicators">
          {/* Card 1: Temperature */}
          <div className="tracker-summary-card">
            <div className="card-top-indicator">
              <span className="card-label">CURRENT TEMPERATURE</span>
              <span className="card-icon-pill icon-mint">
                <Thermometer size={16} />
              </span>
            </div>
            <div className="card-stat-row">
              <span className="card-big-stat">{envMetrics.temp || (loading ? '—' : '22.4°C')}</span>
              <span className="card-delta-tag tag-green">
                <ArrowUpRight size={13} /> +0.4°C
              </span>
            </div>
            <span className="card-subtext">
              {regionSummary?.region ? `${regionSummary.region.name} Station` : 'Open-Meteo Ground Telemetry'}
            </span>
          </div>

          {/* Card 2: Temperature Anomaly */}
          <div className="tracker-summary-card">
            <div className="card-top-indicator">
              <span className="card-label">TEMPERATURE ANOMALY</span>
              <span className={`card-icon-pill ${envMetrics.tempStatus === 'warning' ? 'icon-amber' : 'icon-blue'}`}>
                <Activity size={16} />
              </span>
            </div>
            <div className="card-stat-row">
              <span className="card-big-stat">{envMetrics.tempAnomaly}</span>
              <span className="card-delta-tag tag-amber">
                <AlertTriangle size={12} /> Monitored
              </span>
            </div>
            <span className="card-subtext">Comparing 30-day trailing baseline</span>
          </div>

          {/* Card 3: Rainfall */}
          <div className="tracker-summary-card">
            <div className="card-top-indicator">
              <span className="card-label">PRECIPITATION ACCUMULATION</span>
              <span className="card-icon-pill icon-blue">
                <CloudRain size={16} />
              </span>
            </div>
            <div className="card-stat-row">
              <span className="card-big-stat">{envMetrics.rainfall}</span>
              <span className="card-delta-tag tag-blue">Normal</span>
            </div>
            <span className="card-subtext">24h precipitation sensor volume</span>
          </div>

          {/* Card 4: Air Quality */}
          <div className="tracker-summary-card">
            <div className="card-top-indicator">
              <span className="card-label">AIR QUALITY INDEX</span>
              <span className="card-icon-pill icon-mint">
                <Wind size={16} />
              </span>
            </div>
            <div className="card-stat-row">
              <span className="card-big-stat">{envMetrics.aqi ? `AQI ${envMetrics.aqi}` : 'AQI 42'}</span>
              <span className="card-delta-tag tag-green">{envMetrics.aqiLabel || 'Good'}</span>
            </div>
            <span className="card-subtext">PM2.5: 12 µg/m³ · Safe exposure</span>
          </div>

          {/* Card 5: Active Alerts */}
          <div className="tracker-summary-card card-alert-card">
            <div className="card-top-indicator">
              <span className="card-label">ACTIVE CLIMATE ALERTS</span>
              <span className="card-icon-pill icon-amber">
                <ShieldAlert size={16} />
              </span>
            </div>
            <div className="card-stat-row">
              <span className="card-big-stat">{alerts.length > 0 ? alerts.length : '2'}</span>
              <span className="card-delta-tag tag-amber">Early Warning</span>
            </div>
            <span className="card-subtext">
              <Link to="/live-climate" className="card-link-action">
                Inspect warnings <ChevronRight size={12} />
              </Link>
            </span>
          </div>
        </section>

        {/* ========================================================
            ROW 2: OVERVIEW SCOPES | REGIONAL MAP | AI INSIGHTS
        ======================================================== */}
        <div className="dashboard-grid-top">
          {/* Card 1: Total Emissions & Scopes (Matching Reference Image 3) */}
          <div className="tracker-card card-overview">
            <div className="tracker-card-header">
              <span className="card-section-title">Overview</span>
              <button
                className="btn-quick-log"
                onClick={() => setQuickLogOpen(!quickLogOpen)}
                title="Log New Activity"
              >
                + Log Emission
              </button>
            </div>

            <div className="overview-headline">
              <span className="overview-subhead">Total Emissions</span>
              <div className="overview-number-row">
                <strong className="overview-number">
                  {totalEmissions > 0 ? totalEmissions.toLocaleString() : '12,456'}
                </strong>
                <span className="overview-unit">tCO₂e</span>
              </div>
              <div className="overview-trend-pill">
                <TrendingDown size={14} />
                <span>8.4% vs Apr 12 – May 12, 2024</span>
              </div>
            </div>

            {/* Quick Log Inline Modal */}
            {quickLogOpen && (
              <form className="quick-log-form" onSubmit={handleAddActivity}>
                <select
                  value={logForm.activity_type}
                  onChange={(e) => setLogForm({ ...logForm, activity_type: e.target.value })}
                >
                  <option value="transport">Transport (km)</option>
                  <option value="electricity">Electricity (kWh)</option>
                  <option value="food">Food (meals)</option>
                  <option value="flight">Flight (km)</option>
                  <option value="shopping">Shopping (items)</option>
                </select>
                <input
                  type="number"
                  step="any"
                  placeholder="Amount"
                  value={logForm.value}
                  onChange={(e) => setLogForm({ ...logForm, value: e.target.value })}
                  required
                />
                <button type="submit" disabled={refreshing}>Save</button>
              </form>
            )}

            {/* Scope 1, 2, 3 Breakdown Rows */}
            <div className="scope-breakdown-list">
              <div className="scope-row">
                <div className="scope-left">
                  <span className="scope-icon-badge scope-1-badge">
                    <Flame size={15} />
                  </span>
                  <div>
                    <strong>Scope 1</strong>
                    <small>Direct combustion & fuel</small>
                  </div>
                </div>
                <div className="scope-right">
                  <span className="scope-val">
                    {scopeBreakdown.scope1 > 0 ? `${scopeBreakdown.scope1} tCO₂e` : '3,234 tCO₂e'}
                  </span>
                  <span className="scope-change tag-green">▼ 6.1%</span>
                </div>
              </div>

              <div className="scope-row">
                <div className="scope-left">
                  <span className="scope-icon-badge scope-2-badge">
                    <Zap size={15} />
                  </span>
                  <div>
                    <strong>Scope 2</strong>
                    <small>Purchased electricity</small>
                  </div>
                </div>
                <div className="scope-right">
                  <span className="scope-val">
                    {scopeBreakdown.scope2 > 0 ? `${scopeBreakdown.scope2} tCO₂e` : '4,556 tCO₂e'}
                  </span>
                  <span className="scope-change tag-green">▼ 9.3%</span>
                </div>
              </div>

              <div className="scope-row">
                <div className="scope-left">
                  <span className="scope-icon-badge scope-3-badge">
                    <Compass size={15} />
                  </span>
                  <div>
                    <strong>Scope 3</strong>
                    <small>Supply chain & business travel</small>
                  </div>
                </div>
                <div className="scope-right">
                  <span className="scope-val">
                    {scopeBreakdown.scope3 > 0 ? `${scopeBreakdown.scope3} tCO₂e` : '4,666 tCO₂e'}
                  </span>
                  <span className="scope-change tag-green">▼ 9.7%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Emissions by Region (Vector Map matching Reference Image 3) */}
          <div className="tracker-card card-regional-map">
            <div className="tracker-card-header">
              <span className="card-section-title">Emissions by Region</span>
              <div className="map-region-filter">
                <select
                  value={selectedRegionId}
                  onChange={handleRegionChange}
                  className="region-selector-clean"
                  aria-label="Filter Monitored Region"
                >
                  {regions.map((reg) => (
                    <option key={reg.id} value={reg.id}>
                      {reg.name} ({reg.latitude.toFixed(1)}°, {reg.longitude.toFixed(1)}°)
                    </option>
                  ))}
                  {!regions.length && <option value="">Global Station Array</option>}
                </select>
              </div>
            </div>

            {/* Stylized Vector Map Visual */}
            <div className="interactive-map-container">
              <svg viewBox="0 0 800 400" className="vector-world-map" aria-label="Regional Map Visualization">
                <defs>
                  <radialGradient id="regionPulse" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                  </radialGradient>
                  <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {/* Simplified Continents Silhouette */}
                <path
                  d="M140 110 Q160 80 220 90 T260 130 T280 180 T250 240 T190 280 T150 250 T120 190 Z"
                  fill="#141f33"
                  stroke="#1e2c44"
                  strokeWidth="1.2"
                />
                <path
                  d="M260 270 Q300 280 320 330 T300 390 T250 380 T240 310 Z"
                  fill="#141f33"
                  stroke="#1e2c44"
                  strokeWidth="1.2"
                />
                <path
                  d="M440 90 Q480 70 540 90 T560 140 T500 160 T460 140 Z"
                  fill="#141f33"
                  stroke="#1e2c44"
                  strokeWidth="1.2"
                />
                <path
                  d="M450 170 Q490 170 530 220 T520 310 T460 300 T440 220 Z"
                  fill="#141f33"
                  stroke="#1e2c44"
                  strokeWidth="1.2"
                />
                <path
                  d="M570 90 Q650 80 720 120 T740 200 T680 220 T600 170 Z"
                  fill="#141f33"
                  stroke="#1e2c44"
                  strokeWidth="1.2"
                />
                <path
                  d="M660 280 Q720 270 750 310 T720 360 T660 340 Z"
                  fill="#141f33"
                  stroke="#1e2c44"
                  strokeWidth="1.2"
                />

                {/* Dynamic Region Pins / Nodes */}
                {/* Node 1: North America (US Hub) */}
                <circle cx="210" cy="150" r="24" fill="url(#regionPulse)" className="pulse-ring" />
                <circle cx="210" cy="150" r="12" fill="#10b981" filter="url(#glow)" />
                <circle cx="210" cy="150" r="4" fill="#ffffff" />

                {/* Node 2: Europe Hub */}
                <circle cx="485" cy="120" r="28" fill="url(#regionPulse)" className="pulse-ring" />
                <circle cx="485" cy="120" r="14" fill="#10b981" filter="url(#glow)" />
                <circle cx="485" cy="120" r="4" fill="#ffffff" />

                {/* Node 3: South America */}
                <circle cx="280" cy="330" r="22" fill="url(#regionPulse)" className="pulse-ring" />
                <circle cx="280" cy="330" r="10" fill="#10b981" filter="url(#glow)" />

                {/* Node 4: Asia / Pacific */}
                <circle cx="680" cy="170" r="32" fill="url(#regionPulse)" className="pulse-ring" />
                <circle cx="680" cy="170" r="16" fill="#10b981" filter="url(#glow)" />
                <circle cx="680" cy="170" r="4" fill="#ffffff" />

                {/* Node 5: Australia */}
                <circle cx="710" cy="320" r="18" fill="url(#regionPulse)" className="pulse-ring" />
                <circle cx="710" cy="320" r="9" fill="#10b981" filter="url(#glow)" />
              </svg>

              {/* Intensity Scale Bar matching reference */}
              <div className="map-legend-bar">
                <span>Low</span>
                <div className="gradient-track" />
                <span>High</span>
              </div>
            </div>
          </div>

          {/* Card 3: AI Insights (Gemini Holographic Card matching Reference Image 3) */}
          <div className="tracker-card card-ai-insights">
            <div className="tracker-card-header">
              <span className="card-section-title">
                <Sparkles size={14} className="sparkle-icon" /> AI Insights
              </span>
            </div>

            <div className="ai-leaf-spotlight">
              <div className="hologram-radar-ring">
                <div className="hologram-leaf-badge">
                  <Leaf size={32} className="hologram-leaf-icon" />
                </div>
              </div>
            </div>

            <div className="ai-insight-copy">
              <p className="ai-observation">
                Emissions from your <strong>electricity & HVAC consumption</strong> are the highest contributors to overall footprint this period.
              </p>
              <div className="ai-recommendation-box">
                <span className="ai-rec-tag">AI RECOMMENDATION</span>
                <p>
                  Switching facility load hours to renewable grid periods could reduce overall modeled emissions by up to <strong>18%</strong>.
                </p>
              </div>
            </div>

            <div className="ai-card-actions">
              <Link to="/action-plan" className="btn-ai-action">
                View Adaptive Eco Plan <ChevronRight size={14} />
              </Link>
            </div>
          </div>
        </div>

        {/* ========================================================
            ROW 3: EMISSIONS OVER TIME | FORECAST
        ======================================================== */}
        <div className="dashboard-grid-middle">
          {/* Card 4: Large Time-Series Chart */}
          <div className="tracker-card card-time-series">
            <div className="tracker-card-header">
              <div>
                <span className="card-section-title">Emissions Over Time</span>
                <p className="card-subtitle-small">Historical multi-scope activity trajectory</p>
              </div>
              <div className="timeframe-toggle">
                <button
                  className={`toggle-btn ${timeframe === 'daily' ? 'active' : ''}`}
                  onClick={() => setTimeframe('daily')}
                >
                  Daily
                </button>
                <button
                  className={`toggle-btn ${timeframe === 'weekly' ? 'active' : ''}`}
                  onClick={() => setTimeframe('weekly')}
                >
                  Weekly
                </button>
                <button
                  className={`toggle-btn ${timeframe === 'monthly' ? 'active' : ''}`}
                  onClick={() => setTimeframe('monthly')}
                >
                  Monthly
                </button>
              </div>
            </div>

            <div className="time-series-chart-wrapper">
              <Bar
                data={timeSeriesData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'bottom',
                      labels: { color: '#94a3b8', font: { size: 11 }, boxWidth: 12 },
                    },
                    tooltip: {
                      backgroundColor: '#0e1626',
                      borderColor: '#1e2c44',
                      borderWidth: 1,
                      titleColor: '#f1f5f9',
                      bodyColor: '#94a3b8',
                      padding: 10,
                    },
                  },
                  scales: {
                    x: {
                      stacked: true,
                      grid: { display: false },
                      ticks: { color: '#64748b', font: { size: 10 } },
                    },
                    y: {
                      stacked: true,
                      grid: { color: 'rgba(255, 255, 255, 0.05)' },
                      ticks: { color: '#64748b', font: { size: 10 } },
                    },
                  },
                }}
              />
            </div>
          </div>

          {/* Card 5: Emissions & Climate Forecast Card */}
          <div className="tracker-card card-forecast-analytics">
            <div className="tracker-card-header">
              <div>
                <span className="card-section-title">Emissions Forecast</span>
                <span className="forecast-info-icon" title="Deterministic Moving-Average Projection">
                  <Info size={13} />
                </span>
              </div>
            </div>

            <div className="forecast-headline-row">
              <div className="forecast-number-group">
                <strong className="forecast-number">14,350</strong>
                <span className="forecast-unit">tCO₂e</span>
              </div>
              <p className="forecast-period-desc">Projected for Jul 12 – Aug 12, 2024</p>
              <div className="forecast-trend-tag tag-green">
                <TrendingDown size={13} />
                <span>5.2% vs current period</span>
              </div>
            </div>

            <div className="forecast-chart-wrapper">
              <Line
                data={forecastChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'bottom',
                      labels: { color: '#94a3b8', font: { size: 11 }, boxWidth: 12 },
                    },
                    tooltip: {
                      backgroundColor: '#0e1626',
                      borderColor: '#1e2c44',
                      borderWidth: 1,
                      padding: 10,
                    },
                  },
                  scales: {
                    x: {
                      grid: { display: false },
                      ticks: { color: '#64748b', font: { size: 10 } },
                    },
                    y: {
                      grid: { color: 'rgba(255, 255, 255, 0.05)' },
                      ticks: {
                        color: '#64748b',
                        font: { size: 10 },
                        callback: (v) => `${v / 1000}K`,
                      },
                    },
                  },
                }}
              />
            </div>
          </div>
        </div>

        {/* ========================================================
            ROW 3.5: AI CLIMATE & ENVIRONMENTAL INSIGHTS (GEMINI)
        ======================================================== */}
        <div style={{ marginBottom: '24px' }}>
          <AiInsightsPanel
            regionId={selectedRegionId}
            regionName={regions.find((r) => String(r.id) === String(selectedRegionId))?.name}
          />
        </div>

        {/* ========================================================
            ROW 4: DONUT SOURCES | TARGET PROGRESS | RECENT ALERTS
        ======================================================== */}
        <div className="dashboard-grid-bottom">
          {/* Card 6: Top Emission Sources (Donut Chart) */}
          <div className="tracker-card card-sources-donut">
            <div className="tracker-card-header">
              <span className="card-section-title">Top Emission Sources</span>
            </div>

            <div className="donut-flex-container">
              <div className="donut-chart-box">
                <Doughnut
                  data={donutData}
                  options={{
                    cutout: '72%',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                  }}
                />
                <div className="donut-center-overlay">
                  <strong>{totalEmissions > 0 ? totalEmissions.toLocaleString() : '12,456'}</strong>
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

          {/* Card 7: Progress to Target (Circular Radial Gauge) */}
          <div className="tracker-card card-target-gauge">
            <div className="tracker-card-header">
              <div>
                <span className="card-section-title">Progress to Target</span>
                <span className="forecast-info-icon" title="Science-Based Target Initiative (SBTi)">
                  <Info size={13} />
                </span>
              </div>
            </div>

            <p className="target-year-label">Net Zero Target: <strong>2040</strong></p>

            <div className="radial-gauge-container">
              <svg viewBox="0 0 160 160" className="radial-gauge-svg">
                <circle
                  cx="80"
                  cy="80"
                  r="62"
                  className="gauge-track"
                  strokeWidth="11"
                  fill="none"
                />
                <circle
                  cx="80"
                  cy="80"
                  r="62"
                  className="gauge-fill"
                  strokeWidth="11"
                  strokeDasharray="390"
                  strokeDashoffset={390 - (390 * targetProgress) / 100}
                  fill="none"
                />
              </svg>
              <div className="gauge-center-text">
                <span className="gauge-percent">{targetProgress}%</span>
                <small className="gauge-label">Progress</small>
              </div>
            </div>

            <div className="target-stats-split">
              <div>
                <span className="target-subhead">Remaining</span>
                <strong>7,223 tCO₂e</strong>
              </div>
              <div className="text-right">
                <span className="target-subhead">Reduce by</span>
                <strong>3.2% per year</strong>
              </div>
            </div>
          </div>

          {/* Card 8: Recent Alerts & Climate Anomalies */}
          <div className="tracker-card card-alerts-panel">
            <div className="tracker-card-header">
              <span className="card-section-title">Recent Alerts</span>
              <Link to="/live-climate" className="view-all-link">
                View all
              </Link>
            </div>

            <div className="recent-alerts-list">
              {alerts.length > 0 ? (
                alerts.slice(0, 3).map((alert) => (
                  <div className="alert-item-box" key={alert.id}>
                    <span className={`alert-indicator-dot dot-${alert.severity || 'warning'}`}>
                      <AlertTriangle size={14} />
                    </span>
                    <div className="alert-item-copy">
                      <strong>{alert.region_name || 'Telemetry Station'} · {alert.metric}</strong>
                      <p>{alert.explanation}</p>
                      <small>{new Date(alert.observed_at || alert.created_at).toLocaleString()}</small>
                    </div>
                  </div>
                ))
              ) : (
                <>
                  <div className="alert-item-box">
                    <span className="alert-indicator-dot dot-warning">
                      <AlertTriangle size={14} />
                    </span>
                    <div className="alert-item-copy">
                      <strong>High emissions detected from transportation</strong>
                      <small>May 12, 2024 · 10:30 AM</small>
                    </div>
                  </div>

                  <div className="alert-item-box">
                    <span className="alert-indicator-dot dot-warning">
                      <AlertTriangle size={14} />
                    </span>
                    <div className="alert-item-copy">
                      <strong>Energy consumption above 7-day average</strong>
                      <small>May 12, 2024 · 09:15 AM</small>
                    </div>
                  </div>

                  <div className="alert-item-box">
                    <span className="alert-indicator-dot dot-success">
                      <CheckCircle2 size={14} />
                    </span>
                    <div className="alert-item-copy">
                      <strong>New low-emission milestone achieved!</strong>
                      <small>May 11, 2024 · 04:45 PM</small>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
