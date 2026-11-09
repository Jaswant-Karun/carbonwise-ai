import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  CloudRain,
  Database,
  Droplets,
  HelpCircle,
  Info,
  MapPin,
  RefreshCw,
  Thermometer,
  TrendingUp,
  Wind,
} from 'lucide-react';
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
import ChartCard from '../components/ChartCard';
import LoadingState from '../components/LoadingState';
import SummaryCard from '../components/SummaryCard';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const METRIC_CONFIGS = {
  temperature: { label: 'Temperature', unit: '°C', icon: Thermometer, color: '#f59e0b', baselineRef: 21.5 },
  precipitation: { label: 'Precipitation', unit: 'mm', icon: CloudRain, color: '#38bdf8', baselineRef: 65.0 },
  relative_humidity: { label: 'Relative Humidity', unit: '%', icon: Droplets, color: '#10b981', baselineRef: 60.0 },
  wind_speed: { label: 'Wind Speed', unit: 'km/h', icon: Wind, color: '#a855f7', baselineRef: 14.0 },
};

const ClimateTrends = () => {
  const [regions, setRegions] = useState([]);
  const [selectedRegionId, setSelectedRegionId] = useState('');
  const [resolution, setResolution] = useState('daily'); // daily | monthly | annual
  const [metricKey, setMetricKey] = useState('temperature');
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  // 1. Load available regions
  useEffect(() => {
    let isMounted = true;
    const fetchRegions = async () => {
      try {
        const res = await api.get('/environment/regions');
        if (isMounted && res.data?.length > 0) {
          setRegions(res.data);
          setSelectedRegionId(String(res.data[0].id));
        } else if (isMounted) {
          setStatus('empty');
        }
      } catch {
        if (isMounted) {
          setError('Unable to load environmental regions.');
          setStatus('error');
        }
      }
    };
    fetchRegions();
    return () => { isMounted = false; };
  }, []);

  // 2. Fetch trends for selected region, metric, and resolution
  const fetchTrends = async () => {
    if (!selectedRegionId) return;
    setStatus('loading');
    setError('');
    try {
      const res = await api.get(
        `/environment/regions/${selectedRegionId}/trends?resolution=${resolution}&metric=${metricKey}&includeReference=true`
      );
      setData(res.data);
      setStatus('ready');
    } catch (err) {
      console.error('Error fetching climate trends:', err);
      setError(err.response?.data?.message || 'Failed to load climate trends dataset.');
      setStatus('error');
    }
  };

  useEffect(() => {
    if (selectedRegionId) {
      fetchTrends();
    }
  }, [selectedRegionId, resolution, metricKey]);

  const activeConfig = METRIC_CONFIGS[metricKey] || METRIC_CONFIGS.temperature;

  // Chart.js Data Preparation
  const chartData = useMemo(() => {
    const points = data?.timeSeries || [];
    const trendPoints = data?.trend?.trendPoints || [];

    const labels = points.map((p) => {
      if (resolution === 'annual') return p.date;
      if (resolution === 'monthly') return p.date;
      return p.date.slice(5); // MM-DD for daily
    });

    const values = points.map((p) => (p.isMissing ? null : p.value));
    const trendValues = trendPoints.map((tp) => tp.value);

    return {
      labels,
      datasets: [
        {
          label: `Observed ${activeConfig.label} (${activeConfig.unit})`,
          data: values,
          borderColor: activeConfig.color,
          backgroundColor: `${activeConfig.color}15`,
          borderWidth: 2.2,
          pointRadius: points.length > 50 ? 0 : 3,
          pointHoverRadius: 6,
          pointBackgroundColor: activeConfig.color,
          fill: true,
          tension: 0.25,
          spanGaps: false, // Breaks line over missing dates without fabricating data
        },
        {
          label: `OLS Linear Trend (${data?.trend?.ratePerDecade != null ? `${data.trend.ratePerDecade > 0 ? '+' : ''}${data.trend.ratePerDecade} ${activeConfig.unit}/decade` : 'Trend'})`,
          data: trendValues,
          borderColor: '#e2e8f0',
          borderWidth: 1.8,
          borderDash: [6, 4],
          pointRadius: 0,
          fill: false,
          tension: 0,
        },
      ],
    };
  }, [data, activeConfig, resolution]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: { color: '#94a3b8', font: { family: 'DM Sans', size: 12 }, usePointStyle: true },
      },
      tooltip: {
        backgroundColor: '#0e1626',
        borderColor: '#1e2c44',
        borderWidth: 1,
        titleColor: '#f1f5f9',
        bodyColor: '#94a3b8',
        callbacks: {
          label: (ctx) => {
            if (ctx.raw == null) return `${ctx.dataset.label}: Missing observation`;
            return `${ctx.dataset.label}: ${ctx.raw} ${activeConfig.unit}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#64748b', maxTicksLimit: 14 },
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#64748b' },
        title: { display: true, text: `${activeConfig.label} (${activeConfig.unit})`, color: '#64748b' },
      },
    },
  };

  const trend = data?.trend || {};
  const refComp = data?.referenceComparison || {};
  const isInsufficient = data?.status === 'insufficient_history';

  return (
    <Layout>
      {/* Top Header & Navigation Strip */}
      <div className="intelligence-toolbar">
        <div>
          <span className="section-kicker">Empirical Climate Analytics</span>
          <h2>Climate Trends & Historical Reference</h2>
          <p className="page-supporting-copy">
            Deterministic daily, monthly, and annual trends compared against standard WMO 1991–2020 climatological normals.
          </p>
        </div>

        {/* Region & Controls Selector */}
        <div className="live-climate-controls">
          <label className="filter-control">
            <span>Location</span>
            <select
              value={selectedRegionId}
              onChange={(e) => setSelectedRegionId(e.target.value)}
              disabled={status === 'loading'}
            >
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} {r.country ? `(${r.country})` : ''}
                </option>
              ))}
            </select>
          </label>

          <button className="btn" type="button" onClick={fetchTrends} disabled={status === 'loading'}>
            <RefreshCw size={15} className={status === 'loading' ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Resolution & Metric Selection Strip */}
      <section className="tracker-card" style={{ marginBottom: '18px', padding: '14px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          {/* Metric Selector Buttons */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {Object.entries(METRIC_CONFIGS).map(([key, cfg]) => {
              const Icon = cfg.icon;
              const active = metricKey === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMetricKey(key)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    background: active ? `${cfg.color}20` : 'var(--surface-soft)',
                    border: `1px solid ${active ? cfg.color : 'var(--surface-border)'}`,
                    borderRadius: '8px',
                    color: active ? '#ffffff' : 'var(--text-muted)',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                  }}
                >
                  <Icon size={15} style={{ color: cfg.color }} />
                  {cfg.label}
                </button>
              );
            })}
          </div>

          {/* Resolution Selector Tabs */}
          <div style={{ display: 'flex', background: 'var(--surface-soft)', padding: '3px', borderRadius: '8px', border: '1px solid var(--surface-border)' }}>
            {['daily', 'monthly', 'annual'].map((res) => (
              <button
                key={res}
                type="button"
                onClick={() => setResolution(res)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: 0,
                  background: resolution === res ? 'var(--primary-dark)' : 'transparent',
                  color: resolution === res ? '#ffffff' : 'var(--text-muted)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  textTransform: 'capitalize',
                }}
              >
                {res}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Main Content State */}
      {status === 'loading' ? (
        <LoadingState label="Calculating empirical climate trends and normal baselines..." />
      ) : status === 'error' ? (
        <section className="intelligence-state">
          <AlertTriangle size={34} />
          <h2>Dataset Query Error</h2>
          <p>{error}</p>
          <button className="btn state-button" type="button" onClick={fetchTrends}>
            <RefreshCw size={15} /> Try again
          </button>
        </section>
      ) : isInsufficient ? (
        <div className="forecast-insufficient" role="status" style={{ margin: '20px 0' }}>
          <Info size={20} />
          <div>
            <strong>Insufficient historical observations for {activeConfig.label} trend calculation.</strong>
            <span>At least 3 valid intervals are required to calculate regression slopes without fabricating data. Continuous ingestion will populate this series.</span>
          </div>
        </div>
      ) : (
        <>
          {/* Key Trend Summary Strip */}
          <div className="summary-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <SummaryCard
              label="Observed Period Mean"
              value={refComp.observedMean != null ? `${refComp.observedMean} ${activeConfig.unit}` : '—'}
              detail={`Calculated over ${data?.sampleCount || 0} ${resolution} intervals`}
              icon={activeConfig.icon}
              tone="blue"
            />
            <SummaryCard
              label="1991–2020 Reference Delta"
              value={
                refComp.anomaly != null
                  ? `${refComp.anomaly > 0 ? '+' : ''}${refComp.anomaly} ${activeConfig.unit}`
                  : 'Baseline nominal'
              }
              detail={refComp.interpretation || 'WMO standard climate normal comparison'}
              icon={TrendingUp}
              tone={refComp.anomaly > 0 ? 'amber' : 'green'}
            />
            <SummaryCard
              label="Decadal Rate of Change"
              value={
                trend.ratePerDecade != null
                  ? `${trend.ratePerDecade > 0 ? '+' : ''}${trend.ratePerDecade} ${activeConfig.unit}/dec`
                  : 'Stable'
              }
              detail={`Linear OLS slope (R² = ${trend.rSquared ?? 0})`}
              icon={trend.direction === 'warming' || trend.direction === 'wetter' ? ArrowUpRight : ArrowDownRight}
              tone={trend.direction === 'warming' ? 'amber' : 'green'}
            />
            <SummaryCard
              label="Data Source & Integrity"
              value={data?.hasGaps ? `${data.dateGaps.length} missing dates` : '100% complete'}
              detail={data?.dataSource || 'NASA POWER / PostgreSQL'}
              icon={Database}
              tone={data?.hasGaps ? 'amber' : 'green'}
            />
          </div>

          {/* Large Time-Series Chart */}
          <div className="intelligence-grid" style={{ marginTop: '16px' }}>
            <ChartCard
              title={`${data?.region?.name || 'Regional'} ${activeConfig.label} Trend (${resolution.toUpperCase()})`}
              description={`Observed data: ${data?.startDate || '—'} to ${data?.endDate || '—'} · Source: ${data?.dataSource || 'PostgreSQL Ground Truth'}`}
              className="chart-card-wide"
            >
              <div className="forecast-chart" style={{ height: '360px' }}>
                <Line data={chartData} options={chartOptions} />
              </div>
              {data?.hasGaps && (
                <div style={{ marginTop: '8px', fontSize: '0.75rem', color: 'var(--accent-amber)' }}>
                  ⚠️ {data.dateGaps.length} missing observation day(s) detected in timeseries (represented as gaps without interpolation).
                </div>
              )}
            </ChartCard>

            {/* Reference Climatology & Method Limitations Card */}
            <ChartCard
              title="Methodology & Climatological Limitations"
              description="Transparent mathematical models conforming to WMO Task Team on Climate Guidelines."
            >
              <div style={{ display: 'grid', gap: '14px', fontSize: '0.84rem' }}>
                <div style={{ padding: '12px', background: 'var(--surface-soft)', borderRadius: '8px', border: '1px solid var(--surface-border)' }}>
                  <strong style={{ color: '#ffffff', display: 'block', marginBottom: '4px' }}>
                    Reference Period: {refComp.referencePeriod}
                  </strong>
                  <p style={{ color: 'var(--text-muted)', lineHeight: '1.4' }}>
                    Climatological normal: <strong>{refComp.referenceBaseline} {activeConfig.unit}</strong>.
                    Standard reference periods define baseline climate state over 30 years to contextualize anthropogenic shift.
                  </p>
                </div>

                <div style={{ padding: '12px', background: 'var(--surface-soft)', borderRadius: '8px', border: '1px solid var(--surface-border)' }}>
                  <strong style={{ color: '#ffffff', display: 'block', marginBottom: '4px' }}>
                    Statistical Trend Model: {trend.method}
                  </strong>
                  <p style={{ color: 'var(--text-muted)', lineHeight: '1.4' }}>
                    {trend.limitations}
                  </p>
                </div>

                <div style={{ padding: '10px 12px', background: 'var(--surface-soft)', borderRadius: '8px', border: '1px solid var(--surface-border)' }}>
                  <small style={{ color: 'var(--text-soft)' }}>
                    Attribution: {data?.attribution || 'NASA Langley Research Center POWER Project / Open-Meteo Weather APIs'}.
                  </small>
                </div>
              </div>
            </ChartCard>
          </div>
        </>
      )}
    </Layout>
  );
};

export default ClimateTrends;
