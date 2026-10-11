import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Leaf,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import api from '../services/api';
import Layout from '../components/Layout';
import ChartCard from '../components/ChartCard';
import LoadingState from '../components/LoadingState';
import SummaryCard from '../components/SummaryCard';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, Tooltip, Legend);

const formatKg = (value) => `${Number(value || 0).toFixed(2)} kg`;

const CarbonIntelligence = () => {
  const [period, setPeriod] = useState('30');
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  const fetchIntelligence = async () => {
    setStatus('loading');
    setError('');
    try {
      const response = await api.get(`/intelligence?period=${period}`);
      setData(response.data);
      setStatus('ready');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load carbon intelligence.');
      setStatus('error');
    }
  };

  useEffect(() => {
    fetchIntelligence();
  }, [period]);

  const trendData = useMemo(() => ({
    labels: data?.trends?.map((item) => item.date.slice(5)) || [],
    datasets: [{
      label: 'Daily emissions (kg CO₂)',
      data: data?.trends?.map((item) => item.emissions) || [],
      borderColor: '#176b4d',
      backgroundColor: 'rgba(120, 199, 154, .18)',
      fill: true,
      tension: .35,
      pointRadius: 2,
    }],
  }), [data]);

  const categoryData = useMemo(() => ({
    labels: data?.categoryBreakdown?.map((item) => item.label) || [],
    datasets: [{
      label: 'Emissions (kg CO₂)',
      data: data?.categoryBreakdown?.map((item) => item.emissions) || [],
      backgroundColor: ['#176b4d', '#78c79a', '#91b8a1', '#e4bd70', '#87a9bd'],
      borderRadius: 7,
    }],
  }), [data]);

  const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { color: '#edf1ed' } } } };

  if (status === 'loading') {
    return <Layout><div className="intelligence-loading"><LoadingState label="Calculating your carbon intelligence..." /></div></Layout>;
  }

  if (status === 'error') {
    return (
      <Layout>
        <div className="intelligence-state">
          <AlertTriangle size={34} />
          <h2>We could not load your intelligence</h2>
          <p>{error}</p>
          <button className="btn state-button" type="button" onClick={fetchIntelligence}><RefreshCw size={16} /> Try again</button>
        </div>
      </Layout>
    );
  }

  const isEmpty = !data?.activityCount;
  const comparison = data?.comparison || {};
  const increase = comparison.status === 'increase';

  return (
    <Layout>
      <div className="intelligence-toolbar">
        <div>
          <span className="section-kicker">Deterministic analysis</span>
          <h2>Understand what drives your footprint</h2>
        </div>
        <label className="filter-control">
          <span>Analysis period</span>
          <select value={period} onChange={(event) => setPeriod(event.target.value)}>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last 12 months</option>
          </select>
        </label>
      </div>

      {isEmpty ? (
        <div className="intelligence-state">
          <Leaf size={36} />
          <h2>Start logging to unlock intelligence</h2>
          <p>Your daily, weekly, monthly, comparison, and recommendation insights will appear here after your first activity.</p>
        </div>
      ) : (
        <>
          <div className="summary-grid">
            <SummaryCard label="Current period" value={formatKg(data.totals.currentPeriod)} detail={`${data.activityCount} activities analyzed`} icon={BarChart3} />
            <SummaryCard label="Daily average" value={formatKg(data.totals.daily)} detail="Based on the selected period" icon={TrendingUp} tone="blue" />
            <SummaryCard label="Weekly run rate" value={formatKg(data.totals.weekly)} detail="Current daily average × 7" icon={Leaf} tone="purple" />
            <SummaryCard label="Monthly run rate" value={formatKg(data.totals.monthly)} detail="Current daily average × 30" icon={CheckCircle2} tone="amber" />
          </div>

          <div className="intelligence-grid intelligence-grid-main">
            <ChartCard title="Daily emissions trend" description="Your recorded emissions across the selected period." className="chart-card-wide">
              <div className="intelligence-chart"><Line data={trendData} options={chartOptions} /></div>
            </ChartCard>
            <ChartCard title="Category breakdown" description="Where your current footprint comes from.">
              <div className="intelligence-chart intelligence-doughnut"><Doughnut data={categoryData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 16 } } } }} /></div>
            </ChartCard>
          </div>

          <div className="intelligence-grid">
            <ChartCard title="Largest emission sources" description="Categories ranked by current-period emissions.">
              <div className="source-list">
                {data.largestSources.map((source) => (
                  <div className="source-row" key={source.category}>
                    <div><strong>{source.label}</strong><span>{source.contributionPercentage}% of current emissions</span></div>
                    <strong>{formatKg(source.emissions)}</strong>
                  </div>
                ))}
              </div>
            </ChartCard>
            <ChartCard title="Period comparison" description="Current period compared with the previous equivalent period.">
              <div className="comparison-panel">
                <div><span>Previous</span><strong>{formatKg(comparison.previous)}</strong></div>
                <div className={`comparison-change ${increase ? 'is-increase' : 'is-decrease'}`}>
                  {increase ? <ArrowUpRight size={21} /> : <ArrowDownRight size={21} />}
                  <strong>{comparison.percentageChange === null ? 'New baseline' : `${Math.abs(comparison.percentageChange)}%`}</strong>
                  <span>{comparison.status}</span>
                </div>
                <div><span>Current</span><strong>{formatKg(comparison.current)}</strong></div>
              </div>
            </ChartCard>
          </div>

          <div className="intelligence-grid">
            <ChartCard title="Ranked reduction opportunities" description="Transparent estimates based on existing activity emissions and category opportunities.">
              <div className="recommendation-list">
                {data.recommendations.map((recommendation) => (
                  <div className="recommendation-row" key={recommendation.category}>
                    <span className="recommendation-rank">{recommendation.rank}</span>
                    <div><strong>{recommendation.label}</strong><p>{recommendation.reason}</p><small>{recommendation.contributionPercentage}% of emissions · {recommendation.reductionRatePercentage}% opportunity</small></div>
                    <strong className="savings">-{formatKg(recommendation.potentialSavingsKg)}</strong>
                  </div>
                ))}
              </div>
            </ChartCard>
            <ChartCard title="Unusual activity" description="Rule-based flags: above 1.5× the baseline average and two standard deviations.">
              {data.anomalies.length ? <div className="anomaly-list">{data.anomalies.map((anomaly) => <div className="anomaly-row" key={anomaly.date}><AlertTriangle size={18} /><div><strong>{anomaly.date} · {formatKg(anomaly.emissions)}</strong><p>{anomaly.explanation}</p></div></div>)}</div> : <div className="empty-inline"><CheckCircle2 size={20} /><span>No unusual increases detected in this period.</span></div>}
            </ChartCard>
          </div>
          {data.invalidActivityCount > 0 ? <p className="data-quality-note"><AlertTriangle size={15} /> {data.invalidActivityCount} invalid historical record(s) were excluded from calculations.</p> : null}
        </>
      )}
    </Layout>
  );
};

export default CarbonIntelligence;
