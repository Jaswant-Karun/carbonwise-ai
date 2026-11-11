import React, { createContext, useState, useEffect } from 'react';
import api from '../services/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      const isDemo = localStorage.getItem('carbonwise_demo_mode') === 'true';
      if (isDemo) {
        setUser({
          id: 999,
          name: 'Sustainability Ambassador',
          email: 'demo@carbonwise.ai',
          role: 'demo_user',
        });
        setLoading(false);
        return;
      }

      const token = localStorage.getItem('token');
      if (token) {
        try {
          const res = await api.get('/auth/me');
          setUser(res.data);
        } catch {
          localStorage.removeItem('token');
        }
      }
      setLoading(false);
    };

    fetchUser();
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    localStorage.removeItem('carbonwise_demo_mode');
    localStorage.setItem('token', res.data.token);
    setUser(res.data);
  };

  const register = async (name, email, password) => {
    const res = await api.post('/auth/register', { name, email, password });
    localStorage.removeItem('carbonwise_demo_mode');
    localStorage.setItem('token', res.data.token);
    setUser(res.data);
  };

  const loginAsDemo = () => {
    const demoUser = {
      id: 999,
      name: 'Sustainability Ambassador',
      email: 'demo@carbonwise.ai',
      role: 'demo_user',
    };
    localStorage.setItem('token', 'demo-token-carbonwise-preview');
    localStorage.setItem('carbonwise_demo_mode', 'true');
    setUser(demoUser);
    return demoUser;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('carbonwise_demo_mode');
    setUser(null);
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#F7F9F7',
          fontFamily: "'DM Sans', sans-serif",
          color: '#183247',
        }}
      >
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            border: '3px solid #E4EBE6',
            borderTopColor: '#16845B',
            animation: 'cw-spin 0.8s linear infinite',
            marginBottom: '16px',
          }}
        />
        <style>{`@keyframes cw-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        <div style={{ fontSize: '0.96rem', fontWeight: 600, color: '#183247' }}>Loading CarbonWise AI...</div>
        <div style={{ fontSize: '0.84rem', color: '#718096', marginTop: '4px' }}>Verifying authenticated session</div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, loginAsDemo, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
