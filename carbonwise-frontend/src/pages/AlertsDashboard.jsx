import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  ExternalLink,
  Filter,
  Info,
  MapPin,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Wind,
  XCircle,
  FileText,
  Activity,
  History,
  AlertCircle,
} from 'lucide-react';
import api from '../services/api';
import Layout from '../components/Layout';
import ChartCard from '../components/ChartCard';
import SummaryCard from '../components/SummaryCard';
import LoadingState from '../components/LoadingState';

const categoryLabels = {
  all: 'All Categories',
  air_quality: 'Air Quality (OpenAQ)',
  atmospheric: 'Weather & Climate Anomalies',
  data_quality: 'Sensor & Data Integrity',
};

const _severityTones = {
  critical: 'rose',
  warning: 'amber',
  info: 'blue',
  normal: 'green',
};

const AlertsDashboard = () => {
  const [regions, setRegions] = useState([]);
  const [selectedRegionId, setSelectedRegionId] = useState('');
  const [alerts, setAlerts] = useState([]);
  const [airQualityData, setAirQualityData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(null);
  const [message, setMessage] = useState('');

  // Filters state
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState('all'); // all, 24h, 7d, 30d

  // Resolution modal state
  const [resolutionModal, setResolutionModal] = useState({
    isOpen: false,
    alertId: null,
    targetStatus: 'resolved',
    note: '',
  });

  // History expanded state per alert
  const [expandedHistory, setExpandedHistory] = useState({});

  const toggleHistory = (alertId) => {
    setExpandedHistory((prev) => ({ ...prev, [alertId]: !prev[alertId] }));
  };

  const loadRegions = useCallback(async () => {
    try {
      const res = await api.get('/environment/regions');
      const data = res.data || [];
      setRegions(data);
      if (data.length > 0 && !selectedRegionId) {
        setSelectedRegionId(String(data[0].id));
      }
      return data;
    } catch (err) {
      console.warn('Failed to load regions:', err.message);
      return [];
    }
  }, [selectedRegionId]);

  const loadAlerts = useCallback(async () => {
    try {
      const params = {};
      if (selectedRegionId && selectedRegionId !== 'all') {
        params.regionId = selectedRegionId;
      }
      if (categoryFilter !== 'all') {
        params.category = categoryFilter;
      }
      if (severityFilter !== 'all') {
        params.severity = severityFilter;
      }
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }

      if (dateRange === '24h') {
        params.startDate = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      } else if (dateRange === '7d') {
        params.startDate = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
      } else if (dateRange === '30d') {
        params.startDate = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      }

      const res = await api.get('/environment/alerts', { params });
      setAlerts(res.data || []);
    } catch (err) {
      console.warn('Failed to load alerts:', err.message);
    }
  }, [selectedRegionId, categoryFilter, severityFilter, statusFilter, dateRange]);

  const loadAirQuality = useCallback(async (regionId) => {
    if (!regionId || regionId === 'all') {
      setAirQualityData(null);
      return;
    }
    try {
      const res = await api.get(`/environment/regions/${regionId}/air-quality`);
      setAirQualityData(res.data);
    } catch (err) {
      console.warn('Air quality load error:', err.message);
      setAirQualityData({
        status: 'provider_unavailable',
        provider: 'openaq',
        measurements: [],
        message: 'OpenAQ air quality feed currently unreachable.',
        attribution: 'OpenAQ Community (https://openaq.org)',
        sourceUrl: 'https://openaq.org',
      });
    }
  }, []);

  const refreshAll = async () => {
    setRefreshing(true);
    setMessage('');
    try {
      await Promise.all([loadAlerts(), loadAirQuality(selectedRegionId)]);
      setMessage('Environmental telemetry and alerts updated successfully.');
    } catch (err) {
      setMessage(`Refresh completed with notes: ${err.message}`);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadRegions().then((loaded) => {
      const firstId = loaded[0]?.id ? String(loaded[0].id) : '';
      Promise.all([loadAlerts(), loadAirQuality(firstId)]).finally(() => setLoading(false));
    });
  }, []);

  useEffect(() => {
    loadAlerts();
    if (selectedRegionId && selectedRegionId !== 'all') {
      loadAirQuality(selectedRegionId);
    }
  }, [selectedRegionId, categoryFilter, severityFilter, statusFilter, dateRange]);

  const handleUpdateStatus = async (alertId, newStatus, note = '') => {
    setActionInProgress(alertId);
    try {
      await api.patch(`/environment/alerts/${alertId}`, {
        status: newStatus,
        note: note || `Status updated to ${newStatus}`,
      });
      await loadAlerts();
      setMessage(`Alert #${alertId} updated to ${newStatus}.`);
    } catch (err) {
      setMessage(`Failed to update alert: ${err.response?.data?.message || err.message}`);
    } finally {
      setActionInProgress(null);
      setResolutionModal({ isOpen: false, alertId: null, targetStatus: 'resolved', note: '' });
    }
  };

  const openResolutionPrompt = (alertId, targetStatus) => {
    setResolutionModal({
      isOpen: true,
      alertId,
      targetStatus,
      note: targetStatus === 'resolved' ? 'Environmental levels verified within guideline thresholds.' : '',
    });
  };

  // Summary counts
  const criticalCount = useMemo(() => alerts.filter((a) => a.severity === 'critical' && a.status === 'open').length, [alerts]);
  const warningCount = useMemo(() => alerts.filter((a) => a.severity === 'warning' && a.status === 'open').length, [alerts]);
  const airQualityCount = useMemo(() => alerts.filter((a) => a.anomaly_category === 'air_quality' && a.status === 'open').length, [alerts]);
  const sensorIssueCount = useMemo(() => alerts.filter((a) => a.anomaly_category === 'data_quality' && a.status === 'open').length, [alerts]);

  const activeRegion = useMemo(() => {
    if (!selectedRegionId || selectedRegionId === 'all') return null;
    return regions.find((r) => String(r.id) === String(selectedRegionId));
  }, [regions, selectedRegionId]);

  return (
    <Layout>
      <div className="intelligence-toolbar">
        <div>
          <span className="section-kicker">Authoritative Environmental Safety & Monitoring</span>
          <h2>Environmental Alerts & Air Quality Intelligence</h2>
          <p className="page-supporting-copy">
            Independent ground-level air quality telemetry from OpenAQ alongside weather anomaly and sensor integrity alerts.
          </p>
        </div>

        <div className="live-climate-controls">
          <label className="filter-control">
            <span>Region</span>
            <select
              value={selectedRegionId}
              onChange={(e) => setSelectedRegionId(e.target.value)}
              disabled={refreshing}
            >
              <option value="all">All Monitored Regions</option>
              {regions.map((reg) => (
                <option key={reg.id} value={reg.id}>
                  {reg.name} {reg.country ? `(${reg.country})` : ''}
                </option>
              ))}
            </select>
          </label>

          <button
            className="btn"
            type="button"
            onClick={refreshAll}
            disabled={refreshing}
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Updating...' : 'Sync Telemetry'}
          </button>
        </div>
      </div>

      {message && <div className="inline-message" role="alert">{message}</div>}

      {/* Disclaimers & Attribution Banner */}
      <div
        style={{
          background: 'rgba(16, 24, 39, 0.75)',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          borderRadius: '12px',
          padding: '12px 18px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
        }}
      >
        <Info size={19} style={{ color: '#60a5fa', flexShrink: 0, marginTop: '2px' }} />
        <div style={{ fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.5 }}>
          <strong style={{ color: '#f1f5f9' }}>Data Sources & Scientific Transparency:</strong> Ground air quality measurements are retrieved via the official <a href="https://openaq.org" target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', textDecoration: 'underline' }}>OpenAQ API</a>. In adherence to meteorological standards, ambient particulate pollution and air quality indicators are evaluated separately from long-term climate change baselines. Official public health warnings and civil defense declarations are issued solely by designated governmental authorities.
        </div>
      </div>

      {/* Summary Metrics Strip */}
      <div className="dashboard-summary-strip" style={{ marginBottom: '22px' }}>
        <SummaryCard
          label="Active Critical Alerts"
          value={String(criticalCount)}
          detail="Requires immediate review"
          icon={ShieldAlert}
          tone={criticalCount > 0 ? 'rose' : 'green'}
        />
        <SummaryCard
          label="Active Warnings"
          value={String(warningCount)}
          detail="Elevated thresholds observed"
          icon={AlertTriangle}
          tone={warningCount > 0 ? 'amber' : 'green'}
        />
        <SummaryCard
          label="Air Quality Alerts"
          value={String(airQualityCount)}
          detail="OpenAQ threshold exceedances"
          icon={Wind}
          tone={airQualityCount > 0 ? 'amber' : 'green'}
        />
        <SummaryCard
          label="Sensor & Data Quality"
          value={String(sensorIssueCount)}
          detail="Telemetry integrity checks"
          icon={Activity}
          tone={sensorIssueCount > 0 ? 'amber' : 'green'}
        />
      </div>

      {/* OpenAQ Ground Air Quality Telemetry Section */}
      {selectedRegionId !== 'all' && (
        <section style={{ marginBottom: '24px' }}>
          <ChartCard
            title={`Ground Air Quality Telemetry: ${activeRegion ? activeRegion.name : 'Selected Region'}`}
            description="Live station measurements from OpenAQ Community network with WHO 2021 & US EPA guideline classifications."
          >
            {airQualityData?.status === 'available' && airQualityData.measurements?.length > 0 ? (
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '10px',
                    padding: '12px 14px',
                    background: 'rgba(15, 23, 42, 0.6)',
                    borderRadius: '8px',
                    marginBottom: '16px',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MapPin size={16} style={{ color: 'var(--mint-strong)' }} />
                    <span style={{ fontSize: '0.85rem', color: '#f1f5f9' }}>
                      Station: <strong>{airQualityData.stationName}</strong>
                    </span>
                    {airQualityData.sourceUrl && (
                      <a
                        href={airQualityData.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: '0.78rem',
                          color: '#38bdf8',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          marginLeft: '6px',
                        }}
                      >
                        View Station on OpenAQ <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                  <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                    {airQualityData.attribution}
                  </span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                    gap: '14px',
                  }}
                >
                  {airQualityData.measurements.map((m) => {
                    const evalMatch = airQualityData.evaluations?.find((e) => e.pollutant === m.pollutant);
                    const severity = evalMatch?.severity || 'normal';
                    const category = evalMatch?.categoryLabel || 'Good';

                    return (
                      <div
                        key={m.pollutant}
                        style={{
                          background: 'rgba(13, 20, 34, 0.7)',
                          border: `1px solid ${severity === 'critical' ? '#ef4444' : severity === 'warning' ? '#f59e0b' : 'rgba(255, 255, 255, 0.08)'}`,
                          borderRadius: '12px',
                          padding: '14px 16px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                          <strong style={{ fontSize: '0.92rem', color: '#f1f5f9' }}>{m.label}</strong>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontWeight: 600,
                              background: severity === 'critical' ? '#ef444425' : severity === 'warning' ? '#f59e0b25' : '#10b98125',
                              color: severity === 'critical' ? '#f87171' : severity === 'warning' ? '#fbbf24' : '#34d399',
                              border: '1px solid currentColor',
                            }}
                          >
                            {category}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', margin: '8px 0 4px' }}>
                          <span style={{ fontSize: '1.65rem', fontWeight: 800, color: '#ffffff' }}>
                            {m.value}
                          </span>
                          <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{m.unit}</span>
                        </div>

                        <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                          <span>Source raw: {m.originalValue} {m.originalUnit}</span>
                          {evalMatch?.guideline && (
                            <span>WHO limit: {evalMatch.guideline} {m.unit}</span>
                          )}
                        </div>

                        {evalMatch?.explanation && (
                          <p style={{ fontSize: '0.74rem', color: '#94a3b8', margin: '8px 0 0', lineHeight: 1.4, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '6px' }}>
                            {evalMatch.explanation}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Requirement 9: Show 'Data unavailable' when no station exists rather than treating missing data as clean air */
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px dashed rgba(239, 68, 68, 0.4)',
                  borderRadius: '12px',
                  padding: '24px',
                  textAlign: 'center',
                }}
              >
                <AlertCircle size={32} style={{ color: '#f87171', margin: '0 auto 10px' }} />
                <h4 style={{ color: '#f1f5f9', marginBottom: '6px' }}>
                  {airQualityData?.status === 'auth_required'
                    ? 'OpenAQ API Authentication Required'
                    : 'Data Unavailable: No Ground Air-Quality Station within 25 km'}
                </h4>
                <p style={{ color: '#94a3b8', fontSize: '0.85rem', maxWidth: '620px', margin: '0 auto 12px' }}>
                  {airQualityData?.message ||
                    'No active OpenAQ ground sensor station is registered within a 25 km radius of this location. In accordance with environmental safety standards, missing telemetry is explicitly flagged as data unavailable and is never assumed to represent clean air.'}
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', alignItems: 'center' }}>
                  <a
                    href="https://openaq.org"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn"
                    style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                  >
                    Explore OpenAQ Station Map <ExternalLink size={13} style={{ marginLeft: '4px' }} />
                  </a>
                </div>
              </div>
            )}
          </ChartCard>
        </section>
      )}

      {/* Filter Bar */}
      <section className="tracker-card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <Filter size={17} style={{ color: 'var(--mint-strong)' }} />
          <strong style={{ fontSize: '0.92rem', color: '#f1f5f9' }}>Alert Filtering & Classification</strong>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px',
          }}
        >
          <label className="filter-control">
            <span>Category</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">All Categories</option>
              <option value="air_quality">Air Quality (OpenAQ)</option>
              <option value="atmospheric">Weather Anomalies</option>
              <option value="data_quality">Sensor Data Quality</option>
            </select>
          </label>

          <label className="filter-control">
            <span>Severity</span>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical (Red)</option>
              <option value="warning">Warning (Amber)</option>
              <option value="info">Advisory / Info (Blue)</option>
            </select>
          </label>

          <label className="filter-control">
            <span>Status</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="open">Open (Active)</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="resolved">Resolved</option>
            </select>
          </label>

          <label className="filter-control">
            <span>Observation Window</span>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
            >
              <option value="all">All Recorded History</option>
              <option value="24h">Past 24 Hours</option>
              <option value="7d">Past 7 Days</option>
              <option value="30d">Past 30 Days</option>
            </select>
          </label>
        </div>
      </section>

      {/* Environmental Alerts Feed */}
      <section>
        <ChartCard
          title={`Active Environmental Alerts (${alerts.length})`}
          description="Traceable, explainable environmental anomalies with full audit trail and resolution history."
        >
          {loading ? (
            <LoadingState message="Loading environmental alerts and telemetry..." />
          ) : alerts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 12px', color: '#94a3b8' }}>
              <CheckCircle2 size={38} style={{ color: 'var(--mint-strong)', margin: '0 auto 12px' }} />
              <h4>No matching alerts found</h4>
              <p style={{ fontSize: '0.85rem' }}>
                All environmental observations within the selected filters are operating within expected baseline thresholds.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '14px' }}>
              {alerts.map((alert) => {
                const isAirQuality = alert.anomaly_category === 'air_quality';
                const isDataQuality = alert.anomaly_category === 'data_quality';
                const history = Array.isArray(alert.resolution_history) ? alert.resolution_history : [];
                const historyExpanded = Boolean(expandedHistory[alert.id]);

                return (
                  <div
                    key={alert.id}
                    style={{
                      background: 'rgba(13, 20, 34, 0.75)',
                      border: `1px solid ${
                        alert.severity === 'critical'
                          ? 'rgba(239, 68, 68, 0.4)'
                          : alert.severity === 'warning'
                          ? 'rgba(245, 158, 11, 0.35)'
                          : 'rgba(59, 130, 246, 0.25)'
                      }`,
                      borderRadius: '12px',
                      padding: '16px',
                    }}
                  >
                    {/* Alert Header */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '8px',
                        marginBottom: '10px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            background:
                              alert.severity === 'critical'
                                ? '#ef444425'
                                : alert.severity === 'warning'
                                ? '#f59e0b25'
                                : '#3b82f625',
                            color:
                              alert.severity === 'critical'
                                ? '#f87171'
                                : alert.severity === 'warning'
                                ? '#fbbf24'
                                : '#60a5fa',
                            border: '1px solid currentColor',
                          }}
                        >
                          {alert.severity}
                        </span>

                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            background: isAirQuality
                              ? 'rgba(16, 185, 129, 0.15)'
                              : isDataQuality
                              ? 'rgba(239, 68, 68, 0.15)'
                              : 'rgba(59, 130, 246, 0.15)',
                            color: isAirQuality
                              ? '#34d399'
                              : isDataQuality
                              ? '#f87171'
                              : '#60a5fa',
                          }}
                        >
                          {categoryLabels[alert.anomaly_category] || alert.anomaly_category}
                        </span>

                        <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#f1f5f9' }}>
                          {alert.region_name} · {alert.metric?.toUpperCase()}
                        </span>

                        {alert.duration_hours > 1 && (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              color: '#94a3b8',
                              background: 'rgba(255, 255, 255, 0.05)',
                              padding: '2px 6px',
                              borderRadius: '4px',
                            }}
                          >
                            ⏱️ {alert.duration_hours}h ongoing event
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span
                          style={{
                            fontSize: '0.74rem',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontWeight: 600,
                            background:
                              alert.status === 'open'
                                ? 'rgba(245, 158, 11, 0.2)'
                                : alert.status === 'acknowledged'
                                ? 'rgba(59, 130, 246, 0.2)'
                                : 'rgba(16, 185, 129, 0.2)',
                            color:
                              alert.status === 'open'
                                ? '#fbbf24'
                                : alert.status === 'acknowledged'
                                ? '#60a5fa'
                                : '#34d399',
                          }}
                        >
                          Status: {alert.status}
                        </span>

                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {alert.observed_at ? new Date(alert.observed_at).toLocaleString() : 'Recent'}
                        </span>
                      </div>
                    </div>

                    {/* Explanation */}
                    <p style={{ fontSize: '0.84rem', color: '#cbd5e1', lineHeight: 1.5, margin: '6px 0 10px' }}>
                      {alert.explanation}
                    </p>

                    {/* Evidence & Scientific Attribution Strip */}
                    <div
                      style={{
                        background: 'rgba(15, 23, 42, 0.5)',
                        border: '1px solid rgba(255, 255, 255, 0.04)',
                        borderRadius: '8px',
                        padding: '10px 12px',
                        fontSize: '0.78rem',
                        color: '#94a3b8',
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                        <span>
                          Observed Value: <strong style={{ color: '#f1f5f9' }}>{alert.observed_value}</strong>
                        </span>
                        {alert.baseline_value != null && (
                          <span>
                            Baseline: <strong style={{ color: '#f1f5f9' }}>{alert.baseline_value}</strong>
                          </span>
                        )}
                        {alert.threshold_value != null && (
                          <span>
                            Guideline Limit: <strong style={{ color: '#f1f5f9' }}>{alert.threshold_value}</strong>
                          </span>
                        )}
                        <span>
                          Source: <strong style={{ color: '#f1f5f9' }}>{alert.data_source || 'Ground Telemetry'}</strong>
                        </span>
                      </div>

                      {alert.source_url && (
                        <a
                          href={alert.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            color: '#38bdf8',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            textDecoration: 'none',
                          }}
                        >
                          Source Record <ExternalLink size={12} />
                        </a>
                      )}
                    </div>

                    {/* Action Buttons & Resolution History */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: '12px',
                        paddingTop: '10px',
                        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                        flexWrap: 'wrap',
                        gap: '10px',
                      }}
                    >
                      <div>
                        {history.length > 0 && (
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => toggleHistory(alert.id)}
                            style={{ margin: 0, fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <History size={13} />
                            {historyExpanded ? 'Hide Audit Log' : `Audit Log (${history.length} events)`}
                          </button>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        {alert.status === 'open' && (
                          <button
                            type="button"
                            className="btn"
                            style={{ fontSize: '0.75rem', padding: '5px 10px', background: '#3b82f620', color: '#60a5fa', border: '1px solid #3b82f640' }}
                            onClick={() => handleUpdateStatus(alert.id, 'acknowledged', 'Alert acknowledged by environmental analyst.')}
                            disabled={actionInProgress === alert.id}
                          >
                            Acknowledge
                          </button>
                        )}

                        {alert.status !== 'resolved' ? (
                          <button
                            type="button"
                            className="btn"
                            style={{ fontSize: '0.75rem', padding: '5px 10px', background: 'var(--primary)', color: '#090d16' }}
                            onClick={() => openResolutionPrompt(alert.id, 'resolved')}
                            disabled={actionInProgress === alert.id}
                          >
                            <CheckCircle2 size={13} style={{ marginRight: '4px' }} />
                            Resolve
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="text-button"
                            style={{ fontSize: '0.74rem', margin: 0 }}
                            onClick={() => handleUpdateStatus(alert.id, 'open', 'Reopened for investigation')}
                            disabled={actionInProgress === alert.id}
                          >
                            Reopen Alert
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expanded Resolution History Audit Trail */}
                    {historyExpanded && history.length > 0 && (
                      <div
                        style={{
                          marginTop: '10px',
                          padding: '10px 12px',
                          background: 'rgba(9, 13, 22, 0.8)',
                          borderRadius: '8px',
                          border: '1px solid rgba(255, 255, 255, 0.05)',
                        }}
                      >
                        <strong style={{ fontSize: '0.76rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Status Resolution Audit Trail:
                        </strong>
                        <div style={{ marginTop: '8px', display: 'grid', gap: '6px' }}>
                          {history.map((h, idx) => (
                            <div
                              key={idx}
                              style={{
                                fontSize: '0.75rem',
                                color: '#cbd5e1',
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '8px',
                              }}
                            >
                              <Clock size={12} style={{ color: '#64748b', marginTop: '2px', flexShrink: 0 }} />
                              <div>
                                <span style={{ color: '#94a3b8' }}>
                                  {new Date(h.timestamp).toLocaleString()}:
                                </span>{' '}
                                Changed from <strong style={{ color: '#fbbf24' }}>{h.previousStatus}</strong> to{' '}
                                <strong style={{ color: '#34d399' }}>{h.newStatus}</strong>
                                {h.note && <span style={{ color: '#94a3b8' }}> — "{h.note}"</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ChartCard>
      </section>

      {/* Resolution Note Modal */}
      {resolutionModal.isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
          }}
        >
          <div
            style={{
              background: '#0e1626',
              border: '1px solid #1e2c44',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '480px',
              width: '100%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
            }}
          >
            <h3 style={{ color: '#f1f5f9', marginBottom: '8px' }}>Resolve Environmental Alert</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.84rem', marginBottom: '16px', lineHeight: 1.5 }}>
              Record the scientific verification, mitigation action, or justification for resolving alert #{resolutionModal.alertId}. This will be added to the immutable resolution audit history.
            </p>

            <label className="filter-control" style={{ marginBottom: '16px' }}>
              <span>Resolution Notes / Evidence</span>
              <textarea
                rows={3}
                value={resolutionModal.note}
                onChange={(e) => setResolutionModal((prev) => ({ ...prev, note: e.target.value }))}
                placeholder="e.g., Air quality index verified nominal via subsequent hourly ground station telemetry."
                style={{
                  width: '100%',
                  background: '#090d16',
                  border: '1px solid var(--surface-border)',
                  borderRadius: '8px',
                  color: '#ffffff',
                  padding: '10px',
                  fontSize: '0.84rem',
                  outline: 0,
                  resize: 'vertical',
                }}
              />
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="text-button"
                onClick={() => setResolutionModal({ isOpen: false, alertId: null, targetStatus: 'resolved', note: '' })}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => handleUpdateStatus(resolutionModal.alertId, resolutionModal.targetStatus, resolutionModal.note)}
                disabled={actionInProgress === resolutionModal.alertId}
              >
                Confirm Resolution
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default AlertsDashboard;
