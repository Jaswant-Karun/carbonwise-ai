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
  { path: '/dashboard', label: 'Executive Dashboard', icon: Gauge },
  { path: '/activities', label: 'Activity Log (Track)', icon: History },
  { path: '/carbon-intelligence', label: 'Carbon Intelligence', icon: Sparkles },
  { path: '/carbon-forecast', label: 'Emission Forecast', icon: Activity },
  { path: '/action-plan', label: 'Action Plan (Reduce)', icon: Target },
  { path: '/impact', label: 'Impact & Baselines', icon: Leaf },
  { path: '/live-monitoring', label: 'Live Telemetry', icon: CloudSun },
  { path: '/alerts', label: 'Environmental Alerts', icon: Bell },
  { path: '/reports', label: 'Compliance Reports', icon: FileText },
  { path: '/settings', label: 'Settings', icon: Settings },
];

const Sidebar = () => {
  const { user, logout } = useContext(AuthContext);

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">
          <Leaf size={19} />
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
        <span className="sidebar-label">Platform Modules</span>
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
                  <NavIcon size={17} aria-hidden="true" />
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
            <Leaf size={22} className="promo-leaf-icon" />
          </div>
          <strong>SDG-13 Climate Action</strong>
          <p>Automated carbon intelligence, predictive modeling, and live environmental telemetry.</p>
        </div>

        <button onClick={logout} className="logout-button" type="button">
          <LogOut size={16} />
          <span>Log out</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
