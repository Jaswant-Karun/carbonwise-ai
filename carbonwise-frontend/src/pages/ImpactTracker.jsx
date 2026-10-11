import React, { useEffect, useMemo, useState } from 'react';
import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, LineElement, PointElement, Tooltip } from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import { Download, FileText, Leaf, RefreshCw, Target, TrendingDown, TrendingUp } from 'lucide-react';
import api from '../services/api';
import Layout from '../components/Layout';
import ChartCard from '../components/ChartCard';
import LoadingState from '../components/LoadingState';
import SummaryCard from '../components/SummaryCard';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend);

const formatKg = (value) => `${Number(value || 0).toFixed(2)} kg`;

const ImpactTracker = () => {
  const [report, setReport] = useState(null);
  const [reports, setReports] = useState([]);
  const [baselines, setBaselines] = useState([]);
  const [period, setPeriod] = useState('30');
  const [baselineForm, setBaselineForm] = useState({ name: '', startDate: '', endDate: '' });
  const [baselineId, setBaselineId] = useState('');
  const [useGemini, setUseGemini] = useState(false);
  const [status, setStatus] = useState('loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async () => {
    const [reportResponse, reportsResponse, baselinesResponse] = await Promise.all([
      api.get(`/impact/reports?periodDays=${period}`),
      api.get('/impact/reports'),
      api.get('/impact/baselines'),
    ]);
    setReport(reportResponse.data[0] || null);
    setReports(reportsResponse.data);
    setBaselines(baselinesResponse.data);
    setStatus('ready');
  };

  useEffect(() => {
    load().catch((requestError) => {
      setError(requestError.response?.data?.message || 'Unable to load your impact tracker.');
      setStatus('error');
    });
  }, []);

  const createBaseline = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await api.post('/impact/baselines', { ...baselineForm, periodDays: Number(period) });
      setBaselines((current) => [response.data, ...current]);
      setBaselineId(String(response.data.id));
      setNotice('Baseline established from recorded emissions.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to establish baseline.');
    } finally {
      setBusy(false);
    }
  };

  const generateReport = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await api.post('/impact/reports', { periodDays: Number(period), baselineId: baselineId || null, useGemini });
      setReport(response.data);
      setReports((current) => [response.data, ...current]);
      setNotice('Deterministic impact report generated.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to generate impact report.');
    } finally {
      setBusy(false);
    }
  };

  const downloadPdf = async (id) => {
    try {
      const response = await api.get(`/impact/reports/${id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `impact-report-${id}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to export this report.');
    }
  };

  const trendData = useMemo(() => ({
    labels: report?.trends?.map((item) => item.date.slice(5)) || [],
    datasets: [{ label: 'Recorded emissions', data: report?.trends?.map((item) => item.emissions) || [], borderColor: '#176b4d', backgroundColor: 'rgba(23,107,77,.12)', fill: true, tension: .3 }],
  }), [report]);

  const categoryData = useMemo(() => ({
    labels: report?.categoryBreakdown?.map((item) => item.label) || [],
    datasets: [
      { label: 'Current', data: report?.categoryBreakdown?.map((item) => item.emissions) || [], backgroundColor: '#176b4d', borderRadius: 5 },
      { label: 'Potential savings estimate', data: report?.categoryBreakdown?.map((item) => item.potentialSavingsKg) || [], backgroundColor: '#d3a04a', borderRadius: 5 },
    ],
  }), [report]);

  const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true } } };

  if (status === 'loading') return <Layout><div className="intelligence-loading"><LoadingState label="Loading your sustainability impact..." /></div></Layout>;
  if (status === 'error') return <Layout><div className="intelligence-state"><h2>Impact tracker unavailable</h2><p>{error}</p><button className="btn" type="button" onClick={() => { setStatus('loading'); load(); }}><RefreshCw size={16} /> Try again</button></div></Layout>;

  const totals = report?.totals || { current: 0, baseline: 0, absoluteChange: 0, percentageChange: null, status: 'unchanged' };
  const decrease = totals.status === 'decrease';

  return (
    <Layout>
      <div className="impact-intro">
        <div><span className="section-kicker">Measured progress</span><h2>Understand your sustainability impact</h2><p>Compare recorded emissions over equivalent periods without confusing modeled potential with observed change.</p></div>
        <div className="impact-controls"><label>Reporting period<select value={period} onChange={(event) => setPeriod(event.target.value)}><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option><option value="365">12 months</option></select></label><button className="btn" type="button" onClick={generateReport} disabled={busy}>{busy ? 'Generating...' : 'Generate report'}</button></div>
      </div>
      {error && <div className="simulator-alert" role="alert">{error}</div>}
      {notice && <div className="simulator-notice" role="status">{notice}</div>}

      {!report ? <div className="impact-empty chart-card"><Leaf size={32} /><h3>No impact report yet</h3><p>Establish a baseline and generate a report from your recorded activity history.</p></div> : (
        <>
          <div className="summary-grid">
            <SummaryCard label="Current recorded" value={formatKg(totals.current)} detail={`${report.activityCount} activities in period`} icon={TrendingUp} />
            <SummaryCard label="Baseline" value={formatKg(totals.baseline)} detail="Equivalent comparison period" icon={Target} tone="blue" />
            <SummaryCard label="Observed change" value={totals.percentageChange == null ? 'New baseline' : `${Math.abs(totals.percentageChange)}%`} detail={`${decrease ? 'Decrease' : totals.status}`} icon={decrease ? TrendingDown : TrendingUp} tone="purple" />
            <SummaryCard label="Potential savings" value={formatKg(report.potentialSavingsKg)} detail="Modeled opportunity, not observed reduction" icon={Leaf} tone="amber" />
          </div>
          <div className="impact-chart-grid"><ChartCard title="Recorded emissions trend" description="Only actual activity records are shown."><div className="impact-chart"><Line data={trendData} options={chartOptions} /></div></ChartCard><ChartCard title="Categories and modeled opportunity" description="Potential savings are separate from observed changes."><div className="impact-chart"><Bar data={categoryData} options={chartOptions} /></div></ChartCard></div>
          <div className="impact-report-note"><strong>{report.narrative || 'Deterministic summary'}</strong><p>{report.limitations}</p></div>
        </>
      )}

      <div className="impact-lower-grid">
        <ChartCard title="Establish a baseline" description="Choose a completed period of your recorded history for comparison.">
          <form className="baseline-form" onSubmit={createBaseline}><label>Name<input value={baselineForm.name} onChange={(event) => setBaselineForm({ ...baselineForm, name: event.target.value })} placeholder="My first baseline" maxLength="120" /></label><label>Start date<input type="date" value={baselineForm.startDate} onChange={(event) => setBaselineForm({ ...baselineForm, startDate: event.target.value })} required /></label><label>End date<input type="date" value={baselineForm.endDate} onChange={(event) => setBaselineForm({ ...baselineForm, endDate: event.target.value })} required /></label><button className="btn" type="submit" disabled={busy}>Set baseline</button></form>
          <label className="impact-select">Compare against<select value={baselineId} onChange={(event) => setBaselineId(event.target.value)}><option value="">Automatic equivalent period</option>{baselines.map((baseline) => <option key={baseline.id} value={baseline.id}>{baseline.name} · {baseline.startDate} to {baseline.endDate}</option>)}</select></label>
          <label className="impact-gemini"><input type="checkbox" checked={useGemini} onChange={(event) => setUseGemini(event.target.checked)} /> Add optional natural-language explanation</label>
        </ChartCard>
        <ChartCard title="Goal progress" description="Goals and completed eco-actions from your Eco-Coach.">
          <div className="impact-goal-list">{(report?.goals || []).length === 0 ? <div className="empty-inline"><Target size={19} />Create goals in AI Eco-Coach to track them here.</div> : report.goals.map((goal) => <div className="impact-goal-row" key={goal.id}><div><strong>{goal.period} · {goal.category || 'All categories'}</strong><small>{goal.completedActions} completed action(s) · target {formatKg(goal.targetKg)}</small></div><span className={`goal-status ${goal.status}`}>{goal.status}</span></div>)}</div>
        </ChartCard>
      </div>

      <ChartCard title="Report history" description="Previously generated deterministic report snapshots.">
        <div className="impact-history-list">{reports.length === 0 ? <div className="empty-inline"><FileText size={19} />No previous reports.</div> : reports.map((item) => <div className="impact-history-row" key={item.id}><div><strong>{item.period?.currentStart} to {item.period?.currentEnd}</strong><small>{formatKg(item.totals?.current)} recorded · {item.totals?.status} · {item.narrativeSource}</small></div><button className="icon-button" type="button" aria-label={`Download report ${item.id}`} onClick={() => downloadPdf(item.id)}><Download size={16} /></button></div>)}</div>
      </ChartCard>
      <ChartCard title="Eco-action history" description="Completion records are participation evidence, not proof of an emissions reduction.">
        <div className="impact-history-list">{(report?.actionHistory || []).length === 0 ? <div className="empty-inline"><Target size={19} />No recorded coach actions yet.</div> : report.actionHistory.map((action) => <div className="impact-history-row" key={action.id}><div><strong>{action.title}</strong><small>{action.category} · {action.status}{action.completed_at ? ` · completed ${new Date(action.completed_at).toLocaleDateString()}` : ''}</small></div><span className={`goal-status ${action.status}`}>{action.status.replace('_', ' ')}</span></div>)}</div>
      </ChartCard>
    </Layout>
  );
};

export default ImpactTracker;
