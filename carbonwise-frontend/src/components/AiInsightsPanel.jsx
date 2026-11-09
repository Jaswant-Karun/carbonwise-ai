import React, { useCallback, useEffect, useState } from 'react';
import {
  Sparkles,
  RefreshCw,
  Info,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Lightbulb,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import api from '../services/api';

const AiInsightsPanel = ({ regionId, regionName, className = '' }) => {
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [expandedIndex, setExpandedIndex] = useState(0);

  const fetchInsights = useCallback(async (_forced = false) => {
    if (!regionId) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/environment/regions/${regionId}/ai-insights`);
      setInsights(res.data.insights || []);
      setLastUpdated(res.data.generatedAt || new Date().toISOString());
    } catch (err) {
      console.warn('AI insights fetch error:', err.message);
      setError(err.response?.data?.message || 'Unable to retrieve AI insights right now.');
    } finally {
      setLoading(false);
    }
  }, [regionId]);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  return (
    <div
      className={`tracker-card card-ai-insights ${className}`}
      style={{
        background: 'linear-gradient(145deg, rgba(14, 22, 38, 0.95), rgba(9, 13, 22, 0.98))',
        border: '1px solid rgba(59, 130, 246, 0.25)',
        borderRadius: '16px',
        padding: '20px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Ambient background glow */}
      <div
        style={{
          position: 'absolute',
          top: '-40px',
          right: '-40px',
          width: '140px',
          height: '140px',
          background: 'radial-gradient(circle, rgba(56, 189, 248, 0.15) 0%, rgba(0,0,0,0) 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(16, 185, 129, 0.2))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(56, 189, 248, 0.3)',
            }}
          >
            <Sparkles size={17} style={{ color: '#38bdf8' }} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.02rem', fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
              AI Climate & Environmental Insights
            </h3>
            <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
              {regionName ? `Context: ${regionName}` : 'Regional Telemetry'} · Powered by Gemini Assistant
            </span>
          </div>
        </div>

        <button
          type="button"
          className="btn"
          onClick={() => fetchInsights(true)}
          disabled={loading || !regionId}
          style={{
            fontSize: '0.76rem',
            padding: '6px 12px',
            background: 'rgba(56, 189, 248, 0.12)',
            color: '#38bdf8',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Analyzing...' : 'Refresh Insights'}
        </button>
      </div>

      {/* Scientific Transparency Disclaimer */}
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: '8px',
          padding: '8px 12px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '0.75rem',
          color: '#94a3b8',
        }}
      >
        <Info size={14} style={{ color: '#60a5fa', flexShrink: 0 }} />
        <span>
          Gemini serves strictly as an explanation and reporting assistant. Numerical anomaly detection and historical baselines are computed deterministically in PostgreSQL.
        </span>
      </div>

      {/* Error state */}
      {error && (
        <div style={{ color: '#f87171', fontSize: '0.8rem', padding: '8px 0' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Insights Cards List */}
      {loading && insights.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8', fontSize: '0.84rem' }}>
          <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto 8px', color: '#38bdf8' }} />
          Synthesizing explainable insights from verified observations...
        </div>
      ) : insights.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px 0', color: '#64748b', fontSize: '0.84rem' }}>
          Select a monitored region to generate explainable AI insights.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '10px' }}>
          {insights.map((item, idx) => {
            const isExpanded = expandedIndex === idx;
            const isWarning = item.severity === 'warning';
            const isInfo = item.severity === 'info';

            return (
              <div
                key={idx}
                style={{
                  background: 'rgba(9, 13, 22, 0.65)',
                  border: `1px solid ${
                    isWarning
                      ? 'rgba(245, 158, 11, 0.35)'
                      : isInfo
                      ? 'rgba(56, 189, 248, 0.25)'
                      : 'rgba(255, 255, 255, 0.06)'
                  }`,
                  borderRadius: '10px',
                  padding: '12px 14px',
                  transition: 'all 0.2s ease',
                }}
              >
                <div
                  onClick={() => setExpandedIndex(isExpanded ? -1 : idx)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: isWarning ? '#f59e0b20' : isInfo ? '#38bdf820' : '#10b98120',
                        color: isWarning ? '#fbbf24' : isInfo ? '#38bdf8' : '#34d399',
                        border: '1px solid currentColor',
                      }}
                    >
                      {item.severity || 'Normal'}
                    </span>
                    <strong style={{ fontSize: '0.86rem', color: '#f1f5f9' }}>{item.title}</strong>
                  </div>

                  <button
                    type="button"
                    style={{
                      background: 'transparent',
                      border: 0,
                      color: '#94a3b8',
                      cursor: 'pointer',
                      padding: '2px',
                    }}
                    aria-label="Toggle details"
                  >
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>

                <p style={{ fontSize: '0.81rem', color: '#cbd5e1', margin: '6px 0 0', lineHeight: 1.45 }}>
                  {item.whatChanged}
                </p>

                {isExpanded && (
                  <div
                    style={{
                      marginTop: '10px',
                      paddingTop: '8px',
                      borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                      display: 'grid',
                      gap: '8px',
                      fontSize: '0.78rem',
                    }}
                  >
                    {item.evidence && (
                      <div>
                        <span style={{ color: '#94a3b8', fontWeight: 600 }}>Evidence: </span>
                        <span style={{ color: '#e2e8f0' }}>{item.evidence}</span>
                      </div>
                    )}

                    {item.recommendation && (
                      <div
                        style={{
                          background: 'rgba(16, 185, 129, 0.08)',
                          border: '1px solid rgba(16, 185, 129, 0.2)',
                          borderRadius: '6px',
                          padding: '6px 10px',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '6px',
                        }}
                      >
                        <Lightbulb size={14} style={{ color: '#34d399', marginTop: '2px', flexShrink: 0 }} />
                        <div>
                          <strong style={{ color: '#34d399' }}>Action: </strong>
                          <span style={{ color: '#e2e8f0' }}>{item.recommendation}</span>
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.72rem', flexWrap: 'wrap', gap: '6px' }}>
                      <span>Source: {item.dataSource || 'Verified Telemetry'}</span>
                      {item.limitations && <span>Limitations: {item.limitations}</span>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {lastUpdated && (
        <div style={{ marginTop: '12px', fontSize: '0.7rem', color: '#64748b', textAlign: 'right' }}>
          Last generated: {new Date(lastUpdated).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
};

export default AiInsightsPanel;
