import React, { useContext } from 'react';
import { NavLink } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  CheckCircle2,
  CloudSun,
  Compass,
  FileText,
  Flame,
  LayoutDashboard,
  Leaf,
  LogOut,
  Settings,
  Sparkles,
} from 'lucide-react';
import { AuthContext } from '../context/AuthContext';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/carbon-intelligence', label: 'Emissions', icon: Flame },
  { path: '/activities', label: 'Sources', icon: Compass },
  { path: '/reports', label: 'Analytics', icon: BarChart3 },
  { path: '/insights', label: 'AI Insights', icon: Sparkles },
  { path: '/action-plan', label: 'Targets', icon: CheckCircle2 },
  { path: '/carbon-forecast', label: 'Predictions', icon: BarChart3 },
  { path: '/alerts', label: 'Alerts', icon: Bell },
  { path: '/live-climate', label: 'Climate Intelligence', icon: CloudSun },
  { path: '/settings', label: 'Settings', icon: Settings },
];

const Sidebar = () => {
  const { user, logout } = useContext(AuthContext);

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark-ai">
          <span className="brand-ai-text">AI</span>
        </div>
        <div className="brand-text">
          <div className="brand-title">
            AI Carbon Tracker
          </div>
          <span className="brand-subtitle">Track. Analyze. Reduce.</span>
        </div>
      </div>

      <div className="sidebar-profile">
        <span className="sidebar-profile-avatar">
          {user?.name?.charAt(0)?.toUpperCase() || 'A'}
        </span>
        <div className="sidebar-profile-info">
          <strong>{user?.name || 'Sustainability Lead'}</strong>
          <span>CarbonWise AI Workspace</span>
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
          <strong>Small actions big impact.</strong>
          <p>Let's build a sustainable future.</p>
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
