import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Award,
  Building2,
  Calendar,
  Car,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Droplets,
  ExternalLink,
  Flame,
  HelpCircle,
  History,
  Info,
  Leaf,
  Minus,
  Package,
  Plus,
  Recycle,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  Utensils,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import Layout from '../components/Layout';
import LoadingState from '../components/LoadingState';

const CATEGORY_ICONS = {
  electricity: Zap,
  transport: Car,
  food: Utensils,
  water: Droplets,
  waste: Recycle,
  facilities: Building2,
  other: Package,
  flight: Car,
  shopping: Package,
};

const CATEGORY_COLORS = {
  electricity: '#f59e0b',
  transport: '#3b82f6',
  food: '#10b981',
  water: '#06b6d4',
  waste: '#8b5cf6',
  facilities: '#ec4899',
  other: '#64748b',
};

const STATUS_ICONS = {
  recommended: Sparkles,
  planned: Clock3,
  in_progress: RotateCcw,
  completed: CheckCircle2,
  skipped: XCircle,
  dismissed: X,
};

const formatKg = (val) => {
  const n = Number(val);
  return Number.isFinite(n) ? `${n.toFixed(2)} kg` : 'Not calculated';
};

const formatTonnes = (val) => {
  const n = Number(val);
  return Number.isFinite(n) ? `${(n / 1000.0).toFixed(4)} t` : '0.0000 t';
};

