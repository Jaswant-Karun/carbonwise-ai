import React, { useState } from 'react';
import api from '../services/api';
import Layout from '../components/Layout';

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

const Insights = () => {
  const [insights, setInsights] = useState([]);
  const [prediction, setPrediction] = useState(null);
  const [totalEmissions, setTotalEmissions] = useState(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [loadingPrediction, setLoadingPrediction] = useState(false);

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
      <h1
        style={{ fontFamily: 'Outfit, sans-serif', fontSize: '2rem', marginBottom: '8px' }}
      >
        AI Insights
      </h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>
        Gemini AI analyzes your activity data to surface personalized environmental insights.
      </p>

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
