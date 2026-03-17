import React, { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const features = [
  {
    icon: '📊',
    title: 'Track Daily Activities',
    desc: 'Log transport, electricity, and food habits to calculate your personal carbon footprint in real time.',
  },
  {
    icon: '🤖',
    title: 'AI-Powered Insights',
    desc: 'Gemini AI analyzes your data and generates personalized, science-backed sustainability recommendations.',
  },
  {
    icon: '🌱',
    title: 'Eco Action Plans',
    desc: 'Receive a custom 7-day sustainability plan tailored to your lifestyle and emission patterns.',
  },
  {
    icon: '📋',
    title: 'Monthly Climate Reports',
    desc: 'Get AI-generated monthly reports summarizing your environmental performance and progress.',
  },
  {
    icon: '📈',
    title: 'Impact Predictions',
    desc: 'See future projections of your emissions and discover the single biggest change you can make.',
  },
  {
    icon: '💬',
    title: 'Climate Advisor Chatbot',
    desc: 'Ask your AI advisor anything about sustainability, eco-friendly alternatives, or climate science.',
  },
];

const LandingPage = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleCTA = () => {
    if (user) navigate('/dashboard');
    else navigate('/register');
  };

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Navbar */}
      <nav
        className="glass-panel"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 40px',
          borderRadius: 0,
          borderLeft: 'none',
          borderRight: 'none',
          borderTop: 'none',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <h2
          className="auth-title"
          style={{ fontSize: '1.4rem', margin: 0 }}
        >
          CarbonWise.ai
        </h2>
        <div style={{ display: 'flex', gap: '12px' }}>
          {user ? (
            <button
              className="btn"
              style={{ width: 'auto', padding: '8px 20px' }}
              onClick={() => navigate('/dashboard')}
            >
              Go to Dashboard
            </button>
          ) : (
            <>
              <Link
                to="/login"
                style={{
                  padding: '8px 20px',
                  borderRadius: '8px',
                  color: 'var(--text-muted)',
                  textDecoration: 'none',
                  border: '1px solid var(--surface-border)',
                }}
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="btn"
                style={{ width: 'auto', padding: '8px 20px', textDecoration: 'none', display: 'inline-block' }}
              >
                Get Started
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section
        style={{
          textAlign: 'center',
          padding: '100px 20px 80px',
          maxWidth: '800px',
          margin: '0 auto',
        }}
      >
        <div
          style={{
            display: 'inline-block',
            padding: '6px 16px',
            borderRadius: '20px',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: 'var(--primary)',
            fontSize: '0.85rem',
            marginBottom: '24px',
            fontWeight: 600,
          }}
        >
          🌍 SDG 13 — Climate Action
        </div>

        <h1
          style={{
            fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
            fontFamily: 'Outfit, sans-serif',
            fontWeight: 800,
            lineHeight: 1.1,
            marginBottom: '24px',
            background: 'linear-gradient(135deg, #34d399, #3b82f6)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Track Your Carbon.
          <br />
          Change Your Future.
        </h1>

        <p
          style={{
            fontSize: '1.2rem',
            color: 'var(--text-muted)',
            lineHeight: 1.7,
            marginBottom: '40px',
            maxWidth: '600px',
            margin: '0 auto 40px',
          }}
        >
          CarbonWise AI combines data analytics and Generative AI to help you
          understand your environmental impact and take meaningful action.
        </p>

        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            className="btn"
            style={{ width: 'auto', padding: '14px 36px', fontSize: '1.1rem' }}
            onClick={handleCTA}
          >
            Start Tracking Free →
          </button>
          <a
            href="#features"
            style={{
              padding: '14px 36px',
              borderRadius: '8px',
              color: 'var(--text-muted)',
              textDecoration: 'none',
              border: '1px solid var(--surface-border)',
              fontSize: '1.1rem',
            }}
          >
            Learn More
          </a>
        </div>
      </section>

      {/* Stats Banner */}
      <section
        className="glass-panel"
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '60px',
          padding: '32px',
          borderRadius: '16px',
          maxWidth: '800px',
          margin: '0 auto 80px',
          flexWrap: 'wrap',
        }}
      >
        {[
          { value: '4.7B', label: 'Tons CO₂ from individuals yearly' },
          { value: '70%', label: 'Can be reduced with lifestyle changes' },
          { value: 'AI', label: 'Powered personalized guidance' },
        ].map((stat) => (
          <div key={stat.label} style={{ textAlign: 'center' }}>
            <div
              style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--primary)' }}
            >
              {stat.value}
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
              {stat.label}
            </div>
          </div>
        ))}
      </section>

      {/* Features Grid */}
      <section id="features" style={{ maxWidth: '1100px', margin: '0 auto 80px', padding: '0 20px' }}>
        <h2
          style={{
            textAlign: 'center',
            fontSize: '2.2rem',
            fontFamily: 'Outfit, sans-serif',
            marginBottom: '48px',
          }}
        >
          Everything you need to go green
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '24px',
          }}
        >
          {features.map((f) => (
            <div key={f.title} className="glass-panel" style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '2rem', marginBottom: '12px' }}>{f.icon}</div>
              <h3
                style={{
                  fontSize: '1.1rem',
                  fontFamily: 'Outfit, sans-serif',
                  marginBottom: '8px',
                  color: 'var(--text-main)',
                }}
              >
                {f.title}
              </h3>
              <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, fontSize: '0.95rem' }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Footer */}
      <section
        className="glass-panel"
        style={{
          textAlign: 'center',
          maxWidth: '700px',
          margin: '0 auto 60px',
          padding: '60px 40px',
        }}
      >
        <h2
          style={{
            fontSize: '2rem',
            fontFamily: 'Outfit, sans-serif',
            marginBottom: '16px',
          }}
        >
          Ready to make a difference?
        </h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '32px', lineHeight: 1.6 }}>
          Join thousands of people using CarbonWise AI to understand and reduce
          their climate impact.
        </p>
        <button
          className="btn"
          style={{ width: 'auto', padding: '14px 40px', fontSize: '1.1rem' }}
          onClick={handleCTA}
        >
          Create Free Account →
        </button>
      </section>

      <footer
        style={{
          textAlign: 'center',
          padding: '24px',
          color: 'var(--text-muted)',
          fontSize: '0.85rem',
          borderTop: '1px solid var(--surface-border)',
        }}
      >
        CarbonWise AI — Built for SDG 13: Climate Action
      </footer>
    </div>
  );
};

export default LandingPage;
