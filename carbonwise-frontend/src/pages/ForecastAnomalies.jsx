import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Building2,
  Calendar,
  CalendarClock,
  Car,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Droplets,
  HelpCircle,
  History,
  Info,
  Leaf,
  Minus,
  Package,
  Recycle,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Utensils,
  Zap,
} from 'lucide-react';
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
import { Line } from 'react-chartjs-2';
import { Link } from 'react-router-dom';
import api from '../services/api';
import Layout from '../components/Layout';
import ChartCard from '../components/ChartCard';
import LoadingState from '../components/LoadingState';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

const CATEGORY_ICONS = {
  food: Utensils,
  electricity: Zap,
  transport: Car,
  water: Droplets,
  waste: Recycle,
  facilities: Building2,
  other: Package,
};

const CATEGORY_COLORS = {
  food: '#10b981',
  electricity: '#f59e0b',
  transport: '#3b82f6',
  water: '#06b6d4',
  waste: '#8b5cf6',
  facilities: '#ec4899',
  other: '#64748b',
};

const roundVal = (val, d = 2) => {
  const n = Number(val);
  return Number.isFinite(n) ? Number(n.toFixed(d)) : 0;
};

const ForecastAnomalies = () => {
  // Navigation & Filter State
  const [period, setPeriod] = useState('90'); // 30, 90, 365
  const [horizon, setHorizon] = useState('30'); // 7, 30, 90
  const [unit, setUnit] = useState('kg'); // 'kg' or 'tonnes'

  // Data State
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Accordion & Detail State
  const [expandedAnomaly, setExpandedAnomaly] = useState(null);

  // What-If Reduction Scenario State (Percentages 0% - 50%)
  const [reductions, setReductions] = useState({
    electricity: 15,
    transport: 20,
    food: 15,
    waste: 10,
    other: 0,
  });

  const fetchForecast = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setStatus('loading');
    setError('');

    try {
      const response = await api.get(`/forecast?period=${period}&horizon=${horizon}`);
      setData(response.data);
      setStatus('ready');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load carbon emission forecast.');
      setStatus('error');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchForecast();
  }, [period, horizon]);

  // Handle What-If Slider Changes
  const handleSliderChange = (category, value) => {
    setReductions((prev) => ({
      ...prev,
      [category]: Math.max(0, Math.min(50, Number(value))),
    }));
  };

  const resetWhatIf = () => {
    setReductions({
      electricity: 0,
      transport: 0,
      food: 0,
      waste: 0,
      other: 0,
    });
  };

  // Reactive Client-Side What-If Scenario Calculation
  const whatIfResults = useMemo(() => {
    if (!data?.categoryPredictions || !data?.forecast?.totalProjectedKg) {
      return null;
    }

    const horizonDays = Number(horizon);
    const baselineTotalKg = data.forecast.totalProjectedKg;
    let simulatedDailyTotal = 0;

    data.categoryPredictions.forEach((cat) => {
      let reductionPct = 0;
      if (cat.category === 'electricity') reductionPct = reductions.electricity;
      else if (cat.category === 'transport') reductionPct = reductions.transport;
      else if (cat.category === 'food') reductionPct = reductions.food;
      else if (cat.category === 'waste') reductionPct = reductions.waste;
      else reductionPct = reductions.other;

      const rate = Math.min(100, Math.max(0, Number(reductionPct))) / 100;
      const reducedDaily = (cat.historicalDailyAvg || 0) * (1 - rate);
      simulatedDailyTotal += reducedDaily;
    });

    const simulatedTotalKg = roundVal(simulatedDailyTotal * horizonDays);
    const potentialSavingsKg = roundVal(Math.max(0, baselineTotalKg - simulatedTotalKg));
    const potentialSavingsTonnes = roundVal(potentialSavingsKg / 1000.0, 4);
    const simulatedFutureTonnes = roundVal(simulatedTotalKg / 1000.0, 4);
    const percentageReduction = baselineTotalKg > 0 ? roundVal((potentialSavingsKg / baselineTotalKg) * 100, 1) : 0;

    return {
      baselineTotalKg,
      baselineTotalTonnes: roundVal(baselineTotalKg / 1000.0, 4),
      simulatedTotalKg,
      simulatedFutureTonnes,
      potentialSavingsKg,
      potentialSavingsTonnes,
      percentageReduction,
    };
  }, [data, horizon, reductions]);

  // Chart Data with 95% Confidence Interval Envelope
  const chartData = useMemo(() => {
    const actual = data?.forecast?.actual || [];
    const projected = data?.forecast?.projected || [];
    const points = [...actual, ...projected];

    const labels = points.map((point) => point.date.slice(5)); // 'MM-DD'
    const isTonnes = unit === 'tonnes';
    const scale = isTonnes ? 0.001 : 1;

    const actualSeries = [
      ...actual.map((p) => roundVal(p.emissions * scale, 3)),
      ...projected.map(() => null),
    ];

    const projectedSeries = [
      ...actual.map(() => null),
      ...projected.map((p) => roundVal((p.projectedEmissions ?? p.emissions) * scale, 3)),
    ];

    const upperBoundSeries = [
      ...actual.map(() => null),
      ...projected.map((p) => roundVal(p.upperBound * scale, 3)),
    ];

    const lowerBoundSeries = [
      ...actual.map(() => null),
      ...projected.map((p) => roundVal(p.lowerBound * scale, 3)),
    ];

    const datasets = [
      {
        label: `Actual Observations (${isTonnes ? 't CO₂e' : 'kg CO₂e'})`,
        data: actualSeries,
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.12)',
        fill: true,
        tension: 0.25,
        pointRadius: actual.length > 50 ? 1 : 3,
        pointHoverRadius: 5,
        borderWidth: 2,
      },
      {
        label: `Modeled Forecast (${isTonnes ? 't CO₂e' : 'kg CO₂e'})`,
        data: projectedSeries,
        borderColor: '#f59e0b',
        backgroundColor: 'transparent',
        borderDash: [6, 4],
        tension: 0.25,
        pointRadius: projected.length > 50 ? 1 : 3,
        pointHoverRadius: 5,
        borderWidth: 2.5,
      },
    ];

    if (data?.forecast?.sufficientData && projected.length > 0) {
      datasets.push(
        {
          label: '95% CI Upper Bound',
          data: upperBoundSeries,
          borderColor: 'rgba(245, 158, 11, 0.5)',
          borderDash: [2, 3],
          pointRadius: 0,
          fill: false,
          borderWidth: 1.2,
        },
        {
          label: '95% CI Uncertainty Band',
          data: lowerBoundSeries,
          borderColor: 'rgba(245, 158, 11, 0.5)',
          borderDash: [2, 3],
          pointRadius: 0,
          fill: '-1', // fills to dataset immediately preceding (upper bound)
          backgroundColor: 'rgba(245, 158, 11, 0.08)',
          borderWidth: 1.2,
        }
      );
    }

    return { labels, datasets };
  }, [data, unit]);

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
          boxHeight: 12,
          usePointStyle: true,
          padding: 16,
          font: { size: 12, weight: '500' },
          filter: (legendItem) => legendItem.text !== '95% CI Upper Bound',
        },
      },
      tooltip: {
        backgroundColor: '#0f172a',
        titleColor: '#f8fafc',
        bodyColor: '#cbd5e1',
        borderColor: 'rgba(255, 255, 255, 0.12)',
        borderWidth: 1,
        padding: 12,
        callbacks: {
          label: (context) => {
            const val = context.raw;
            if (val === null || val === undefined) return null;
            const unitLabel = unit === 'tonnes' ? 't CO₂e' : 'kg CO₂e';
            return ` ${context.dataset.label}: ${val} ${unitLabel}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.04)' },
        ticks: { color: '#64748b', maxTicksLimit: 14, font: { size: 11 } },
      },
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(255, 255, 255, 0.06)' },
        ticks: { color: '#64748b', font: { size: 11 } },
        title: {
          display: true,
          text: unit === 'tonnes' ? 'tonnes CO₂e' : 'kg CO₂e',
          color: '#94a3b8',
          font: { size: 11, weight: '600' },
        },
      },
    },
  };

  if (status === 'loading') {
    return (
      <Layout>
        <div className="forecast-page-container">
          <LoadingState label="Computing statistical forecast, uncertainty envelopes, and sector outlooks..." />
        </div>
      </Layout>
    );
  }

  if (status === 'error') {
    return (
      <Layout>
        <div className="forecast-page-container">
          <div className="forecast-error-state">
            <AlertTriangle size={36} className="text-amber" />
            <h2>Forecast Service Unavailable</h2>
            <p>{error}</p>
            <button className="btn btn-primary" type="button" onClick={() => fetchForecast(false)}>
              <RefreshCw size={16} /> Try Again
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  const forecast = data?.forecast || {};
  const isSufficient = Boolean(forecast.sufficientData);
  const dataQuality = data?.dataQuality || {};
  const outlooks = data?.outlooks || {};
  const anomalies = data?.anomalies || [];
  const explanation = data?.explanation || {};
  const categoryPredictions = data?.categoryPredictions || [];

  const displayTotal = unit === 'tonnes'
    ? `${forecast.totalProjectedTonnes || 0} t CO₂e`
    : `${forecast.totalProjectedKg || 0} kg CO₂e`;

  const altTotal = unit === 'tonnes'
    ? `${forecast.totalProjectedKg || 0} kg CO₂e`
    : `${forecast.totalProjectedTonnes || 0} t CO₂e`;

  return (
    <Layout>
      <div className="forecast-page-container">
        {/* Top Header & Platform Scope Banner */}
        <div className="forecast-header-row">
          <div>
            <div className="forecast-badge-pill">
              <Sparkles size={13} />
              <span>AI Carbon Intelligence & Forecasting</span>
            </div>
            <h1 className="forecast-page-title">Emission Predictions & Anomaly Intelligence</h1>
            <p className="forecast-page-subtitle">
              Scientifically-grounded time-series projections, 95% Gaussian confidence intervals, sector trend outlooks, and What-If reduction scenarios.
            </p>
          </div>

          <div className="forecast-action-controls">
            {/* Horizon Selector */}
            <div className="forecast-control-group">
              <span className="control-label">Forecast Horizon</span>
              <div className="pill-toggle-group">
                <button
                  type="button"
                  className={`pill-btn ${horizon === '7' ? 'active' : ''}`}
                  onClick={() => setHorizon('7')}
                >
                  7 Days
                </button>
                <button
                  type="button"
                  className={`pill-btn ${horizon === '30' ? 'active' : ''}`}
                  onClick={() => setHorizon('30')}
                >
                  30 Days (1 Mo)
                </button>
                <button
                  type="button"
                  className={`pill-btn ${horizon === '90' ? 'active' : ''}`}
                  onClick={() => setHorizon('90')}
                >
                  90 Days (1 Qtr)
                </button>
              </div>
            </div>

            {/* Historical Training Window */}
            <div className="forecast-control-group">
              <span className="control-label">Training Window</span>
              <select
                className="select-dropdown"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              >
                <option value="30">Last 30 Days</option>
                <option value="90">Last 90 Days</option>
                <option value="365">Last 12 Months</option>
              </select>
            </div>

            {/* Unit Toggle */}
            <div className="forecast-control-group">
              <span className="control-label">Reporting Unit</span>
              <div className="pill-toggle-group">
                <button
                  type="button"
                  className={`pill-btn ${unit === 'kg' ? 'active' : ''}`}
                  onClick={() => setUnit('kg')}
                >
                  kg CO₂e
                </button>
                <button
                  type="button"
                  className={`pill-btn ${unit === 'tonnes' ? 'active' : ''}`}
                  onClick={() => setUnit('tonnes')}
                >
                  tonnes
                </button>
              </div>
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              className={`btn-icon-refresh ${refreshing ? 'spinning' : ''}`}
              title="Refresh Forecast"
              onClick={() => fetchForecast(true)}
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {/* Independent Telemetry Architecture Banner */}
        <div className="forecast-telemetry-banner">
          <div className="telemetry-banner-icon">
            <ShieldCheck size={20} className="text-emerald" />
          </div>
          <div className="telemetry-banner-content">
            <strong>Independent Platform Architecture:</strong> Personal and organizational footprint forecasting is calculated strictly from verified activity records using OLS linear trend smoothing and Gaussian uncertainty. Regional atmospheric climate telemetry and ambient air quality alerts operate on separate pipelines under <Link to="/live-monitoring">Live Telemetry</Link> and <Link to="/alerts">Environmental Alerts</Link>.
          </div>
        </div>

        {/* Data Sufficiency Alert (when history is limited) */}
        {!isSufficient && (
          <div className="forecast-insufficient-alert">
            <AlertTriangle size={24} className="alert-icon-warning" />
            <div className="insufficient-alert-text">
              <strong>More Historical Activity Data Required for High Confidence</strong>
              <p>
                {forecast.limitation || `At least ${horizon === '30' ? 14 : 3} days with recorded emissions are needed to build a statistically valid projection for this horizon. Currently observed: ${dataQuality.observedDays || 0} active days.`}
              </p>
              <span className="zero-fabrication-note">
                🛡️ <em>CarbonWise AI Scientific Guarantee: We never fabricate synthetic or hallucinated numbers to fill empty charts.</em>
              </span>
            </div>
            <Link to="/activities" className="btn btn-secondary-emerald">
              Log Activity Entries <ArrowRight size={14} />
            </Link>
          </div>
        )}

        {/* Top KPI Summary Cards */}
        <div className="forecast-kpi-grid">
          {/* Card 1: Projected Total for Horizon */}
          <div className="forecast-kpi-card highlight-emerald">
            <div className="kpi-card-header">
              <span className="kpi-label">Projected Footprint ({horizon} Days)</span>
              <div className="kpi-icon-wrap emerald">
                <TrendingUp size={18} />
              </div>
            </div>
            <div className="kpi-primary-val">{displayTotal}</div>
            <div className="kpi-secondary-row">
              <span className="badge-alt-unit">{altTotal}</span>
              <span className="kpi-subtext">Run-rate: {forecast.baselineDailyAverage || 0} kg/day</span>
            </div>
          </div>

          {/* Card 2: Next Month vs Next Quarter */}
          <div className="forecast-kpi-card">
            <div className="kpi-card-header">
              <span className="kpi-label">Multi-Horizon Projections</span>
              <div className="kpi-icon-wrap amber">
                <CalendarClock size={18} />
              </div>
            </div>
            <div className="kpi-dual-values">
              <div>
                <small>Next 30 Days (1 Month)</small>
                <strong>
                  {unit === 'tonnes'
                    ? `${forecast.nextMonthTonnes || 0} t`
                    : `${forecast.nextMonthKg || 0} kg`}
                </strong>
              </div>
              <div className="kpi-divider-v" />
              <div>
                <small>Next 90 Days (1 Qtr)</small>
                <strong>
                  {unit === 'tonnes'
                    ? `${forecast.nextThreeMonthsTonnes || 0} t`
                    : `${forecast.nextThreeMonthsKg || 0} kg`}
                </strong>
              </div>
            </div>
            <div className="kpi-footer-note">Linear baseline extrapolation</div>
          </div>

          {/* Card 3: Historical Baseline Training Data */}
          <div className="forecast-kpi-card">
            <div className="kpi-card-header">
              <span className="kpi-label">Training Window Baseline</span>
              <div className="kpi-icon-wrap blue">
                <History size={18} />
              </div>
            </div>
            <div className="kpi-primary-val">
              {dataQuality.observedDays || 0}
              <span className="kpi-unit-tag">observed days</span>
            </div>
            <div className="kpi-secondary-row">
              <span className="kpi-subtext">
                {dataQuality.activityCount || 0} total valid logs in {period}d window
              </span>
            </div>
          </div>

          {/* Card 4: Statistical Confidence & Margin of Error */}
          <div className="forecast-kpi-card">
            <div className="kpi-card-header">
              <span className="kpi-label">95% Confidence Bounds</span>
              <div className="kpi-icon-wrap purple">
                <ShieldCheck size={18} />
              </div>
            </div>
            <div className="kpi-primary-val">
              ±{forecast.uncertainty?.marginOfError || 0}
              <span className="kpi-unit-tag">kg/day</span>
            </div>
            <div className="kpi-secondary-row">
              <span className={`kpi-status-badge ${isSufficient ? 'sufficient' : 'limited'}`}>
                {isSufficient ? 'Sufficient History' : 'Limited Sample Size'}
              </span>
              <span className="kpi-subtext">Gaussian z = 1.96</span>
            </div>
          </div>
        </div>

        {/* Primary Predictive Chart Card */}
        <div className="forecast-chart-card">
          <div className="chart-card-header-flex">
            <div>
              <div className="chart-section-title">
                <Activity size={18} className="text-emerald" />
                <h2>Historical Observations & Modeled Forecast ({horizon} Days)</h2>
              </div>
              <p className="chart-section-subtitle">
                Solid emerald denotes verified historical entries. Dashed amber indicates projected trajectory with a 95% confidence interval envelope.
              </p>
            </div>
            <div className="chart-legend-badges">
              <span className="legend-badge actual">
                <span className="legend-dot actual" /> Actual History
              </span>
              <span className="legend-badge forecast">
                <span className="legend-dot forecast" /> Forecast
              </span>
              <span className="legend-badge ci">
                <span className="legend-dot ci" /> 95% Confidence Band
              </span>
            </div>
          </div>

          <div className="forecast-chart-canvas-wrapper">
            <Line data={chartData} options={chartOptions} />
          </div>

          <div className="chart-card-footer">
            <Info size={15} />
            <span>
              <strong>Methodology:</strong> {forecast.method || 'Trailing 7-Day Weighted Baseline with OLS Trend & Gaussian Uncertainty'}. Historical training window: {data?.period?.startDate} to {data?.period?.endDate}.
            </span>
          </div>
        </div>

        {/* Category-Based Future Projections & Sector Outlooks */}
        <div className="forecast-section-box">
          <div className="section-box-header">
            <div>
              <h2 className="section-heading">Category-Based Forecast & Sector Outlooks</h2>
              <p className="section-subheading">
                Individual sector projections over the next {horizon} days with trend slope trajectories and targeted mitigation guidance.
              </p>
            </div>
            {outlooks.topFutureContributor && (
              <div className="top-contributor-tag">
                🎯 Top Future Driver: <strong>{outlooks.topFutureContributor.label}</strong> ({outlooks.topFutureContributor.shareOfFuture}%)
              </div>
            )}
          </div>

          {/* 7-Sector Projections Grid */}
          <div className="category-forecast-grid">
            {categoryPredictions.map((cat) => {
              const CatIcon = CATEGORY_ICONS[cat.category] || Package;
              const catColor = CATEGORY_COLORS[cat.category] || '#64748b';

              return (
                <div className="category-forecast-card" key={cat.category}>
                  <div className="cat-card-top">
                    <div className="cat-icon-title">
                      <div
                        className="cat-card-icon"
                        style={{ backgroundColor: `${catColor}1f`, color: catColor }}
                      >
                        <CatIcon size={18} />
                      </div>
                      <div>
                        <strong>{cat.label}</strong>
                        <span className="cat-run-rate">
                          Baseline: {cat.historicalDailyAvg || 0} kg/day
                        </span>
                      </div>
                    </div>

                    <div className={`trend-badge-pill ${cat.trendDirection}`}>
                      {cat.trendDirection === 'increasing' && <TrendingUp size={12} />}
                      {cat.trendDirection === 'decreasing' && <TrendingDown size={12} />}
                      {cat.trendDirection === 'stable' && <Minus size={12} />}
                      <span>{cat.trendDirection}</span>
                    </div>
                  </div>

                  <div className="cat-footprint-row">
                    <div className="cat-footprint-main">
                      {unit === 'tonnes'
                        ? `${cat.projectedTonnes} t CO₂e`
                        : `${cat.projectedKg} kg CO₂e`}
                    </div>
                    <div className="cat-footprint-share">
                      {cat.shareOfFuture}% of horizon
                    </div>
                  </div>

                  {/* Progress bar showing share */}
                  <div className="cat-share-bar-track">
                    <div
                      className="cat-share-bar-fill"
                      style={{
                        width: `${Math.min(100, Math.max(3, cat.shareOfFuture))}%`,
                        backgroundColor: catColor,
                      }}
                    />
                  </div>

                  <p className="cat-insight-text">{cat.insight}</p>
                </div>
              );
            })}
          </div>

          {/* Spotlight Sector Outlooks (Electricity, Transport, Food) */}
          <div className="sector-outlooks-row">
            {/* Electricity Outlook */}
            <div className="sector-outlook-card">
              <div className="outlook-header">
                <div className="outlook-icon-wrap amber">
                  <Zap size={18} />
                </div>
                <div>
                  <strong>Electricity Demand Outlook</strong>
                  <span className={`outlook-trend-tag ${outlooks.electricity?.trendDirection}`}>
                    Trend: {outlooks.electricity?.trendDirection || 'stable'}
                  </span>
                </div>
              </div>
              <p className="outlook-body-text">
                {outlooks.electricity?.trendDirection === 'increasing'
                  ? 'Electricity emissions show an upward trajectory. Inspect baseboard heating, continuous HVAC, or high-draw appliances to prevent peak-tariff penalties.'
                  : 'Power consumption remains stable. Consider solar micro-generation or off-peak load shifting to further reduce grid emissions.'}
              </p>
              <div className="outlook-footer-stat">
                Projected: <strong>{outlooks.electricity?.projectedKg || 0} kg CO₂e</strong> ({outlooks.electricity?.shareOfFuture || 0}% of horizon)
              </div>
            </div>

            {/* Transport Outlook */}
            <div className="sector-outlook-card">
              <div className="outlook-header">
                <div className="outlook-icon-wrap blue">
                  <Car size={18} />
                </div>
                <div>
                  <strong>Transportation Trajectory</strong>
                  <span className={`outlook-trend-tag ${outlooks.transport?.trendDirection}`}>
                    Trend: {outlooks.transport?.trendDirection || 'stable'}
                  </span>
                </div>
              </div>
              <p className="outlook-body-text">
                {outlooks.transport?.trendDirection === 'increasing'
                  ? 'Vehicle travel is trending upwards. Bundling errands, selecting public transit for city trips, or utilizing electric vehicle charging reduces travel impact.'
                  : 'Commuting footprint is stable. Shifting 20% of solo vehicle trips to cycling or transit yields significant compounding monthly savings.'}
              </p>
              <div className="outlook-footer-stat">
                Projected: <strong>{outlooks.transport?.projectedKg || 0} kg CO₂e</strong> ({outlooks.transport?.shareOfFuture || 0}% of horizon)
              </div>
            </div>

            {/* Food Outlook */}
            <div className="sector-outlook-card">
              <div className="outlook-header">
                <div className="outlook-icon-wrap emerald">
                  <Utensils size={18} />
                </div>
                <div>
                  <strong>Diet & Food Waste Outlook</strong>
                  <span className={`outlook-trend-tag ${outlooks.food?.trendDirection}`}>
                    Trend: {outlooks.food?.trendDirection || 'stable'}
                  </span>
                </div>
              </div>
              <p className="outlook-body-text">
                Dietary patterns contribute consistently to daily baseline emissions. Incorporating 2 plant-rich days per week and preventing kitchen food spoilage can eliminate up to 30% of this sector.
              </p>
              <div className="outlook-footer-stat">
                Projected: <strong>{outlooks.food?.projectedKg || 0} kg CO₂e</strong> ({outlooks.food?.shareOfFuture || 0}% of horizon)
              </div>
            </div>
          </div>
        </div>

        {/* Interactive What-If Carbon Reduction Simulator */}
        <div className="forecast-section-box whatif-simulator-container">
          <div className="section-box-header">
            <div>
              <div className="whatif-header-badge">
                <Sliders size={14} />
                <span>Decision Support Simulation</span>
              </div>
              <h2 className="section-heading">What-If Carbon Reduction Simulator</h2>
              <p className="section-subheading">
                Explore how targeted conservation actions across electricity, commuting, and diet can alter your projected footprint over the next {horizon} days.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={resetWhatIf}
              title="Reset all reduction sliders to 0%"
            >
              <RotateCcw size={14} /> Reset Scenarios
            </button>
          </div>

          <div className="whatif-grid-layout">
            {/* Interactive Sliders Column */}
            <div className="whatif-sliders-panel">
              <h3 className="whatif-panel-title">Targeted Sector Reductions</h3>

              {/* Electricity Slider */}
              <div className="whatif-slider-group">
                <div className="slider-label-row">
                  <span className="slider-title">
                    <Zap size={14} className="text-amber" /> Electricity Reduction
                  </span>
                  <span className="slider-val-badge amber">-{reductions.electricity}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="5"
                  value={reductions.electricity}
                  onChange={(e) => handleSliderChange('electricity', e.target.value)}
                  className="slider-control"
                />
                <span className="slider-hint">LED lighting, thermostat adjustments, eliminating standby power</span>
              </div>

              {/* Transport Slider */}
              <div className="whatif-slider-group">
                <div className="slider-label-row">
                  <span className="slider-title">
                    <Car size={14} className="text-blue" /> Transport & Commuting
                  </span>
                  <span className="slider-val-badge blue">-{reductions.transport}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="5"
                  value={reductions.transport}
                  onChange={(e) => handleSliderChange('transport', e.target.value)}
                  className="slider-control"
                />
                <span className="slider-hint">Trip combining, cycling, carpooling, or public transit</span>
              </div>

              {/* Food Slider */}
              <div className="whatif-slider-group">
                <div className="slider-label-row">
                  <span className="slider-title">
                    <Utensils size={14} className="text-emerald" /> Food Waste & Diet
                  </span>
                  <span className="slider-val-badge emerald">-{reductions.food}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="5"
                  value={reductions.food}
                  onChange={(e) => handleSliderChange('food', e.target.value)}
                  className="slider-control"
                />
                <span className="slider-hint">Zero meal wastage, plant-forward menus, seasonal produce</span>
              </div>

              {/* Waste Slider */}
              <div className="whatif-slider-group">
                <div className="slider-label-row">
                  <span className="slider-title">
                    <Recycle size={14} className="text-purple" /> Waste Diversion
                  </span>
                  <span className="slider-val-badge purple">-{reductions.waste}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="5"
                  value={reductions.waste}
                  onChange={(e) => handleSliderChange('waste', e.target.value)}
                  className="slider-control"
                />
                <span className="slider-hint">Composting organic waste, recycling paper, plastics, and metals</span>
              </div>

              {/* Other Slider */}
              <div className="whatif-slider-group">
                <div className="slider-label-row">
                  <span className="slider-title">
                    <Package size={14} className="text-slate" /> Facilities & General
                  </span>
                  <span className="slider-val-badge slate">-{reductions.other}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="5"
                  value={reductions.other}
                  onChange={(e) => handleSliderChange('other', e.target.value)}
                  className="slider-control"
                />
                <span className="slider-hint">Optimized heating/cooling, water pump run-times, eco-supplies</span>
              </div>
            </div>

            {/* Scenario Impact Dashboard Column */}
            <div className="whatif-impact-panel">
              <h3 className="whatif-panel-title">Simulated Scenario Impact</h3>

              {whatIfResults ? (
                <div className="whatif-results-content">
                  <div className="whatif-savings-hero">
                    <div className="savings-hero-label">Potential Avoided Emissions ({horizon} Days)</div>
                    <div className="savings-hero-number">
                      {unit === 'tonnes'
                        ? `${whatIfResults.potentialSavingsTonnes} t CO₂e`
                        : `${whatIfResults.potentialSavingsKg} kg CO₂e`}
                    </div>
                    <div className="savings-hero-badge">
                      <TrendingDown size={14} /> -{whatIfResults.percentageReduction}% Reduction
                    </div>
                  </div>

                  <div className="whatif-comparison-table">
                    <div className="comp-row">
                      <span className="comp-label">Baseline Projected Footprint:</span>
                      <strong className="comp-val">
                        {unit === 'tonnes'
                          ? `${whatIfResults.baselineTotalTonnes} t CO₂e`
                          : `${whatIfResults.baselineTotalKg} kg CO₂e`}
                      </strong>
                    </div>
                    <div className="comp-row">
                      <span className="comp-label">Simulated Future Footprint:</span>
                      <strong className="comp-val simulated">
                        {unit === 'tonnes'
                          ? `${whatIfResults.simulatedFutureTonnes} t CO₂e`
                          : `${whatIfResults.simulatedTotalKg} kg CO₂e`}
                      </strong>
                    </div>
                    <div className="comp-row highlight">
                      <span className="comp-label">Net Projected Savings:</span>
                      <strong className="comp-val savings">
                        {unit === 'tonnes'
                          ? `-${whatIfResults.potentialSavingsTonnes} t CO₂e`
                          : `-${whatIfResults.potentialSavingsKg} kg CO₂e`}
                      </strong>
                    </div>
                  </div>

                  {/* Visual Impact Comparison Bar */}
                  <div className="whatif-bar-comparison">
                    <div className="bar-labels">
                      <span>Baseline: 100%</span>
                      <span>Simulated: {100 - whatIfResults.percentageReduction}%</span>
                    </div>
                    <div className="comparison-bar-track">
                      <div
                        className="comparison-bar-fill simulated"
                        style={{ width: `${Math.max(5, 100 - whatIfResults.percentageReduction)}%` }}
                      />
                      <div
                        className="comparison-bar-fill savings"
                        style={{ width: `${whatIfResults.percentageReduction}%` }}
                      />
                    </div>
                  </div>

                  {/* Regulatory Disclaimer */}
                  <div className="whatif-disclaimer-box">
                    <ShieldAlert size={16} className="text-amber" />
                    <span>
                      <strong>Hypothetical Simulation:</strong> Results represent predictive mathematical estimates based on applied reduction percentages. They do not constitute actual verified historical reductions.
                    </span>
                  </div>
                </div>
              ) : (
                <div className="whatif-empty-state">
                  <Info size={20} />
                  <span>Configure reduction sliders above to model projected savings.</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Emission Anomaly Detection & Deep Activity Attribution */}
        <div className="forecast-section-box">
          <div className="section-box-header">
            <div>
              <h2 className="section-heading">Emission Anomaly Detection & Root-Cause Attribution</h2>
              <p className="section-subheading">
                Identifies high-emission outlier days exceeding statistical rules (μ + 2σ or 1.5× baseline threshold) and isolates the specific activity records driving the spike.
              </p>
            </div>
            <span className="anomaly-count-pill">
              {anomalies.length} {anomalies.length === 1 ? 'Anomaly' : 'Anomalies'} Detected
            </span>
          </div>

          {anomalies.length === 0 ? (
            <div className="anomaly-clean-state">
              <CheckCircle2 size={32} className="text-emerald" />
              <div>
                <strong>No Anomalous Emission Spikes Detected</strong>
                <p>
                  All recorded activities within this training window fall within normal statistical variance of your daily baseline ({forecast.baselineDailyAverage || 0} kg/day).
                </p>
              </div>
            </div>
          ) : (
            <div className="anomaly-cards-list">
              {anomalies.map((anomaly) => {
                const isExpanded = expandedAnomaly === anomaly.date;
                const CatIcon = CATEGORY_ICONS[anomaly.category] || Package;

                return (
                  <article className="anomaly-event-card" key={anomaly.date}>
                    <div className="anomaly-top-row">
                      <div className="anomaly-date-category">
                        <span className="anomaly-badge-spike">
                          <AlertTriangle size={14} />
                          {anomaly.deviationFactor}× Normal Baseline
                        </span>
                        <div className="anomaly-date-text">
                          <Calendar size={14} />
                          <strong>{anomaly.date}</strong>
                        </div>
                        <div className="anomaly-category-tag">
                          <CatIcon size={14} />
                          <span>{anomaly.categoryLabel}</span>
                        </div>
                      </div>

                      <div className="anomaly-magnitude-stats">
                        <div className="mag-stat">
                          <small>Recorded Day Total</small>
                          <strong>{roundVal(anomaly.emissions)} kg CO₂e</strong>
                        </div>
                        <div className="mag-divider" />
                        <div className="mag-stat">
                          <small>Normal Baseline</small>
                          <span>{roundVal(anomaly.baselineDailyAverage)} kg CO₂e</span>
                        </div>
                        <div className="mag-divider" />
                        <div className="mag-stat">
                          <small>Spike Share</small>
                          <span className="text-amber">{anomaly.shareOfAnomaly}% from {anomaly.categoryLabel}</span>
                        </div>
                      </div>
                    </div>

                    <p className="anomaly-explanation-text">
                      {anomaly.explanation}
                    </p>

                    <div className="anomaly-action-row">
                      <button
                        type="button"
                        className="btn-inspect-records"
                        onClick={() => setExpandedAnomaly(isExpanded ? null : anomaly.date)}
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp size={15} /> Hide Activity Records
                          </>
                        ) : (
                          <>
                            <ChevronDown size={15} /> Inspect {anomaly.activityRecords?.length || 0} Driving Activity Record(s)
                          </>
                        )}
                      </button>
                    </div>

                    {/* Expandable Activity Records Drawer */}
                    {isExpanded && anomaly.activityRecords && (
                      <div className="anomaly-records-drawer">
                        <div className="drawer-title">Activities Logged on {anomaly.date}:</div>
                        <div className="drawer-records-list">
                          {anomaly.activityRecords.map((record) => (
                            <div className="drawer-record-item" key={record.id}>
                              <div className="record-item-left">
                                <span className="record-id-badge">#{record.id}</span>
                                <span className="record-cat-pill">{record.categoryLabel}</span>
                                <span className="record-desc-text">
                                  {typeof record.details === 'object'
                                    ? JSON.stringify(record.details).replace(/["{}]/g, ' ')
                                    : String(record.details || 'Standard activity record')}
                                </span>
                              </div>
                              <strong className="record-emission-val">
                                {roundVal(record.emissions)} kg CO₂e
                              </strong>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>

        {/* AI Prediction Explanation & Methodological Transparency Card */}
        <div className="forecast-section-box explanation-card-container">
          <div className="section-box-header">
            <div>
              <div className="explanation-header-badge">
                <ShieldCheck size={14} />
                <span>Auditable Scientific Governance</span>
              </div>
              <h2 className="section-heading">Model Explanation & Methodological Disclosure</h2>
              <p className="section-subheading">
                Comprehensive audit trail detailing parameters, statistical methods, data sufficiency, and environmental assumptions.
              </p>
            </div>
          </div>

          <div className="explanation-factors-grid">
            {/* Factor 1: Predicted Value */}
            <div className="explanation-factor-box">
              <span className="factor-label">Predicted Footprint</span>
              <strong className="factor-value">{explanation.predictedValue || displayTotal}</strong>
              <small className="factor-note">Multi-horizon deterministic projection</small>
            </div>

            {/* Factor 2: Historical Reference */}
            <div className="explanation-factor-box">
              <span className="factor-label">Historical Baseline</span>
              <strong className="factor-value">{explanation.historicalReference || `${forecast.baselineDailyAverage} kg/day trailing average`}</strong>
              <small className="factor-note">7-day rolling baseline smoothing</small>
            </div>

            {/* Factor 3: Forecast Horizon */}
            <div className="explanation-factor-box">
              <span className="factor-label">Forecast Period</span>
              <strong className="factor-value">{explanation.forecastPeriod || `${horizon} Days`}</strong>
              <small className="factor-note">Forward projection timeline</small>
            </div>

            {/* Factor 4: Primary Contributing Sectors */}
            <div className="explanation-factor-box">
              <span className="factor-label">Top Driving Sectors</span>
              <div className="factor-tags-list">
                {Array.isArray(explanation.importantContributingCategories) && explanation.importantContributingCategories.length > 0 ? (
                  explanation.importantContributingCategories.map((c, i) => (
                    <span className="factor-driver-tag" key={i}>{c}</span>
                  ))
                ) : (
                  <span>General recorded activities</span>
                )}
              </div>
              <small className="factor-note">Ranked by prospective carbon share</small>
            </div>

            {/* Factor 5: Mathematical Methodology */}
            <div className="explanation-factor-box">
              <span className="factor-label">Forecasting Algorithm</span>
              <strong className="factor-value">{explanation.methodUsed || forecast.method}</strong>
              <small className="factor-note">Strictly deterministic linear regression</small>
            </div>

            {/* Factor 6: Data Sufficiency & Limitations */}
            <div className="explanation-factor-box">
              <span className="factor-label">Data Sufficiency Status</span>
              <strong className={`factor-value ${isSufficient ? 'text-emerald' : 'text-amber'}`}>
                {explanation.dataSufficiency || (isSufficient ? 'Sufficient sample size' : 'Limited historical activities')}
              </strong>
              <small className="factor-note">{explanation.uncertaintyAndLimitations || forecast.limitation}</small>
            </div>
          </div>

          {/* Gemini AI Environmental Executive Synthesis */}
          <div className="gemini-narrative-box">
            <div className="gemini-narrative-header">
              <div className="gemini-avatar">
                <Sparkles size={16} className="text-emerald" />
              </div>
              <div>
                <strong>Gemini AI Climate Intelligence Synthesis</strong>
                <span>Contextual executive synthesis strictly interpreting deterministic calculations</span>
              </div>
            </div>
            <p className="gemini-narrative-text">
              {explanation.aiNarrative || forecast.limitation || 'Projections are calculated based on your recent activity patterns. Maintain consistent daily tracking across transport, electricity, and diet to improve statistical confidence.'}
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ForecastAnomalies;