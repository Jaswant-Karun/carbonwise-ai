import React, { useState } from 'react';
import api from '../services/api';
import Layout from '../components/Layout';
//Added new Activity
const impactBadge = (impact) => {
  const styles = {
    high: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444', label: 'High Impact' },
    medium: { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', label: 'Medium Impact' },
    low: { bg: 'rgba(16,185,129,0.15)', color: '#10b981', label: 'Low Impact' },
  };
  const s = styles[impact] || styles.low;
  return (
    <span
      style={{
        background: s.bg,
        color: s.color,
        padding: '3px 10px',
        borderRadius: '12px',
        fontSize: '0.75rem',
        fontWeight: 600,
      }}
    >
      {s.label}
    </span>
  );
};

import AiInsightsPanel from '../components/AiInsightsPanel';

const Insights = () => {
  const [activeTab, setActiveTab] = useState('environmental'); // 'environmental' or 'personal'
  const [regions, setRegions] = useState([]);
  const [selectedRegionId, setSelectedRegionId] = useState('');
  const [insights, setInsights] = useState([]);
  const [prediction, setPrediction] = useState(null);
  const [totalEmissions, setTotalEmissions] = useState(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [loadingPrediction, setLoadingPrediction] = useState(false);

  React.useEffect(() => {
    api.get('/environment/regions')
      .then((res) => {
        const list = res.data || [];
        setRegions(list);
        if (list.length > 0 && !selectedRegionId) {
          setSelectedRegionId(String(list[0].id));
        }
      })
      .catch((err) => console.warn('Could not load regions in Insights:', err.message));
  }, []);

  const fetchInsights = async () => {
    setLoadingInsights(true);
    try {
      const res = await api.get('/reports/insights');
      setInsights(res.data.insights || []);
      setTotalEmissions(res.data.totalEmissions);
    } catch (err) {
      alert(err.response?.data?.message || 'Error fetching insights. Is the backend running?');
    }
    setLoadingInsights(false);
  };

  const fetchPrediction = async () => {
    setLoadingPrediction(true);
    try {
      const res = await api.get('/reports/predict');
      setPrediction(res.data.prediction);
    } catch (err) {
      alert(err.response?.data?.message || 'Error fetching prediction. Is the backend running?');
    }
    setLoadingPrediction(false);
  };

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '2rem', marginBottom: '8px' }}>
            AI Environmental Insights
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>
            Gemini AI acts as an explanation assistant for verified climate telemetry and personal footprint data.
          </p>
        </div>

        {/* Tab Toggle */}
        <div style={{ display: 'flex', gap: '8px', background: 'rgba(15, 23, 42, 0.8)', padding: '4px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <button
            type="button"
            className="btn"
            onClick={() => setActiveTab('environmental')}
            style={{
              fontSize: '0.82rem',
              padding: '8px 16px',
              background: activeTab === 'environmental' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'environmental' ? '#090d16' : '#94a3b8',
              border: 0,
              fontWeight: 700,
            }}
          >
            🌍 Regional Climate Insights
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => setActiveTab('personal')}
            style={{
              fontSize: '0.82rem',
              padding: '8px 16px',
              background: activeTab === 'personal' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'personal' ? '#090d16' : '#94a3b8',
              border: 0,
              fontWeight: 700,
            }}
          >
            👤 Personal Footprint Insights
          </button>
        </div>
      </div>

      {activeTab === 'environmental' ? (
        <div style={{ display: 'grid', gap: '20px' }}>
          <div className="tracker-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <span style={{ fontSize: '0.88rem', color: '#f1f5f9', fontWeight: 600 }}>Select Monitored Region:</span>
            <select
              value={selectedRegionId}
              onChange={(e) => setSelectedRegionId(e.target.value)}
              className="region-selector-clean"
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
        {/* Personalized Insights */}
        <div className="glass-panel">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
            }}
          >
            <h3>🔍 Personalized Insights</h3>
            <button
              className="btn"
              style={{ width: 'auto', padding: '8px 16px' }}
              onClick={fetchInsights}
              disabled={loadingInsights}
            >
              {loadingInsights ? 'Analyzing...' : '✨ Analyze'}
            </button>
          </div>

          {totalEmissions && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '8px',
                background: 'rgba(16,185,129,0.1)',
                border: '1px solid rgba(16,185,129,0.2)',
                marginBottom: '20px',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ color: 'var(--text-muted)' }}>Total Emissions Analyzed</span>
              <span style={{ fontWeight: 700, color: 'var(--primary)' }}>
                {totalEmissions} kg CO₂
              </span>
            </div>
          )}

          {insights.length === 0 && !loadingInsights && (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🤖</div>
              <p>Click Analyze to generate AI insights from your logged activities.</p>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {insights.map((insight, i) => (
              <div
                key={i}
                style={{
                  padding: '16px',
                  borderRadius: '10px',
                  background: 'rgba(0,0,0,0.2)',
                  border: '1px solid var(--surface-border)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.5rem' }}>{insight.icon}</span>
                    <h4 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1rem' }}>
                      {insight.title}
                    </h4>
                  </div>
                  {impactBadge(insight.impact)}
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                  {insight.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Climate Impact Prediction */}
        <div className="glass-panel">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
            }}
          >
            <h3>📈 Impact Prediction</h3>
            <button
              className="btn"
              style={{ width: 'auto', padding: '8px 16px' }}
              onClick={fetchPrediction}
              disabled={loadingPrediction}
            >
              {loadingPrediction ? 'Predicting...' : '🔮 Predict'}
            </button>
          </div>

          {!prediction && !loadingPrediction && (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🌍</div>
              <p>
                Click Predict to see how your current habits will impact the environment
                over the next year.
              </p>
            </div>
          )}

          {prediction && (
            <div
              style={{
                background: 'rgba(0,0,0,0.2)',
                padding: '20px',
                borderRadius: '10px',
                lineHeight: 1.8,
                whiteSpace: 'pre-wrap',
                color: 'var(--text-muted)',
                fontSize: '0.95rem',
              }}
            >
              {prediction}
            </div>
          )}
        </div>
      </div>
      )}

      {/* Info Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '20px',
          marginTop: '32px',
        }}
      >
        {[
          { icon: '🌲', title: '1 tree absorbs', value: '~20 kg CO₂/year' },
          { icon: '🚗', title: 'Average car emits', value: '0.21 kg CO₂/km' },
          { icon: '🌍', title: 'Global avg per person', value: '833 kg CO₂/month' },
          { icon: '⚡', title: 'Avg electricity', value: '0.5 kg CO₂/kWh' },
        ].map((card) => (
          <div
            key={card.title}
            className="glass-panel"
            style={{ textAlign: 'center', padding: '20px' }}
          >
            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>{card.icon}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '4px' }}>
              {card.title}
            </div>
            <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '1.1rem' }}>
              {card.value}
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
};

export default Insights;
