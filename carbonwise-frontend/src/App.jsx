import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/AuthContext';
import './index.css';

import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';

import LandingPage from './pages/LandingPage';
import ActivityTracker from './pages/ActivityTracker';
import Insights from './pages/Insights';
import ActionPlan from './pages/ActionPlan';
import Reports from './pages/Reports';
import Profile from './pages/Profile';
import CarbonIntelligence from './pages/CarbonIntelligence';
import WhatIfSimulator from './pages/WhatIfSimulator';
import ForecastAnomalies from './pages/ForecastAnomalies';
import ImpactTracker from './pages/ImpactTracker';
import LiveClimateDashboard from './pages/LiveClimateDashboard';
import ClimateTrends from './pages/ClimateTrends';
import ClimateForecasts from './pages/ClimateForecasts';
import AlertsDashboard from './pages/AlertsDashboard';
import ErrorBoundary from './components/ErrorBoundary';

const ProtectedRoute = ({ children }) => {
  const { user } = React.useContext(AuthContext);
  return user ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <div className="app-container">
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/live-monitoring" element={<ProtectedRoute><LiveClimateDashboard /></ProtectedRoute>} />
              <Route path="/live-climate" element={<ProtectedRoute><LiveClimateDashboard /></ProtectedRoute>} />
              <Route path="/climate-analytics" element={<ProtectedRoute><ClimateTrends /></ProtectedRoute>} />
              <Route path="/climate-trends" element={<ProtectedRoute><ClimateTrends /></ProtectedRoute>} />
              <Route path="/intelligence" element={<ProtectedRoute><ClimateTrends /></ProtectedRoute>} />
              <Route path="/anomaly-detection" element={<ProtectedRoute><ForecastAnomalies /></ProtectedRoute>} />
              <Route path="/carbon-forecast" element={<ProtectedRoute><ForecastAnomalies /></ProtectedRoute>} />
              <Route path="/forecast" element={<ProtectedRoute><ClimateForecasts /></ProtectedRoute>} />
              <Route path="/climate-forecast" element={<ProtectedRoute><ClimateForecasts /></ProtectedRoute>} />
              <Route path="/alerts" element={<ProtectedRoute><AlertsDashboard /></ProtectedRoute>} />
              <Route path="/ai-insights" element={<ProtectedRoute><Insights /></ProtectedRoute>} />
              <Route path="/insights" element={<ProtectedRoute><Insights /></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              {/* Preserved underlying activity and simulation routes */}
              <Route path="/activities" element={<ProtectedRoute><ActivityTracker /></ProtectedRoute>} />
              <Route path="/carbon-intelligence" element={<ProtectedRoute><CarbonIntelligence /></ProtectedRoute>} />
              <Route path="/simulator" element={<ProtectedRoute><WhatIfSimulator /></ProtectedRoute>} />
              <Route path="/action-plan" element={<ProtectedRoute><ActionPlan /></ProtectedRoute>} />
              <Route path="/impact" element={<ProtectedRoute><ImpactTracker /></ProtectedRoute>} />
            </Routes>
          </div>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
