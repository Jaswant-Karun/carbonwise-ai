import React, { useContext } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Activity,
  Bell,
  CloudSun,
  FileText,
  Gauge,
  History,
  Leaf,
  LogOut,
  Settings,
  Sparkles,
  Target,
} from 'lucide-react';
import { AuthContext } from '../context/AuthContext';

const navItems = [
  { path: '/dashboard', label: 'Overview', icon: Gauge },
  { path: '/activities', label: 'Activity Logs', icon: History },
  { path: '/carbon-intelligence', label: 'Carbon Emissions', icon: Sparkles },
  { path: '/reports', label: 'Analytics & Reports', icon: FileText },
  { path: '/carbon-forecast', label: 'AI Predictions', icon: Activity },
  { path: '/action-plan', label: 'Climate Actions', icon: Target },
  { path: '/live-climate', label: 'Environmental Intelligence', icon: CloudSun },
  { path: '/alerts', label: 'Notifications', icon: Bell },
  { path: '/settings', label: 'Settings', icon: Settings },
];

const Sidebar = () => {
  const { user, logout } = useContext(AuthContext);

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">
          <Leaf size={18} />
        </span>
        <div className="brand-text">
          <div className="brand-title">
            CarbonWise <span className="brand-badge">AI</span>
          </div>
          <span className="brand-subtitle">Track. Analyze. Predict. Reduce.</span>
        </div>
      </div>

      <div className="sidebar-profile">
        <span className="sidebar-profile-avatar">
          {user?.name?.charAt(0)?.toUpperCase() || 'C'}
        </span>
        <div className="sidebar-profile-info">
          <strong>{user?.name || 'Sustainability Lead'}</strong>
          <span>Carbon & Climate Workspace</span>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Primary navigation">
        <span className="sidebar-label">Navigation</span>
        <ul>
          {navItems.map((item) => {
            const NavIcon = item.icon;
            return (
              <li key={item.path + item.label}>
                <NavLink
                  to={item.path}
                  end={item.path === '/dashboard'}
                  className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                >
                  <NavIcon size={16} aria-hidden="true" />
                  <span>{item.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-promo-card">
          <div className="promo-glow-circle">
            <Leaf size={18} className="promo-leaf-icon" />
          </div>
          <strong>SDG-13 Climate Action</strong>
          <p>AI carbon accounting, predictive modeling, and live environmental intelligence.</p>
        </div>

        <button onClick={logout} className="logout-button" type="button" title="Sign out of CarbonWise AI">
          <LogOut size={15} />
          <span>Log out</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
