import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  Plus,
  CheckCircle,
  ArrowRight,
  ShieldCheck,
  Zap,
  Globe,
  Compass,
  Brain,
  Layers,
  Leaf,
} from 'lucide-react';
import api from '../services/api';
import Layout from '../components/Layout';
import AiInsightsPanel from '../components/AiInsightsPanel';

const impactBadge = (impact) => {
  const styles = {
    high: { bg: 'rgba(239, 68, 68, 0.15)', color: '#F87171', border: 'rgba(239, 68, 68, 0.3)', label: 'High Impact' },
    medium: { bg: 'rgba(245, 158, 11, 0.15)', color: '#FBBF24', border: 'rgba(245, 158, 11, 0.3)', label: 'Medium Impact' },
    low: { bg: 'rgba(16, 185, 129, 0.15)', color: '#34D399', border: 'rgba(16, 185, 129, 0.3)', label: 'Low Impact' },
  };
  const s = styles[impact] || styles.low;
  return (
    <span
      style={{
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        padding: '3px 10px',
        borderRadius: '12px',
        fontSize: '0.72rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.03em',
      }}
    >
      {s.label}
    </span>
  );
};

const Insights = () => {
  const [activeTab, setActiveTab] = useState('personal'); // Default to personal as requested
  const [regions, setRegions] = useState([]);
  const [selectedRegionId, setSelectedRegionId] = useState('');
  const [insights, setInsights] = useState([]);
  const [prediction, setPrediction] = useState(null);
  const [predictionMetrics, setPredictionMetrics] = useState(null);
  const [totalEmissions, setTotalEmissions] = useState(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [loadingPrediction, setLoadingPrediction] = useState(false);
  const [insightsError, setInsightsError] = useState('');
  const [predictionError, setPredictionError] = useState('');
  const [hasFetchedPersonal, setHasFetchedPersonal] = useState(false);

  useEffect(() => {
    api.get('/environment/regions')
      .then((res) => {
        const list = res.data || [];
        setRegions(list);
        if (list.length > 0 && !selectedRegionId) {
          setSelectedRegionId(String(list[0].id));
        }
      })
      .catch((err) => console.warn('Could not load regions in Insights:', err.message));
  }, [selectedRegionId]);

  const fetchInsights = async () => {
    setLoadingInsights(true);
    setInsightsError('');
    try {
      const res = await api.get('/reports/insights');
      const loaded = res.data?.insights || [];
      setInsights(loaded);
      setTotalEmissions(res.data?.totalEmissions || '0.00');
    } catch (err) {
      console.warn('Insights request fallback:', err.message);
      setInsightsError(err.response?.data?.message || 'Unable to load personalized insights. Please verify backend connection.');
    } finally {
      setLoadingInsights(false);
    }
  };

  const fetchPrediction = async () => {
    setLoadingPrediction(true);
    setPredictionError('');
    try {
      const res = await api.get('/reports/predict');
      setPrediction(res.data?.prediction || '');
      if (res.data?.avgDaily || res.data?.predictedMonthly) {
        setPredictionMetrics({
          avgDaily: res.data.avgDaily,
          predictedMonthly: res.data.predictedMonthly,
        });
      }
    } catch (err) {
      console.warn('Prediction request fallback:', err.message);
      setPredictionError(err.response?.data?.message || 'Unable to generate impact prediction. Please verify backend connection.');
    } finally {
      setLoadingPrediction(false);
    }
  };

  // Auto-fetch personal footprint data when tab becomes active
  useEffect(() => {
    if (activeTab === 'personal' && !hasFetchedPersonal) {
      setHasFetchedPersonal(true);
      fetchInsights();
      fetchPrediction();
    }
  }, [activeTab, hasFetchedPersonal]);

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.35)', color: '#34D399', fontSize: '0.74rem', fontWeight: 700, padding: '4px 12px', borderRadius: '999px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
            <Brain size={13} />
            <span>AI Climate Intelligence & Modeling</span>
          </div>
          <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: '1.95rem', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.02em', margin: '0 0 6px' }}>
            AI Environmental & Footprint Insights
          </h1>
          <p style={{ color: '#94A3B8', fontSize: '0.88rem', margin: 0, maxWidth: '780px' }}>
            Grounded numerical calculations, continuous telemetry synthesis, and explainable AI insights derived deterministically from your logged activities and global climate observations.
          </p>
        </div>

        {/* Tab Toggle */}
        <div style={{ display: 'flex', gap: '6px', background: '#0E1726', padding: '4px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <button
            type="button"
            className="btn"
            onClick={() => setActiveTab('personal')}
            style={{
              fontSize: '0.82rem',
              padding: '8px 16px',
              background: activeTab === 'personal' ? '#10B981' : 'transparent',
              color: activeTab === 'personal' ? '#080D1A' : '#94A3B8',
              border: 0,
              borderRadius: '8px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            👤 Personal Footprint Insights
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => setActiveTab('environmental')}
            style={{
              fontSize: '0.82rem',
              padding: '8px 16px',
              background: activeTab === 'environmental' ? '#10B981' : 'transparent',
              color: activeTab === 'environmental' ? '#080D1A' : '#94A3B8',
              border: 0,
              borderRadius: '8px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            🌍 Regional Climate Telemetry
          </button>
        </div>
      </div>

      {activeTab === 'environmental' ? (
        <div style={{ display: 'grid', gap: '20px' }}>
          <div className="tracker-card" style={{ background: '#0E1726', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <span style={{ fontSize: '0.88rem', color: '#FFFFFF', fontWeight: 700 }}>Select Monitored Climate Region:</span>
            <select
              value={selectedRegionId}
              onChange={(e) => setSelectedRegionId(e.target.value)}
              className="select-region"
              style={{ minWidth: '220px' }}
            >
              {regions.map((reg) => (
                <option key={reg.id} value={reg.id}>
                  {reg.name} {reg.country ? `(${reg.country})` : ''}
                </option>
              ))}
            </select>
          </div>

          <AiInsightsPanel
            regionId={selectedRegionId}
            regionName={regions.find((r) => String(r.id) === String(selectedRegionId))?.name}
          />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '24px' }}>
          {/* Personalized Insights Panel */}
          <div
            className="tracker-card"
            style={{
              background: '#0E1726',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 4px 24px rgba(0, 0, 0, 0.35)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '18px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                paddingBottom: '14px',
              }}
            >
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#FFFFFF', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🔍</span> Personalized AI Insights
                </h3>
                <span style={{ fontSize: '0.78rem', color: '#94A3B8' }}>
                  Targeted mitigation vectors derived from your logged activities
                </span>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                style={{ width: 'auto', padding: '7px 16px', fontSize: '0.8rem' }}
                onClick={fetchInsights}
                disabled={loadingInsights}
              >
                <RefreshCw size={13} className={loadingInsights ? 'animate-spin' : ''} style={{ marginRight: '6px' }} />
                {loadingInsights ? 'Analyzing...' : '✨ Analyze'}
              </button>
            </div>

            {totalEmissions && (
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: '10px',
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  marginBottom: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ color: '#94A3B8', fontSize: '0.82rem', fontWeight: 600 }}>Total Footprint Evaluated:</span>
                <span style={{ fontWeight: 800, color: '#34D399', fontSize: '1.05rem' }}>
                  {totalEmissions} kg CO₂e
                </span>
              </div>
            )}

            {insightsError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '12px 16px', borderRadius: '10px', color: '#F87171', fontSize: '0.82rem', marginBottom: '16px' }}>
                ⚠️ {insightsError}
              </div>
            )}

            {loadingInsights && (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94A3B8' }}>
                <RefreshCw size={32} className="animate-spin text-emerald" style={{ margin: '0 auto 12px' }} />
                <p style={{ fontSize: '0.88rem' }}>Evaluating activity entries across emission scopes...</p>
              </div>
            )}

            {!loadingInsights && insights.length === 0 && (
              <div style={{ textAlign: 'center', padding: '50px 20px', color: '#94A3B8' }}>
                <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🤖</div>
                <h4 style={{ color: '#FFFFFF', fontSize: '1rem', fontWeight: 700, margin: '0 0 6px' }}>No Activity Data Recorded Yet</h4>
                <p style={{ fontSize: '0.84rem', maxWidth: '380px', margin: '0 auto 16px' }}>
                  Click Analyze above to synthesize baseline insights, or log your personal energy and transport activities.
                </p>
                <Link to="/activity" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '8px 16px' }}>
                  <Plus size={14} /> Log Your First Activity
                </Link>
              </div>
            )}

            {!loadingInsights && insights.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {insights.map((insight, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '14px 16px',
                      borderRadius: '12px',
                      background: '#111C31',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '10px',
                        marginBottom: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '1.35rem' }}>{insight.icon}</span>
                        <h4 style={{ fontFamily: 'Manrope, sans-serif', fontSize: '0.95rem', fontWeight: 700, color: '#FFFFFF', margin: 0 }}>
                          {insight.title}
                        </h4>
                      </div>
                      {impactBadge(insight.impact)}
                    </div>
                    <p style={{ color: '#94A3B8', fontSize: '0.84rem', lineHeight: 1.55, margin: 0 }}>
                      {insight.description}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Climate Impact Prediction Panel */}
          <div
            className="tracker-card"
            style={{
              background: '#0E1726',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 4px 24px rgba(0, 0, 0, 0.35)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '18px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                paddingBottom: '14px',
              }}
            >
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#FFFFFF', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📈</span> Forward Impact Prediction
                </h3>
                <span style={{ fontSize: '0.78rem', color: '#94A3B8' }}>
                  Statistical run-rate trajectory and forward climate scenario
                </span>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                style={{ width: 'auto', padding: '7px 16px', fontSize: '0.8rem' }}
                onClick={fetchPrediction}
                disabled={loadingPrediction}
              >
                <RefreshCw size={13} className={loadingPrediction ? 'animate-spin' : ''} style={{ marginRight: '6px' }} />
                {loadingPrediction ? 'Predicting...' : '🔮 Predict'}
              </button>
            </div>

            {predictionMetrics && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                  marginBottom: '18px',
                }}
              >
                <div style={{ background: '#111C31', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <span style={{ fontSize: '0.72rem', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '2px' }}>
                    Daily Baseline
                  </span>
                  <strong style={{ fontSize: '1.25rem', color: '#38BDF8', fontWeight: 800 }}>
                    {predictionMetrics.avgDaily} <small style={{ fontSize: '0.75rem', color: '#94A3B8' }}>kg/day</small>
                  </strong>
                </div>
                <div style={{ background: '#111C31', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <span style={{ fontSize: '0.72rem', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '2px' }}>
                    30-Day Forward Total
                  </span>
                  <strong style={{ fontSize: '1.25rem', color: '#34D399', fontWeight: 800 }}>
                    {predictionMetrics.predictedMonthly} <small style={{ fontSize: '0.75rem', color: '#94A3B8' }}>kg CO₂e</small>
                  </strong>
                </div>
              </div>
            )}

            {predictionError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '12px 16px', borderRadius: '10px', color: '#F87171', fontSize: '0.82rem', marginBottom: '16px' }}>
                ⚠️ {predictionError}
              </div>
            )}

            {loadingPrediction && (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94A3B8' }}>
                <RefreshCw size={32} className="animate-spin text-emerald" style={{ margin: '0 auto 12px' }} />
                <p style={{ fontSize: '0.88rem' }}>Generating statistical run-rate and scenario simulation...</p>
              </div>
            )}

            {!loadingPrediction && !prediction && (
              <div style={{ textAlign: 'center', padding: '50px 20px', color: '#94A3B8' }}>
                <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🌍</div>
                <h4 style={{ color: '#FFFFFF', fontSize: '1rem', fontWeight: 700, margin: '0 0 6px' }}>Generate Your Forward Trajectory</h4>
                <p style={{ fontSize: '0.84rem', maxWidth: '380px', margin: '0 auto 16px' }}>
                  Click Predict above to forecast your annual emissions and review targeted reduction measures.
                </p>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={fetchPrediction}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '8px 16px' }}
                >
                  <TrendingUp size={14} /> Calculate Forward Forecast
                </button>
              </div>
            )}

            {!loadingPrediction && prediction && (
              <div
                style={{
                  background: '#111C31',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  padding: '20px',
                  borderRadius: '12px',
                  lineHeight: 1.7,
                  whiteSpace: 'pre-wrap',
                  color: '#CBD5E1',
                  fontSize: '0.88rem',
                }}
              >
                {prediction}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sustainable Benchmark Reference Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginTop: '32px',
        }}
      >
        {[
          { icon: '🌲', title: '1 Mature Tree Absorbs', value: '~20 kg CO₂ / year' },
          { icon: '🚗', title: 'Passenger Vehicle Emits', value: '0.21 kg CO₂ / km' },
          { icon: '🌍', title: 'Global Per-Capita Baseline', value: '350 kg CO₂ / month' },
          { icon: '⚡', title: 'National Grid Average', value: '0.50 kg CO₂ / kWh' },
        ].map((card) => (
          <div
            key={card.title}
            className="tracker-card"
            style={{
              background: '#0E1726',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              textAlign: 'center',
              padding: '18px 16px',
            }}
          >
            <div style={{ fontSize: '1.8rem', marginBottom: '6px' }}>{card.icon}</div>
            <div style={{ color: '#94A3B8', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>
              {card.title}
            </div>
            <div style={{ fontWeight: 800, color: '#34D399', fontSize: '1.05rem' }}>
              {card.value}
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
};

export default Insights;
