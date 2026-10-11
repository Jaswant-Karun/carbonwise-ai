import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CloudSun, MapPin, RefreshCw, ShieldCheck } from 'lucide-react';
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

const formatValue = (value, unit) => `${Number(value).toFixed(2)} ${unit}`;

const LiveClimateDashboard = () => {
  const [regions, setRegions] = useState([]);
  const [selectedRegionId, setSelectedRegionId] = useState('');
  const [summary, setSummary] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');
  const [regionForm, setRegionForm] = useState({ name: '', latitude: '', longitude: '' });
  const [busy, setBusy] = useState(false);

  const loadAlerts = useCallback(async () => {
    const response = await api.get('/environment/alerts');
    setAlerts(response.data || []);
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
    const response = await api.get(`/environment/regions/${regionId}/summary`);
    setSummary(response.data);
    setStatus('ready');
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const nextRegions = await loadRegions();
        await loadAlerts();
        if (nextRegions[0]) await loadSummary(nextRegions[0].id);
        else setStatus('empty');
      } catch (error) {
        setMessage(error.response?.data?.message || 'Unable to load live climate data.');
        setStatus('error');
      }
    };
    load();
  }, [loadAlerts, loadRegions, loadSummary]);

  const selectRegion = async (event) => {
    const regionId = event.target.value;
    setSelectedRegionId(regionId);
    try {
      await loadSummary(regionId);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Unable to load this region.');
      setStatus('error');
    }
  };

  const createRegion = async (event) => {
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
      if (response.data.alerts?.length) setAlerts((current) => [...response.data.alerts, ...current]);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Environmental data could not be refreshed.');
    } finally {
      setBusy(false);
    }
  };

  const chartData = useMemo(() => {
    const metric = summary?.metrics?.find((item) => item.metric === 'pm2_5')
      || summary?.metrics?.[0];
    return {
      labels: metric?.observations?.map((item) => new Date(item.observedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })) || [],
      datasets: [{
        label: metric ? `${metric.label} (${metric.unit})` : 'Environmental metric',
        data: metric?.observations?.map((item) => item.value) || [],
        borderColor: '#176b4d',
        backgroundColor: 'rgba(120, 199, 154, .18)',
        fill: true,
        tension: 0.35,
      }],
    };
  }, [summary]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: true } },
    scales: { x: { grid: { display: false }, title: { display: true, text: 'Observation time' } }, y: { beginAtZero: true, title: { display: true, text: 'Measured value' } } },
  };

  return (
    <Layout>
      <div className="intelligence-toolbar">
        <div>
          <span className="section-kicker">Live environmental data</span>
          <h2>Climate conditions and early warnings</h2>
          <p className="page-supporting-copy">Provider observations are shown with source freshness and transparent anomaly rules.</p>
        </div>
        <div className="live-climate-controls">
          <label className="filter-control">
            <span>Region</span>
            <select value={selectedRegionId} onChange={selectRegion} disabled={!regions.length}>
              {!regions.length && <option value="">Add a region</option>}
              {regions.map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}
            </select>
          </label>
          <button className="btn" type="button" onClick={refresh} disabled={!selectedRegionId || busy}>
            <RefreshCw size={16} /> {busy ? 'Refreshing...' : 'Refresh data'}
          </button>
        </div>
      </div>

      {message && <div className="inline-message" role="alert">{message}</div>}

      {!regions.length && status !== 'loading' ? (
        <section className="chart-card live-region-setup">
          <MapPin size={28} />
          <h3>Choose a region to begin</h3>
          <p>Add a latitude and longitude for a region you want to monitor. No environmental values are fabricated before a provider observation is available.</p>
          <form className="live-region-form" onSubmit={createRegion}>
            <input aria-label="Region name" placeholder="Region name" value={regionForm.name} onChange={(event) => setRegionForm({ ...regionForm, name: event.target.value })} required />
            <input aria-label="Latitude" type="number" step="any" min="-90" max="90" placeholder="Latitude" value={regionForm.latitude} onChange={(event) => setRegionForm({ ...regionForm, latitude: event.target.value })} required />
            <input aria-label="Longitude" type="number" step="any" min="-180" max="180" placeholder="Longitude" value={regionForm.longitude} onChange={(event) => setRegionForm({ ...regionForm, longitude: event.target.value })} required />
            <button className="btn" type="submit" disabled={busy}>Monitor region</button>
          </form>
        </section>
      ) : status === 'loading' ? <LoadingState label="Loading environmental observations..." /> : status === 'error' ? (
        <section className="intelligence-state"><AlertTriangle size={32} /><h2>Live data is temporarily unavailable</h2><p>Check the provider connection and try again.</p></section>
      ) : (
        <>
          <div className="summary-grid">
            {summary?.metrics?.map((metric) => (
              <SummaryCard key={metric.metric} label={metric.label} value={formatValue(metric.latest, metric.unit)} detail={`Observed ${new Date(metric.observedAt).toLocaleString()}`} icon={metric.anomaly ? AlertTriangle : CloudSun} tone={metric.anomaly ? 'amber' : 'blue'} />
            ))}
            <SummaryCard label="Open warnings" value={String(alerts.filter((alert) => alert.status === 'open').length)} detail="User-owned environmental alerts" icon={ShieldCheck} />
          </div>
          <div className="intelligence-grid">
            <ChartCard title="Environmental observations" description="Recent provider observations; this chart does not represent personal carbon emissions." className="chart-card-wide">
              <div className="forecast-chart"><Line data={chartData} options={chartOptions} /></div>
            </ChartCard>
            <ChartCard title="Data quality and limits" description="Every value remains tied to its provider timestamp.">
              <div className="source-list">
                {summary?.metrics?.map((metric) => <div className="source-row" key={metric.metric}><div><strong>{metric.label}</strong><span>Baseline: {metric.baseline == null ? 'insufficient history' : `${metric.baseline} ${metric.unit}`}</span></div><strong>{metric.anomaly ? 'Warning' : 'Within rule'}</strong></div>)}
              </div>
            </ChartCard>
          </div>
        </>
      )}

      <ChartCard title="Environmental alerts" description="Alerts are rule-based early warnings, not medical, safety, or emergency advice.">
        {alerts.length ? alerts.slice(0, 10).map((alert) => <div className="recommendation-row" key={alert.id}><span className={`alert-severity alert-${alert.severity}`}>{alert.severity}</span><div><strong>{alert.region_name} · {alert.metric}</strong><p>{alert.explanation}</p><small>{new Date(alert.observed_at).toLocaleString()} · {alert.status}</small></div></div>) : <div className="empty-inline"><ShieldCheck size={20} /> No environmental alerts have been generated yet.</div>}
      </ChartCard>
    </Layout>
  );
};

export default LiveClimateDashboard;
