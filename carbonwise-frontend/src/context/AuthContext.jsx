/* eslint-disable react-refresh/only-export-components */
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

  return (
    <AuthContext.Provider value={{ user, loading, login, register, loginAsDemo, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
