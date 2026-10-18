import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CloudSun,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Search,
  Droplets,
  Wind,
  Gauge,
  Activity,
  Calendar,
  CheckCircle2,
} from 'lucide-react';
import api from '../services/api';
import Layout from '../components/Layout';
import ChartCard from '../components/ChartCard';
import LoadingState from '../components/LoadingState';
import SummaryCard from '../components/SummaryCard';
import { Line } from 'react-chartjs-2';
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

const formatValue = (value, unit) => `${Number(value).toFixed(1)} ${unit}`;

const getMetricIcon = (metric) => {
  switch (metric) {
    case 'temperature': return CloudSun;
    case 'relative_humidity': return Droplets;
    case 'precipitation': return Droplets;
    case 'wind_speed': return Wind;
    case 'surface_pressure': return Gauge;
    case 'us_aqi':
    case 'pm2_5':
    case 'pm10': return Activity;
    default: return CloudSun;
  }
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
        setMessage(error.response?.data?.message || 'Unable to load live climate observations.');
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
      const nextRegions = await loadRegions();
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

  const updateAlert = async (alertId, status) => {
    try {
      const response = await api.patch(`/environment/alerts/${alertId}`, { status });
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

  const chartData = useMemo(() => {
    return {
      labels:
        activeMetric?.observations?.map((item) =>
          new Date(item.observedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        ) || [],
      datasets: [
        {
          label: activeMetric ? `${activeMetric.label} (${activeMetric.unit})` : 'Measurement',
          data: activeMetric?.observations?.map((item) => item.value) || [],
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.15)',
          fill: true,
          tension: 0.35,
          pointRadius: 4,
          pointBackgroundColor: '#10b981',
        },
      ],
    };
  }, [activeMetric]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, labels: { color: '#94a3b8' } },
      tooltip: {
        backgroundColor: '#0e1626',
        borderColor: '#1e2c44',
        borderWidth: 1,
        titleColor: '#f1f5f9',
        bodyColor: '#94a3b8',
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#64748b' },
        title: { display: true, text: 'Observation Timestamp (UTC)', color: '#64748b' },
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#64748b' },
        title: { display: true, text: activeMetric ? `${activeMetric.label} (${activeMetric.unit})` : '', color: '#64748b' },
      },
    },
  };

  return (
    <Layout>
      <div className="intelligence-toolbar">
        <div>
          <span className="section-kicker">Live Environmental Data Ingestion</span>
          <h2>Automated Climate Telemetry & Early Warning</h2>
          <p className="page-supporting-copy">
            Continuous ingestion from Open-Meteo weather and air quality APIs with idempotent storage and background scheduling.
          </p>
        </div>
        <div className="live-climate-controls">
          <label className="filter-control">
            <span>Monitored Region</span>
            <select value={selectedRegionId} onChange={selectRegion} disabled={!regions.length || busy}>
              {!regions.length && <option value="">No regions active</option>}
              {regions.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.name} {region.country ? `(${region.country})` : ''}
                </option>
              ))}
            </select>
          </label>
          <button className="btn" type="button" onClick={refresh} disabled={!selectedRegionId || busy}>
            <RefreshCw size={15} className={busy ? 'animate-spin' : ''} /> {busy ? 'Ingesting...' : 'Refresh Feed'}
          </button>
        </div>
      </div>

      {message && <div className="inline-message" role="alert">{message}</div>}

      {/* Location Search Bar */}
      <section className="tracker-card location-search-bar" style={{ marginBottom: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Search size={18} style={{ color: 'var(--mint-strong)' }} />
          <input
            type="text"
            placeholder="Search city or location name (e.g. Berlin, Tokyo, London, San Francisco)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              background: 'transparent',
              border: 0,
              color: '#ffffff',
              outline: 0,
              fontSize: '0.88rem',
            }}
          />
          {searching && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Searching Open-Meteo...</span>}
          <button
            type="button"
            className="text-button"
            onClick={() => setCustomFormOpen(!customFormOpen)}
            style={{ margin: 0 }}
          >
            {customFormOpen ? 'Cancel' : '+ Custom Lat/Lon'}
          </button>
        </div>

        {/* Location Suggestions Dropdown */}
        {suggestions.length > 0 && (
          <div
            style={{
              marginTop: '12px',
              paddingTop: '10px',
              borderTop: '1px solid var(--surface-border)',
              display: 'grid',
              gap: '6px',
            }}
          >
            <span style={{ fontSize: '0.7rem', color: 'var(--text-soft)', textTransform: 'uppercase' }}>
              Select a location to monitor (automatically configures coordinates):
            </span>
            {suggestions.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectSuggestion(item)}
                disabled={busy}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: 'var(--surface-soft)',
                  border: '1px solid var(--surface-border)',
                  borderRadius: '8px',
                  color: '#ffffff',
                  textAlign: 'left',
                }}
              >
                <span>
                  <strong>{item.name}</strong> {item.admin1 ? `, ${item.admin1}` : ''} {item.country ? `· ${item.country}` : ''}
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--mint-strong)' }}>
                  {item.latitude}°, {item.longitude}°
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Custom Lat/Lon Form */}
        {customFormOpen && (
          <form onSubmit={createRegionManual} style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
            <input
              placeholder="Location name"
              value={regionForm.name}
              onChange={(e) => setRegionForm({ ...regionForm, name: e.target.value })}
              required
              className="input-field"
            />
            <input
              type="number"
              step="any"
              min="-90"
              max="90"
              placeholder="Latitude"
              value={regionForm.latitude}
              onChange={(e) => setRegionForm({ ...regionForm, latitude: e.target.value })}
              required
              className="input-field"
            />
            <input
              type="number"
              step="any"
              min="-180"
              max="180"
              placeholder="Longitude"
              value={regionForm.longitude}
              onChange={(e) => setRegionForm({ ...regionForm, longitude: e.target.value })}
              required
              className="input-field"
            />
            <button type="submit" className="btn" disabled={busy} style={{ width: 'auto' }}>
              Add Node
            </button>
          </form>
        )}
      </section>

      {/* Main Content Area */}
      {!regions.length && status !== 'loading' ? (
        <section className="chart-card live-region-setup" style={{ textAlign: 'center', padding: '40px' }}>
          <MapPin size={34} style={{ color: 'var(--mint-strong)', marginBottom: '12px' }} />
          <h3>No Environmental Monitoring Nodes Configured</h3>
          <p>Search for a city above to immediately begin continuous environmental telemetry from Open-Meteo APIs.</p>
        </section>
      ) : status === 'loading' ? (
        <LoadingState label="Synchronizing atmospheric & meteorological observations..." />
      ) : status === 'error' ? (
        <section className="intelligence-state">
          <AlertTriangle size={32} />
          <h2>Observations Temporarily Offline</h2>
          <p>Preserving last valid database records. Check provider network connectivity and try again.</p>
        </section>
      ) : (
        <>
          {/* Multi-Metric Live Cards Strip */}
          <div className="summary-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            {summary?.metrics?.map((metric) => {
              const IconComponent = getMetricIcon(metric.metric);
              return (
                <div
                  key={metric.metric}
                  onClick={() => setActiveMetricKey(metric.metric)}
                  style={{
                    cursor: 'pointer',
                    outline: activeMetricKey === metric.metric ? '2px solid var(--primary)' : 'none',
                    borderRadius: '16px',
                  }}
                >
                  <SummaryCard
                    label={metric.label}
                    value={formatValue(metric.latest, metric.unit)}
                    detail={
                      metric.freshness === 'stale'
                        ? '⚠️ Stale observation'
                        : `Fresh (${metric.freshnessMinutes || 0}m ago)`
                    }
                    icon={metric.anomaly ? AlertTriangle : IconComponent}
                    tone={metric.anomaly ? 'amber' : 'green'}
                  />
                </div>
              );
            })}
            <SummaryCard
              label="Active Warnings"
              value={String(alerts.filter((a) => a.status === 'open').length)}
              detail="Rule-based anomaly triggers"
              icon={ShieldCheck}
              tone="amber"
            />
          </div>

          {/* Environmental Chart & Telemetry Limits */}
          <div className="intelligence-grid" style={{ marginTop: '16px' }}>
            <ChartCard
              title={`Telemetry Trend: ${activeMetric?.label || 'Environmental Observation'}`}
              description={`Latest reading: ${activeMetric ? `${activeMetric.latest} ${activeMetric.unit}` : '—'} · Source: Open-Meteo API`}
              className="chart-card-wide"
            >
              <div className="forecast-chart">
                <Line data={chartData} options={chartOptions} />
              </div>
            </ChartCard>

            <ChartCard
              title="Data Integrity & Freshness Attribution"
              description="Observations are normalized with deterministic statistical baselines in PostgreSQL."
            >
              <div className="source-list">
                {summary?.metrics?.map((metric) => (
                  <div className="source-row" key={metric.metric}>
                    <div>
                      <strong>{metric.label}</strong>
                      <span>
                        Baseline: {metric.baselineStatus === 'insufficient_history' || metric.baseline == null
                          ? 'Insufficient baseline data'
                          : `${metric.baseline} ${metric.unit} (Robust MAD: ±${metric.mad || 0} ${metric.unit})`}
                      </span>
                      <small style={{ color: metric.freshness === 'stale' ? 'var(--accent-amber)' : 'var(--mint-strong)' }}>
                        {metric.freshness === 'stale' ? '⚠️ Stale observation (>2h)' : '✓ Verified fresh observation'}
                        {metric.confidenceLabel ? ` · Confidence: ${metric.confidenceLabel}` : ''}
                      </small>
                    </div>
                    <strong>
                      {metric.baselineStatus === 'insufficient_history' ? (
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Insufficient baseline data</span>
                      ) : metric.anomaly ? (
                        <span style={{ color: 'var(--accent-amber)' }}>
                          ⚠️ Anomaly ({metric.deviation > 0 ? '+' : ''}{metric.deviation} {metric.unit})
                        </span>
                      ) : (
                        <span style={{ color: 'var(--mint-strong)' }}>✓ Normal</span>
                      )}
                    </strong>
                  </div>
                ))}
              </div>
            </ChartCard>
          </div>
        </>
      )}

      {/* Early Warning Alerts Section */}
      <div style={{ marginTop: '20px' }}>
        <ChartCard
          title="Active Environmental Alerts & Anomalies"
          description="Transparent, deterministic rules detecting deviations beyond statistical historical bounds."
        >
          {alerts.length ? (
            alerts.slice(0, 10).map((alert) => (
              <div className="recommendation-row" key={alert.id}>
                <span className={`alert-severity alert-${alert.severity}`}>{alert.severity}</span>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                    <strong>
                      {alert.region_name} · {alert.metric}
                    </strong>
                    {alert.anomaly_category && (
                      <span
                        className="badge"
                        style={{
                          fontSize: '0.68rem',
                          padding: '2px 6px',
                          background: alert.anomaly_category === 'data_quality' ? '#ef444420' : '#3b82f620',
                          color: alert.anomaly_category === 'data_quality' ? '#f87171' : '#60a5fa',
                          border: '1px solid currentColor',
                          borderRadius: '4px',
                        }}
                      >
                        {alert.anomaly_category === 'data_quality' ? 'Sensor/Data Quality' : 'Atmospheric'}
                      </span>
                    )}
                    {alert.duration_hours && alert.duration_hours > 1 && (
                      <span
                        className="badge"
                        style={{
                          fontSize: '0.68rem',
                          padding: '2px 6px',
                          background: '#eab30820',
                          color: '#facc15',
                          border: '1px solid currentColor',
                          borderRadius: '4px',
                        }}
                      >
                        {alert.duration_hours}h Ongoing Event
                      </span>
                    )}
                    {alert.confidence_score && (
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Confidence: {Math.round(Number(alert.confidence_score) * 100)}%
                      </span>
                    )}
                  </div>
                  <p>{alert.explanation}</p>
                  <small>
                    {new Date(alert.observed_at).toLocaleString()} · Status: {alert.status}
                    {alert.detection_method ? ` · Method: ${alert.detection_method}` : ''}
                  </small>
                  <div className="alert-actions">
                    {alert.status === 'open' && (
                      <button className="text-button" type="button" onClick={() => updateAlert(alert.id, 'acknowledged')}>
                        Acknowledge
                      </button>
                    )}
                    {alert.status !== 'resolved' && (
                      <button className="text-button" type="button" onClick={() => updateAlert(alert.id, 'resolved')}>
                        Resolve
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-inline">
              <CheckCircle2 size={20} style={{ color: 'var(--mint-strong)' }} /> All environmental indicators are within normal historical bounds.
            </div>
          )}
        </ChartCard>
      </div>
    </Layout>
  );
};

export default LiveClimateDashboard;
