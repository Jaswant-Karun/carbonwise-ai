import React, { useState, useEffect, useContext } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  Bell,
  CalendarDays,
  Download,
  FileSpreadsheet,
  FileText,
  Plus,
} from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';

const pageMeta = {
  '/dashboard': {
    eyebrow: 'Command Center',
    title: 'Overview Dashboard',
    description: 'Track your carbon emissions, predictive trajectories, and live environmental intelligence.',
  },
  '/activities': {
    eyebrow: 'Activity Management',
    title: 'Activity Logs',
    description: 'Record, filter, edit, and audit carbon-generating activities across 7 certified emission sectors.',
  },
  '/carbon-intelligence': {
    eyebrow: 'Emission Intelligence',
    title: 'Carbon Emissions',
    description: 'Deep category breakdowns, deterministic calculation formulas, and official emission factor references.',
  },
  '/carbon-forecast': {
    eyebrow: 'AI Forecasting',
    title: 'AI Predictions',
    description: 'Multi-horizon emission forecasts, uncertainty confidence intervals, and anomaly detection.',
  },
  '/action-plan': {
    eyebrow: 'Decarbonization Roadmap',
    title: 'Climate Actions',
    description: 'AI-prioritized reduction opportunities, verified savings formulas, and action progress tracking.',
  },
  '/reports': {
    eyebrow: 'Reporting & Compliance',
    title: 'Analytics & Reports',
    description: 'Comprehensive period rollups, visual Chart.js audits, and instant PDF / CSV compliance export.',
  },
  '/live-climate': {
    eyebrow: 'Physical Telemetry',
    title: 'Environmental Intelligence',
    description: 'Real-time Open-Meteo weather observations, NASA POWER baselines, and OpenAQ ground station telemetry.',
  },
  '/alerts': {
    eyebrow: 'Warning System',
    title: 'Notifications & Alerts',
    description: 'Real-time atmospheric anomaly detection and EPA/WHO air quality threshold warnings.',
  },
  '/settings': {
    eyebrow: 'Workspace Preferences',
    title: 'Settings & Profile',
    description: 'Manage user credentials, preferred units (metric/imperial), default region, and notification rules.',
  },
};

const Header = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const meta = pageMeta[location.pathname] || pageMeta['/dashboard'];

  const [alertCount, setAlertCount] = useState(0);
  const [dateRange, setDateRange] = useState('30d');
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchHeaderData = async () => {
      try {
        const alertRes = await api.get('/environment/alerts');
        if (isMounted && Array.isArray(alertRes.data)) {
          const openAlerts = alertRes.data.filter((a) => a.status === 'open');
          setAlertCount(openAlerts.length);
        }
      } catch {
        // Fallback silently if offline
      }
    };
    fetchHeaderData();
    return () => { isMounted = false; };
  }, []);

  const handleQuickAddClick = () => {
    if (location.pathname === '/dashboard') {
      window.dispatchEvent(new CustomEvent('carbonwise:open-quick-add'));
    } else {
      navigate('/activities?action=new');
    }
  };

  const handleDateRangeChange = (val) => {
    setDateRange(val);
    window.dispatchEvent(new CustomEvent('carbonwise:date-range-change', { detail: val }));
  };

  const handleExport = async (format) => {
    setShowDownloadMenu(false);
    setIsExporting(true);
    try {
      const endpoint = format === 'pdf' ? '/reports/pdf?filter=current_month' : '/reports/csv?filter=all';
      const res = await api.get(endpoint, { responseType: 'blob' });
      const mime = format === 'pdf' ? 'application/pdf' : 'text/csv;charset=utf-8;';
      const blob = new Blob([res.data], { type: mime });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `carbonwise-${format === 'pdf' ? 'audit-report.pdf' : 'emissions.csv'}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      // Fallback: navigate directly to reports page for full export suite
      navigate('/reports');
    } finally {
      setIsExporting(false);
    }
  };

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
          <span className="header-welcome-greeting">
            Welcome back, <strong>{user?.name?.split(' ')[0] || 'User'}</strong>
          </span>
        </div>
        <h1>{meta.title}</h1>
        <p>{meta.description}</p>
      </div>

      <div className="header-actions">
        {/* Date Range Selector matching Image 1 */}
        <div className="header-date-range" title="Global Dashboard Timeframe Filter">
          <CalendarDays size={14} className="date-icon" />
          <select
            value={dateRange}
            onChange={(e) => handleDateRangeChange(e.target.value)}
            className="header-select"
            aria-label="Timeframe"
          >
            <option value="7d">May 12 - Jun 12, 2024</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="1y">Year to Date (2024)</option>
          </select>
          <ChevronDown size={13} className="chevron" />
        </div>

        {/* Download Report Button matching Image 1 */}
        <div className="header-download-dropdown-wrapper">
          <button
            type="button"
            className="header-btn-download"
            onClick={() => setShowDownloadMenu(!showDownloadMenu)}
            disabled={isExporting}
            title="Download Carbon Audit Reports"
          >
            <Download size={14} />
            <span>{isExporting ? 'Exporting...' : 'Download Report'}</span>
            <ChevronDown size={13} />
          </button>
          {showDownloadMenu && (
            <div className="header-download-menu">
              <button type="button" onClick={() => handleExport('pdf')}>
                <FileText size={14} style={{ color: '#10B981' }} />
                <span>Executive Audit Report (PDF)</span>
              </button>
              <button type="button" onClick={() => handleExport('csv')}>
                <FileSpreadsheet size={14} style={{ color: '#38BDF8' }} />
                <span>Emissions Ledger (CSV)</span>
              </button>
            </div>
          )}
        </div>

        {/* Quick Add Activity Button */}
        <button
          type="button"
          onClick={handleQuickAddClick}
          className="header-btn-quick-add"
          title="Quickly record a new carbon activity"
        >
          <Plus size={15} />
          <span>Quick Add</span>
        </button>

        {/* Notification Icon with Count Badge */}
        <Link
          to="/alerts"
          className="header-icon-btn"
          aria-label="Environmental Notifications"
          title={`${alertCount} active alerts`}
        >
          <Bell size={16} />
          {alertCount > 0 && <span className="notification-indicator">{alertCount}</span>}
        </Link>

        {/* User Profile matching Image 1 (AG avatar pill) */}
        <Link to="/settings" className="header-profile-badge" aria-label="Platform Settings & Profile" title="Account Settings">
          <span className="header-avatar-circle">{initials}</span>
          <div className="header-profile-text">
            <strong>{user?.name || 'Administrator'}</strong>
            <small>{user?.email || 'Settings'}</small>
          </div>
        </Link>
      </div>
    </header>
  );
};

export default Header;
