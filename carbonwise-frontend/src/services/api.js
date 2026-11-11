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
  demoGoals,
  demoAirQualityData,
  demoClimateTrendReport,
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
  if (url.includes('/coach/goals')) {
    if (method === 'post') {
      try {
        const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
        const newGoal = {
          id: Date.now(),
          period: body?.period || 'weekly',
          targetKg: Number(body?.targetKg) || 20,
          category: body?.category || '',
          status: 'active',
          currentPeriodEmissionsKg: 0,
          actualChangeKg: 0,
          progressPercentage: 0,
          isTargetAchieved: false,
          verificationStatus: 'pending',
          createdAt: new Date().toISOString(),
        };
        demoGoals.unshift(newGoal);
        return { data: newGoal, status: 201 };
      } catch {
        return { data: demoGoals[0], status: 201 };
      }
    }
    return { data: demoGoals, status: 200 };
  }
  if (url.includes('/coach/recommendations')) {
    return { data: { recommendations: demoActionPlan.recommendations, highestImpactCategories: demoActionPlan.highestImpactCategories }, status: 200 };
  }
  if (url.includes('/coach/actions/')) {
    try {
      const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
      const parts = url.split('/');
      const actId = Number(parts[parts.length - 1]);
      const action = demoActionPlan.actions.find((a) => a.id === actId);
      if (action && body?.status) {
        action.status = body.status;
        if (body.status === 'completed') action.completedAt = new Date().toISOString();
        return { data: action, status: 200 };
      }
    } catch {
      // fallback
    }
    return { data: demoActionPlan.actions[0], status: 200 };
  }
  if (url.includes('/coach/plans') || url.includes('/coach/plan') || url.includes('/action-plans')) {
    if (url.includes('/plans')) {
      return { data: [demoActionPlan], status: 200 };
    }
    return { data: demoActionPlan, status: 200 };
  }
  if (url.includes('/air-quality')) {
    return { data: demoAirQualityData, status: 200 };
  }
  if (url.includes('/ai-trend-report') || url.includes('/trend-report')) {
    return { data: demoClimateTrendReport, status: 200 };
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
