import React, { useState, useEffect } from 'react';
import api from '../services/api';
import Layout from '../components/Layout';

const activityTypes = [
  { value: 'transport', label: '🚗 Transport', unit: 'km driven', factor: 0.21 },
  { value: 'electricity', label: '⚡ Electricity', unit: 'kWh used', factor: 0.5 },
  { value: 'food', label: '🍖 Food', unit: 'heavy meat meals', factor: 2.5 },
  { value: 'flight', label: '✈️ Flight', unit: 'km flown', factor: 0.255 },
  { value: 'shopping', label: '🛍️ Shopping', unit: 'items purchased', factor: 5.0 },
];

const calculateEmissions = (type, value) => {
  const found = activityTypes.find((a) => a.value === type);
  const val = parseFloat(value);
  if (!found || isNaN(val)) return 0;
  return +(val * found.factor).toFixed(2);
};

const impactColor = (val) => {
  if (val < 2) return '#10b981';
  if (val < 5) return '#f59e0b';
  return '#ef4444';
};

const ActivityTracker = () => {
  const [activities, setActivities] = useState([]);
  const [activityType, setActivityType] = useState('transport');
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    setLoading(true);
    try {
      const res = await api.get('/activities');
      setActivities(res.data);
    } catch {
      console.error('Error fetching activities');
    }
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const carbon = calculateEmissions(activityType, amount);
    setSubmitting(true);
    try {
      await api.post('/activities', {
        activity_type: activityType,
        details: { value: amount, unit: activityTypes.find((a) => a.value === activityType)?.unit },
        carbon_emissions: carbon,
      });
      setAmount('');
      fetchActivities();
    } catch {
      alert('Error logging activity. Make sure the backend is running.');
    }
    setSubmitting(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this activity?')) return;
    try {
      await api.delete(`/activities/${id}`);
      setActivities((prev) => prev.filter((a) => a.id !== id));
    } catch {
      alert('Could not delete activity.');
    }
  };

  const selectedType = activityTypes.find((a) => a.value === activityType);
  const previewEmissions = calculateEmissions(activityType, amount);

  const filtered =
    filterType === 'all'
      ? activities
      : activities.filter((a) => a.activity_type === filterType);

  const totalFiltered = filtered.reduce(
    (sum, a) => sum + parseFloat(a.carbon_emissions),
    0
  );

  return (
    <Layout>
      <h1
        style={{
          fontFamily: 'Outfit, sans-serif',
          fontSize: '2rem',
          marginBottom: '8px',
        }}
      >
        Activity Tracker
      </h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>
        Log your daily activities to calculate your carbon footprint.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '32px' }}>
        {/* Log Activity Form */}
        <div className="glass-panel" style={{ alignSelf: 'start' }}>
          <h3 style={{ marginBottom: '1.5rem' }}>➕ Log New Activity</h3>
          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label>Activity Type</label>
              <select
                className="input-field"
                value={activityType}
                onChange={(e) => setActivityType(e.target.value)}
                style={{ appearance: 'none' }}
              >
                {activityTypes.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="input-group">
              <label>
                Amount ({selectedType?.unit})
              </label>
              <input
                type="number"
                step="any"
                min="0"
                className="input-field"
                placeholder="e.g. 15"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>

            {amount && (
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: '8px',
                  background: 'rgba(0,0,0,0.2)',
                  marginBottom: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Estimated CO₂</span>
                <span
                  style={{
                    fontWeight: 700,
                    color: impactColor(previewEmissions),
                    fontSize: '1.1rem',
                  }}
                >
                  {previewEmissions} kg
                </span>
              </div>
            )}

            <button type="submit" className="btn" disabled={submitting}>
              {submitting ? 'Logging...' : 'Log Activity'}
            </button>
          </form>

          {/* Emission factors info */}
          <div style={{ marginTop: '24px', borderTop: '1px solid var(--surface-border)', paddingTop: '20px' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '10px' }}>Emission factors used:</p>
            {activityTypes.map((a) => (
              <div key={a.value} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{a.label}</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--primary)' }}>{a.factor} kg/unit</span>
              </div>
            ))}
          </div>
        </div>

        {/* Activity History */}
        <div className="glass-panel">
          <div
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}
          >
            <h3>Activity History</h3>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <select
                className="input-field"
                style={{ width: 'auto', padding: '6px 12px', fontSize: '0.85rem' }}
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="all">All Types</option>
                {activityTypes.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Summary */}
          <div
            style={{
              display: 'flex',
              gap: '16px',
              marginBottom: '20px',
              flexWrap: 'wrap',
            }}
          >
            <div
              style={{
                flex: 1,
                padding: '12px 16px',
                borderRadius: '8px',
                background: 'rgba(16,185,129,0.1)',
                border: '1px solid rgba(16,185,129,0.2)',
              }}
            >
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total CO₂ (filtered)</div>
              <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '1.2rem' }}>
                {totalFiltered.toFixed(2)} kg
              </div>
            </div>
            <div
              style={{
                flex: 1,
                padding: '12px 16px',
                borderRadius: '8px',
                background: 'rgba(59,130,246,0.1)',
                border: '1px solid rgba(59,130,246,0.2)',
              }}
            >
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Activities logged</div>
              <div style={{ fontWeight: 700, color: 'var(--secondary)', fontSize: '1.2rem' }}>
                {filtered.length}
              </div>
            </div>
          </div>

          {loading ? (
            <p style={{ color: 'var(--text-muted)' }}>Loading activities...</p>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🌿</div>
              <p>No activities logged yet. Start tracking your impact!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '450px', overflowY: 'auto' }}>
              {filtered.map((act) => {
                const typeInfo = activityTypes.find((t) => t.value === act.activity_type);
                return (
                  <div
                    key={act.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '14px 16px',
                      borderRadius: '10px',
                      background: 'rgba(0,0,0,0.2)',
                      border: '1px solid var(--surface-border)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '1.4rem' }}>{typeInfo?.label.split(' ')[0] || '📌'}</span>
                      <div>
                        <div style={{ fontWeight: 600, textTransform: 'capitalize', fontSize: '0.95rem' }}>
                          {act.activity_type}
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          {act.details?.value} {act.details?.unit} &nbsp;·&nbsp;{' '}
                          {new Date(act.date).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span
                        style={{
                          fontWeight: 700,
                          color: impactColor(parseFloat(act.carbon_emissions)),
                          fontSize: '1rem',
                        }}
                      >
                        {parseFloat(act.carbon_emissions).toFixed(2)} kg
                      </span>
                      <button
                        onClick={() => handleDelete(act.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--danger)',
                          cursor: 'pointer',
                          fontSize: '1rem',
                          padding: '4px',
                        }}
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default ActivityTracker;
