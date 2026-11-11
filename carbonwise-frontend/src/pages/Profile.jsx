import React, { useState, useContext, useEffect } from 'react';
import api from '../services/api';
import Layout from '../components/Layout';
import { AuthContext } from '../context/AuthContext';
import {
  Award,
  Bell,
  Building2,
  Check,
  CheckCircle2,
  Globe,
  Mail,
  MapPin,
  Save,
  Scale,
  Settings as SettingsIcon,
  Shield,
  Sliders,
  User,
} from 'lucide-react';

const Profile = () => {
  const { user } = useContext(AuthContext);

  // Form State
  const [activeTab, setActiveTab] = useState('profile');
  const [name, setName] = useState(user?.name || 'Sustainability Analyst');
  const [email, setEmail] = useState(user?.email || 'analyst@carbonwise.ai');
  const [organization, setOrganization] = useState(localStorage.getItem('carbonwise_org') || 'Global Climate Initiative');
  const [role, setRole] = useState(localStorage.getItem('carbonwise_role') || 'Sustainability Lead');

  // Preferred Units
  const [unitSystem, setUnitSystem] = useState(localStorage.getItem('carbonwise_units') || 'metric');

  // Default Location
  const [defaultLocation, setDefaultLocation] = useState(localStorage.getItem('carbonwise_location') || 'New York, USA');
  const [regions, setRegions] = useState([]);

  // Notification Preferences
  const [emailDigest, setEmailDigest] = useState(
    localStorage.getItem('carbonwise_notif_digest') !== 'false'
  );
  const [anomalyAlerts, setAnomalyAlerts] = useState(
    localStorage.getItem('carbonwise_notif_anomalies') !== 'false'
  );
  const [aqiAlerts, setAqiAlerts] = useState(
    localStorage.getItem('carbonwise_notif_aqi') !== 'false'
  );

  // Status & Feedback
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    let isMounted = true;
    const loadProfileData = async () => {
      try {
        const [actRes, regRes] = await Promise.allSettled([
          api.get('/activities'),
          api.get('/environment/regions'),
        ]);

        if (isMounted) {
          if (actRes.status === 'fulfilled') {
            const raw = actRes.value.data;
            setActivities(Array.isArray(raw) ? raw : raw?.activities || []);
          }
          if (regRes.status === 'fulfilled' && regRes.value.data?.length > 0) {
            setRegions(regRes.value.data);
          }
        }
      } catch (err) {
        console.warn('Error loading profile metadata:', err);
      }
    };
    loadProfileData();
    return () => { isMounted = false; };
  }, []);

  const totalEmissions = activities.reduce(
    (sum, a) => sum + parseFloat(a.carbon_emissions || a.calculated_co2e || 0),
    0
  );

  const sustainabilityScore = Math.max(
    10,
    Math.min(100, Math.round(100 - (totalEmissions / 800) * 50))
  );

  const handleSaveSettings = (e) => {
    e.preventDefault();
    localStorage.setItem('carbonwise_org', organization);
    localStorage.setItem('carbonwise_role', role);
    localStorage.setItem('carbonwise_units', unitSystem);
    localStorage.setItem('carbonwise_location', defaultLocation);
    localStorage.setItem('carbonwise_notif_digest', String(emailDigest));
    localStorage.setItem('carbonwise_notif_anomalies', String(anomalyAlerts));
    localStorage.setItem('carbonwise_notif_aqi', String(aqiAlerts));

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3500);
  };

  const milestones = [
    { label: 'First Activity Recorded', achieved: activities.length >= 1, icon: '🌱' },
    { label: '5 Activities Logged', achieved: activities.length >= 5, icon: '📊' },
    { label: 'Decarbonization Active', achieved: activities.length >= 10, icon: '🏆' },
    { label: 'Low Footprint (<100 kg)', achieved: totalEmissions < 100 && activities.length > 0, icon: '🌍' },
    { label: 'Eco Champion (Score ≥ 70)', achieved: sustainabilityScore >= 70, icon: '🥇' },
  ];

  return (
    <Layout>
      <div className="settings-page-white">
        <div className="settings-header-banner">
          <div>
            <h2 className="card-heading-navy" style={{ fontSize: '1.5rem' }}>Platform Settings & Profile</h2>
            <p className="card-sub-muted">
              Manage your personal credentials, calculation units, monitoring locations, and automated alerts.
            </p>
          </div>
          {saveSuccess && (
            <div className="settings-toast-success">
              <CheckCircle2 size={16} />
              <span>Settings saved successfully!</span>
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="settings-tab-nav">
          <button
            type="button"
            className={`settings-tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <User size={15} />
            <span>User Profile</span>
          </button>
          <button
            type="button"
            className={`settings-tab-btn ${activeTab === 'units' ? 'active' : ''}`}
            onClick={() => setActiveTab('units')}
          >
            <Scale size={15} />
            <span>Preferred Units</span>
          </button>
          <button
            type="button"
            className={`settings-tab-btn ${activeTab === 'location' ? 'active' : ''}`}
            onClick={() => setActiveTab('location')}
          >
            <MapPin size={15} />
            <span>Default Location</span>
          </button>
          <button
            type="button"
            className={`settings-tab-btn ${activeTab === 'notifications' ? 'active' : ''}`}
            onClick={() => setActiveTab('notifications')}
          >
            <Bell size={15} />
            <span>Notification Preferences</span>
          </button>
        </div>

        <form onSubmit={handleSaveSettings} className="settings-content-grid">
          {/* Main Configuration Card */}
          <div className="saas-content-card" style={{ padding: '28px' }}>
            {activeTab === 'profile' && (
              <div className="settings-section">
                <div className="settings-sec-head">
                  <h3 className="card-heading-navy">Personal & Organization Profile</h3>
                  <p className="card-sub-muted">Update your identity and workspace credentials</p>
                </div>

                <div className="settings-form-grid">
                  <div className="form-group-white">
                    <label>Full Name</label>
                    <input
                      type="text"
                      className="modal-input-white"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group-white">
                    <label>Email Address</label>
                    <input
                      type="email"
                      className="modal-input-white"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group-white">
                    <label>Organization / Company</label>
                    <input
                      type="text"
                      className="modal-input-white"
                      value={organization}
                      onChange={(e) => setOrganization(e.target.value)}
                      placeholder="e.g. Acme Corp / SDG Climate Labs"
                    />
                  </div>

                  <div className="form-group-white">
                    <label>Role / Position</label>
                    <input
                      type="text"
                      className="modal-input-white"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      placeholder="e.g. Lead Sustainability Officer"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'units' && (
              <div className="settings-section">
                <div className="settings-sec-head">
                  <h3 className="card-heading-navy">Preferred Measurement Units</h3>
                  <p className="card-sub-muted">Configure how carbon emissions, distances, and quantities are reported</p>
                </div>

                <div className="unit-selection-cards">
                  <div
                    className={`unit-radio-card ${unitSystem === 'metric' ? 'selected' : ''}`}
                    onClick={() => setUnitSystem('metric')}
                  >
                    <div className="unit-card-header">
                      <strong>Metric System (SI)</strong>
                      <span className="unit-rec-tag">Recommended for GHG Protocol</span>
                    </div>
                    <ul className="unit-specs-list">
                      <li>• Carbon: <strong>Kilograms (kg CO₂e) & Tonnes (t CO₂e)</strong></li>
                      <li>• Travel: <strong>Kilometers (km)</strong></li>
                      <li>• Energy: <strong>Kilowatt-hours (kWh)</strong></li>
                      <li>• Water: <strong>Liters (L) & Cubic Meters (m³)</strong></li>
                    </ul>
                  </div>

                  <div
                    className={`unit-radio-card ${unitSystem === 'imperial' ? 'selected' : ''}`}
                    onClick={() => setUnitSystem('imperial')}
                  >
                    <div className="unit-card-header">
                      <strong>Imperial System (US Customary)</strong>
                      <span className="unit-alt-tag">North America</span>
                    </div>
                    <ul className="unit-specs-list">
                      <li>• Carbon: <strong>Pounds (lbs CO₂e) & Short Tons</strong></li>
                      <li>• Travel: <strong>Miles (mi)</strong></li>
                      <li>• Energy: <strong>Kilowatt-hours (kWh)</strong></li>
                      <li>• Water: <strong>Gallons (gal)</strong></li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'location' && (
              <div className="settings-section">
                <div className="settings-sec-head">
                  <h3 className="card-heading-navy">Default Environmental Node</h3>
                  <p className="card-sub-muted">Primary location used for Open-Meteo weather and OpenAQ air telemetry</p>
                </div>

                <div className="form-group-white" style={{ maxWidth: '450px' }}>
                  <label>Default Monitoring City</label>
                  <select
                    value={defaultLocation}
                    onChange={(e) => setDefaultLocation(e.target.value)}
                    className="modal-input-white"
                  >
                    {regions.length > 0 ? (
                      regions.map((r) => (
                        <option key={r.id} value={r.name}>
                          {r.name} ({r.country})
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="New York, USA">New York, USA</option>
                        <option value="London, UK">London, UK</option>
                        <option value="Tokyo, Japan">Tokyo, Japan</option>
                        <option value="Paris, France">Paris, France</option>
                        <option value="Sydney, Australia">Sydney, Australia</option>
                        <option value="Singapore">Singapore</option>
                      </>
                    )}
                  </select>
                </div>

                <div className="location-info-callout">
                  <Globe size={16} className="text-emerald" />
                  <span>
                    Your default location determines the localized 30-year NASA POWER climatology baseline
                    and nearest OpenAQ air quality monitoring station.
                  </span>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="settings-section">
                <div className="settings-sec-head">
                  <h3 className="card-heading-navy">Automated Notification Preferences</h3>
                  <p className="card-sub-muted">Configure proactive alerts and weekly executive summaries</p>
                </div>

                <div className="notif-toggle-list">
                  <label className="notif-toggle-row">
                    <div className="notif-toggle-info">
                      <strong>Weekly Sustainability Digest</strong>
                      <p>Receive weekly PDF summaries and progress updates on active climate reduction goals.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={emailDigest}
                      onChange={(e) => setEmailDigest(e.target.checked)}
                      className="saas-switch"
                    />
                  </label>

                  <label className="notif-toggle-row">
                    <div className="notif-toggle-info">
                      <strong>Real-Time Environmental Anomaly Alerts</strong>
                      <p>Notify when atmospheric parameters exceed ±2 MAD excursions from 30-day medians.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={anomalyAlerts}
                      onChange={(e) => setAnomalyAlerts(e.target.checked)}
                      className="saas-switch"
                    />
                  </label>

                  <label className="notif-toggle-row">
                    <div className="notif-toggle-info">
                      <strong>Unhealthy Air Quality (AQI & PM2.5) Triggers</strong>
                      <p>Immediate alert when ground stations report Unhealthy (AQI &gt; 100) or hazardous conditions.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={aqiAlerts}
                      onChange={(e) => setAqiAlerts(e.target.checked)}
                      className="saas-switch"
                    />
                  </label>
                </div>
              </div>
            )}

            <div className="settings-footer-actions">
              <button type="submit" className="btn-emerald-primary">
                <Save size={15} />
                <span>Save Settings & Preferences</span>
              </button>
            </div>
          </div>

          {/* Right Column: User Card & Milestones */}
          <div className="settings-sidebar-col">
            <div className="saas-content-card" style={{ textAlign: 'center', padding: '24px' }}>
              <div className="profile-large-avatar">
                {name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <h3 className="card-heading-navy" style={{ marginTop: '12px' }}>{name}</h3>
              <p className="card-sub-muted" style={{ fontSize: '0.8rem' }}>{role}</p>
              <div className="profile-org-badge">
                <Building2 size={13} />
                <span>{organization}</span>
              </div>

              <div className="profile-score-box">
                <span className="score-lbl">Sustainability Score</span>
                <div className="score-val text-emerald">{sustainabilityScore} / 100</div>
                <div className="score-desc">
                  Based on {activities.length} logged activities and {totalEmissions.toFixed(1)} kg CO₂e recorded.
                </div>
              </div>
            </div>

            <div className="saas-content-card" style={{ padding: '20px' }}>
              <h4 className="card-heading-navy" style={{ fontSize: '0.9rem', marginBottom: '14px' }}>
                Sustainability Milestones
              </h4>
              <div className="milestones-stack">
                {milestones.map((m) => (
                  <div
                    key={m.label}
                    className={`milestone-row ${m.achieved ? 'achieved' : 'locked'}`}
                  >
                    <span className="milestone-icon">{m.icon}</span>
                    <span className="milestone-label">{m.label}</span>
                    {m.achieved ? (
                      <span className="milestone-status text-emerald">✓</span>
                    ) : (
                      <span className="milestone-status text-muted">○</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </form>
      </div>
    </Layout>
  );
};

export default Profile;
