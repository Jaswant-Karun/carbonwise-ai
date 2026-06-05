import React, { useState, useContext, useEffect } from 'react';
import api from '../services/api';
import Layout from '../components/Layout';
import { AuthContext } from '../context/AuthContext';

const Profile = () => {
  const { user } = useContext(AuthContext);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const res = await api.get('/activities');
        setActivities(res.data);
      } catch {
        console.error('Could not load activities.');
      }
      setLoading(false);
    };
    fetchActivities();
  }, []);

  const totalEmissions = activities.reduce(
    (sum, a) => sum + parseFloat(a.carbon_emissions),
    0
  );

  const byType = {};
  activities.forEach((a) => {
    byType[a.activity_type] = (byType[a.activity_type] || 0) + parseFloat(a.carbon_emissions);
  });

  const topEmitter = Object.entries(byType).sort((a, b) => b[1] - a[1])[0];

  const joinDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'N/A';

  const sustainabilityScore = () => {
    if (totalEmissions === 0) return 50;
    // Global avg ~833 kg/month; score = max(0, 100 - (total/833)*100)
    const score = Math.max(0, Math.round(100 - (totalEmissions / 833) * 100));
    return Math.min(score, 100);
  };

  const score = sustainabilityScore();
  const scoreColor =
    score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444';

  const milestones = [
    { label: 'First Activity Logged', achieved: activities.length >= 1, icon: '🌱' },
    { label: '5 Activities Logged', achieved: activities.length >= 5, icon: '📊' },
    { label: '10 Activities Logged', achieved: activities.length >= 10, icon: '🏆' },
    { label: 'Under 100 kg Total', achieved: totalEmissions < 100 && activities.length > 0, icon: '🌍' },
    { label: 'Under 50 kg Total', achieved: totalEmissions < 50 && activities.length > 0, icon: '⭐' },
    { label: 'Eco Champion (score ≥ 70)', achieved: score >= 70, icon: '🥇' },
  ];

  const typeIcons = { transport: '🚗', electricity: '⚡', food: '🍖', flight: '✈️', shopping: '🛍️' };

  return (
    <Layout>
      <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '2rem', marginBottom: '8px' }}>
        My Profile
      </h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>
        Your account details, sustainability statistics, and earned milestones.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '32px' }}>
        {/* Left: User Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Avatar + Info */}
          <div className="glass-panel" style={{ textAlign: 'center' }}>
            <div
              style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2rem',
                margin: '0 auto 16px',
                fontWeight: 700,
                color: 'white',
              }}
            >
              {user?.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.4rem', marginBottom: '4px' }}>
              {user?.name}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '16px' }}>
              {user?.email}
            </p>
            <div
              style={{
                padding: '8px 16px',
                borderRadius: '20px',
                background: 'rgba(16,185,129,0.15)',
                border: '1px solid rgba(16,185,129,0.3)',
                color: 'var(--primary)',
                fontSize: '0.85rem',
                fontWeight: 600,
                display: 'inline-block',
              }}
            >
              🌍 CarbonWise Member
            </div>
          </div>

          {/* Sustainability Score */}
          <div className="glass-panel" style={{ textAlign: 'center' }}>
            <h4 style={{ marginBottom: '16px', color: 'var(--text-muted)', fontWeight: 400 }}>
              Sustainability Score
            </h4>
            <div
              style={{
                fontSize: '4rem',
                fontWeight: 800,
                color: scoreColor,
                fontFamily: 'Outfit, sans-serif',
                lineHeight: 1,
              }}
            >
              {score}
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
              out of 100
            </div>
            <div
              style={{
                marginTop: '12px',
                height: '8px',
                borderRadius: '4px',
                background: 'rgba(255,255,255,0.1)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${score}%`,
                  background: `linear-gradient(90deg, ${scoreColor}, ${scoreColor}aa)`,
                  borderRadius: '4px',
                  transition: 'width 0.8s ease',
                }}
              />
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '12px' }}>
              {score >= 70
                ? '🌟 Excellent! You are well below average emissions.'
                : score >= 40
                ? '👍 Good effort! Keep reducing your footprint.'
                : '⚠️ Above average. Try logging more eco activities.'}
            </p>
          </div>
        </div>

        {/* Right: Stats + Milestones */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Stats Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '16px',
            }}
          >
            {[
              { label: 'Total CO₂', value: loading ? '...' : `${totalEmissions.toFixed(1)} kg`, icon: '💨' },
              { label: 'Activities', value: loading ? '...' : activities.length, icon: '📝' },
              { label: 'Trees Needed', value: loading ? '...' : Math.ceil(totalEmissions / 20), icon: '🌲' },
              { label: 'Top Emitter', value: loading ? '...' : (topEmitter ? topEmitter[0] : 'None'), icon: typeIcons[topEmitter?.[0]] || '📊' },
            ].map((stat) => (
              <div
                key={stat.label}
                className="glass-panel"
                style={{ textAlign: 'center', padding: '18px' }}
              >
                <div style={{ fontSize: '1.5rem', marginBottom: '6px' }}>{stat.icon}</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--primary)' }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          {/* Emissions by Category */}
          {Object.keys(byType).length > 0 && (
            <div className="glass-panel">
              <h4 style={{ marginBottom: '16px' }}>Emissions by Category</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {Object.entries(byType)
                  .sort((a, b) => b[1] - a[1])
                  .map(([type, val]) => {
                    const pct = totalEmissions > 0 ? (val / totalEmissions) * 100 : 0;
                    return (
                      <div key={type}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginBottom: '6px',
                          }}
                        >
                          <span style={{ textTransform: 'capitalize', fontSize: '0.9rem' }}>
                            {typeIcons[type] || '📌'} {type}
                          </span>
                          <span style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '0.9rem' }}>
                            {parseFloat(val).toFixed(2)} kg ({pct.toFixed(0)}%)
                          </span>
                        </div>
                        <div
                          style={{
                            height: '6px',
                            borderRadius: '3px',
                            background: 'rgba(255,255,255,0.08)',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              height: '100%',
                              width: `${pct}%`,
                              background: 'linear-gradient(90deg, var(--primary), var(--secondary))',
                              borderRadius: '3px',
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Milestones */}
          <div className="glass-panel">
            <h4 style={{ marginBottom: '16px' }}>🏅 Milestones</h4>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: '10px',
              }}
            >
              {milestones.map((m) => (
                <div
                  key={m.label}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '10px',
                    background: m.achieved ? 'rgba(16,185,129,0.12)' : 'rgba(0,0,0,0.2)',
                    border: `1px solid ${m.achieved ? 'rgba(16,185,129,0.3)' : 'var(--surface-border)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    opacity: m.achieved ? 1 : 0.5,
                  }}
                >
                  <span style={{ fontSize: '1.2rem' }}>{m.icon}</span>
                  <span
                    style={{
                      fontSize: '0.8rem',
                      color: m.achieved ? 'var(--primary)' : 'var(--text-muted)',
                      fontWeight: m.achieved ? 600 : 400,
                    }}
                  >
                    {m.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Profile;