const ActionPlan = () => {
  // Navigation & View State
  const [activeTab, setActiveTab] = useState('feed'); // 'feed' | 'planner' | 'goals'
  const [categoryFilter, setCategoryFilter] = useState('all'); // 'all' | 'high' | category

  // Data State
  const [plan, setPlan] = useState(null);
  const [goals, setGoals] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [highestImpactCategories, setHighestImpactCategories] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [useGemini, setUseGemini] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Goal Modal & Form State
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [goalSaving, setGoalSaving] = useState(false);
  const [goalForm, setGoalForm] = useState({
    period: 'weekly',
    targetKg: 25,
    category: '',
  });

  const planRequest = useRef(false);

  const loadData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setStatus('loading');
    setError('');

    try {
      const [plansRes, goalsRes, recsRes] = await Promise.all([
        api.get('/coach/plans'),
        api.get('/coach/goals'),
        api.get('/coach/recommendations').catch(() => ({ data: { recommendations: [] } })),
      ]);

      const activePlan = plansRes.data[0] || null;
      setPlan(activePlan);
      setGoals(goalsRes.data || []);

      // Set recommendations from dedicated endpoint or from plan payload
      const allRecs = recsRes.data?.recommendations?.length
        ? recsRes.data.recommendations
        : (activePlan?.recommendations || []);
      setRecommendations(allRecs);

      setHighestImpactCategories(recsRes.data?.highestImpactCategories || activePlan?.highestImpactCategories || []);
      setStatus('ready');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load Climate Action Planner.');
      setStatus('error');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleSync = () => { loadData(); };
    window.addEventListener('carbonwise:activity-recorded', handleSync);
    return () => {
      window.removeEventListener('carbonwise:activity-recorded', handleSync);
    };
  }, []);

  // Regenerate 7-Day Plan
  const generatePlan = async () => {
    if (planRequest.current) return;
    planRequest.current = true;
    setStatus('loading');
    setError('');
    setNotice('');

    try {
      const response = await api.post('/coach/plans', { useGemini });
      setPlan(response.data);
      if (response.data.recommendations?.length) {
        setRecommendations(response.data.recommendations);
      }
      setStatus('ready');
      setNotice(
        response.data.narrativeSource === 'gemini'
          ? 'Personalized Climate Action Plan regenerated with Gemini executive guidance.'
          : 'Climate Action Plan regenerated based on your latest activity history.'
      );
      window.dispatchEvent(new CustomEvent('carbonwise:action-updated'));
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to regenerate action plan.');
      setStatus('error');
    } finally {
      planRequest.current = false;
    }
  };

  // Update Action Status (Planned, In Progress, Completed, Skipped, Dismissed)
  const updateActionStatus = async (actionId, newStatus) => {
    try {
      const response = await api.patch(`/coach/actions/${actionId}`, { status: newStatus });
      setPlan((current) => ({
        ...current,
        actions: current.actions.map((act) => (act.id === actionId ? response.data : act)),
      }));

      // If marked completed, re-fetch goals to update real vs hypothetical progress
      if (newStatus === 'completed') {
        const updatedGoals = await api.get('/coach/goals');
        setGoals(updatedGoals.data || []);
      }
      window.dispatchEvent(new CustomEvent('carbonwise:action-updated'));
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update action status.');
    }
  };

  // Accept a Recommendation from the Feed into the Active Plan
  const acceptRecommendation = async (rec) => {
    try {
      // If action is already in the active plan, update its status to 'planned'
      const existingAction = plan?.actions?.find((a) => a.actionType === rec.actionType || a.title === rec.title);
      if (existingAction) {
        await updateActionStatus(existingAction.id, 'planned');
      } else {
        // Create or patch action
        setNotice(`Action "${rec.title}" accepted into your active plan.`);
      }
      setNotice(`"${rec.title}" accepted into your climate plan.`);
    } catch {
      setError('Unable to accept recommendation.');
    }
  };

  // Dismiss a Recommendation
  const dismissRecommendation = async (rec) => {
    try {
      const existingAction = plan?.actions?.find((a) => a.actionType === rec.actionType || a.title === rec.title);
      if (existingAction) {
        await updateActionStatus(existingAction.id, 'dismissed');
      }
      setNotice(`Action "${rec.title}" dismissed from active view.`);
    } catch {
      setError('Unable to dismiss recommendation.');
    }
  };

  // Create Reduction Target
  const handleCreateGoal = async (e) => {
    e.preventDefault();
    setGoalSaving(true);
    setError('');

    try {
      const response = await api.post('/coach/goals', {
        ...goalForm,
        targetKg: Number(goalForm.targetKg),
        category: goalForm.category || null,
      });

      setGoals((prev) => [response.data, ...prev]);
      setGoalModalOpen(false);
      setNotice('New carbon reduction target established successfully.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to create reduction target.');
    } finally {
      setGoalSaving(false);
    }
  };

  // Update Goal Status (active, completed, archived)
  const handleUpdateGoalStatus = async (goalId, newStatus) => {
    try {
      const response = await api.patch(`/coach/goals/${goalId}`, { status: newStatus });
      setGoals((prev) => prev.map((g) => (g.id === goalId ? { ...g, ...response.data } : g)));
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update goal status.');
    }
  };

  // Metrics Calculations
  const planActions = plan?.actions || [];
  const completedActions = planActions.filter((a) => a.status === 'completed');
  const inProgressActions = planActions.filter((a) => a.status === 'in_progress');
  const plannedActions = planActions.filter((a) => a.status === 'planned');

  // Sum of hypothetical potential savings from completed actions
  const totalCompletedSavingsKg = completedActions.reduce(
    (sum, a) => sum + (Number(a.estimatedPotentialSavingsKg) || 0),
    0
  );

  // Active goals metrics
  const activeGoals = goals.filter((g) => g.status === 'active');
  const onTrackGoalsCount = activeGoals.filter((g) => g.isTargetAchieved).length;

  // Filtered Recommendations
  const filteredRecommendations = useMemo(() => {
    if (categoryFilter === 'all') return recommendations;
    if (categoryFilter === 'high') return recommendations.filter((r) => r.impactLevel === 'high');
    return recommendations.filter((r) => r.category === categoryFilter);
  }, [recommendations, categoryFilter]);

  if (status === 'loading') {
    return (
      <Layout>
        <div className="planner-page-container">
          <LoadingState label="Analyzing emission history, calculating high-impact opportunities, and loading goals..." />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="planner-page-container">
        {/* Header & Controls Toolbar */}
        <div className="planner-header-row">
          <div>
            <div className="planner-badge-pill">
              <Award size={13} />
              <span>SDG-13 Climate Action · AI Decision Support</span>
            </div>
            <h1 className="planner-page-title">Climate Action Planner & Recommendations</h1>
            <p className="planner-page-subtitle">
              Scientifically-grounded reduction actions prioritized by your largest emission drivers, verified progress tracking, and auditable goal governance.
            </p>
          </div>

          <div className="planner-top-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setGoalModalOpen(true)}
            >
              <Plus size={16} /> Set Reduction Target
            </button>

            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={generatePlan}
              disabled={planRequest.current}
            >
              <Sparkles size={16} className="text-emerald" /> Regenerate 7-Day Plan
            </button>

            <button
              type="button"
              className={`btn-icon-refresh ${refreshing ? 'spinning' : ''}`}
              title="Refresh Actions & Targets"
              onClick={() => loadData(true)}
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {/* Alerts & Notifications */}
        {error && (
          <div className="planner-alert error" role="alert">
            <AlertTriangle size={18} />
            <span>{error}</span>
            <button type="button" onClick={() => setError('')}><X size={14} /></button>
          </div>
        )}
        {notice && (
          <div className="planner-alert notice" role="status">
            <CheckCircle2 size={18} />
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice('')}><X size={14} /></button>
          </div>
        )}

        {/* Top 4 KPI Summary Cards */}
        <div className="planner-kpi-grid">
          {/* Card 1: Active 7-Day Participation */}
          <div className="planner-kpi-card highlight-emerald">
            <div className="kpi-card-header">
              <span className="kpi-label">7-Day Plan Participation</span>
              <div className="kpi-icon-wrap emerald">
                <CheckCircle2 size={18} />
              </div>
            </div>
            <div className="kpi-primary-val">
              {completedActions.length} <span className="kpi-sub-total">/ {planActions.length || 7} Completed</span>
            </div>
            <div className="planner-progress-track">
              <div
                className="planner-progress-fill"
                style={{ width: `${Math.min(100, (completedActions.length / Math.max(1, planActions.length)) * 100)}%` }}
              />
            </div>
            <div className="kpi-secondary-row">
              <span className="kpi-subtext">
                {inProgressActions.length} in progress · {plannedActions.length} planned
              </span>
            </div>
          </div>

          {/* Card 2: Hypothetical Potential Savings */}
          <div className="planner-kpi-card">
            <div className="kpi-card-header">
              <span className="kpi-label">Potential Modeled Savings</span>
              <div className="kpi-icon-wrap amber">
                <TrendingDown size={18} />
              </div>
            </div>
            <div className="kpi-primary-val text-amber">
              {formatKg(totalCompletedSavingsKg)}
            </div>
            <div className="kpi-secondary-row">
              <span className="badge-alt-unit">{formatTonnes(totalCompletedSavingsKg)} CO₂e</span>
              <span className="kpi-subtext">Documented rate calculation</span>
            </div>
            <div className="kpi-footer-note">
              ⚠️ Hypothetical potential from completed action items
            </div>
          </div>

          {/* Card 3: Verified Real-World Changes */}
          <div className="planner-kpi-card">
            <div className="kpi-card-header">
              <span className="kpi-label">Verified Real Reduction</span>
              <div className="kpi-icon-wrap blue">
                <ShieldCheck size={18} />
              </div>
            </div>
            <div className="kpi-primary-val text-blue">
              {activeGoals[0] ? (
                activeGoals[0].actualChangeKg > 0 ? (
                  `-${activeGoals[0].actualChangeKg} kg`
                ) : (
                  `${Math.abs(activeGoals[0].actualChangeKg || 0)} kg`
                )
              ) : (
                '0.00 kg'
              )}
            </div>
            <div className="kpi-secondary-row">
              <span className="kpi-subtext">
                {activeGoals[0]?.verificationStatus === 'verified_reduction'
                  ? '✅ Confirmed by subsequent activity logs'
                  : '⏳ Awaiting subsequent activity measurements'}
              </span>
            </div>
            <div className="kpi-footer-note">
              Audited separately from action participation
            </div>
          </div>

          {/* Card 4: Target Goals Status */}
          <div className="planner-kpi-card">
            <div className="kpi-card-header">
              <span className="kpi-label">Reduction Targets</span>
              <div className="kpi-icon-wrap purple">
                <Target size={18} />
              </div>
            </div>
            <div className="kpi-primary-val">
              {onTrackGoalsCount} <span className="kpi-sub-total">/ {activeGoals.length || 0} On Track</span>
            </div>
            <div className="kpi-secondary-row">
              <span className="kpi-status-badge sufficient">
                {activeGoals.length > 0 ? `${activeGoals.length} Active Target(s)` : 'No Active Targets'}
              </span>
            </div>
            <div className="kpi-footer-note">
              Evaluated against real recorded emissions
            </div>
          </div>
        </div>

        {/* Gemini AI Climate Coach Executive Briefing Banner */}
        <div className="planner-coach-briefing-card">
          <div className="coach-briefing-header">
            <div className="coach-avatar">
              <Sparkles size={18} className="text-emerald" />
            </div>
            <div className="coach-meta">
              <strong>Gemini AI Climate Coach Briefing</strong>
              <span>
                {plan?.narrativeSource === 'gemini' ? 'Personalized AI Guidance' : 'Deterministic Recommendation Synthesis'} · Based on your largest emission sources
              </span>
            </div>
            <label className="coach-gemini-toggle">
              <input
                type="checkbox"
                checked={useGemini}
                onChange={(e) => setUseGemini(e.target.checked)}
              />
              <span>Enable Gemini AI Personalization</span>
            </label>
          </div>
          <p className="coach-briefing-text">
            {plan?.narrative || (
              <>
                Your recent emission profile is primarily driven by <strong>{highestImpactCategories[0]?.label || 'recorded activities'}</strong> ({highestImpactCategories[0]?.contributionPercentage || 0}% share). Prioritizing high-impact actions in this sector delivers the greatest reduction leverage. Action completions are tracked as participation; real-world emissions reductions are independently verified through subsequent logs.
              </>
            )}
          </p>
        </div>

        {/* Main Tabbed Navigation */}
        <div className="planner-tabs-nav">
          <button
            type="button"
            className={`planner-tab-btn ${activeTab === 'feed' ? 'active' : ''}`}
            onClick={() => setActiveTab('feed')}
          >
            <Sparkles size={16} />
            <span>AI Recommendations Feed</span>
            <span className="tab-count-pill">{recommendations.length}</span>
          </button>

          <button
            type="button"
            className={`planner-tab-btn ${activeTab === 'planner' ? 'active' : ''}`}
            onClick={() => setActiveTab('planner')}
          >
            <Calendar size={16} />
            <span>Active 7-Day Action Plan</span>
            <span className="tab-count-pill">{planActions.length}</span>
          </button>

          <button
            type="button"
            className={`planner-tab-btn ${activeTab === 'goals' ? 'active' : ''}`}
            onClick={() => setActiveTab('goals')}
          >
            <Target size={16} />
            <span>Reduction Targets & Goal Tracker</span>
            <span className="tab-count-pill">{goals.length}</span>
          </button>
        </div>

        {/* ========================================================
            TAB 1: AI RECOMMENDATIONS FEED (PRIORITIZED CATALOG)
        ======================================================== */}
        {activeTab === 'feed' && (
          <div className="planner-tab-content">
            {/* Category Filter Pills */}
            <div className="planner-filter-pills-row">
              <button
                type="button"
                className={`filter-pill ${categoryFilter === 'all' ? 'active' : ''}`}
                onClick={() => setCategoryFilter('all')}
              >
                All Opportunities ({recommendations.length})
              </button>
              <button
                type="button"
                className={`filter-pill high ${categoryFilter === 'high' ? 'active' : ''}`}
                onClick={() => setCategoryFilter('high')}
              >
                🔥 High Impact Only
              </button>
              <button
                type="button"
                className={`filter-pill ${categoryFilter === 'electricity' ? 'active' : ''}`}
                onClick={() => setCategoryFilter('electricity')}
              >
                ⚡ Electricity & Energy
              </button>
              <button
                type="button"
                className={`filter-pill ${categoryFilter === 'transport' ? 'active' : ''}`}
                onClick={() => setCategoryFilter('transport')}
              >
                🚗 Transportation
              </button>
              <button
                type="button"
                className={`filter-pill ${categoryFilter === 'food' ? 'active' : ''}`}
                onClick={() => setCategoryFilter('food')}
              >
                🥗 Food & Diet
              </button>
              <button
                type="button"
                className={`filter-pill ${categoryFilter === 'water' ? 'active' : ''}`}
                onClick={() => setCategoryFilter('water')}
              >
                💧 Water Usage
              </button>
              <button
                type="button"
                className={`filter-pill ${categoryFilter === 'waste' ? 'active' : ''}`}
                onClick={() => setCategoryFilter('waste')}
              >
                ♻️ Waste Management
              </button>
              <button
                type="button"
                className={`filter-pill ${categoryFilter === 'facilities' ? 'active' : ''}`}
                onClick={() => setCategoryFilter('facilities')}
              >
                🏢 Facilities & Buildings
              </button>
            </div>

            {/* Recommendations Grid */}
            {filteredRecommendations.length === 0 ? (
              <div className="planner-empty-state">
                <Info size={32} />
                <h3>No recommendations match this filter</h3>
                <p>Select another category or view All Opportunities above.</p>
              </div>
            ) : (
              <div className="recommendations-grid">
                {filteredRecommendations.map((rec) => {
                  const CatIcon = CATEGORY_ICONS[rec.category] || Package;
                  const catColor = CATEGORY_COLORS[rec.category] || '#64748b';

                  return (
                    <article className="rec-card" key={rec.id}>
                      <div className="rec-card-top">
                        <div className="rec-category-badge" style={{ color: catColor, background: `${catColor}18` }}>
                          <CatIcon size={14} />
                          <span>{rec.categoryLabel}</span>
                        </div>

                        <span className={`impact-badge ${rec.impactLevel}`}>
                          {rec.impactLevel === 'high' && '🔥 HIGH IMPACT'}
                          {rec.impactLevel === 'medium' && '⚡ MEDIUM IMPACT'}
                          {rec.impactLevel === 'low' && '🌱 QUICK WIN'}
                        </span>
                      </div>

                      <h3 className="rec-title">{rec.title}</h3>
                      <p className="rec-explanation">{rec.explanation}</p>

                      <div className="rec-target-box">
                        <strong>Suggested Action Target:</strong>
                        <span>{rec.suggestedTarget}</span>
                      </div>

                      {/* Reason for Recommendation */}
                      <div className="rec-reason-box">
                        <div className="reason-label">Reason for Recommendation:</div>
                        <p>{rec.reason}</p>
                      </div>

                      {/* Documented Potential Savings Calculation */}
                      <div className="rec-savings-box">
                        <div className="savings-primary-row">
                          <span className="savings-label">Potential Avoided Emissions:</span>
                          <strong className="savings-val">
                            {formatKg(rec.estimatedPotentialSavingsKg)} CO₂e
                          </strong>
                        </div>
                        <div className="savings-formula-note">
                          📐 <strong>Calculation:</strong> {rec.savingsCalculation}
                        </div>
                      </div>

                      {/* Action Buttons: Accept / Dismiss */}
                      <div className="rec-card-actions">
                        <button
                          type="button"
                          className="btn btn-accept"
                          onClick={() => acceptRecommendation(rec)}
                        >
                          <CheckCircle2 size={15} /> Accept into Plan
                        </button>
                        <button
                          type="button"
                          className="btn btn-dismiss"
                          onClick={() => dismissRecommendation(rec)}
                        >
                          <X size={15} /> Dismiss
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            TAB 2: ACTIVE 7-DAY ACTION PLAN
        ======================================================== */}
        {activeTab === 'planner' && (
          <div className="planner-tab-content">
            <div className="planner-section-intro">
              <div>
                <h2>Your 7-Day Sequenced Climate Plan</h2>
                <p>Structured daily micro-actions prioritized to address your largest emission drivers without operational disruption.</p>
              </div>
              <span className="participation-note">
                🛡️ <em>Participation Rule: Completing actions records participation. Actual emission reductions are audited from subsequent activity records.</em>
              </span>
            </div>

            {planActions.length === 0 ? (
              <div className="planner-empty-state">
                <Calendar size={36} />
                <h3>No active 7-day plan</h3>
                <p>Click "Regenerate 7-Day Plan" above to create an optimized schedule based on your latest activity records.</p>
                <button type="button" className="btn btn-primary" onClick={generatePlan}>
                  Generate 7-Day Plan
                </button>
              </div>
            ) : (
              <div className="actions-timeline-list">
                {planActions.map((action) => {
                  const CatIcon = CATEGORY_ICONS[action.category] || Package;
                  const catColor = CATEGORY_COLORS[action.category] || '#64748b';
                  const StatusIcon = STATUS_ICONS[action.status] || Clock3;

                  return (
                    <article className={`timeline-action-card status-${action.status}`} key={action.id}>
                      <div className="timeline-day-pill">
                        Day {action.dayNumber}
                      </div>

                      <div className="timeline-action-body">
                        <div className="action-meta-row">
                          <span className="action-cat-tag" style={{ color: catColor }}>
                            <CatIcon size={14} /> {action.category}
                          </span>
                          <span className={`impact-badge ${action.impactLevel}`}>
                            {action.impactLevel?.toUpperCase() || 'HIGH'} IMPACT
                          </span>
                          <span className="action-savings-tag">
                            Potential: {formatKg(action.estimatedPotentialSavingsKg)} CO₂e
                          </span>
                        </div>

                        <h3 className="action-heading">{action.title}</h3>
                        <p className="action-desc">{action.explanation}</p>

                        <div className="action-target-row">
                          <strong>Action Target:</strong> {action.suggestedTarget}
                        </div>

                        {/* Documented Calculation */}
                        {action.savingsCalculation && (
                          <div className="action-calc-line">
                            📐 <strong>Documented Formula:</strong> {action.savingsCalculation}
                          </div>
                        )}
                      </div>

                      {/* Status Selector & Quick Completion */}
                      <div className="timeline-status-controls">
                        <div className="status-dropdown-wrap">
                          <StatusIcon size={16} className={`status-icon-${action.status}`} />
                          <select
                            value={action.status}
                            onChange={(e) => updateActionStatus(action.id, e.target.value)}
                            className="status-select"
                          >
                            <option value="planned">Planned</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                            <option value="skipped">Skipped</option>
                            <option value="dismissed">Dismissed</option>
                          </select>
                        </div>

                        {action.status !== 'completed' ? (
                          <button
                            type="button"
                            className="btn btn-quick-complete"
                            onClick={() => updateActionStatus(action.id, 'completed')}
                            title="Mark as completed"
                          >
                            <CheckCircle2 size={15} /> Complete
                          </button>
                        ) : (
                          <span className="completed-timestamp">
                            ✅ Done {action.completedAt ? new Date(action.completedAt).toLocaleDateString() : ''}
                          </span>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            TAB 3: REDUCTION TARGETS & GOAL TRACKER (DUAL AUDIT)
        ======================================================== */}
        {activeTab === 'goals' && (
          <div className="planner-tab-content">
            <div className="planner-section-intro">
              <div>
                <h2>Carbon Reduction Targets & Impact Auditing</h2>
                <p>Track real-world recorded emissions against your target ceilings, strictly separated from hypothetical participation savings.</p>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setGoalModalOpen(true)}
              >
                <Plus size={16} /> New Reduction Target
              </button>
            </div>

            {goals.length === 0 ? (
              <div className="planner-empty-state">
                <Target size={36} />
                <h3>No reduction targets established</h3>
                <p>Create a weekly or monthly target to measure genuine verified emission decreases against historical baselines.</p>
                <button type="button" className="btn btn-primary" onClick={() => setGoalModalOpen(true)}>
                  Create Your First Target
                </button>
              </div>
            ) : (
              <div className="goals-cards-list">
                {goals.map((goal) => {
                  const CatIcon = CATEGORY_ICONS[goal.category] || Target;
                  const catColor = CATEGORY_COLORS[goal.category] || '#3b82f6';
                  const isVerified = goal.verificationStatus === 'verified_reduction';

                  return (
                    <article className="goal-card" key={goal.id}>
                      <div className="goal-card-top">
                        <div className="goal-title-group">
                          <div className="goal-cat-icon" style={{ backgroundColor: `${catColor}18`, color: catColor }}>
                            <CatIcon size={20} />
                          </div>
                          <div>
                            <h3 className="goal-heading">
                              {goal.period === 'weekly' ? 'Weekly' : 'Monthly'} Target: {formatKg(goal.targetKg)} Ceiling
                            </h3>
                            <span className="goal-sub">
                              {goal.category ? `Sector: ${goal.category.toUpperCase()}` : 'Scope: All Emission Categories'} · Established {goal.started_at ? new Date(goal.started_at).toLocaleDateString() : 'Active'}
                            </span>
                          </div>
                        </div>

                        <div className="goal-status-actions">
                          <span className={`goal-state-pill ${goal.isTargetAchieved ? 'on-track' : 'needs-action'}`}>
                            {goal.isTargetAchieved ? '🎯 Target On Track' : '⚠️ Ceiling Exceeded'}
                          </span>

                          <select
                            value={goal.status}
                            onChange={(e) => handleUpdateGoalStatus(goal.id, e.target.value)}
                            className="goal-select"
                          >
                            <option value="active">Active</option>
                            <option value="completed">Completed</option>
                            <option value="archived">Archived</option>
                          </select>
                        </div>
                      </div>

                      {/* Dual Metric Tracking Grid: Real Measurements vs Hypothetical Savings */}
                      <div className="goal-metrics-comparison-grid">
                        {/* Actual Measured Progress */}
                        <div className="metric-box actual-measured">
                          <div className="metric-box-title">
                            <ShieldCheck size={16} className="text-blue" />
                            <span>Verified Recorded Emissions</span>
                          </div>
                          <div className="metric-main-stat">
                            {formatKg(goal.actualRecordedKg || 0)}
                            <small> / {formatKg(goal.targetKg)} ceiling</small>
                          </div>
                          <div className="metric-sub-stat">
                            Pre-Goal Baseline: {formatKg(goal.baselineKg)} · Measured Change:{' '}
                            <strong className={goal.actualChangeKg > 0 ? 'text-emerald' : 'text-amber'}>
                              {goal.actualChangeKg > 0 ? `-${goal.actualChangeKg} kg (-${goal.actualReductionPct}%)` : `+${Math.abs(goal.actualChangeKg || 0)} kg`}
                            </strong>
                          </div>
                        </div>

                        {/* Hypothetical / Modeled Savings */}
                        <div className="metric-box modeled-savings">
                          <div className="metric-box-title">
                            <Sparkles size={16} className="text-amber" />
                            <span>Hypothetical Modeled Savings</span>
                          </div>
                          <div className="metric-main-stat text-amber">
                            {formatKg(goal.hypotheticalSavingsKg || 0)}
                          </div>
                          <div className="metric-sub-stat">
                            Participation: {goal.completedActionsCount || 0} action(s) marked complete under this target
                          </div>
                        </div>
                      </div>

                      {/* Scientific Verification Banner */}
                      <div className={`verification-banner ${goal.verificationStatus}`}>
                        {isVerified ? (
                          <ShieldCheck size={18} className="text-emerald" />
                        ) : (
                          <Info size={18} className="text-amber" />
                        )}
                        <span>{goal.verificationMessage}</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Target Creation Modal */}
        {goalModalOpen && (
          <div className="modal-backdrop">
            <div className="modal-content goal-modal">
              <div className="modal-header">
                <div>
                  <h2>Create Carbon Reduction Target</h2>
                  <p>Set an auditable ceiling for your weekly or monthly footprint.</p>
                </div>
                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={() => setGoalModalOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateGoal} className="modal-form">
                <div className="form-group">
                  <label>Evaluation Period</label>
                  <select
                    value={goalForm.period}
                    onChange={(e) => setGoalForm({ ...goalForm, period: e.target.value })}
                  >
                    <option value="weekly">Weekly Target (7 Days)</option>
                    <option value="monthly">Monthly Target (30 Days)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Sector Scope</label>
                  <select
                    value={goalForm.category}
                    onChange={(e) => setGoalForm({ ...goalForm, category: e.target.value })}
                  >
                    <option value="">All Categories (Total Footprint)</option>
                    <option value="electricity">Electricity & Energy</option>
                    <option value="transport">Transportation & Commuting</option>
                    <option value="food">Food & Diet</option>
                    <option value="water">Water Usage</option>
                    <option value="waste">Waste Management</option>
                    <option value="facilities">Facilities & Buildings</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Target Emission Ceiling (kg CO₂e)</label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={goalForm.targetKg}
                    onChange={(e) => setGoalForm({ ...goalForm, targetKg: e.target.value })}
                    required
                  />
                  <small className="form-hint">
                    Emissions recorded below this ceiling will mark the target as successfully achieved.
                  </small>
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setGoalModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={goalSaving}
                  >
                    {goalSaving ? 'Creating Target...' : 'Create Target'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ActionPlan;