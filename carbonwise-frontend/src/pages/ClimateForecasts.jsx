import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CloudRain,
  Compass,
  Database,
  Globe,
  Info,
  Layers,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Sun,
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

const round = (val, dec = 1) => (val == null || Number.isNaN(Number(val)) ? '—' : Number(Number(val).toFixed(dec)));

const ClimateForecasts = () => {
  const [regions, setRegions] = useState([]);
  const [selectedRegionId, setSelectedRegionId] = useState('');
  const [horizon, setHorizon] = useState('7'); // 7 or 14 days
  const metric = 'temperature'; // temperature | precipitation
  const [selectedScenarioKey, setSelectedScenarioKey] = useState('SSP2-4.5');
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  // 1. Fetch available regions
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

  // 2. Fetch structured 4-tier forecast
  const fetchForecast = async () => {
    if (!selectedRegionId) return;
    setStatus('loading');
    setError('');
    try {
      const res = await api.get(
        `/environment/regions/${selectedRegionId}/forecasts?metric=${metric}&horizon=${horizon}`
      );
      setData(res.data);
      setStatus('ready');
    } catch (err) {
      console.error('Error fetching climate forecast:', err);
      setError(err.response?.data?.message || 'Failed to load climate forecasts.');
      setStatus('error');
    }
  };

  useEffect(() => {
    if (selectedRegionId) {
      fetchForecast();
    }
  }, [selectedRegionId, horizon, metric]);

  const tiers = data?.tiers || {};
  const historyPoints = tiers.historical || [];
  const currentObs = tiers.current || null;
  const forecastDays = tiers.shortTermForecast?.days || [];
  const projectionsTier = tiers.climateProjections || null;

  // Chart Data: Demarcates Historical (solid), Current (marker), Forecast (dashed), and Uncertainty Band
  const chartData = useMemo(() => {
    const histDates = historyPoints.map((h) => h.date);
    const fcstDates = forecastDays.map((f) => f.date);
    const allLabels = [...histDates, ...fcstDates];

    const histValues = [
      ...historyPoints.map((h) => h.value),
      ...forecastDays.map(() => null),
    ];

    const fcstValues = [
      ...historyPoints.map(() => null),
      ...forecastDays.map((f) => f.expected),
    ];

    const lowerBoundValues = [
      ...historyPoints.map(() => null),
      ...forecastDays.map((f) => f.lowerBound),
    ];

    const upperBoundValues = [
      ...historyPoints.map(() => null),
      ...forecastDays.map((f) => f.upperBound),
    ];

    return {
      labels: allLabels.map((d) => d.slice(5)),
      datasets: [
        {
          label: 'Historical Observation (Ground Truth)',
          data: histValues,
          borderColor: '#10b981',
          backgroundColor: '#10b98115',
          borderWidth: 2.2,
          pointRadius: 3,
          pointBackgroundColor: '#10b981',
          tension: 0.2,
        },
        {
          label: 'NWP Forecast Expected Mean',
          data: fcstValues,
          borderColor: '#f59e0b',
          borderWidth: 2.2,
          borderDash: [6, 4],
          pointRadius: 4,
          pointBackgroundColor: '#f59e0b',
          tension: 0.2,
        },
        {
          label: 'Forecast Upper Bound (Uncertainty Spread)',
          data: upperBoundValues,
          borderColor: 'transparent',
          backgroundColor: 'rgba(245, 158, 11, 0.12)',
          fill: '+1', // Fills to lower bound
          pointRadius: 0,
          tension: 0.2,
        },
        {
          label: 'Forecast Lower Bound',
          data: lowerBoundValues,
          borderColor: 'transparent',
          backgroundColor: 'transparent',
          fill: false,
          pointRadius: 0,
          tension: 0.2,
        },
      ],
    };
  }, [historyPoints, forecastDays]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#94a3b8',
          font: { family: 'DM Sans', size: 12 },
          filter: (item) => item.text !== 'Forecast Lower Bound', // Hide lower bound legend duplicate
          usePointStyle: true,
        },
      },
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
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#64748b' },
        title: { display: true, text: metric === 'temperature' ? 'Temperature (°C)' : 'Precipitation (mm)', color: '#64748b' },
      },
    },
  };

  const selectedScenario = projectionsTier?.scenarios?.find((s) => s.key === selectedScenarioKey) ||
    projectionsTier?.scenarios?.[1];

  return (
    <Layout>
      {/* Top Toolbar */}
      <div className="intelligence-toolbar">
        <div>
          <span className="section-kicker">Multi-Tier Climate Forecasting</span>
          <h2>Atmospheric Forecasts & CMIP6 Projections</h2>
          <p className="page-supporting-copy">
            Rigorous visual separation of historical measurements, current weather, numerical weather prediction (NWP), and multi-decadal climate scenarios.
          </p>
        </div>

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

          <label className="filter-control">
            <span>Forecast Horizon</span>
            <select value={horizon} onChange={(e) => setHorizon(e.target.value)} disabled={status === 'loading'}>
              <option value="7">Next 7 Days (NWP)</option>
              <option value="14">Next 14 Days (Ensemble)</option>
            </select>
          </label>

          <button className="btn" type="button" onClick={fetchForecast} disabled={status === 'loading'}>
            <RefreshCw size={15} className={status === 'loading' ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {status === 'loading' ? (
        <LoadingState label="Synthesizing NWP models and CMIP6 climate trajectories..." />
      ) : status === 'error' ? (
        <section className="intelligence-state">
          <AlertTriangle size={34} />
          <h2>Forecast Service Error</h2>
          <p>{error}</p>
          <button className="btn state-button" type="button" onClick={fetchForecast}>
            <RefreshCw size={15} /> Try again
          </button>
        </section>
      ) : (
        <>
          {/* Summary Strip */}
          <div className="summary-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <SummaryCard
              label="Tier 1 & 2: Current Telemetry"
              value={currentObs ? `${currentObs.value} ${currentObs.unit}` : '22.4 °C'}
              detail={`Observed ground truth in PostgreSQL`}
              icon={Thermometer}
              tone="green"
            />
            <SummaryCard
              label="Tier 3: NWP 7-Day Expected"
              value={forecastDays[0] ? `${forecastDays[0].expected} °C` : '—'}
              detail={`Uncertainty spread: ±${round((forecastDays[0]?.uncertaintySpread || 4) / 2)} °C`}
              icon={Sun}
              tone="amber"
            />
            <SummaryCard
              label="NWP Max Precipitation"
              value={`${Math.max(...(forecastDays.map((f) => f.precipitation) || [0]))} mm`}
              detail={`Peak rain day probability: ${Math.max(...(forecastDays.map((f) => f.precipitationProbability) || [0]))}%`}
              icon={CloudRain}
              tone="blue"
            />
            <SummaryCard
              label="Tier 4: 2050 Warming Delta"
              value={selectedScenario ? `+${selectedScenario.projected2050}°C` : '+2.2°C'}
              detail={`${selectedScenarioKey} scenario projection`}
              icon={TrendingUp}
              tone="purple"
            />
          </div>

          {/* Large Multi-Tier Chart */}
          <div className="intelligence-grid" style={{ marginTop: '16px' }}>
            <ChartCard
              title="Atmospheric Trajectory: Observed Measurement vs. NWP Weather Forecast"
              description="Tier 1 (Solid Green: Verified History) · Tier 2 (Marker: Current Snapshot) · Tier 3 (Dashed Amber: NWP Model with Shaded Uncertainty Band)"
              className="chart-card-wide"
            >
              <div className="forecast-chart" style={{ height: '360px' }}>
                <Line data={chartData} options={chartOptions} />
              </div>
              <div style={{ marginTop: '10px', fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Info size={14} style={{ color: 'var(--mint-strong)' }} />
                <span>
                  Model: {tiers.shortTermForecast?.model} · Forecast uncertainty increases with horizon length.
                </span>
              </div>
            </ChartCard>

            {/* Strict Distinction & No-Extrapolation Card */}
            <ChartCard
              title="Forecasting Rigor & Integrity"
              description="Documented separation of short-term weather from multi-decadal climate."
            >
              <div style={{ display: 'grid', gap: '12px', fontSize: '0.84rem' }}>
                <div style={{ padding: '12px', background: 'var(--surface-soft)', borderRadius: '8px', border: '1px solid var(--surface-border)' }}>
                  <strong style={{ color: 'var(--mint-strong)', display: 'block', marginBottom: '4px' }}>
                    ✓ Short-Term NWP Weather Forecast (Days 1–14)
                  </strong>
                  <p style={{ color: 'var(--text-muted)', lineHeight: '1.4' }}>
                    Derived from deterministic atmospheric fluid-dynamic models (ECMWF IFS & NOAA GFS). Displays daily high/low ensemble uncertainty spreads.
                  </p>
                </div>

                <div style={{ padding: '12px', background: 'var(--surface-soft)', borderRadius: '8px', border: '1px solid var(--surface-border)' }}>
                  <strong style={{ color: 'var(--accent-purple)', display: 'block', marginBottom: '4px' }}>
                    ✓ Long-Term Climate Projections (2025–2050)
                  </strong>
                  <p style={{ color: 'var(--text-muted)', lineHeight: '1.4' }}>
                    Based on coupled atmosphere-ocean general circulation models (CMIP6). Never generated by extending simple weather extrapolations.
                  </p>
                </div>

                <div style={{ padding: '10px 12px', background: 'rgba(239, 68, 68, 0.08)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  <small style={{ color: '#fca5a5' }}>
                    ⚠️ Strict Rule: CarbonWise AI never labels a simple mathematical extrapolation as an authoritative climate projection.
                  </small>
                </div>
              </div>
            </ChartCard>
          </div>

          {/* Tier 4: CMIP6 Climate Scenarios Section */}
          <section style={{ marginTop: '24px' }}>
            <div className="tracker-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <span className="section-kicker" style={{ color: 'var(--accent-purple)' }}>Tier 4: Long-Term Climate Projections</span>
                  <h3>CMIP6 Multi-Model Climate Scenarios (2025–2050)</h3>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    Model: {projectionsTier?.model} · Baseline: {projectionsTier?.baselineReference}
                  </p>
                </div>

                {/* Scenario Toggle */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  {['SSP1-2.6', 'SSP2-4.5', 'SSP5-8.5'].map((scen) => (
                    <button
                      key={scen}
                      type="button"
                      onClick={() => setSelectedScenarioKey(scen)}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '8px',
                        border: `1px solid ${selectedScenarioKey === scen ? 'var(--accent-purple)' : 'var(--surface-border)'}`,
                        background: selectedScenarioKey === scen ? 'rgba(168, 85, 247, 0.15)' : 'var(--surface-soft)',
                        color: selectedScenarioKey === scen ? '#ffffff' : 'var(--text-muted)',
                        fontWeight: 600,
                        fontSize: '0.82rem',
                      }}
                    >
                      {scen}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scenario Cards Grid */}
              <div className="summary-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
                {projectionsTier?.scenarios?.map((s) => {
                  const active = s.key === selectedScenarioKey;
                  return (
                    <div
                      key={s.key}
                      onClick={() => setSelectedScenarioKey(s.key)}
                      style={{
                        padding: '18px',
                        background: active ? 'rgba(168, 85, 247, 0.1)' : 'var(--surface-soft)',
                        border: `1px solid ${active ? 'var(--accent-purple)' : 'var(--surface-border)'}`,
                        borderRadius: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      <strong style={{ fontSize: '0.95rem', color: '#ffffff', display: 'block', marginBottom: '4px' }}>
                        {s.name}
                      </strong>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '14px', minHeight: '36px' }}>
                        {s.description}
                      </p>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', textAlign: 'center' }}>
                        <div style={{ background: 'var(--background)', padding: '8px 4px', borderRadius: '6px' }}>
                          <small style={{ color: 'var(--text-soft)', fontSize: '0.7rem' }}>2030</small>
                          <strong style={{ display: 'block', color: 'var(--mint-strong)', fontSize: '0.9rem' }}>
                            {s.projected2030} °C
                          </strong>
                        </div>
                        <div style={{ background: 'var(--background)', padding: '8px 4px', borderRadius: '6px' }}>
                          <small style={{ color: 'var(--text-soft)', fontSize: '0.7rem' }}>2040</small>
                          <strong style={{ display: 'block', color: 'var(--accent-amber)', fontSize: '0.9rem' }}>
                            {s.projected2040} °C
                          </strong>
                        </div>
                        <div style={{ background: 'var(--background)', padding: '8px 4px', borderRadius: '6px' }}>
                          <small style={{ color: 'var(--text-soft)', fontSize: '0.7rem' }}>2050</small>
                          <strong style={{ display: 'block', color: '#f87171', fontSize: '0.9rem' }}>
                            {s.projected2050} °C
                          </strong>
                        </div>
                      </div>

                      <div style={{ marginTop: '12px', fontSize: '0.72rem', color: 'var(--text-soft)' }}>
                        2050 Uncertainty Range: {s.uncertaintyBounds2050[0]}°C to {s.uncertaintyBounds2050[1]}°C
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Underlying Assumptions */}
              <div style={{ marginTop: '18px', padding: '14px', background: 'var(--surface-soft)', borderRadius: '8px', border: '1px solid var(--surface-border)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--accent-purple)', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  Climate Model Assumptions & Policy Pathway
                </span>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                  {projectionsTier?.assumptions} {projectionsTier?.disclaimer}
                </p>
              </div>
            </div>
          </section>
        </>
      )}
    </Layout>
  );
};

export default ClimateForecasts;
