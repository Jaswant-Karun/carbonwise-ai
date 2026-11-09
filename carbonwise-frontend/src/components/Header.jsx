
import React, { useState, useEffect, useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ChevronDown,
  Bell,
  CalendarDays,
  Download,
  MapPin,
  RefreshCw,
} from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';

const pageMeta = {
  '/dashboard': {
    eyebrow: 'Real-Time Climate Intelligence',
    title: 'Climate Intelligence & Anomaly Dashboard',
    description: 'Continuous atmospheric observations, statistical anomaly detection, and climate alerts.',
  },
  '/live-monitoring': {
    eyebrow: 'Continuous Telemetry',
    title: 'Live Environmental Monitoring',
    description: 'Atmospheric observations, air quality index, and meteorological forecasts.',
  },
  '/live-climate': {
    eyebrow: 'Continuous Telemetry',
    title: 'Live Environmental Monitoring',
    description: 'Atmospheric observations, air quality index, and meteorological forecasts.',
  },
  '/climate-analytics': {
    eyebrow: 'Multi-Decadal Analytics',
    title: 'Climate Trends & Baselines',
    description: 'Historical temperature and precipitation trends compared against 1991–2020 WMO standard normals.',
  },
  '/climate-trends': {
    eyebrow: 'Multi-Decadal Analytics',
    title: 'Climate Trends & Baselines',
    description: 'Historical temperature and precipitation trends compared against 1991–2020 WMO standard normals.',
  },
  '/anomaly-detection': {
    eyebrow: 'Statistical Detection',
    title: 'Atmospheric Anomaly Engine',
    description: 'Explainable statistical anomaly identification using MAD, robust Z-scores, and seasonal limits.',
  },
  '/alerts': {
    eyebrow: 'Evidence-Based Warning System',
    title: 'Environmental Alerts & Air Quality',
    description: 'Prioritized alerts based on measured atmospheric deviations and EPA/WHO air quality thresholds.',
  },
  '/ai-insights': {
    eyebrow: 'Explainable AI Analytics',
    title: 'AI Climate Insights',
    description: 'Natural-language climate intelligence explaining observed anomalies with deterministic fallbacks.',
  },
  '/insights': {
    eyebrow: 'Explainable AI Analytics',
    title: 'AI Climate Insights',
    description: 'Natural-language climate intelligence explaining observed anomalies with deterministic fallbacks.',
  },
  '/reports': {
    eyebrow: 'Environmental Audits',
    title: 'Climate & Sustainability Reports',
    description: 'Export verifiable PDF reports and evidence-based environmental telemetry summaries.',
  },
  '/settings': {
    eyebrow: 'Workspace Configuration',
    title: 'Platform Settings & Locations',
    description: 'Configure monitoring regions, sensor telemetry preferences, and provider connections.',
  },
  '/profile': {
    eyebrow: 'Workspace Configuration',
    title: 'Platform Settings & Locations',
    description: 'Configure monitoring regions, sensor telemetry preferences, and provider connections.',
  },
};

const Header = () => {
  const location = useLocation();
  const { user } = useContext(AuthContext);
  const meta = pageMeta[location.pathname] || pageMeta['/dashboard'];
  const [regions, setRegions] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState('New York, USA');
  const [lastUpdate, setLastUpdate] = useState('Syncing...');
  const [alertCount, setAlertCount] = useState(0);
  const [dateRange, setDateRange] = useState('7d');

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      try {
        const [regRes, alertRes] = await Promise.allSettled([
          api.get('/environment/regions'),
          api.get('/environment/alerts'),
        ]);

        if (isMounted) {
          if (regRes.status === 'fulfilled' && regRes.value.data?.length > 0) {
            setRegions(regRes.value.data);
            setSelectedRegion(regRes.value.data[0].name);
          }
          if (alertRes.status === 'fulfilled' && Array.isArray(alertRes.value.data)) {
            const openAlerts = alertRes.value.data.filter((a) => a.status === 'open');
            setAlertCount(openAlerts.length);
          }
          setLastUpdate('Live • Open-Meteo Synced');
        }
      } catch {
        if (isMounted) setLastUpdate('Connecting...');
      }
    };
    fetchData();
    return () => { isMounted = false; };
  }, []);

  const initials = user?.name
    ?.split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'CW';

  return (
    <header className="page-header">
      <div className="page-heading">
        <div className="header-meta-row">
          <span className="page-eyebrow">{meta.eyebrow}</span>
          <div className="live-status-pill">
            <span className="live-status-dot" />
            <span>{lastUpdate}</span>
          </div>
        </div>
        <h1>{meta.title}</h1>
        <p>{meta.description}</p>
      </div>

      <div className="header-actions">
        {/* Location Selector */}
        <div className="header-location-picker">
          <MapPin size={14} className="location-icon" />
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="location-select"
            aria-label="Monitored Location"
          >
            {regions.length > 0 ? (
              regions.map((reg) => (
                <option key={reg.id} value={reg.name}>
                  {reg.name}
                </option>
              ))
            ) : (
              <option value="New York, USA">New York, USA</option>
            )}
          </select>
          <ChevronDown size={13} className="chevron" />
        </div>

        {/* Date Range Selector */}
        <div className="header-date-range">
          <CalendarDays size={14} />
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="location-select"
            aria-label="Timeframe"
            style={{ background: 'transparent', border: 'none', color: 'inherit', padding: 0 }}
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="1y">Year to Date</option>
          </select>
          <ChevronDown size={13} className="chevron" />
        </div>

        {/* Download Report Button */}
        <Link to="/reports" className="header-btn-download">
          <Download size={14} />
          <span>Download Report</span>
        </Link>

        {/* Notification Indicator with alert count badge */}
        <Link to="/alerts" className="header-icon-btn" aria-label="Active Alerts" title="Active Environmental Alerts">
          <Bell size={16} />
          {alertCount > 0 && <span className="notification-indicator">{alertCount}</span>}
        </Link>

        {/* User Avatar */}
        <Link to="/settings" className="header-profile-badge" aria-label="Platform Settings">
          <span className="header-avatar-circle">{initials}</span>
          <div className="header-profile-text">
            <strong>{user?.name || 'Climate Analyst'}</strong>
            <small>Environmental Lead</small>
          </div>
        </Link>
      </div>
    </header>
  );
};

export default Header;
