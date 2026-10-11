import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, Bell, CalendarDays } from 'lucide-react';
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

const pageMeta = {
  '/dashboard': {
    eyebrow: 'Overview',
    title: 'Dashboard',
    description: 'Monitor your footprint and make measurable progress.',
  },
  '/activities': {
    eyebrow: 'Data capture',
    title: 'Activity History',
    description: 'Review and manage the activities behind your footprint.',
  },
  '/insights': {
    eyebrow: 'Carbon intelligence',
    title: 'Carbon Intelligence',
    description: 'Turn your activity data into practical climate insights.',
  },
  '/action-plan': {
    eyebrow: 'Personalized guidance',
    title: 'AI Eco-Coach',
    description: 'Build practical habits with an actionable weekly plan.',
  },
  '/reports': {
    eyebrow: 'Reporting',
    title: 'Climate Reports',
    description: 'Export and review your environmental performance.',
  },
  '/profile': {
    eyebrow: 'Account',
    title: 'Impact Tracker',
    description: 'See your milestones and long-term sustainability progress.',
  },
};

const Header = () => {
  const location = useLocation();
  const { user } = useContext(AuthContext);
  const meta = pageMeta[location.pathname] || pageMeta['/dashboard'];
  const initials = user?.name
    ?.split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'CW';

  return (
    <header className="page-header">
      <div className="page-heading">
        <span className="page-eyebrow">{meta.eyebrow}</span>
        <h1>{meta.title}</h1>
        <p>{meta.description}</p>
      </div>

      <div className="header-actions">
        <label className="period-selector">
          <CalendarDays size={16} aria-hidden="true" />
          <span className="sr-only">Reporting period</span>
          <select defaultValue="30">
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last 12 months</option>
          </select>
          <ChevronDown size={15} aria-hidden="true" />
        </label>
        <button className="icon-button" type="button" aria-label="Notifications">
          <Bell size={18} />
        </button>
        <Link to="/profile" className="profile-menu" aria-label="Open profile">
          <span className="profile-avatar">{initials}</span>
          <span className="profile-copy">
            <strong>{user?.name || 'CarbonWise member'}</strong>
            <small>Personal account</small>
          </span>
          <ChevronDown size={16} aria-hidden="true" />
        </Link>
      </div>
    </header>
  );
};

export default Header;
