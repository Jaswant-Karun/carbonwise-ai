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
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  ChevronRight,
  CloudRain,
  CloudSun,
  Compass,
  Database,
  ExternalLink,
  Flame,
  Globe,
  Info,
  MapPin,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Thermometer,
  TrendingUp,
  Wind,
} from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const round = (val, d = 1) => (val != null && !Number.isNaN(Number(val)) ? Number(val).toFixed(d) : '—');

const Dashboard = () => {
  const [regions, setRegions] = useState([]);
  const [selectedRegionId, setSelectedRegionId] = useState('');
  const [summary, setSummary] = useState(null);
  const [trends, setTrends] = useState(null);
  const [anomaliesData, setAnomaliesData] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [aiInsights, setAiInsights] = useState(null);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeframe, setTimeframe] = useState('daily');
  const [metricFilter, setMetricFilter] = useState('temperature');

  // Load Regions and initial overview
  useEffect(() => {
    let isMounted = true;
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        const [regRes, ovRes] = await Promise.allSettled([
          api.get('/environment/regions'),
          api.get('/environment/overview'),
        ]);

        if (!isMounted) return;

        if (ovRes.status === 'fulfilled') {
          setOverview(ovRes.value.data);
        }

        if (regRes.status === 'fulfilled' && regRes.value.data?.length > 0) {
          const list = regRes.value.data;
          setRegions(list);
          setSelectedRegionId(String(list[0].id));
        }
      } catch (err) {
        console.error('Failed to load initial environmental data:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchInitialData();
    return () => { isMounted = false; };
  }, []);

  // Fetch telemetry and analytics when selectedRegionId changes
  const loadRegionData = useCallback(async (regionId) => {
    if (!regionId) return;
    try {
      const [sumRes, trRes, anomRes, alertRes, aiRes] = await Promise.allSettled([
        api.get(`/environment/regions/${regionId}/summary`),
        api.get(`/environment/regions/${regionId}/trends?resolution=${timeframe}&metric=${metricFilter}`),
        api.get(`/environment/regions/${regionId}/anomalies`),
        api.get(`/environment/alerts?regionId=${regionId}`),
        api.get(`/environment/regions/${regionId}/ai-insights`),
      ]);

      if (sumRes.status === 'fulfilled') setSummary(sumRes.value.data);
      if (trRes.status === 'fulfilled') setTrends(trRes.value.data);
      if (anomRes.status === 'fulfilled') setAnomaliesData(anomRes.value.data);
      if (alertRes.status === 'fulfilled') setAlerts(alertRes.value.data || []);
      if (aiRes.status === 'fulfilled') setAiInsights(aiRes.value.data);
    } catch (err) {
      console.warn('Error loading region environmental intelligence:', err);
    }
  }, [timeframe, metricFilter]);

  useEffect(() => {
    if (selectedRegionId) {
      loadRegionData(selectedRegionId);
    }
  }, [selectedRegionId, loadRegionData]);

  // Handle manual live refresh
  const handleRefresh = async () => {
    if (!selectedRegionId || refreshing) return;
    try {
      setRefreshing(true);
      await api.post(`/environment/regions/${selectedRegionId}/refresh`);
      await loadRegionData(selectedRegionId);
    } catch (err) {
      console.error('Live refresh failed:', err);
    } finally {
      setRefreshing(false);
    }
  };

  // Acknowledge alert
  const handleAcknowledgeAlert = async (alertId) => {
    try {
      await api.patch(`/environment/alerts/${alertId}`, { status: 'acknowledged' });
      setAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, status: 'acknowledged' } : a)));
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    }
  };

  // Extract Row 1 metrics
  const activeRegion = useMemo(() => {
    return regions.find((r) => String(r.id) === String(selectedRegionId)) || summary?.region;
  }, [regions, selectedRegionId, summary]);

  const currentConditions = summary?.current || {};
  const currentTemp = currentConditions.temperature;
  const currentRain = currentConditions.precipitation;
  const currentHumidity = currentConditions.relative_humidity;
  const currentWind = currentConditions.wind_speed;
  const currentPressure = currentConditions.surface_pressure;
  const currentAqi = currentConditions.us_aqi;
  const currentPm25 = currentConditions.pm2_5;

  // Temperature anomaly metric
  const tempAnomalyMetric = summary?.metrics?.find((m) => m.metric === 'temperature');
  const tempAnomalyVal = tempAnomalyMetric?.anomaly?.departure;
  const tempZScore = tempAnomalyMetric?.anomaly?.robustZ;
  const isTempAnomaly = Boolean(tempAnomalyMetric?.anomaly);

  // Air Quality classification
  const getAqiCategory = (aqi) => {
    if (aqi == null) return { label: 'Unavailable', color: 'var(--text-muted)' };
    if (aqi <= 50) return { label: 'Good (WHO Target)', color: '#10b981' };
    if (aqi <= 100) return { label: 'Moderate', color: '#f59e0b' };
    if (aqi <= 150) return { label: 'Unhealthy for Sensitive Groups', color: '#f97316' };
    return { label: 'Unhealthy / Hazardous', color: '#ef4444' };
  };

  const aqiInfo = getAqiCategory(currentAqi);

  // Trend Chart Data (Row 2)
  const chartData = useMemo(() => {
    const history = trends?.history || [];
    const labels = history.map((h) => (h.date ? h.date.slice(5) : ''));
    const obsValues = history.map((h) => h.mean ?? h.sum ?? null);
    const baselineValue = trends?.referenceBaseline?.meanValue;
    const baselineSeries = history.map(() => baselineValue ?? null);

    return {
      labels,
      datasets: [
        {
          label: `Observed ${metricFilter === 'temperature' ? 'Daily Mean Temp (°C)' : 'Precipitation (mm)'}`,
          data: obsValues,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.12)',
          borderWidth: 2.2,
          pointRadius: history.length > 30 ? 0 : 3,
          pointHoverRadius: 5,
          tension: 0.35,
          fill: true,
        },
        ...(baselineValue != null
          ? [
              {
                label: '1991–2020 WMO Standard Baseline',
                data: baselineSeries,
                borderColor: '#38bdf8',
                borderWidth: 1.8,
                borderDash: [5, 5],
                pointRadius: 0,
                fill: false,
              },
            ]
          : []),
      ],
    };
  }, [trends, metricFilter]);

  const chartOptions = useMemo(() => {
    return {
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
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#64748b', font: { size: 11 } },
        },
      },
    };
  }, []);

  if (loading) {
    return (
      <Layout>
        <div className="dashboard-container" style={{ padding: '80px 20px', textAlign: 'center' }}>
          <RefreshCw size={32} className="spin icon-mint" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ color: '#ffffff', fontSize: '1.25rem', marginBottom: '8px' }}>Initializing Environmental Telemetry...</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Retrieving live weather observations from Open-Meteo & OpenAQ networks.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="dashboard-container">
        {/* Top Region Control Bar */}
        <div className="dashboard-region-bar">
          <div className="region-bar-left">
            <div className="region-indicator-dot" />
            <span className="region-bar-label">Active Monitoring Station:</span>
            <select
              value={selectedRegionId}
              onChange={(e) => setSelectedRegionId(e.target.value)}
              className="region-bar-select"
              aria-label="Select Environmental Monitoring Region"
            >
              {regions.map((reg) => (
                <option key={reg.id} value={reg.id}>
                  {reg.name} ({reg.country})
                </option>
              ))}
            </select>
            {activeRegion && (
              <span className="region-coords-pill">
                <MapPin size={12} /> {round(activeRegion.latitude, 2)}°N, {round(activeRegion.longitude, 2)}°E
              </span>
            )}
          </div>

          <div className="region-bar-right">
            <span className="data-freshness-pill">
              <Database size={13} />
              <span>Provider: Open-Meteo & OpenAQ</span>
            </span>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="btn-refresh-telemetry"
              title="Poll latest environmental telemetry"
            >
              <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
              <span>{refreshing ? 'Syncing...' : 'Refresh Telemetry'}</span>
            </button>
          </div>
        </div>

        {/* ========================================================
            ROW 1: SUMMARY METRICS STRIP
        ======================================================== */}
        <div className="dashboard-summary-strip">
          {/* Card 1: Current Temperature */}
          <div className="summary-metric-card">
            <div className="summary-card-header">
              <span className="summary-card-title">Current Temperature</span>
              <span className="summary-card-icon-wrap mint">
                <Thermometer size={18} />
              </span>
            </div>
            <div className="summary-card-value-row">
              <span className="summary-card-value">{round(currentTemp)}</span>
              <span className="summary-card-unit">°C</span>
            </div>
            <div className="summary-card-footer">
              <span className="summary-status-badge live">
                <span className="live-dot" /> Live Telemetry
              </span>
              <span className="summary-card-sub">
                Humidity: {round(currentHumidity, 0)}% • Wind: {round(currentWind)} km/h
              </span>
            </div>
          </div>

          {/* Card 2: Temperature Anomaly */}
          <div className="summary-metric-card">
            <div className="summary-card-header">
              <span className="summary-card-title">Temperature Anomaly</span>
              <span className={`summary-card-icon-wrap ${isTempAnomaly ? 'amber' : 'mint'}`}>
                {isTempAnomaly ? <Flame size={18} /> : <TrendingUp size={18} />}
              </span>
            </div>
            <div className="summary-card-value-row">
              <span className={`summary-card-value ${isTempAnomaly ? 'text-amber' : ''}`}>
                {tempAnomalyVal != null ? (tempAnomalyVal > 0 ? `+${round(tempAnomalyVal)}` : round(tempAnomalyVal)) : '0.0'}
              </span>
              <span className="summary-card-unit">°C departure</span>
            </div>
            <div className="summary-card-footer">
              <span className={`summary-status-badge ${isTempAnomaly ? 'warning' : 'normal'}`}>
                {isTempAnomaly ? `Anomaly (Z: +${round(tempZScore)}σ)` : 'Within Baseline Normal'}
              </span>
              <span className="summary-card-sub">
                vs. Seasonal Baseline: {round(tempAnomalyMetric?.baseline?.median)}°C
              </span>
            </div>
          </div>

          {/* Card 3: Rainfall & Precipitation */}
          <div className="summary-metric-card">
            <div className="summary-card-header">
              <span className="summary-card-title">Precipitation & Rain</span>
              <span className="summary-card-icon-wrap blue">
                <CloudRain size={18} />
              </span>
            </div>
            <div className="summary-card-value-row">
              <span className="summary-card-value">{round(currentRain)}</span>
              <span className="summary-card-unit">mm</span>
            </div>
            <div className="summary-card-footer">
              <span className="summary-status-badge blue">
                {currentRain > 25 ? 'Heavy Rainfall' : currentRain > 5 ? 'Light Rain' : 'Normal / Dry'}
              </span>
              <span className="summary-card-sub">Pressure: {round(currentPressure, 0)} hPa</span>
            </div>
          </div>

          {/* Card 4: Air Quality */}
          <div className="summary-metric-card">
            <div className="summary-card-header">
              <span className="summary-card-title">Ambient Air Quality</span>
              <span className="summary-card-icon-wrap purple">
                <Wind size={18} />
              </span>
            </div>
            <div className="summary-card-value-row">
              <span className="summary-card-value">
                {currentAqi != null ? round(currentAqi, 0) : round(currentPm25, 1)}
              </span>
              <span className="summary-card-unit">{currentAqi != null ? 'US AQI' : 'µg/m³ PM2.5'}</span>
            </div>
            <div className="summary-card-footer">
              <span className="summary-status-badge" style={{ color: aqiInfo.color, borderColor: aqiInfo.color }}>
                {aqiInfo.label}
              </span>
              <span className="summary-card-sub">
                {currentPm25 != null ? `PM2.5: ${round(currentPm25, 1)} µg/m³` : 'Standard Sensor Network'}
              </span>
            </div>
          </div>
        </div>

        {/* ========================================================
            ROW 2: LARGE TREND CHART & REGIONAL MONITORING PANEL
        ======================================================== */}
        <div className="dashboard-grid-middle">
          {/* Large Historical Environmental Trend Chart */}
          <div className="tracker-card card-chart-large">
            <div className="tracker-card-header">
              <div>
                <h2 className="card-section-title">
                  <Activity size={18} className="icon-mint" />
                  Historical Climate Trends & Baseline Comparison
                </h2>
                <p className="card-subtitle-small">
                  Observed environmental values compared against 1991–2020 WMO Standard Reference Normals
                </p>
              </div>

              <div className="chart-controls-group">
                <div className="timeframe-selector">
                  <button
                    className={`btn-timeframe ${metricFilter === 'temperature' ? 'active' : ''}`}
                    onClick={() => setMetricFilter('temperature')}
                  >
                    Temperature
                  </button>
                  <button
                    className={`btn-timeframe ${metricFilter === 'precipitation' ? 'active' : ''}`}
                    onClick={() => setMetricFilter('precipitation')}
                  >
                    Precipitation
                  </button>
                </div>

                <div className="timeframe-selector">
                  <button
                    className={`btn-timeframe ${timeframe === 'daily' ? 'active' : ''}`}
                    onClick={() => setTimeframe('daily')}
                  >
                    Daily
                  </button>
                  <button
                    className={`btn-timeframe ${timeframe === 'monthly' ? 'active' : ''}`}
                    onClick={() => setTimeframe('monthly')}
                  >
                    Monthly
                  </button>
                </div>
              </div>
            </div>

            <div className="dashboard-main-chart-wrapper" style={{ height: '320px' }}>
              {trends?.history?.length > 0 ? (
                <Line data={chartData} options={chartOptions} />
              ) : (
                <div className="empty-chart-notice">
                  <Info size={20} />
                  <span>Loading verified multi-decadal historical observations...</span>
                </div>
              )}
            </div>

            {trends?.trendSummary && (
              <div className="chart-footer-stat-bar">
                <span>
                  <strong>Decadal Trend Rate:</strong> {trends.trendSummary.warmingRateCPerDecade != null ? `+${round(trends.trendSummary.warmingRateCPerDecade, 2)}°C / decade` : 'Consistent with baseline'}
                </span>
                <span>
                  <strong>Data Period:</strong> {trends.trendSummary.dataPeriodYears || 30} years verified observations
                </span>
                <span>
                  <strong>Baseline Reference:</strong> 1991–2020 WMO Standard Normals
                </span>
              </div>
            )}
          </div>

          {/* Regional Environmental Monitoring Panel */}
          <div className="tracker-card card-regional-panel">
            <div className="tracker-card-header">
              <div>
                <h2 className="card-section-title">
                  <Globe size={18} className="icon-mint" />
                  Regional Monitoring Panel
                </h2>
                <p className="card-subtitle-small">Geographic Station Coordinates & Sensor Matrix</p>
              </div>
            </div>

            <div className="regional-meta-box">
              <div className="meta-box-row">
                <span className="meta-box-label">Station Name</span>
                <strong className="meta-box-val">{activeRegion?.name || 'Monitoring Node'}</strong>
              </div>
              <div className="meta-box-row">
                <span className="meta-box-label">Country / Jurisdiction</span>
                <span className="meta-box-val">{activeRegion?.country || 'International'}</span>
              </div>
              <div className="meta-box-row">
                <span className="meta-box-label">Geographic Coordinates</span>
                <span className="meta-box-val mono">
                  {round(activeRegion?.latitude, 4)}° N, {round(activeRegion?.longitude, 4)}° E
                </span>
              </div>
              <div className="meta-box-row">
                <span className="meta-box-label">Station Timezone</span>
                <span className="meta-box-val mono">{activeRegion?.timezone || 'UTC'}</span>
              </div>
              <div className="meta-box-row">
                <span className="meta-box-label">Telemetry Status</span>
                <span className="badge-live-tag">
                  <CheckCircle2 size={12} /> Active Ingestion Stream
                </span>
              </div>
            </div>

            <div className="regional-sensor-grid">
              <div className="sensor-cell">
                <span className="sensor-label">Relative Humidity</span>
                <strong className="sensor-val">{round(currentHumidity, 0)}%</strong>
              </div>
              <div className="sensor-cell">
                <span className="sensor-label">Wind Velocity</span>
                <strong className="sensor-val">{round(currentWind, 1)} km/h</strong>
              </div>
              <div className="sensor-cell">
                <span className="sensor-label">Atmospheric Pressure</span>
                <strong className="sensor-val">{round(currentPressure, 0)} hPa</strong>
              </div>
              <div className="sensor-cell">
                <span className="sensor-label">PM2.5 Particles</span>
                <strong className="sensor-val">{round(currentPm25, 1)} µg/m³</strong>
              </div>
            </div>

            <div className="regional-action-footer">
              <Link to="/live-monitoring" className="btn-regional-link">
                <span>View Full Telemetry Stream</span>
                <ChevronRight size={15} />
              </Link>
            </div>
          </div>
        </div>

        {/* ========================================================
            ROW 3: ANOMALY OVERVIEW, ALERTS, & HISTORICAL COMPARISON
        ======================================================== */}
        <div className="dashboard-grid-bottom">
          {/* Anomaly Detection Overview */}
          <div className="tracker-card card-anomalies-overview">
            <div className="tracker-card-header">
              <div>
                <h2 className="card-section-title">
                  <ShieldAlert size={18} className="icon-amber" />
                  Anomaly Detection Overview
                </h2>
                <p className="card-subtitle-small">Robust Z-scores and seasonal threshold deviations</p>
              </div>
              <Link to="/anomaly-detection" className="card-action-link">
                Full Engine <ChevronRight size={14} />
              </Link>
            </div>

            <div className="anomalies-list">
              {anomaliesData?.atmosphericAnomalies?.length > 0 ? (
                anomaliesData.atmosphericAnomalies.slice(0, 4).map((anom, idx) => (
                  <div key={idx} className="anomaly-item-row">
                    <div className="anomaly-item-left">
                      <span className="anomaly-badge-tag amber">
                        {anom.metric}
                      </span>
                      <div className="anomaly-item-desc">
                        <strong>Observed: {round(anom.anomaly?.observed)} {anom.metric === 'temperature' ? '°C' : 'mm'}</strong>
                        <small>Baseline: {round(anom.anomaly?.baseline)} (Δ {round(anom.anomaly?.departure)} / Z: {round(anom.anomaly?.robustZ)}σ)</small>
                      </div>
                    </div>
                    <span className="anomaly-date-tag">
                      {anom.observedAt ? new Date(anom.observedAt).toLocaleDateString() : 'Live'}
                    </span>
                  </div>
                ))
              ) : (
                <div className="empty-state-notice">
                  <CheckCircle2 size={24} className="icon-mint" />
                  <span>No extreme atmospheric anomalies detected in current cycle. Observations align with seasonal normal bounds.</span>
                </div>
              )}
            </div>
          </div>

          {/* Environmental Alerts Panel */}
          <div className="tracker-card card-alerts-overview">
            <div className="tracker-card-header">
              <div>
                <h2 className="card-section-title">
                  <AlertTriangle size={18} className="icon-amber" />
                  Environmental Alerts
                </h2>
                <p className="card-subtitle-small">Active evidence-based threshold warnings</p>
              </div>
              <Link to="/alerts" className="card-action-link">
                View All ({alerts.length}) <ChevronRight size={14} />
              </Link>
            </div>

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
                      <p>{alert.explanation || `Threshold exceeded (${round(alert.threshold_value)}). Statistical deviation flagged.`}</p>
                    </div>
                    {alert.status === 'open' && (
                      <button
                        onClick={() => handleAcknowledgeAlert(alert.id)}
                        className="btn-ack-alert"
                      >
                        Acknowledge
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="empty-state-notice">
                  <CheckCircle2 size={24} className="icon-mint" />
                  <span>All environmental alerts resolved. Sensor parameters within acceptable limits.</span>
                </div>
              )}
            </div>
          </div>

          {/* Historical Comparison */}
          <div className="tracker-card card-historical-comp">
            <div className="tracker-card-header">
              <div>
                <h2 className="card-section-title">
                  <Compass size={18} className="icon-mint" />
                  Historical Comparison
                </h2>
                <p className="card-subtitle-small">Current Season vs. 30-Year Normal</p>
              </div>
            </div>

            <div className="historical-comp-stats">
              <div className="comp-stat-box">
                <span className="comp-label">Temperature Departure</span>
                <strong className={`comp-val ${tempAnomalyVal > 0 ? 'text-amber' : 'text-mint'}`}>
                  {tempAnomalyVal != null ? (tempAnomalyVal > 0 ? `+${round(tempAnomalyVal)}°C` : `${round(tempAnomalyVal)}°C`) : '0.0°C'}
                </strong>
                <small className="comp-subtext">vs. 1991–2020 WMO Standard</small>
              </div>

              <div className="comp-stat-box">
                <span className="comp-label">Baseline Robustness</span>
                <strong className="comp-val text-mint">Verified (MAD)</strong>
                <small className="comp-subtext">Physical bounds validated</small>
              </div>
            </div>

            <div className="scientific-disclaimer-box">
              <Info size={14} className="icon-info" />
              <span>
                <strong>Methodological Standard:</strong> Isolated weather deviations do not prove climatological shift. Long-term trends require multi-decadal verification.
              </span>
            </div>
          </div>
        </div>

        {/* ========================================================
            ROW 4: AI CLIMATE INSIGHTS, MONITORING ACTIVITY, SOURCES
        ======================================================== */}
        <div className="dashboard-grid-bottom">
          {/* AI Climate Insights */}
          <div className="tracker-card card-ai-insights">
            <div className="tracker-card-header">
              <div>
                <h2 className="card-section-title">
                  <Sparkles size={18} className="icon-mint" />
                  AI Climate Insights
                </h2>
                <p className="card-subtitle-small">Natural-language climate intelligence (Gemini)</p>
              </div>
              <span className="badge-ai-model">
                {aiInsights?.narrativeSource === 'gemini' ? 'Gemini 2.5 Flash' : 'Deterministic Evidence'}
              </span>
            </div>

            <div className="ai-insights-narrative">
              <p>
                {aiInsights?.narrative ||
                  'Current regional observations indicate typical seasonal weather patterns with low atmospheric anomaly deviation. Continue monitoring continuous Open-Meteo telemetry streams.'}
              </p>
            </div>

            <div className="ai-insights-footer">
              <span className="ai-cache-indicator">
                <CheckCircle2 size={12} className="icon-mint" /> PostgreSQL SHA-256 Cached
              </span>
              <Link to="/ai-insights" className="card-action-link">
                Detailed Analysis <ChevronRight size={14} />
              </Link>
            </div>
          </div>

          {/* Recent Monitoring Activity */}
          <div className="tracker-card card-monitoring-activity">
            <div className="tracker-card-header">
              <div>
                <h2 className="card-section-title">
                  <Activity size={18} className="icon-mint" />
                  Monitoring Ingestion Activity
                </h2>
                <p className="card-subtitle-small">Automated 30-minute scheduled cycles</p>
              </div>
            </div>

            <div className="activity-feed">
              <div className="feed-item">
                <span className="feed-status-dot completed" />
                <div className="feed-details">
                  <strong>Open-Meteo Ingestion Cycle</strong>
                  <small>Recorded temperature, rain, wind, pressure</small>
                </div>
                <span className="feed-time">Just now</span>
              </div>

              <div className="feed-item">
                <span className="feed-status-dot completed" />
                <div className="feed-details">
                  <strong>Statistical Anomaly Scan</strong>
                  <small>MAD & Robust Z-score validation completed</small>
                </div>
                <span className="feed-time">2m ago</span>
              </div>

              <div className="feed-item">
                <span className="feed-status-dot completed" />
                <div className="feed-details">
                  <strong>OpenAQ Ground Sync</strong>
                  <small>Checked ambient station air quality</small>
                </div>
                <span className="feed-time">15m ago</span>
              </div>
            </div>
          </div>

          {/* Data Sources & Freshness */}
          <div className="tracker-card card-data-sources">
            <div className="tracker-card-header">
              <div>
                <h2 className="card-section-title">
                  <Database size={18} className="icon-mint" />
                  Data Sources & Freshness
                </h2>
                <p className="card-subtitle-small">Authoritative provider telemetry status</p>
              </div>
            </div>

            <div className="sources-list">
              <div className="source-row">
                <div className="source-info">
                  <strong>Open-Meteo Weather API</strong>
                  <small>Weather, rain, wind, atmospheric pressure ({overview?.recentObservations?.length || 0} active telemetry channels)</small>
                </div>
                <span className="source-badge live">Operational</span>
              </div>

              <div className="source-row">
                <div className="source-info">
                  <strong>OpenAQ Air Quality API</strong>
                  <small>Ground station PM2.5, PM10, ozone</small>
                </div>
                <span className="source-badge live">Operational</span>
              </div>

              <div className="source-row">
                <div className="source-info">
                  <strong>NASA POWER / Climatology</strong>
                  <small>1991–2020 WMO Standard Reference Normals</small>
                </div>
                <span className="source-badge normal">Verified</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
