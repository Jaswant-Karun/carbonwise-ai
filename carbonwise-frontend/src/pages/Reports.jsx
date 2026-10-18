import React, { useEffect, useState } from 'react';
import {
  FileText,
  Sparkles,
  Download,
  Copy,
  Check,
  Info,
  Calendar,
  MapPin,
  TrendingUp,
  RefreshCw,
  Lightbulb,
  AlertTriangle,
} from 'lucide-react';
import api from '../services/api';
import Layout from '../components/Layout';

const Reports = () => {
  const [activeTab, setActiveTab] = useState('climate'); // 'climate' or 'carbon'
  const [regions, setRegions] = useState([]);
  const [selectedRegionId, setSelectedRegionId] = useState('');
  const [parameter, setParameter] = useState('temperature_2m');
  const [timeRange, setTimeRange] = useState('annual');

  // Personal carbon PDF state
  const [carbonLoading, setCarbonLoading] = useState(false);

  // Climate AI summary state
  const [climateReport, setClimateReport] = useState(null);
  const [climateLoading, setClimateLoading] = useState(false);
  const [climateError, setClimateError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const loadRegions = async () => {
      try {
        const res = await api.get('/environment/regions');
        const data = res.data || [];
        setRegions(data);
        if (data.length > 0 && !selectedRegionId) {
          setSelectedRegionId(String(data[0].id));
        }
      } catch (err) {
        console.warn('Failed to load regions for reports:', err.message);
      }
    };
    loadRegions();
  }, []);

  const generateCarbonPdf = async () => {
    setCarbonLoading(true);
    try {
      const res = await api.get('/reports/pdf', {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'carbon-report.pdf');
      document.body.appendChild(link);
      link.click();
    } catch {
      alert('Error generating PDF carbon report.');
    } finally {
      setCarbonLoading(false);
    }
  };

  const generateClimateAiReport = async () => {
    if (!selectedRegionId) return;
    setClimateLoading(true);
    setClimateError('');
    try {
      const res = await api.get(`/environment/regions/${selectedRegionId}/ai-trend-report`, {
        params: { parameter, timeRange },
      });
      setClimateReport(res.data);
    } catch (err) {
      setClimateError(err.response?.data?.message || 'Unable to generate climate AI report.');
    } finally {
      setClimateLoading(false);
    }
  };

  const handleCopyReport = () => {
    if (!climateReport?.report) return;
    const r = climateReport.report;
    const text = `CARBONWISE AI — EXECUTIVE CLIMATE INTELLIGENCE REPORT
Region: ${climateReport.region?.name || 'Selected Region'}
Parameter: ${climateReport.parameter} (${climateReport.timeRange})
Generated: ${new Date(climateReport.generatedAt).toLocaleString()}

EXECUTIVE SUMMARY:
${r.summary}

OBSERVED CHANGE:
${r.whatChanged}

BASELINE METHODOLOGY:
${r.baselineUsed}

DATA SOURCE & ATTRIBUTION:
${r.dataSource}

SCIENTIFIC LIMITATIONS:
${r.limitations}

RECOMMENDATIONS:
${(r.recommendations || []).map((rec, i) => `${i + 1}. ${rec}`).join('\n')}
`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <Layout>
      <div className="intelligence-toolbar" style={{ marginBottom: '24px' }}>
        <div>
          <span className="section-kicker">Environmental Analytics & Executive Reporting</span>
          <h2>Climate & Sustainability Intelligence Reports</h2>
          <p className="page-supporting-copy">
            Generate verifiable AI summary reports for regional climate trends, environmental baselines, and monthly activity footprints.
          </p>
        </div>

        {/* Tab Toggle */}
        <div style={{ display: 'flex', gap: '8px', background: 'rgba(15, 23, 42, 0.8)', padding: '4px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <button
            type="button"
            className="btn"
            onClick={() => setActiveTab('climate')}
            style={{
              fontSize: '0.82rem',
              padding: '8px 16px',
              background: activeTab === 'climate' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'climate' ? '#090d16' : '#94a3b8',
              border: 0,
              fontWeight: 700,
            }}
          >
            <Sparkles size={14} style={{ marginRight: '6px' }} />
            AI Climate Report
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => setActiveTab('carbon')}
            style={{
              fontSize: '0.82rem',
              padding: '8px 16px',
              background: activeTab === 'carbon' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'carbon' ? '#090d16' : '#94a3b8',
              border: 0,
              fontWeight: 700,
            }}
          >
            <FileText size={14} style={{ marginRight: '6px' }} />
            Carbon Footprint PDF
          </button>
        </div>
      </div>

      {/* Scientific Transparency Disclaimer */}
      <div
        style={{
          background: 'rgba(16, 24, 39, 0.75)',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          borderRadius: '12px',
          padding: '12px 18px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
        }}
      >
        <Info size={18} style={{ color: '#60a5fa', flexShrink: 0, marginTop: '2px' }} />
        <div style={{ fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.5 }}>
          <strong style={{ color: '#f1f5f9' }}>Reporting Integrity Architecture:</strong> All statistical trends, regression slopes, decadal warming rates, and baseline comparisons are computed deterministically from verified Open-Meteo, NASA POWER, and OpenAQ datasets. Gemini acts strictly as an explanation and executive reporting assistant, translating verified data into structured stakeholder summaries without calculating or projecting figures independently.
        </div>
      </div>

      {activeTab === 'climate' ? (
        <div>
          {/* Controls Card */}
          <div className="tracker-card" style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '1.05rem', color: '#f1f5f9', marginBottom: '14px' }}>
              Configure Climate Intelligence Report
            </h3>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '14px',
                marginBottom: '16px',
              }}
            >
              <label className="filter-control">
                <span>Monitored Region</span>
                <select
                  value={selectedRegionId}
                  onChange={(e) => setSelectedRegionId(e.target.value)}
                >
                  {regions.map((reg) => (
                    <option key={reg.id} value={reg.id}>
                      {reg.name} {reg.country ? `(${reg.country})` : ''}
                    </option>
                  ))}
                  {!regions.length && <option value="">No regions configured</option>}
                </select>
              </label>

              <label className="filter-control">
                <span>Environmental Indicator</span>
                <select
                  value={parameter}
                  onChange={(e) => setParameter(e.target.value)}
                >
                  <option value="temperature_2m">Temperature 2m (°C)</option>
                  <option value="precipitation">Precipitation Sum (mm)</option>
                </select>
              </label>

              <label className="filter-control">
                <span>Resolution Timeframe</span>
                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                >
                  <option value="annual">Annual Decadal Trajectory</option>
                  <option value="monthly">Monthly Seasonal Cycle</option>
                </select>
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn"
                onClick={generateClimateAiReport}
                disabled={climateLoading || !selectedRegionId}
                style={{ padding: '10px 22px', fontSize: '0.86rem' }}
              >
                <Sparkles size={16} className={climateLoading ? 'animate-spin' : ''} style={{ marginRight: '6px' }} />
                {climateLoading ? 'Synthesizing Report...' : '✨ Generate AI Executive Summary'}
              </button>
            </div>

            {climateError && (
              <div style={{ color: '#f87171', fontSize: '0.84rem', marginTop: '12px' }}>
                ⚠️ {climateError}
              </div>
            )}
          </div>

          {/* Report Output Card */}
          {climateReport?.report && (
            <div
              className="tracker-card"
              style={{
                background: 'linear-gradient(145deg, rgba(14, 22, 38, 0.95), rgba(9, 13, 22, 0.98))',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '16px',
                padding: '24px',
              }}
            >
              {/* Report Header */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: '12px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                  paddingBottom: '16px',
                  marginBottom: '20px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span
                      style={{
                        background: 'rgba(16, 185, 129, 0.15)',
                        color: 'var(--mint-strong)',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        border: '1px solid currentColor',
                      }}
                    >
                      Executive Intelligence Summary
                    </span>
                    <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                      Generated {new Date(climateReport.generatedAt).toLocaleString()}
                    </span>
                  </div>
                  <h3 style={{ fontSize: '1.25rem', color: '#f1f5f9', margin: '4px 0' }}>
                    {climateReport.report.summary || `${climateReport.region?.name} Climate Assessment`}
                  </h3>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                    Target Region: <strong style={{ color: '#f1f5f9' }}>{climateReport.region?.name}</strong> · Parameter: <strong style={{ color: '#f1f5f9' }}>{climateReport.parameter}</strong> ({climateReport.timeRange})
                  </div>
                </div>

                <button
                  type="button"
                  className="btn"
                  onClick={handleCopyReport}
                  style={{
                    fontSize: '0.78rem',
                    padding: '8px 14px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: '#f1f5f9',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {copied ? <Check size={14} style={{ color: '#34d399' }} /> : <Copy size={14} />}
                  {copied ? 'Copied to Clipboard' : 'Copy Executive Brief'}
                </button>
              </div>

              {/* Structured Sections */}
              <div style={{ display: 'grid', gap: '16px' }}>
                <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <h4 style={{ color: '#38bdf8', fontSize: '0.88rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
                    1. Observed Trend & Historical Trajectory
                  </h4>
                  <p style={{ color: '#e2e8f0', fontSize: '0.88rem', lineHeight: 1.55, margin: 0 }}>
                    {climateReport.report.whatChanged}
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <h4 style={{ color: 'var(--mint-strong)', fontSize: '0.88rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
                      2. Reference Baseline
                    </h4>
                    <p style={{ color: '#cbd5e1', fontSize: '0.84rem', lineHeight: 1.5, margin: 0 }}>
                      {climateReport.report.baselineUsed}
                    </p>
                  </div>

                  <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <h4 style={{ color: '#a78bfa', fontSize: '0.88rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
                      3. Data Sources & Attribution
                    </h4>
                    <p style={{ color: '#cbd5e1', fontSize: '0.84rem', lineHeight: 1.5, margin: 0 }}>
                      {climateReport.report.dataSource}
                    </p>
                  </div>
                </div>

                <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <h4 style={{ color: '#fbbf24', fontSize: '0.88rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
                    4. Methodological Limitations & Model Assumptions
                  </h4>
                  <p style={{ color: '#cbd5e1', fontSize: '0.84rem', lineHeight: 1.5, margin: 0 }}>
                    {climateReport.report.limitations}
                  </p>
                </div>

                {climateReport.report.recommendations?.length > 0 && (
                  <div style={{ background: 'rgba(16, 185, 129, 0.06)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                    <h4 style={{ color: 'var(--mint-strong)', fontSize: '0.88rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Lightbulb size={16} /> 5. Practical Adaptation & Mitigation Recommendations
                    </h4>
                    <ul style={{ margin: 0, paddingLeft: '20px', display: 'grid', gap: '6px', color: '#e2e8f0', fontSize: '0.85rem' }}>
                      {climateReport.report.recommendations.map((rec, i) => (
                        <li key={i}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Personal Monthly Carbon Report Tab */
        <div className="glass-panel" style={{ padding: '28px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '16px',
            }}
          >
            <div>
              <h3>📋 Personal Carbon Footprint Report</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
                Analyzes your logged activities, baseline emissions, and generates a downloadable PDF audit.
              </p>
            </div>
            <button
              className="btn"
              style={{ width: 'auto', padding: '12px 28px' }}
              onClick={generateCarbonPdf}
              disabled={carbonLoading}
            >
              <Download size={15} style={{ marginRight: '6px' }} />
              {carbonLoading ? 'Generating PDF...' : 'Download PDF Report'}
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Reports;
