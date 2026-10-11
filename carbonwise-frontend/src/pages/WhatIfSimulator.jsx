import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, CheckCircle2, Leaf, Save, Trash2 } from 'lucide-react';
import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import api from '../services/api';
import ChartCard from '../components/ChartCard';
import Layout from '../components/Layout';
import LoadingState from '../components/LoadingState';
import SummaryCard from '../components/SummaryCard';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const categories = [
  { value: 'transport', label: 'Car / transport travel', unit: 'km' },
  { value: 'electricity', label: 'Electricity consumption', unit: 'kWh' },
  { value: 'food', label: 'Food activities', unit: 'meals' },
  { value: 'flight', label: 'Flight travel', unit: 'km' },
  { value: 'shopping', label: 'Shopping activities', unit: 'items' },
];

const transportModes = [
  { value: 'public_transport', label: 'Public transport' },
  { value: 'cycling', label: 'Cycling' },
  { value: 'walking', label: 'Walking' },
];

const formatKg = (value) => `${Number(value || 0).toFixed(2)} kg`;

const WhatIfSimulator = () => {
  const [form, setForm] = useState({
    name: 'Lower my footprint',
    periodDays: 30,
    action: 'reduce',
    category: 'transport',
    percentage: 20,
    targetMode: 'public_transport',
  });
  const [preview, setPreview] = useState(null);
  const [saved, setSaved] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [status, setStatus] = useState('loading');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const payload = useMemo(() => ({
    periodDays: Number(form.periodDays),
    changes: form.action === 'reduce'
      ? [{ action: 'reduce', category: form.category, percentage: Number(form.percentage) }]
      : [{ action: 'switch_transport', category: 'transport', targetMode: form.targetMode, percentage: Number(form.percentage) }],
  }), [form]);

  const loadSaved = async () => {
    const response = await api.get('/scenarios');
    setSaved(response.data);
  };

  const previewScenario = async () => {
    setStatus('loading');
    setError('');
    try {
      const response = await api.post('/scenarios/preview', payload);
      setPreview(response.data);
      setStatus('ready');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to calculate this scenario.');
      setStatus('error');
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        await loadSaved();
        await previewScenario();
      } catch (requestError) {
        setError(requestError.response?.data?.message || 'Unable to load saved scenarios.');
        setStatus('error');
      }
    };
    load();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: name === 'percentage' || name === 'periodDays' ? Number(value) : value }));
  };

  const saveScenario = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await api.post('/scenarios', { name: form.name, ...payload });
      await loadSaved();
      setNotice('Scenario saved for future comparison.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save this scenario.');
    } finally {
      setSaving(false);
    }
  };

  const deleteScenario = async (id) => {
    try {
      await api.delete(`/scenarios/${id}`);
      setSaved((current) => current.filter((scenario) => scenario.id !== id));
      setSelectedIds((current) => current.filter((selectedId) => selectedId !== id));
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to delete this scenario.');
    }
  };

  const toggleSelected = (id) => {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const selectedScenarios = saved.filter((scenario) => selectedIds.includes(scenario.id));
  const chartScenarios = preview ? [{ name: 'Current estimate', ...preview }, ...selectedScenarios] : selectedScenarios;
  const chartData = {
    labels: chartScenarios.map((scenario) => scenario.name),
    datasets: [
      { label: 'Baseline (kg CO₂)', data: chartScenarios.map((scenario) => scenario.baselineEmissionsKg), backgroundColor: '#b9d9c5', borderRadius: 6 },
      { label: 'Scenario (kg CO₂)', data: chartScenarios.map((scenario) => scenario.scenarioEmissionsKg), backgroundColor: '#176b4d', borderRadius: 6 },
    ],
  };
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 18 } } },
    scales: { x: { grid: { display: false } }, y: { beginAtZero: true, title: { display: true, text: 'kg CO₂' } } },
  };

  if (status === 'loading') return <Layout><div className="intelligence-loading"><LoadingState label="Calculating your scenario..." /></div></Layout>;

  return (
    <Layout>
      <div className="simulator-intro">
        <div>
          <span className="section-kicker">Planning tool</span>
          <h2>Explore a lower-carbon routine</h2>
          <p>Adjust one change at a time to estimate how it could affect your recorded footprint.</p>
        </div>
        <div className="estimate-badge"><Leaf size={16} /> Estimates only</div>
      </div>

      {error && <div className="simulator-alert" role="alert"><AlertTriangle size={18} />{error}</div>}
      {notice && <div className="simulator-notice" role="status"><CheckCircle2 size={18} />{notice}</div>}

      <div className="simulator-layout">
        <form className="simulator-form chart-card" onSubmit={saveScenario}>
          <div className="chart-card-heading"><div><h3>Build a scenario</h3><p>All values use your activity history and existing emission factors.</p></div></div>
          <label className="simulator-field">Scenario name<input name="name" value={form.name} onChange={handleChange} maxLength="120" required /></label>
          <label className="simulator-field">Reporting period<select name="periodDays" value={form.periodDays} onChange={handleChange}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last 12 months</option></select></label>
          <label className="simulator-field">Change type<select name="action" value={form.action} onChange={handleChange}><option value="reduce">Reduce an activity</option><option value="switch_transport">Switch transport mode</option></select></label>
          {form.action === 'reduce' ? (
            <label className="simulator-field">Activity category<select name="category" value={form.category} onChange={handleChange}>{categories.map((category) => <option key={category.value} value={category.value}>{category.label} ({category.unit})</option>)}</select></label>
          ) : (
            <label className="simulator-field">Switch transport to<select name="targetMode" value={form.targetMode} onChange={handleChange}>{transportModes.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}</select></label>
          )}
          <label className="simulator-field">Share of activity changed: {form.percentage}%<input name="percentage" type="range" min="0" max="100" step="5" value={form.percentage} onChange={handleChange} aria-describedby="percentage-help" /><input name="percentage" type="number" min="0" max="100" step="1" value={form.percentage} onChange={handleChange} aria-label="Percentage of activity changed" /><span id="percentage-help" className="field-help">Enter a value from 0 to 100 percent.</span></label>
          <button className="btn" type="button" onClick={previewScenario}>Update estimate</button>
          <button className="btn btn-secondary" type="submit" disabled={saving}><Save size={16} />{saving ? 'Saving...' : 'Save scenario'}</button>
          <p className="simulator-disclaimer">Potential savings are modeled estimates, not verified reductions. Saving a scenario never changes your activity history.</p>
        </form>

        <div className="simulator-results">
          {preview && (
            <>
              <div className="summary-grid">
                <SummaryCard label="Baseline" value={formatKg(preview.baselineEmissionsKg)} detail={`${preview.periodDays}-day recorded history`} icon={BarChart3} />
                <SummaryCard label="Scenario estimate" value={formatKg(preview.scenarioEmissionsKg)} detail="Modeled future footprint" icon={Leaf} tone="blue" />
                <SummaryCard label="Potential savings" value={`-${formatKg(preview.potentialSavingsKg)}`} detail={`${preview.potentialSavingsPercentage}% estimated difference`} icon={CheckCircle2} tone="purple" />
              </div>
              <ChartCard title="Baseline versus scenario" description="Compare recorded emissions with this hypothetical estimate.">
                <div className="simulator-chart"><Bar data={chartData} options={chartOptions} /></div>
              </ChartCard>
              <ChartCard title="Assumptions" description="Review how this estimate was calculated.">
                <ul className="assumption-list">{preview.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}</ul>
                <p className="simulator-disclaimer">The baseline uses {preview.activityCount} valid activities from your selected period. {preview.invalidActivityCount ? `${preview.invalidActivityCount} invalid record(s) were excluded.` : ''}</p>
              </ChartCard>
            </>
          )}
        </div>
      </div>

      <ChartCard title="Saved scenarios" description="Select scenarios to compare them with your current estimate.">
        {saved.length === 0 ? <div className="empty-inline"><Leaf size={20} />Save a scenario to compare possible changes over time.</div> : (
          <div className="saved-scenario-list">{saved.map((scenario) => (
            <div className="saved-scenario-row" key={scenario.id}>
              <label><input type="checkbox" checked={selectedIds.includes(scenario.id)} onChange={() => toggleSelected(scenario.id)} /><span><strong>{scenario.name}</strong><small>{scenario.periodDays}-day estimate · {formatKg(scenario.potentialSavingsKg)} potential savings</small></span></label>
              <button type="button" className="icon-button danger-button" aria-label={`Delete ${scenario.name}`} onClick={() => deleteScenario(scenario.id)}><Trash2 size={16} /></button>
            </div>
          ))}</div>
        )}
      </ChartCard>
    </Layout>
  );
};

export default WhatIfSimulator;
