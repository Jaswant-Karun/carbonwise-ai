import React, { useContext } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  CloudSun,
  FileText,
  Gauge,
  History,
  Leaf,
  LogOut,
  Settings,
  Sparkles,
  Target,
  TrendingUp,
  Wind,
  Bell,
} from 'lucide-react';
import { AuthContext } from '../context/AuthContext';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: Gauge },
  { path: '/live-climate', label: 'Live Monitoring', icon: CloudSun },
  { path: '/intelligence', label: 'Climate Trends', icon: TrendingUp },
  { path: '/forecast', label: 'Anomalies & Forecast', icon: AlertTriangle },
  { path: '/alerts', label: 'Air Quality & Alerts', icon: Bell },
  { path: '/activities', label: 'Carbon Footprint', icon: History },
  { path: '/simulator', label: 'What-If Simulator', icon: BrainCircuit },
  { path: '/action-plan', label: 'Sustainability Goals', icon: Target },
  { path: '/reports', label: 'Reports', icon: FileText },
  { path: '/profile', label: 'Settings', icon: Settings },
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
          <span className="brand-subtitle">Track. Analyze. Reduce.</span>
        </div>
      </div>

      <div className="sidebar-profile">
        <span className="sidebar-profile-avatar">
          {user?.name?.charAt(0)?.toUpperCase() || 'C'}
        </span>
        <div className="sidebar-profile-info">
          <strong>{user?.name || 'Climate Analyst'}</strong>
          <span>Sustainability Workspace</span>
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
          <strong>Small actions big impact.</strong>
          <p>Let's build a sustainable future.</p>
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
