import React, { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const SECTOR_CARDS = [
  { icon: '⚡', name: 'Electricity & Energy', metric: 'Grid vs. Solar Self-Consumption', factor: '0.50 kg CO₂e/kWh' },
  { icon: '🚗', name: 'Transportation & Mobility', metric: 'EV, Hybrid, Transit, & Flights', factor: '0.109 kg CO₂e/p-km' },
  { icon: '🥗', name: 'Food & Nutrition', metric: 'Plant-forward vs. High-meat diets', factor: '2.50 kg CO₂e/kg' },
  { icon: '💧', name: 'Water Consumption', metric: 'Municipal Treatment & Pumping', factor: '0.344 kg CO₂e/m³' },
  { icon: '🗑️', name: 'Waste Management', metric: 'Composting & Landfill Diversion', factor: '0.60 kg CO₂e/kg' },
  { icon: '🏢', name: 'Facilities & Buildings', metric: 'Floor Area & Heat Pump Efficiency', factor: '0.13 kg CO₂e/m²' },
];

const PLATFORM_CAPABILITIES = [
  {
    icon: '📊',
    badge: 'Scope 1, 2 & 3',
    title: 'Precision Activity Tracking',
    description: 'Log and validate operational emissions across 6 certified sectors with transparent DEFRA/EPA scientific factors and idempotency checks.',
  },
  {
    icon: '📈',
    badge: 'Forecasting',
    title: '30-Day Numerical Predictions',
    description: 'Empirical time-series forecasting utilizing historical moving averages and seasonality baselines. Never fabricates predictions or assumes outcomes.',
  },
  {
    icon: '🌱',
    badge: 'Action Engine',
    title: 'Climate Action Planner',
    description: 'Personalized reduction roadmaps prioritized by your highest emission contributors, tracking actual recorded changes separately from modeled savings.',
  },
  {
    icon: '🌍',
    badge: 'Open-Meteo & OpenAQ',
    title: 'Live Environmental Intelligence',
    description: 'Continuous atmospheric telemetry, Median Absolute Deviation (MAD) anomaly detection, and ground station air quality indices.',
  },
  {
    icon: '📑',
    badge: 'Compliance',
    title: 'Executive Sustainability Reports',
    description: 'One-click audit reports across 9 custom date ranges with downloadable PDF executive summaries and CSV activity archives.',
  },
  {
    icon: '🤖',
    badge: 'Safe AI',
    title: 'Responsible Gemini Integration',
    description: 'Translates statistical evidence into plain-language summaries with SHA-256 caching, rate limits, and zero-hallucination deterministic fallbacks.',
  },
];

const LandingPage = () => {
  const { user, loginAsDemo } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLaunchDemo = () => {
    loginAsDemo();
    navigate('/dashboard');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F7F9F7', color: '#183247' }}>
      {/* SaaS Navigation Bar */}
      <nav
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 40px',
          background: '#FFFFFF',
          borderBottom: '1px solid #E4EBE6',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          boxShadow: '0 1px 3px rgba(24, 50, 71, 0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: '#EAF6EF',
              color: '#16845B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem',
              fontWeight: 800,
            }}
          >
            🌱
          </div>
          <div>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#183247', letterSpacing: '-0.02em' }}>
              CarbonWise<span style={{ color: '#16845B' }}>.ai</span>
            </span>
            <span
              style={{
                marginLeft: '8px',
                padding: '2px 8px',
                borderRadius: '12px',
                background: '#EAF6EF',
                color: '#16845B',
                fontSize: '0.72rem',
                fontWeight: 700,
                verticalAlign: 'middle',
              }}
            >
              SDG 13
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <a
            href="#features"
            style={{ color: '#718096', fontSize: '0.95rem', fontWeight: 500, textDecoration: 'none' }}
          >
            Capabilities
          </a>
          <a
            href="#sectors"
            style={{ color: '#718096', fontSize: '0.95rem', fontWeight: 500, textDecoration: 'none' }}
          >
            Sectors
          </a>

          {user ? (
            <button
              onClick={() => navigate('/dashboard')}
              style={{
                padding: '9px 20px',
                borderRadius: '8px',
                background: '#16845B',
                color: '#FFFFFF',
                border: 'none',
                fontWeight: 600,
                fontSize: '0.92rem',
                cursor: 'pointer',
              }}
            >
              Open Dashboard →
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                onClick={handleLaunchDemo}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  background: '#EAF6EF',
                  color: '#16845B',
                  border: '1px solid #61B88B',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                }}
              >
                ✨ Live Demo
              </button>
              <Link
                to="/login"
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  color: '#183247',
                  border: '1px solid #E4EBE6',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                  background: '#FFFFFF',
                }}
              >
                Sign In
              </Link>
              <Link
                to="/register"
                style={{
                  padding: '8px 20px',
                  borderRadius: '8px',
                  background: '#16845B',
                  color: '#FFFFFF',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Get Started
              </Link>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section style={{ textAlign: 'center', padding: '72px 24px 56px', maxWidth: '980px', margin: '0 auto' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 16px',
            borderRadius: '24px',
            background: '#EAF6EF',
            border: '1px solid #D1EADE',
            color: '#16845B',
            fontSize: '0.85rem',
            fontWeight: 700,
            marginBottom: '28px',
          }}
        >
          <span>🎯 United Nations SDG 13: Climate Action</span>
          <span>•</span>
          <span>Professional Environmental SaaS</span>
        </div>

        <h1
          style={{
            fontSize: 'clamp(2.4rem, 5vw, 3.8rem)',
            fontWeight: 800,
            lineHeight: 1.15,
            letterSpacing: '-0.03em',
            color: '#183247',
            marginBottom: '20px',
          }}
        >
          Unified Carbon Accounting &<br />
          <span style={{ color: '#16845B' }}>Live Environmental Intelligence</span>
        </h1>

        <p
          style={{
            fontSize: '1.18rem',
            color: '#718096',
            lineHeight: 1.65,
            maxWidth: '720px',
            margin: '0 auto 36px',
          }}
        >
          Track organizational emissions across 6 operational sectors, project reduction pathways with transparent
          mathematical models, and detect atmospheric anomalies using real telemetry from Open-Meteo and OpenAQ.
        </p>

        <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '48px' }}>
          <button
            onClick={handleLaunchDemo}
            style={{
              padding: '14px 34px',
              borderRadius: '10px',
              background: '#16845B',
              color: '#FFFFFF',
              border: 'none',
              fontSize: '1.02rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(22, 132, 91, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>🚀 Explore Live Platform Demo</span>
          </button>
          <Link
            to="/login"
            style={{
              padding: '14px 28px',
              borderRadius: '10px',
              background: '#FFFFFF',
              color: '#183247',
              border: '1px solid #E4EBE6',
              fontSize: '1.02rem',
              fontWeight: 600,
              textDecoration: 'none',
              boxShadow: '0 2px 4px rgba(24, 50, 71, 0.04)',
            }}
          >
            Sign In with Account
          </Link>
        </div>

        {/* Live Architecture Status Banner */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E4EBE6',
            borderRadius: '16px',
            padding: '20px 28px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '20px',
            textAlign: 'left',
            boxShadow: '0 4px 16px rgba(24, 50, 71, 0.04)',
          }}
        >
          <div>
            <div style={{ fontSize: '0.78rem', color: '#718096', fontWeight: 600, textTransform: 'uppercase' }}>
              6 Emission Sectors
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#183247', marginTop: '2px' }}>
              Full Scope 1-3 Auditing
            </div>
            <div style={{ fontSize: '0.82rem', color: '#16845B', marginTop: '4px' }}>
              DEFRA & EPA 2024 Factors
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: '#718096', fontWeight: 600, textTransform: 'uppercase' }}>
              Atmospheric Telemetry
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#183247', marginTop: '2px' }}>
              Open-Meteo & OpenAQ
            </div>
            <div style={{ fontSize: '0.82rem', color: '#16845B', marginTop: '4px' }}>
              Continuous Ingestion Cycle
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: '#718096', fontWeight: 600, textTransform: 'uppercase' }}>
              Anomaly Detection
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#183247', marginTop: '2px' }}>
              MAD & Robust Z-Scores
            </div>
            <div style={{ fontSize: '0.82rem', color: '#16845B', marginTop: '4px' }}>
              vs. 1991–2020 WMO Normals
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: '#718096', fontWeight: 600, textTransform: 'uppercase' }}>
              Numerical Forecasting
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#183247', marginTop: '2px' }}>
              30-Day Trajectories
            </div>
            <div style={{ fontSize: '0.82rem', color: '#16845B', marginTop: '4px' }}>
              Moving Average & Confidence Bands
            </div>
          </div>
        </div>
      </section>

      {/* Sectors Grid */}
      <section id="sectors" style={{ maxWidth: '1140px', margin: '0 auto 72px', padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <h2 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#183247', letterSpacing: '-0.02em' }}>
            Multi-Sector Carbon Accounting Engine
          </h2>
          <p style={{ color: '#718096', fontSize: '1rem', marginTop: '6px' }}>
            Verified mathematical calculations using documented conversion constants. Zero hallucination.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '18px' }}>
          {SECTOR_CARDS.map((sector) => (
            <div
              key={sector.name}
              style={{
                background: '#FFFFFF',
                border: '1px solid #E4EBE6',
                borderRadius: '12px',
                padding: '22px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '16px',
                boxShadow: '0 2px 6px rgba(24, 50, 71, 0.03)',
              }}
            >
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '10px',
                  background: '#EAF6EF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem',
                  flexShrink: 0,
                }}
              >
                {sector.icon}
              </div>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#183247', marginBottom: '4px' }}>
                  {sector.name}
                </h3>
                <div style={{ fontSize: '0.88rem', color: '#718096', marginBottom: '6px' }}>
                  {sector.metric}
                </div>
                <div
                  style={{
                    display: 'inline-block',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    color: '#16845B',
                    background: '#EAF6EF',
                    padding: '2px 8px',
                    borderRadius: '6px',
                  }}
                >
                  Baseline: {sector.factor}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Capabilities Section */}
      <section id="features" style={{ maxWidth: '1140px', margin: '0 auto 80px', padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '42px' }}>
          <h2 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#183247', letterSpacing: '-0.02em' }}>
            Built for Real-World Environmental Intelligence
          </h2>
          <p style={{ color: '#718096', fontSize: '1rem', marginTop: '6px' }}>
            Comprehensive analytics connecting user activities, empirical forecasts, and live external sensors.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: '22px' }}>
          {PLATFORM_CAPABILITIES.map((cap) => (
            <div
              key={cap.title}
              style={{
                background: '#FFFFFF',
                border: '1px solid #E4EBE6',
                borderRadius: '14px',
                padding: '28px',
                boxShadow: '0 2px 8px rgba(24, 50, 71, 0.03)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <span style={{ fontSize: '2rem' }}>{cap.icon}</span>
                  <span
                    style={{
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      color: '#16845B',
                      background: '#EAF6EF',
                      padding: '3px 10px',
                      borderRadius: '12px',
                    }}
                  >
                    {cap.badge}
                  </span>
                </div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#183247', marginBottom: '10px' }}>
                  {cap.title}
                </h3>
                <p style={{ color: '#718096', fontSize: '0.92rem', lineHeight: 1.6 }}>
                  {cap.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section
        style={{
          maxWidth: '820px',
          margin: '0 auto 80px',
          padding: '48px 32px',
          background: '#FFFFFF',
          borderRadius: '18px',
          border: '1px solid #E4EBE6',
          textAlign: 'center',
          boxShadow: '0 6px 20px rgba(24, 50, 71, 0.05)',
        }}
      >
        <span style={{ fontSize: '2.5rem' }}>🌱</span>
        <h2 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#183247', marginTop: '12px', marginBottom: '10px' }}>
          Ready to Experience Modern Climate Analytics?
        </h2>
        <p style={{ color: '#718096', fontSize: '1.02rem', maxWidth: '580px', margin: '0 auto 28px', lineHeight: 1.6 }}>
          Explore interactive dashboards, real atmospheric sensors, and deterministic forecasting right now in your browser.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={handleLaunchDemo}
            style={{
              padding: '13px 32px',
              borderRadius: '8px',
              background: '#16845B',
              color: '#FFFFFF',
              border: 'none',
              fontWeight: 700,
              fontSize: '1rem',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(22, 132, 91, 0.2)',
            }}
          >
            Launch Instant Demo →
          </button>
          <Link
            to="/register"
            style={{
              padding: '13px 28px',
              borderRadius: '8px',
              background: '#EAF6EF',
              color: '#16845B',
              border: '1px solid #61B88B',
              fontWeight: 600,
              fontSize: '1rem',
              textDecoration: 'none',
            }}
          >
            Create Free Account
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          borderTop: '1px solid #E4EBE6',
          padding: '32px 24px',
          background: '#FFFFFF',
          textAlign: 'center',
          color: '#718096',
          fontSize: '0.88rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span style={{ fontWeight: 700, color: '#183247' }}>CarbonWise AI</span>
          <span>•</span>
          <span>Aligned with UN SDG 13: Climate Action</span>
          <span>•</span>
          <span>Open-Meteo & OpenAQ Data Attribution</span>
        </div>
        <div>
          Scientific carbon factors derived from DEFRA 2024, IPCC AR6 Working Group I, and EPA GHG Emission Hub.
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
