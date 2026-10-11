import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Leaf, MessageCircle, RotateCcw, Target, XCircle } from 'lucide-react';
import api from '../services/api';
import Layout from '../components/Layout';
import LoadingState from '../components/LoadingState';
import SummaryCard from '../components/SummaryCard';

const statuses = [
  { value: 'planned', label: 'Planned', icon: Clock3 },
  { value: 'in_progress', label: 'In Progress', icon: RotateCcw },
  { value: 'completed', label: 'Completed', icon: CheckCircle2 },
  { value: 'skipped', label: 'Skipped', icon: XCircle },
];

const formatKg = (value) => value == null ? 'Not calculated' : `${Number(value).toFixed(2)} kg`;

const ActionPlan = () => {
  const [plan, setPlan] = useState(null);
  const [goals, setGoals] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [useGemini, setUseGemini] = useState(false);
  const [goalForm, setGoalForm] = useState({ period: 'weekly', targetKg: 10, category: '' });
  const [goalSaving, setGoalSaving] = useState(false);

  const load = async () => {
    const [plansResponse, goalsResponse] = await Promise.all([
      api.get('/coach/plans'),
      api.get('/coach/goals'),
    ]);
    setPlan(plansResponse.data[0] || null);
    setGoals(goalsResponse.data);
    setStatus('ready');
  };

  useEffect(() => {
    load().catch((requestError) => {
      setError(requestError.response?.data?.message || 'Unable to load your Eco-Coach workspace.');
      setStatus('error');
    });
  }, []);

  const generatePlan = async () => {
    setStatus('loading');
    setError('');
    setNotice('');
    try {
      const response = await api.post('/coach/plans', { useGemini });
      setPlan(response.data);
      setStatus('ready');
      setNotice(response.data.narrativeSource === 'gemini'
        ? 'Plan created with optional Gemini wording and deterministic recommendations.'
        : 'Plan created with deterministic recommendations.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to create your action plan.');
      setStatus('error');
    }
  };

  const updateAction = async (actionId, actionStatus) => {
    try {
      const response = await api.patch(`/coach/actions/${actionId}`, { status: actionStatus });
      setPlan((current) => ({
        ...current,
        actions: current.actions.map((action) => action.id === actionId ? response.data : action),
      }));
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update this action.');
    }
  };

  const createGoal = async (event) => {
    event.preventDefault();
    setGoalSaving(true);
    try {
      const response = await api.post('/coach/goals', {
        ...goalForm,
        targetKg: Number(goalForm.targetKg),
        category: goalForm.category || null,
      });
      setGoals((current) => [response.data, ...current]);
      setNotice('Reduction goal created.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to create this goal.');
    } finally {
      setGoalSaving(false);
    }
  };

  const updateGoal = async (id, goalStatus) => {
    try {
      const response = await api.patch(`/coach/goals/${id}`, { status: goalStatus });
      setGoals((current) => current.map((goal) => goal.id === id ? { ...goal, ...response.data } : goal));
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update this goal.');
    }
  };

  const completedCount = useMemo(() => plan?.actions?.filter((action) => action.status === 'completed').length || 0, [plan]);
  const inProgressCount = useMemo(() => plan?.actions?.filter((action) => action.status === 'in_progress').length || 0, [plan]);

  if (status === 'loading') return <Layout><div className="intelligence-loading"><LoadingState label="Preparing your adaptive action plan..." /></div></Layout>;

  return (
    <Layout>
      <div className="coach-intro">
        <div>
          <span className="section-kicker">Adaptive guidance</span>
          <h2>Small actions, grounded in your footprint</h2>
          <p>Recommendations use your activity history and adapt after you complete or skip actions.</p>
        </div>
        <button className="btn" type="button" onClick={generatePlan}>Generate new 7-day plan</button>
      </div>

      {error && <div className="simulator-alert" role="alert">{error}</div>}
      {notice && <div className="simulator-notice" role="status">{notice}</div>}

      <div className="summary-grid">
        <SummaryCard label="Completed" value={`${completedCount}/7`} detail="Actions completed in this plan" icon={CheckCircle2} />
        <SummaryCard label="In progress" value={inProgressCount} detail="Actions currently underway" icon={Clock3} tone="blue" />
        <SummaryCard label="Plan source" value={plan?.narrativeSource === 'gemini' ? 'Hybrid' : 'Deterministic'} detail="Recommendations are always data grounded" icon={Leaf} tone="purple" />
      </div>

      {!plan ? (
        <div className="coach-empty chart-card">
          <Leaf size={32} />
          <h3>No plan saved yet</h3>
          <p>Generate a plan to turn your highest-impact categories into seven practical actions.</p>
          <label className="coach-toggle"><input type="checkbox" checked={useGemini} onChange={(event) => setUseGemini(event.target.checked)} /> Add optional personalized Gemini introduction</label>
          <button className="btn" type="button" onClick={generatePlan}>Create my plan</button>
        </div>
      ) : (
        <>
          <div className="coach-plan-heading">
            <div><span className="section-kicker">Seven-day plan</span><h3>{plan.narrative || 'Your personalized action plan'}</h3></div>
            <span className="coach-estimate">Estimates are not verified reductions</span>
          </div>
          <div className="coach-action-list">
            {plan.actions.map((action) => {
              const StatusIcon = statuses.find((item) => item.value === action.status)?.icon || Clock3;
              return (
                <article className={`coach-action-card status-${action.status}`} key={action.id}>
                  <div className="coach-day">Day {action.dayNumber}</div>
                  <div className="coach-action-copy">
                    <div className="coach-action-meta"><span>{action.category}</span><span>{formatKg(action.estimatedPotentialSavingsKg)} potential</span></div>
                    <h3>{action.title}</h3>
                    <p>{action.explanation}</p>
                    <strong>Suggested target: {action.suggestedTarget}</strong>
                  </div>
                  <label className="coach-status"><StatusIcon size={16} /><span className="sr-only">Status for {action.title}</span><select value={action.status} onChange={(event) => updateAction(action.id, event.target.value)}>{statuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
                </article>
              );
            })}
          </div>
        </>
      )}

      <div className="coach-lower-grid">
        <section className="chart-card">
          <div className="chart-card-heading"><div><h3>Reduction goals</h3><p>Set a weekly or monthly target to guide your actions.</p></div><Target size={20} /></div>
          <form className="goal-form" onSubmit={createGoal}>
            <label>Period<select value={goalForm.period} onChange={(event) => setGoalForm({ ...goalForm, period: event.target.value })}><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>
            <label>Target kg CO₂<input type="number" min="0.01" step="0.01" value={goalForm.targetKg} onChange={(event) => setGoalForm({ ...goalForm, targetKg: event.target.value })} required /></label>
            <label>Category<select value={goalForm.category} onChange={(event) => setGoalForm({ ...goalForm, category: event.target.value })}><option value="">All categories</option><option value="transport">Transport</option><option value="electricity">Electricity</option><option value="food">Food</option><option value="flight">Flights</option><option value="shopping">Shopping</option></select></label>
            <button className="btn" type="submit" disabled={goalSaving}>Create goal</button>
          </form>
          <div className="goal-list">{goals.map((goal) => <div className="goal-row" key={goal.id}><div><strong>{goal.period} goal · {formatKg(goal.targetKg)}</strong><small>{goal.category || 'All categories'} · baseline {formatKg(goal.baselineKg)}</small></div><select value={goal.status} onChange={(event) => updateGoal(goal.id, event.target.value)}><option value="active">Active</option><option value="completed">Completed</option><option value="archived">Archived</option></select></div>)}</div>
        </section>
        <section className="chart-card coach-note"><MessageCircle size={22} /><h3>How adaptation works</h3><p>Completing an action is recorded as participation, not proof that emissions fell. Future plans review completion history alongside subsequent activity records before changing recommendations.</p></section>
      </div>
    </Layout>
  );
};

export default ActionPlan;
