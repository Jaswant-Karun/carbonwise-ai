import React, { useContext } from 'react';
import { NavLink } from 'react-router-dom';
import {
  AlertTriangle,
  Bell,
  CloudSun,
  FileText,
  Gauge,
  Leaf,
  LogOut,
  Settings,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { AuthContext } from '../context/AuthContext';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: Gauge },
  { path: '/live-monitoring', label: 'Live Monitoring', icon: CloudSun },
  { path: '/climate-analytics', label: 'Climate Analytics', icon: TrendingUp },
  { path: '/anomaly-detection', label: 'Anomaly Detection', icon: AlertTriangle },
  { path: '/alerts', label: 'Environmental Alerts', icon: Bell },
  { path: '/ai-insights', label: 'AI Insights', icon: Sparkles },
  { path: '/reports', label: 'Reports', icon: FileText },
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
          <span className="brand-subtitle">Monitor. Detect. Analyze. Alert.</span>
        </div>
      </div>

      <div className="sidebar-profile">
        <span className="sidebar-profile-avatar">
          {user?.name?.charAt(0)?.toUpperCase() || 'C'}
        </span>
        <div className="sidebar-profile-info">
          <strong>{user?.name || 'Climate Analyst'}</strong>
          <span>Environmental Workspace</span>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Primary navigation">
        <span className="sidebar-label">Environmental Intelligence</span>
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
          <p>Real-time environmental telemetry and automated anomaly intelligence.</p>
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
