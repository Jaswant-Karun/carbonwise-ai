
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
    eyebrow: 'Operations & Intelligence',
    title: 'Climate & Carbon Dashboard',
    description: 'Real-time environmental observations, anomaly telemetry, and carbon analytics.',
  },
  '/activities': {
    eyebrow: 'Data Capture',
    title: 'Carbon Footprint & Activities',
    description: 'Review and manage the emission sources behind your footprint.',
  },
  '/intelligence': {
    eyebrow: 'Environmental Analytics',
    title: 'Climate Trends & Intelligence',
    description: 'Deep-dive into multi-period emissions patterns and variance analysis.',
  },
  '/simulator': {
    eyebrow: 'Scenario Planning',
    title: 'What-If Impact Simulator',
    description: 'Simulate reduction initiatives and transport shifts before implementing.',
  },
  '/forecast': {
    eyebrow: 'Early Warning System',
    title: 'Anomalies & Forecast Analytics',
    description: 'Distinguish observed baseline records from machine learning projections.',
  },
  '/impact': {
    eyebrow: 'SDG-13 Target Progress',
    title: 'Impact & Baseline Tracker',
    description: 'Quantify verified environmental progress against established baselines.',
  },
  '/live-climate': {
    eyebrow: 'Continuous Telemetry',
    title: 'Live Environmental Monitoring',
    description: 'Atmospheric observations, air quality index, and meteorological warnings.',
  },
  '/action-plan': {
    eyebrow: 'Adaptive Decarbonization',
    title: 'Sustainability Action Goals',
    description: 'Actionable weekly guidance and science-aligned reduction targets.',
  },
  '/reports': {
    eyebrow: 'Audit & Compliance',
    title: 'Environmental Climate Reports',
    description: 'Export verifiable PDF audits and deterministic sustainability metrics.',
  },
  '/profile': {
    eyebrow: 'System & Preferences',
    title: 'Settings & Workspace',
    description: 'Manage notification thresholds, workspace members, and regional sensors.',
  },
};

const Header = () => {
  const location = useLocation();
  const { user } = useContext(AuthContext);
  const meta = pageMeta[location.pathname] || pageMeta['/dashboard'];
  const [regions, setRegions] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState('Global Operations');
  const [lastUpdate, setLastUpdate] = useState('Syncing...');

  useEffect(() => {
    let isMounted = true;
    const fetchRegions = async () => {
      try {
        const res = await api.get('/environment/regions');
        if (isMounted && res.data && res.data.length > 0) {
          setRegions(res.data);
          setSelectedRegion(res.data[0].name);
        }
      } catch (err) {
        // Fallback silently if not yet configured
      }
      if (isMounted) {
        setLastUpdate('Live sync');
      }
    };
    fetchRegions();
    return () => { isMounted = false; };
  }, []);

  const initials = user?.name
    ?.split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'AG';

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
              <option value="Global Operations">Global Operations</option>
            )}
          </select>
          <ChevronDown size={13} className="chevron" />
        </div>

        {/* Date Range Selector matching reference */}
        <div className="header-date-range">
          <CalendarDays size={14} />
          <span>May 12 – Jun 12, 2024</span>
          <ChevronDown size={13} className="chevron" />
        </div>

        {/* Download Report Button */}
        <Link to="/reports" className="header-btn-download">
          <Download size={14} />
          <span>Download Report</span>
        </Link>

        {/* Notification Indicator with alert count badge */}
        <Link to="/live-climate" className="header-icon-btn" aria-label="Active Alerts">
          <Bell size={16} />
          <span className="notification-indicator">2</span>
        </Link>

        {/* User Avatar */}
        <Link to="/profile" className="header-profile-badge" aria-label="Account Settings">
          <span className="header-avatar-circle">{initials}</span>
          <div className="header-profile-text">
            <strong>{user?.name || 'Alex Morgan'}</strong>
            <small>Sustainability Lead</small>
          </div>
        </Link>
      </div>
    </header>
  );
};

export default Header;
