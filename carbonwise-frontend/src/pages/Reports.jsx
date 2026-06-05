import React, { useState } from 'react';
import api from '../services/api';
import Layout from '../components/Layout';

const Reports = () => {
  const [report, setReport] = useState(null);
  const [reportMeta, setReportMeta] = useState(null);
  const [loading, setLoading] = useState(false);

 const generateReport = async () => {
  setLoading(true);
  try {
    const res = await api.get('/reports/pdf', {
      responseType: 'blob', // 👈 VERY IMPORTANT
    });

    // Create download link
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'carbon-report.pdf');
    document.body.appendChild(link);
    link.click();

  } catch (err) {
    alert('Error generating PDF');
  }
  setLoading(false);
};

  const typeColors = {
    transport: '#3b82f6',
    electricity: '#f59e0b',
    food: '#10b981',
    flight: '#8b5cf6',
    shopping: '#ef4444',
  };

  const typeIcons = {
    transport: '🚗',
    electricity: '⚡',
    food: '🍖',
    flight: '✈️',
    shopping: '🛍️',
  };

  return (
    <Layout>
      <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '2rem', marginBottom: '8px' }}>
        Climate Reports
      </h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>
        Generate a detailed AI-powered monthly carbon footprint report with analysis and
        recommendations.
      </p>

      {/* Generate Button */}
      <div className="glass-panel" style={{ marginBottom: '32px' }}>
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
            <h3>📋 Monthly Carbon Report</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
              Analyzes your last 30 logged activities and generates a full AI report.
            </p>
          </div>
          <button
            className="btn"
            style={{ width: 'auto', padding: '12px 28px' }}
            onClick={generateReport}
            disabled={loading}
          >
            {loading ? '🤖 Generating Report...' : '✨ Generate Report'}
          </button>
        </div>
      </div>

      {reportMeta && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '16px',
            marginBottom: '32px',
          }}
        >
          {/* Total Emissions */}
          <div
            className="glass-panel"
            style={{ textAlign: 'center', padding: '20px' }}
          >
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Total Emissions
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--primary)' }}>
              {reportMeta.totalEmissions}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>kg CO₂</div>
          </div>

          {/* Activities Count */}
          <div
            className="glass-panel"
            style={{ textAlign: 'center', padding: '20px' }}
          >
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Activities Logged
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--secondary)' }}>
              {reportMeta.activityCount}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>records</div>
          </div>

          {/* Trees Needed */}
          <div
            className="glass-panel"
            style={{ textAlign: 'center', padding: '20px' }}
          >
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Trees to Offset
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f59e0b' }}>
              {Math.ceil(reportMeta.totalEmissions / 20)}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>🌲 needed</div>
          </div>

          {/* By Type breakdown */}
          {Object.entries(reportMeta.byType).map(([type, val]) => (
            <div
              key={type}
              className="glass-panel"
              style={{ textAlign: 'center', padding: '20px' }}
            >
              <div style={{ fontSize: '1.4rem', marginBottom: '4px' }}>
                {typeIcons[type] || '📌'}
              </div>
              <div
                style={{
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)',
                  marginBottom: '4px',
                  textTransform: 'capitalize',
                }}
              >
                {type}
              </div>
              <div
                style={{
                  fontSize: '1.2rem',
                  fontWeight: 700,
                  color: typeColors[type] || 'var(--primary)',
                }}
              >
                {parseFloat(val).toFixed(2)} kg
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Report Content */}
      {report && (
        <div className="glass-panel">
          <h3 style={{ marginBottom: '20px' }}>
            📄 Full AI Report —{' '}
            {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h3>
          <div
            style={{
              background: 'rgba(0,0,0,0.2)',
              padding: '24px',
              borderRadius: '10px',
              lineHeight: 1.8,
              whiteSpace: 'pre-wrap',
              color: 'var(--text-muted)',
              fontSize: '0.95rem',
            }}
          >
            {report}
          </div>
        </div>
      )}

      {!report && !loading && (
        <div
          className="glass-panel"
          style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}
        >
          <div style={{ fontSize: '4rem', marginBottom: '16px' }}>📊</div>
          <h3 style={{ marginBottom: '8px' }}>No Report Generated Yet</h3>
          <p style={{ maxWidth: '400px', margin: '0 auto', lineHeight: 1.6 }}>
            Click "Generate Report" above to create a full AI-powered monthly climate
            report based on your logged activities.
          </p>
        </div>
      )}
    </Layout>
  );
};

export default Reports;
