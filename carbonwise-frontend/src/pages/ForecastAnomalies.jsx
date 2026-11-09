import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, CalendarClock, Info, RefreshCw, TrendingUp } from 'lucide-react';
import { CategoryScale, Chart as ChartJS, Legend, LinearScale, LineElement, PointElement, Tooltip } from 'chart.js';
import { Line } from 'react-chartjs-2';
import api from '../services/api';
import Layout from '../components/Layout';
import ChartCard from '../components/ChartCard';
import LoadingState from '../components/LoadingState';
import SummaryCard from '../components/SummaryCard';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

const formatKg = (value) => `${Number(value || 0).toFixed(2)} kg`;

const ForecastAnomalies = () => {
  const [period, setPeriod] = useState('30');
  const [horizon, setHorizon] = useState('7');
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [expandedAnomaly, setExpandedAnomaly] = useState(null);

  const fetchForecast = async () => {
    setStatus('loading');
    setError('');
    try {
      const response = await api.get(`/forecast?period=${period}&horizon=${horizon}`);
      setData(response.data);
      setStatus('ready');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load your forecast.');
      setStatus('error');
    }
  };

  useEffect(() => {
    fetchForecast();
  }, [period, horizon]);

  const chartData = useMemo(() => {
    const actual = data?.forecast?.actual || [];
    const projected = data?.forecast?.projected || [];
    const points = [...actual, ...projected];
    return {
      labels: points.map((point) => point.date.slice(5)),
      datasets: [
        {
          label: 'Actual emissions',
          data: [...actual.map((point) => point.emissions), ...projected.map(() => null)],
          borderColor: '#176b4d',
          backgroundColor: 'rgba(23, 107, 77, .12)',
          fill: true,
          tension: .3,
          pointRadius: 2,
        },
        {
          label: 'Forecast',
          data: [...actual.map(() => null), ...projected.map((point) => point.emissions)],
          borderColor: '#d39a37',
          backgroundColor: 'rgba(211, 154, 55, .12)',
          borderDash: [7, 5],
          fill: false,
          tension: .3,
          pointRadius: 2,
        },
      ],
    };
  }, [data]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 18 } } },
    scales: { x: { grid: { display: false } }, y: { beginAtZero: true, title: { display: true, text: 'kg CO₂' } } },
  };

  if (status === 'loading') return <Layout><div className="intelligence-loading"><LoadingState label="Analyzing history and building forecast..." /></div></Layout>;

  if (status === 'error') {
    return <Layout><div className="intelligence-state"><AlertTriangle size={34} /><h2>Forecast unavailable</h2><p>{error}</p><button className="btn state-button" type="button" onClick={fetchForecast}><RefreshCw size={16} /> Try again</button></div></Layout>;
  }

  const projected = data?.forecast?.projected || [];
  const insufficient = !data?.forecast?.sufficientData;

  return (
    <Layout>
      <div className="forecast-toolbar">
        <div><span className="section-kicker">Forward-looking analysis</span><h2>Forecast your footprint, carefully</h2><p>Historical observations and projections are kept separate so assumptions stay visible.</p></div>
        <div className="forecast-filters">
          <label>History<select value={period} onChange={(event) => setPeriod(event.target.value)}><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last 12 months</option></select></label>
          <label>Horizon<select value={horizon} onChange={(event) => setHorizon(event.target.value)}><option value="7">Next 7 days</option><option value="30">Next 30 days</option></select></label>
        </div>
      </div>

      <div
        style={{
          background: 'rgba(16, 24, 39, 0.75)',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          borderRadius: '12px',
          padding: '12px 18px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '0.82rem',
          color: '#94a3b8',
        }}
      >
        <span style={{ fontSize: '1rem' }}>🛡️</span>
        <div>
          <strong style={{ color: '#f1f5f9' }}>Independent Telemetry Architecture:</strong> Personal footprint forecasting uses trailing moving averages and activity log anomaly detection. Atmospheric temperature excursions and ambient air quality alerts are processed via separate dedicated telemetry pipelines under <a href="/live-climate" style={{ color: '#38bdf8', textDecoration: 'underline' }}>Live Monitoring</a> and <a href="/alerts" style={{ color: '#38bdf8', textDecoration: 'underline' }}>Alerts</a>.
        </div>
      </div>

      {insufficient && <div className="forecast-insufficient" role="status"><Info size={18} /><div><strong>More history is needed for this horizon.</strong><span>{data.forecast.limitation}</span></div></div>}

      <div className="summary-grid">
        <SummaryCard label="Actual days" value={data.dataQuality.observedDays} detail={`${data.dataQuality.activityCount} valid records`} icon={CalendarClock} />
        <SummaryCard label="Recent baseline" value={formatKg(data.forecast.baselineDailyAverage)} detail="Trailing 7-day daily average" icon={TrendingUp} tone="blue" />
        <SummaryCard label="Forecast days" value={projected.length} detail={insufficient ? 'Not projected' : 'Modeled horizon'} icon={BarChart3} tone="amber" />
      </div>

      <ChartCard title="Actual emissions and forecast" description={`Method: ${data.forecast.method}. Historical period: ${data.period.startDate} to ${data.period.endDate}.`}>
        <div className="forecast-chart"><Line data={chartData} options={chartOptions} /></div>
        <p className="forecast-limitation">Assumption: {data.forecast.limitation}</p>
      </ChartCard>

      <div className="forecast-detail-grid">
        <ChartCard title="Forecast method" description="An explainable baseline, not a guarantee.">
          <div className="forecast-method"><strong>{data.forecast.method}</strong><p>Each projected day uses the average of the most recent seven calendar-day totals. This is appropriate as a simple baseline when the available history is limited.</p><small>It does not model seasonality, weather, planned travel, behavioral changes, or confidence intervals.</small></div>
        </ChartCard>
        <ChartCard title="Anomalies" description="High observed days flagged by a transparent rule.">
          {data.anomalies.length === 0 ? <div className="empty-inline"><Info size={20} />No unusual observed days were detected in this period.</div> : <div className="anomaly-list">{data.anomalies.map((anomaly) => <article className="forecast-anomaly-card" key={anomaly.date}><div className="anomaly-card-top"><AlertTriangle size={19} /><strong>{anomaly.date}</strong><span>{anomaly.categoryLabel}</span></div><p>{anomaly.explanation}</p><small>Category total: {formatKg(anomaly.categoryEmissions)} · Baseline: {formatKg(anomaly.baselineDailyAverage)}</small><button className="text-button" type="button" onClick={() => setExpandedAnomaly(expandedAnomaly === anomaly.date ? null : anomaly.date)}>{expandedAnomaly === anomaly.date ? 'Hide related records' : `Inspect ${anomaly.activityRecords.length} related record(s)`}</button>{expandedAnomaly === anomaly.date && <div className="related-record-list">{anomaly.activityRecords.map((record) => <div key={`${anomaly.date}-${record.id}`}><span>{record.categoryLabel}</span><strong>{formatKg(record.emissions)}</strong><small>Record #{record.id ?? 'unavailable'}</small></div>)}</div>}</article>)}</div>}
        </ChartCard>
      </div>
    </Layout>
  );
};

export default ForecastAnomalies;
