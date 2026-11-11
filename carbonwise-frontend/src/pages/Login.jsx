import React, { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, loginAsDemo } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (error) {
      const message = error.response?.data?.message || 'Unable to connect to live backend. You can explore the full application using Demo Mode below.';
      setErrorMsg(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoAccess = () => {
    loginAsDemo();
    navigate('/dashboard');
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#F7F9F7',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          background: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E4EBE6',
          padding: '40px',
          boxShadow: '0 8px 24px rgba(24, 50, 71, 0.05)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: '#EAF6EF',
              color: '#16845B',
              fontSize: '1.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
          >
            🌱
          </div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#183247', letterSpacing: '-0.02em', marginBottom: '6px' }}>
            Welcome to CarbonWise
          </h2>
          <p style={{ color: '#718096', fontSize: '0.92rem' }}>
            Unified climate intelligence & carbon accounting
          </p>
        </div>

        {errorMsg && (
          <div
            style={{
              background: '#FEF2F2',
              border: '1px solid #FCA5A5',
              color: '#991B1B',
              padding: '12px 16px',
              borderRadius: '8px',
              fontSize: '0.88rem',
              marginBottom: '20px',
              lineHeight: 1.5,
            }}
          >
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '0.86rem', fontWeight: 600, color: '#183247', marginBottom: '6px' }}>
              Email Address
            </label>
            <input
              type="email"
              placeholder="eco@warrior.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '11px 14px',
                borderRadius: '8px',
                border: '1px solid #E4EBE6',
                background: '#FFFFFF',
                color: '#183247',
                fontSize: '0.95rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '0.86rem', fontWeight: 600, color: '#183247', marginBottom: '6px' }}>
              Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '11px 14px',
                borderRadius: '8px',
                border: '1px solid #E4EBE6',
                background: '#FFFFFF',
                color: '#183247',
                fontSize: '0.95rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              background: '#16845B',
              color: '#FFFFFF',
              border: 'none',
              fontSize: '1rem',
              fontWeight: 700,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.7 : 1,
              boxShadow: '0 2px 8px rgba(22, 132, 91, 0.25)',
              marginBottom: '14px',
            }}
          >
            {isSubmitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div style={{ textAlign: 'center', margin: '20px 0', position: 'relative' }}>
          <hr style={{ border: 'none', borderTop: '1px solid #E4EBE6' }} />
          <span
            style={{
              position: 'absolute',
              top: '-10px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: '#FFFFFF',
              padding: '0 12px',
              color: '#A0AEC0',
              fontSize: '0.8rem',
              fontWeight: 600,
            }}
          >
            OR
          </span>
        </div>

        <button
          type="button"
          onClick={handleDemoAccess}
          style={{
            width: '100%',
            padding: '11px',
            borderRadius: '8px',
            background: '#EAF6EF',
            color: '#16845B',
            border: '1px solid #61B88B',
            fontSize: '0.95rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          <span>✨ Explore Live Demo (Instant Access)</span>
        </button>

        <p style={{ textAlign: 'center', marginTop: '24px', color: '#718096', fontSize: '0.88rem' }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color: '#16845B', fontWeight: 700, textDecoration: 'none' }}>
            Register free
          </Link>
        </p>

        <p style={{ textAlign: 'center', marginTop: '12px' }}>
          <Link to="/" style={{ color: '#A0AEC0', fontSize: '0.84rem', textDecoration: 'none' }}>
            ← Back to Homepage
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
