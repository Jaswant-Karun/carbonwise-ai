import axios from 'axios';
import {
  demoUser,
  demoActivities,
  demoSummary,
  demoDetailedReport,
  demoIntelligence,
  demoForecast,
  demoRegions,
  demoRegionalSummary,
  demoActionPlan,
} from './demoFallbackData';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  timeout: 8000,
});

// Add a request interceptor to inject the token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Fallback resolver for demo mode or unreachable backend
const resolveFallbackData = (config) => {
  const url = (config.url || '').toLowerCase();
  const method = (config.method || 'get').toLowerCase();

  if (url.includes('/auth/me')) {
    return { data: demoUser, status: 200 };
  }
  if (url.includes('/auth/login') || url.includes('/auth/register')) {
    return { data: { token: 'demo-token-preview', ...demoUser }, status: 200 };
  }
  if (url.includes('/activities/summary') || url.includes('/emissions/summary')) {
    return { data: demoSummary, status: 200 };
  }
  if (url.includes('/activities')) {
    if (method === 'post') {
      try {
        const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
        const newAct = {
          id: Date.now(),
          activity_type: body?.activity_type || 'electricity',
          details: body?.details || {},
          carbon_emissions: Number(body?.carbon_emissions) || 12.5,
          date: body?.date || new Date().toISOString().split('T')[0],
          notes: body?.notes || 'Logged via demo dashboard',
        };
        demoActivities.unshift(newAct);
        return { data: newAct, status: 201 };
      } catch {
        return { data: demoActivities[0], status: 201 };
      }
    }
    if (method === 'delete' || method === 'put') {
      return { data: { success: true }, status: 200 };
    }
    return { data: demoActivities, status: 200 };
  }
  if (url.includes('/predictions') || url.includes('/forecast')) {
    return { data: demoForecast, status: 200 };
  }
  if (url.includes('/reports/pdf') || url.includes('/reports/csv')) {
    return { data: new Blob(['CarbonWise AI Certified Report'], { type: 'text/plain' }), status: 200 };
  }
  if (url.includes('/reports/monthly') || url.includes('/reports/analytics') || url.includes('/reports')) {
    return { data: demoDetailedReport, status: 200 };
  }
  if (url.includes('/action-plans') || url.includes('/coach')) {
    return { data: demoActionPlan, status: 200 };
  }
  if (url.includes('/environment/regions') && !url.includes('/summary') && !url.includes('/ai-insights')) {
    return { data: demoRegions, status: 200 };
  }
  if (url.includes('/environment/regions') || url.includes('/environment/observations')) {
    return { data: demoRegionalSummary, status: 200 };
  }
  if (url.includes('/environment/alerts')) {
    return { data: demoRegionalSummary.activeAlerts, status: 200 };
  }
  if (url.includes('/intelligence')) {
    return { data: demoIntelligence, status: 200 };
  }
  if (url.includes('/environment')) {
    return { data: demoRegionalSummary, status: 200 };
  }

  return null;
};

// Response interceptor: if in demo mode or network error, provide realistic fallback
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isDemo = localStorage.getItem('carbonwise_demo_mode') === 'true';
    const isNetworkError = !error.response || error.code === 'ERR_NETWORK' || error.message?.includes('Network Error');

    if (isDemo || isNetworkError) {
      const fallback = resolveFallbackData(error.config || {});
      if (fallback) {
        return Promise.resolve(fallback);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
