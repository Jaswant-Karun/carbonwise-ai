import React, { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import Layout from '../components/Layout';
import {
  Car,
  CheckCircle2,
  Filter,
  History,
  Leaf,
  Plane,
  Plus,
  RefreshCw,
  ShoppingBag,
  Trash2,
  Utensils,
  Zap,
} from 'lucide-react';

const ACTIVITY_CONFIG = [
  { value: 'transport', label: 'Transport / Driving', unit: 'km', factor: 0.21, icon: Car, color: '#10b981' },
  { value: 'electricity', label: 'Electricity Consumption', unit: 'kWh', factor: 0.5, icon: Zap, color: '#38bdf8' },
  { value: 'food', label: 'Food & Meat Meals', unit: 'meals', factor: 2.5, icon: Utensils, color: '#f59e0b' },
  { value: 'flight', label: 'Aviation / Flights', unit: 'km', factor: 0.255, icon: Plane, color: '#a855f7' },
  { value: 'shopping', label: 'Goods & Shopping', unit: 'items', factor: 5.0, icon: ShoppingBag, color: '#ec4899' },
];

const round = (val, d = 2) => (val != null && !Number.isNaN(Number(val)) ? Number(val).toFixed(d) : '0.00');

const ActivityTracker = () => {
  const [activities, setActivities] = useState([]);
  const [activityType, setActivityType] = useState('transport');
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [successNotice, setSuccessNotice] = useState(false);

  const fetchActivities = async () => {
    setLoading(true);
    try {
      const res = await api.get('/activities');
      setActivities(res.data || []);
    } catch {
      console.error('Error fetching activities');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const val = parseFloat(amount);
    if (!val || val <= 0) return;

    setSubmitting(true);
    try {
      const selected = ACTIVITY_CONFIG.find((a) => a.value === activityType);
      await api.post('/activities', {
        activity_type: activityType,
        details: { value: val, unit: selected?.unit },
      });
      setAmount('');
      setSuccessNotice(true);
      setTimeout(() => setSuccessNotice(false), 3000);
      await fetchActivities();
    } catch {
      alert('Error recording activity. Please verify backend connectivity.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this recorded activity from your ledger?')) return;
    try {
      await api.delete(`/activities/${id}`);
      setActivities((prev) => prev.filter((a) => a.id !== id));
    } catch {
      alert('Could not delete activity.');
    }
  };

  const selectedType = ACTIVITY_CONFIG.find((a) => a.value === activityType) || ACTIVITY_CONFIG[0];
  const previewEmissions = amount && !Number.isNaN(parseFloat(amount)) ? parseFloat(amount) * selectedType.factor : 0;

  const filtered = useMemo(() => {
    return filterType === 'all'
      ? activities
      : activities.filter((a) => a.activity_type === filterType);
  }, [activities, filterType]);

  const totalFilteredEmissions = useMemo(() => {
    return filtered.reduce((sum, a) => sum + (parseFloat(a.carbon_emissions) || 0), 0);
  }, [filtered]);

  return (
    <Layout>
      <div className="dashboard-container">
        {/* Header Summary */}
        <div className="dashboard-region-bar">
          <div className="region-bar-left">
            <span className="summary-status-badge live">
              <span className="live-dot" /> Verified Emission Ledger
            </span>
            <span className="region-bar-label">Total Activities Recorded:</span>
            <strong style={{ color: '#ffffff' }}>{activities.length}</strong>
          </div>
          <div className="region-bar-right">
            <span className="data-freshness-pill">
              <Leaf size={13} />
              <span>Standards: GHG Protocol & DEFRA</span>
            </span>
          </div>
        </div>

        <div className="dashboard-grid-middle">
          {/* Left Column: Log New Activity Form */}
          <div className="tracker-card card-regional-panel" style={{ alignSelf: 'start' }}>
            <div className="tracker-card-header">
              <div>
                <h2 className="card-section-title">
                  <Plus size={18} className="icon-mint" />
                  Log Carbon-Generating Activity
                </h2>
                <p className="card-subtitle-small">
                  Record daily emissions with automated calculations
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="quick-activity-box">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label className="summary-card-title">Activity Category</label>
                <select
                  className="quick-select"
                  value={activityType}
                  onChange={(e) => setActivityType(e.target.value)}
                  style={{ width: '100%' }}
                  aria-label="Activity Type"
                >
                  {ACTIVITY_CONFIG.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label} ({a.factor} kg CO₂/{a.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label className="summary-card-title">
                  Measured Consumption ({selectedType.unit})
                </label>
                <div className="quick-input-wrap">
                  <input
                    type="number"
                    step="any"
                    min="0.1"
                    className="quick-input"
                    placeholder={`e.g. 25 ${selectedType.unit}`}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                  <span className="quick-unit-tag">{selectedType.unit}</span>
                </div>
              </div>

              {amount && (
                <div className="quick-calc-preview" style={{ padding: '8px 10px', background: 'var(--surface-card)', borderRadius: '8px' }}>
                  <span>Calculated Greenhouse Gas:</span>
                  <strong>{round(previewEmissions)} kg CO₂e</strong>
                </div>
              )}

              <button type="submit" className="btn-log-action" disabled={submitting || !amount}>
                <Plus size={15} />
                <span>{submitting ? 'Recording Activity...' : 'Record In Ledger'}</span>
              </button>

              {successNotice && (
                <div className="log-success-pill">
                  <CheckCircle2 size={13} /> Activity successfully stored in PostgreSQL!
                </div>
              )}
            </form>

            {/* Emission Factors Reference Table */}
            <div style={{ marginTop: '18px', paddingTop: '14px', borderTop: '1px solid var(--surface-border)' }}>
              <span className="summary-card-title" style={{ display: 'block', marginBottom: '8px' }}>
                Transparent Emission Factors:
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {ACTIVITY_CONFIG.map((a) => {
                  const Icon = a.icon;
                  return (
                    <div key={a.value} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
                        <Icon size={13} style={{ color: a.color }} /> {a.label}
                      </span>
                      <strong className="mono" style={{ color: '#ffffff' }}>{a.factor} kg/{a.unit}</strong>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Activity History Ledger */}
          <div className="tracker-card card-chart-large">
            <div className="tracker-card-header">
              <div>
                <h2 className="card-section-title">
                  <History size={18} className="icon-mint" />
                  Activity History & Emission Ledger
                </h2>
                <p className="card-subtitle-small">
                  Filter, audit, and inspect your recorded activity entries
                </p>
              </div>

              {/* Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Filter size={14} className="icon-mint" />
                <select
                  className="quick-select"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  style={{ width: 'auto', padding: '5px 10px', fontSize: '0.75rem' }}
                  aria-label="Filter Type"
                >
                  <option value="all">All Categories</option>
                  {ACTIVITY_CONFIG.map((a) => (
                    <option key={a.value} value={a.value}>{a.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Top Stats for Filtered Selection */}
            <div className="dashboard-summary-strip" style={{ gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div className="summary-metric-card" style={{ padding: '12px' }}>
                <span className="summary-card-title">Filtered Emissions</span>
                <div className="summary-card-value-row" style={{ margin: '4px 0 0' }}>
                  <span className="summary-card-value" style={{ fontSize: '1.5rem' }}>{round(totalFilteredEmissions)}</span>
                  <span className="summary-card-unit">kg CO₂e</span>
                </div>
              </div>
              <div className="summary-metric-card" style={{ padding: '12px' }}>
                <span className="summary-card-title">Matching Activities</span>
                <div className="summary-card-value-row" style={{ margin: '4px 0 0' }}>
                  <span className="summary-card-value" style={{ fontSize: '1.5rem' }}>{filtered.length}</span>
                  <span className="summary-card-unit">records</span>
                </div>
              </div>
            </div>

            {/* Activity Table */}
            <div className="activity-table-wrapper" style={{ maxHeight: '420px', overflowY: 'auto' }}>
              {loading ? (
                <div className="empty-state-notice">
                  <RefreshCw size={24} className="spin icon-mint" />
                  <span>Loading activity ledger...</span>
                </div>
              ) : filtered.length === 0 ? (
                <div className="empty-state-notice">
                  <Leaf size={28} className="icon-mint" />
                  <span>No activities logged in this category. Use the form on the left to record your first entry.</span>
                </div>
              ) : (
                <table className="custom-data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Category</th>
                      <th>Quantity</th>
                      <th>Emission (kg CO₂e)</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((act) => {
                      const cfg = ACTIVITY_CONFIG.find((t) => t.value === act.activity_type) || {};
                      const Icon = cfg.icon || Leaf;
                      return (
                        <tr key={act.id}>
                          <td className="mono">{act.date ? new Date(act.date).toLocaleDateString() : 'Today'}</td>
                          <td>
                            <span className="category-cell-badge">
                              <Icon size={14} style={{ color: cfg.color || '#10b981' }} />
                              <span style={{ textTransform: 'capitalize' }}>{act.activity_type}</span>
                            </span>
                          </td>
                          <td className="mono">
                            {act.details?.value} {act.details?.unit || cfg.unit}
                          </td>
                          <td>
                            <strong className="text-mint">{round(act.carbon_emissions)} kg</strong>
                          </td>
                          <td>
                            <button
                              onClick={() => handleDelete(act.id)}
                              className="btn-trash-inline"
                              title="Delete entry"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ActivityTracker;
