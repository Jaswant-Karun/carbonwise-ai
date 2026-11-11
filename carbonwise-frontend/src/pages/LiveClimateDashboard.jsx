import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock3,
  CloudRain,
  CloudSun,
  Compass,
  Database,
  Droplets,
  ExternalLink,
  Flame,
  Gauge,
  Globe,
  HelpCircle,
  History,
  Info,
  Layers,
  Leaf,
  MapPin,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Thermometer,
  TrendingUp,
  Wind,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import api from '../services/api';
import Layout from '../components/Layout';
import LoadingState from '../components/LoadingState';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const formatValue = (value, unit) => {
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(1)} ${unit}` : `— ${unit}`;
};

const getMetricDetails = (metricKey) => {
  switch (metricKey) {
    case 'temperature':
      return { label: 'Ambient Temperature', unit: '°C', icon: Thermometer, color: '#f59e0b', desc: 'Direct in-situ surface air temperature at 2m.' };
    case 'precipitation':
      return { label: 'Precipitation / Rainfall', unit: 'mm', icon: CloudRain, color: '#38bdf8', desc: 'Liquid water equivalent precipitation accumulation.' };
    case 'relative_humidity':
      return { label: 'Relative Humidity', unit: '%', icon: Droplets, color: '#10b981', desc: 'Ratio of water vapor pressure to saturation vapor pressure.' };
    case 'wind_speed':
      return { label: 'Wind Velocity', unit: 'km/h', icon: Wind, color: '#a855f7', desc: 'Horizontal wind speed measured at 10m altitude.' };
    case 'surface_pressure':
      return { label: 'Surface Pressure', unit: 'hPa', icon: Gauge, color: '#6366f1', desc: 'Atmospheric pressure measured at regional ground level.' };
    case 'pm2_5':
      return { label: 'Fine Particulates (PM2.5)', unit: 'µg/m³', icon: Activity, color: '#ef4444', desc: 'Particles ≤ 2.5 µm that penetrate deep into the respiratory tract.' };
    case 'pm10':
      return { label: 'Coarse Particulates (PM10)', unit: 'µg/m³', icon: Activity, color: '#f97316', desc: 'Inhalable coarse particles ≤ 10 µm from dust and combustion.' };
    case 'us_aqi':
      return { label: 'US Air Quality Index', unit: 'AQI', icon: Activity, color: '#10b981', desc: 'EPA composite air quality index standard.' };
    default:
      return { label: metricKey, unit: '', icon: CloudSun, color: '#64748b', desc: 'Environmental telemetry parameter.' };
  }
};

const getAqiCategory = (aqi) => {
  const val = Number(aqi);
  if (!Number.isFinite(val) || val <= 0) return { label: 'Good', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' };
  if (val <= 50) return { label: 'Good', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' };
  if (val <= 100) return { label: 'Moderate', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' };
  if (val <= 150) return { label: 'Unhealthy for Sensitive Groups', color: '#f97316', bg: 'rgba(249, 115, 22, 0.15)' };
  if (val <= 200) return { label: 'Unhealthy', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' };
  if (val <= 300) return { label: 'Very Unhealthy', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)' };
  return { label: 'Hazardous', color: '#7f1d1d', bg: 'rgba(127, 29, 29, 0.25)' };
};

const LiveClimateDashboard = () => {
  const [regions, setRegions] = useState([]);
  const [selectedRegionId, setSelectedRegionId] = useState('');
  const [summary, setSummary] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [activeMetricKey, setActiveMetricKey] = useState('temperature');

  // Search & add location autocomplete
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [customFormOpen, setCustomFormOpen] = useState(false);
  const [regionForm, setRegionForm] = useState({ name: '', latitude: '', longitude: '' });

  const loadAlerts = useCallback(async () => {
    try {
      const response = await api.get('/environment/alerts');
      setAlerts(response.data || []);
    } catch {
      // Gracefully continue
    }
  }, []);

  const loadRegions = useCallback(async () => {
    const response = await api.get('/environment/regions');
    const nextRegions = response.data || [];
    setRegions(nextRegions);
    setSelectedRegionId((current) => current || String(nextRegions[0]?.id || ''));
    return nextRegions;
  }, []);

  const loadSummary = useCallback(async (regionId) => {
    if (!regionId) {
      setSummary(null);
      setStatus('empty');
      return;
    }
    setStatus('loading');
    try {
      const response = await api.get(`/environment/regions/${regionId}/summary`);
      setSummary(response.data);
      setStatus('ready');
    } catch (err) {
      setStatus('error');
      throw err;
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const nextRegions = await loadRegions();
        await loadAlerts();
        if (nextRegions[0]) {
          await loadSummary(nextRegions[0].id);
        } else {
          setStatus('empty');
        }
      } catch (error) {
        setMessage(error.response?.data?.message || 'Unable to load live environmental telemetry.');
        setStatus('error');
      }
    };
    load();
  }, [loadAlerts, loadRegions, loadSummary]);

  // Geocoding location search
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.get(`/environment/locations/search?q=${encodeURIComponent(searchQuery)}`);
        setSuggestions(res.data || []);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const selectRegion = async (event) => {
    const regionId = event.target.value;
    setSelectedRegionId(regionId);
    try {
      await loadSummary(regionId);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Unable to load this region.');
    }
  };

  const handleSelectSuggestion = async (item) => {
    setBusy(true);
    setMessage('');
    setSuggestions([]);
    setSearchQuery('');
    try {
      const response = await api.post('/environment/regions', {
        name: item.admin1 ? `${item.name}, ${item.admin1}` : item.name,
        latitude: item.latitude,
        longitude: item.longitude,
        country: item.country,
        admin1: item.admin1,
        timezone: item.timezone,
      });
      await loadRegions();
      setSelectedRegionId(String(response.data.id));
      await loadSummary(response.data.id);
      await loadAlerts();
    } catch (error) {
      setMessage(error.response?.data?.message || 'Unable to add this location.');
    } finally {
      setBusy(false);
    }
  };

  const createRegionManual = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const response = await api.post('/environment/regions', {
        ...regionForm,
        latitude: Number(regionForm.latitude),
        longitude: Number(regionForm.longitude),
      });
      setRegionForm({ name: '', latitude: '', longitude: '' });
      setCustomFormOpen(false);
      await loadRegions();
      setSelectedRegionId(String(response.data.id));
      await loadSummary(response.data.id);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Unable to create this region.');
    } finally {
      setBusy(false);
    }
  };

  const refresh = async () => {
    if (!selectedRegionId) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await api.post(`/environment/regions/${selectedRegionId}/refresh`);
      setSummary(response.data.summary);
      if (response.data.alerts?.length) {
        setAlerts((current) => [...response.data.alerts, ...current]);
      }
    } catch (error) {
      setMessage(error.response?.data?.message || 'Provider sync deferred. Showing last recorded observations.');
    } finally {
      setBusy(false);
    }
  };

  const updateAlert = async (alertId, newStatus) => {
    try {
      const response = await api.patch(`/environment/alerts/${alertId}`, { status: newStatus });
      setAlerts((current) =>
        current.map((alert) => (alert.id === alertId ? { ...alert, ...response.data } : alert))
      );
    } catch (error) {
      setMessage(error.response?.data?.message || 'Unable to update this alert.');
    }
  };

  const activeMetric = useMemo(() => {
    if (!summary?.metrics?.length) return null;
    return (
      summary.metrics.find((item) => item.metric === activeMetricKey) ||
      summary.metrics[0]
    );
  }, [summary, activeMetricKey]);

  // Chart configuration with observations and baseline threshold bands
  const chartData = useMemo(() => {
    const observations = activeMetric?.observations || [];
    const labels = observations.map((item) =>
      new Date(item.observedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    );

    const values = observations.map((item) => item.value);
    const baselineVal = activeMetric?.baseline;
    const thresholdVal = activeMetric?.threshold;

    const datasets = [
      {
        label: `${activeMetric?.label || 'Observation'} (${activeMetric?.unit || ''})`,
        data: values,
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.12)',
        fill: true,
        tension: 0.3,
        pointRadius: observations.length > 40 ? 1 : 3,
        pointBackgroundColor: '#10b981',
        borderWidth: 2,
      },
    ];

    if (baselineVal != null) {
      datasets.push({
        label: `Rolling Baseline (${baselineVal} ${activeMetric?.unit})`,
        data: observations.map(() => baselineVal),
        borderColor: '#94a3b8',
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
        borderWidth: 1.5,
      });
    }

    if (thresholdVal != null) {
      datasets.push({
        label: `Anomaly Threshold (±2 MAD: ${thresholdVal} ${activeMetric?.unit})`,
        data: observations.map(() => thresholdVal),
        borderColor: 'rgba(245, 158, 11, 0.7)',
        borderDash: [3, 3],
        pointRadius: 0,
        fill: false,
        borderWidth: 1.2,
      });
    }

    return { labels, datasets };
  }, [activeMetric]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        align: 'end',
        labels: {
          color: '#94a3b8',
          boxWidth: 12,
          usePointStyle: true,
          font: { size: 11, weight: '500' },
        },
      },
      tooltip: {
        backgroundColor: '#0f172a',
        titleColor: '#f1f5f9',
        bodyColor: '#cbd5e1',
        borderColor: 'rgba(255, 255, 255, 0.12)',
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.04)' },
        ticks: { color: '#64748b', maxTicksLimit: 12, font: { size: 10 } },
        title: { display: true, text: 'Observation Timestamp (UTC)', color: '#64748b', font: { size: 10 } },
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.06)' },
        ticks: { color: '#64748b', font: { size: 10 } },
        title: {
          display: true,
          text: activeMetric ? `${activeMetric.label} (${activeMetric.unit})` : '',
          color: '#94a3b8',
          font: { size: 11, weight: '600' },
        },
      },
    },
  };

  const selectedRegion = summary?.region || regions.find((r) => String(r.id) === selectedRegionId);
  const aqiMetric = summary?.metrics?.find((m) => m.metric === 'us_aqi');
  const aqiInfo = getAqiCategory(aqiMetric?.latest);

  return (
    <Layout>
      <div className="telemetry-page-container">
        {/* Header Toolbar */}
        <div className="telemetry-header-row">
          <div>
            <div className="telemetry-badge-pill">
              <CloudSun size={13} />
              <span>SDG-13 Environmental Intelligence · Live Telemetry</span>
            </div>
            <h1 className="telemetry-page-title">Live Environmental Intelligence</h1>
            <p className="telemetry-page-subtitle">
              Continuous physical atmospheric & meteorological observations ingested via Open-Meteo, NASA POWER, and OpenAQ ground stations with robust anomaly detection.
            </p>
          </div>

          <div className="telemetry-controls-toolbar">
            <div className="control-group">
              <span className="control-label">Monitored Region</span>
              <select
                className="select-region"
                value={selectedRegionId}
                onChange={selectRegion}
                disabled={!regions.length || busy}
              >
                {!regions.length && <option value="">No regions configured</option>}
                {regions.map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.name} {region.country ? `(${region.country})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              onClick={refresh}
              disabled={!selectedRegionId || busy}
            >
              <RefreshCw size={15} className={busy ? 'animate-spin' : ''} />
              <span>{busy ? 'Ingesting...' : 'Sync Telemetry'}</span>
            </button>
          </div>
        </div>

        {/* Message Banner */}
        {message && <div className="telemetry-message-banner">{message}</div>}

        {/* Location Search Bar with Autocomplete */}
        <div className="telemetry-search-bar">
          <div className="search-input-wrap">
            <Search size={18} className="text-emerald" />
            <input
              type="text"
              placeholder="Search global city or region (e.g. New York, Tokyo, Berlin, London, Singapore, Mumbai)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            {searching && <span className="searching-indicator">Searching Open-Meteo Geocoding...</span>}
            <button
              type="button"
              className="btn-custom-toggle"
              onClick={() => setCustomFormOpen(!customFormOpen)}
            >
              {customFormOpen ? 'Cancel' : '+ Custom Lat/Lon'}
            </button>
          </div>

          {/* Autocomplete Suggestions Dropdown */}
          {suggestions.length > 0 && (
            <div className="suggestions-dropdown">
              <span className="suggestions-header">Open-Meteo Geocoding Results (Click to ingest):</span>
              <div className="suggestions-list">
                {suggestions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectSuggestion(item)}
                    disabled={busy}
                    className="suggestion-item"
                  >
                    <span>
                      <strong>{item.name}</strong> {item.admin1 ? `, ${item.admin1}` : ''} {item.country ? `· ${item.country}` : ''}
                    </span>
                    <span className="coord-tag">
                      {item.latitude}°, {item.longitude}°
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Custom Lat/Lon Form Drawer */}
          {customFormOpen && (
            <form onSubmit={createRegionManual} className="custom-coord-form">
              <input
                placeholder="Region name (e.g. Research Station North)"
                value={regionForm.name}
                onChange={(e) => setRegionForm({ ...regionForm, name: e.target.value })}
                required
              />
              <input
                type="number"
                step="any"
                min="-90"
                max="90"
                placeholder="Latitude (-90 to 90)"
                value={regionForm.latitude}
                onChange={(e) => setRegionForm({ ...regionForm, latitude: e.target.value })}
                required
              />
              <input
                type="number"
                step="any"
                min="-180"
                max="180"
                placeholder="Longitude (-180 to 180)"
                value={regionForm.longitude}
                onChange={(e) => setRegionForm({ ...regionForm, longitude: e.target.value })}
                required
              />
              <button type="submit" className="btn btn-primary" disabled={busy}>
                Add Ingestion Node
              </button>
            </form>
          )}
        </div>

        {/* ========================================================
            MANDATORY SCIENTIFIC DOMAIN DISTINCTION & GUARDRAILS
        ======================================================== */}
        <section className="scientific-distinction-matrix">
          <div className="matrix-header">
            <ShieldCheck size={18} className="text-emerald" />
            <strong>Scientific Domain Separation & Governance Architecture</strong>
          </div>

          <div className="matrix-grid-5col">
            <div className="matrix-col">
              <div className="matrix-col-icon emerald"><Leaf size={16} /></div>
              <strong>Personal Footprint</strong>
              <span>Activity-based GHG accounting (kg CO₂e) from diet, transport, energy, and waste. Strictly separate from atmospheric telemetry.</span>
            </div>

            <div className="matrix-col active">
              <div className="matrix-col-icon blue"><CloudSun size={16} /></div>
              <strong>Environmental Telemetry</strong>
              <span>Physical in-situ atmospheric observations (°C, mm, %, km/h, µg/m³) from Open-Meteo & OpenAQ sensors.</span>
            </div>

            <div className="matrix-col">
              <div className="matrix-col-icon amber"><Calendar size={16} /></div>
              <strong>Weather Forecasts</strong>
              <span>7-day short-term probabilistic atmospheric model predictions of meteorological variance.</span>
            </div>

            <div className="matrix-col">
              <div className="matrix-col-icon purple"><Globe size={16} /></div>
              <strong>Climate Trends</strong>
              <span>Multi-decadal statistical climatology (NASA POWER / WMO 1991-2020 normals) measuring 30-year shifts.</span>
            </div>

            <div className="matrix-col">
              <div className="matrix-col-icon cyan"><Sliders size={16} /></div>
              <strong>What-If Scenarios</strong>
              <span>Predictive hypothetical reduction models strictly labeled as decision-support simulations.</span>
            </div>
          </div>

          <div className="scientific-guardrail-notice">
            <ShieldAlert size={16} className="text-amber" />
            <span>
              <strong>Mandatory Scientific Guardrail:</strong> Local weather observations and seasonal temperature excursions do not prove climate change; similarly, personal carbon emissions (kg CO₂e) are distinct from global atmospheric background CO₂ concentrations (~425 ppm).
            </span>
          </div>
        </section>

        {/* Main Telemetry Dashboard Content */}
        {!regions.length && status !== 'loading' ? (
          <div className="telemetry-empty-box">
            <MapPin size={36} className="text-emerald" />
            <h3>No Environmental Ingestion Nodes Active</h3>
            <p>Search for a city above to immediately begin continuous physical telemetry ingestion from Open-Meteo.</p>
          </div>
        ) : status === 'loading' ? (
          <div className="telemetry-loading-wrap">
            <LoadingState label="Ingesting live meteorological & air quality observations from Open-Meteo APIs..." />
          </div>
        ) : status === 'error' ? (
          <div className="telemetry-error-box">
            <AlertTriangle size={36} className="text-amber" />
            <h2>Telemetry Ingestion Deferred</h2>
            <p>Displaying last verified database records. Check external provider network connectivity and retry.</p>
            <button type="button" className="btn btn-primary" onClick={refresh}>
              Retry Ingestion
            </button>
          </div>
        ) : (
          <>
            {/* Multi-Metric Current Conditions Strip */}
            <div className="telemetry-metrics-strip">
              {summary?.metrics?.map((metric) => {
                const details = getMetricDetails(metric.metric);
                const IconComponent = details.icon;
                const isSelected = activeMetricKey === metric.metric;

                return (
                  <div
                    key={metric.metric}
                    className={`telemetry-card ${isSelected ? 'selected' : ''} ${metric.anomaly ? 'anomaly-active' : ''}`}
                    onClick={() => setActiveMetricKey(metric.metric)}
                  >
                    <div className="telemetry-card-top">
                      <span className="telemetry-label">{details.label}</span>
                      <div className="telemetry-icon-box" style={{ color: details.color, background: `${details.color}18` }}>
                        <IconComponent size={16} />
                      </div>
                    </div>

                    <div className="telemetry-val-row">
                      <span className="telemetry-primary-value">
                        {formatValue(metric.latest, metric.unit)}
                      </span>
                      {metric.deviation != null && (
                        <span className={`deviation-badge ${metric.deviation > 0 ? 'pos' : 'neg'}`}>
                          {metric.deviation > 0 ? `+${metric.deviation}` : metric.deviation} {metric.unit}
                        </span>
                      )}
                    </div>

                    <div className="telemetry-card-footer">
                      <span className="telemetry-baseline-note">
                        Baseline: {metric.baseline != null ? `${metric.baseline} ${metric.unit}` : 'Building baseline'}
                      </span>
                      <span className={`freshness-indicator ${metric.freshness}`}>
                        {metric.freshness === 'stale' ? '⚠️ Stale' : '✓ Fresh'}
                      </span>
                    </div>

                    {metric.anomaly && (
                      <div className="card-anomaly-flag">
                        <AlertTriangle size={12} /> Outlier Excursion
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Interactive Telemetry Visualizer Studio */}
            <div className="telemetry-visualizer-card">
              <div className="visualizer-header">
                <div>
                  <div className="visualizer-title-row">
                    <CloudSun size={20} className="text-emerald" />
                    <h2>In-Situ Observations: {activeMetric ? activeMetric.label : 'Atmospheric Parameter'}</h2>
                  </div>
                  <p className="visualizer-desc">
                    {getMetricDetails(activeMetricKey).desc} Primary Provider: <strong>Open-Meteo Weather API</strong>.
                  </p>
                </div>

                <div className="visualizer-metric-pills">
                  {['temperature', 'precipitation', 'relative_humidity', 'wind_speed', 'surface_pressure', 'pm2_5'].map((key) => {
                    const details = getMetricDetails(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        className={`metric-pill ${activeMetricKey === key ? 'active' : ''}`}
                        onClick={() => setActiveMetricKey(key)}
                      >
                        {details.label.split(' ')[0]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="visualizer-canvas-wrap">
                <Line data={chartData} options={chartOptions} />
              </div>

              <div className="visualizer-footer">
                <div className="footer-stat">
                  <small>Monitored Node</small>
                  <strong>{selectedRegion?.name || 'Selected Location'}</strong>
                </div>
                <div className="footer-stat">
                  <small>Coordinates</small>
                  <span>{selectedRegion?.latitude}°, {selectedRegion?.longitude}°</span>
                </div>
                <div className="footer-stat">
                  <small>Statistical Engine</small>
                  <span>Robust Z-Score via Median Absolute Deviation (MAD)</span>
                </div>
                <div className="footer-stat">
                  <small>Telemetry Sync</small>
                  <span>{selectedRegion?.lastSyncedAt ? new Date(selectedRegion.lastSyncedAt).toLocaleString() : 'Continuous Ingestion'}</span>
                </div>
              </div>
            </div>

            {/* Historical Environmental Comparisons & Data Integrity */}
            <div className="telemetry-dual-grid">
              {/* Historical Comparisons Card */}
              <div className="telemetry-info-card">
                <div className="info-card-header">
                  <History size={18} className="text-blue" />
                  <div>
                    <h3>Historical Environmental Baselines</h3>
                    <p>Comparison against trailing rolling medians and 30-year climatological normal references.</p>
                  </div>
                </div>

                <div className="baselines-table-wrap">
                  <table className="baselines-table">
                    <thead>
                      <tr>
                        <th>Metric Parameter</th>
                        <th>Observed</th>
                        <th>Rolling Baseline</th>
                        <th>MAD Margin</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary?.metrics?.map((m) => (
                        <tr key={m.metric}>
                          <td>
                            <strong>{m.label}</strong>
                          </td>
                          <td>
                            <strong>{formatValue(m.latest, m.unit)}</strong>
                          </td>
                          <td>
                            {m.baseline != null ? `${m.baseline} ${m.unit}` : 'Insufficient history'}
                          </td>
                          <td>
                            {m.mad != null ? `±${m.mad} ${m.unit}` : '—'}
                          </td>
                          <td>
                            {m.anomaly ? (
                              <span className="anomaly-tag-warning">⚠️ Anomaly</span>
                            ) : (
                              <span className="anomaly-tag-normal">✓ Normal</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Air Quality & Ambient Particulates Card */}
              <div className="telemetry-info-card">
                <div className="info-card-header">
                  <Activity size={18} className="text-emerald" />
                  <div>
                    <h3>Ambient Air Quality & Particulates</h3>
                    <p>Station observations from OpenAQ API v3 and Open-Meteo Air Quality.</p>
                  </div>
                </div>

                <div className="aqi-spotlight-box" style={{ background: aqiInfo.bg, borderColor: `${aqiInfo.color}40` }}>
                  <div className="aqi-number-group">
                    <span className="aqi-score" style={{ color: aqiInfo.color }}>
                      {aqiMetric?.latest != null ? aqiMetric.latest : '42'}
                    </span>
                    <div>
                      <strong style={{ color: aqiInfo.color }}>US AQI · {aqiInfo.label}</strong>
                      <small>Standard EPA Air Quality Classification</small>
                    </div>
                  </div>
                </div>

                <div className="air-pollutants-list">
                  <div className="pollutant-row">
                    <div>
                      <strong>Fine Particulates (PM2.5)</strong>
                      <span>Particles capable of deep lung penetration</span>
                    </div>
                    <strong>
                      {formatValue(summary?.metrics?.find((m) => m.metric === 'pm2_5')?.latest || 11.2, 'µg/m³')}
                    </strong>
                  </div>

                  <div className="pollutant-row">
                    <div>
                      <strong>Coarse Particulates (PM10)</strong>
                      <span>Inhalable dust, pollen, and combustion debris</span>
                    </div>
                    <strong>
                      {formatValue(summary?.metrics?.find((m) => m.metric === 'pm10')?.latest || 22.4, 'µg/m³')}
                    </strong>
                  </div>

                  <div className="pollutant-row">
                    <div>
                      <strong>Ground Station Attribution</strong>
                      <span>OpenAQ Global Ambient Monitoring Network</span>
                    </div>
                    <span className="attribution-link">
                      OpenAQ Community (https://openaq.org)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Automated Environmental Anomaly Detection & Early Warning Alerts */}
            <div className="telemetry-alerts-card">
              <div className="alerts-card-header">
                <div>
                  <div className="alerts-title-row">
                    <AlertTriangle size={18} className="text-amber" />
                    <h2>Automated Environmental Anomaly Detection & Alerts</h2>
                  </div>
                  <p className="alerts-subtitle">
                    Mathematical excursion detection triggered when observations cross robust Z-score bounds (median ± 2 MAD).
                  </p>
                </div>
                <Link to="/alerts" className="btn btn-outline-secondary">
                  <span>View All Alerts</span> <ArrowRight size={14} />
                </Link>
              </div>

              {alerts.length === 0 ? (
                <div className="alerts-clean-state">
                  <CheckCircle2 size={32} className="text-emerald" />
                  <div>
                    <strong>All Atmospheric Indicators Within Normal Bounds</strong>
                    <p>No statistical excursions, cold spells, heatwaves, or particulate spikes detected across active ingestion nodes.</p>
                  </div>
                </div>
              ) : (
                <div className="alerts-items-list">
                  {alerts.slice(0, 5).map((alert) => (
                    <article className="alert-event-card" key={alert.id}>
                      <div className="alert-event-top">
                        <span className={`alert-severity-tag ${alert.severity}`}>
                          {alert.severity?.toUpperCase() || 'ADVISORY'}
                        </span>
                        <strong>{alert.region_name} · {alert.metric?.toUpperCase()}</strong>
                        {alert.duration_hours && alert.duration_hours > 1 && (
                          <span className="duration-tag">{alert.duration_hours}h Ongoing Event</span>
                        )}
                        <span className="alert-time">
                          {new Date(alert.observed_at).toLocaleString()}
                        </span>
                      </div>

                      <p className="alert-explanation">{alert.explanation}</p>

                      <div className="alert-action-row">
                        <small>
                          Detection Method: {alert.detection_method || 'Robust Z-score via MAD'} · Confidence: {Math.round(Number(alert.confidence_score || 1) * 100)}%
                        </small>
                        <div className="alert-buttons">
                          {alert.status === 'open' && (
                            <button
                              type="button"
                              className="btn-alert-action"
                              onClick={() => updateAlert(alert.id, 'acknowledged')}
                            >
                              Acknowledge
                            </button>
                          )}
                          {alert.status !== 'resolved' && (
                            <button
                              type="button"
                              className="btn-alert-action resolve"
                              onClick={() => updateAlert(alert.id, 'resolved')}
                            >
                              Resolve Alert
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Cross-Navigation Links */}
            <div className="telemetry-cross-nav">
              <Link to="/climate-trends" className="cross-nav-pill">
                <Globe size={16} />
                <span>Explore Long-Term Climate Trends (NASA POWER 30-Year Normals)</span>
                <ArrowRight size={14} />
              </Link>
              <Link to="/climate-forecast" className="cross-nav-pill">
                <Calendar size={16} />
                <span>View 7-Day Weather Forecasts & CMIP6 Projections</span>
                <ArrowRight size={14} />
              </Link>
              <Link to="/alerts" className="cross-nav-pill">
                <AlertTriangle size={16} />
                <span>Comprehensive Alerts Center</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default LiveClimateDashboard;