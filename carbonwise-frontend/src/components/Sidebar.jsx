import React, { useContext } from 'react';
import { NavLink } from 'react-router-dom';
import {
  BarChart3,
  BrainCircuit,
  CalendarCheck2,
  FileText,
  Flag,
  Gauge,
  History,
  Leaf,
  LogOut,
  Target,
  TrendingUp,
} from 'lucide-react';
import { AuthContext } from '../context/AuthContext';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: Gauge },
  { path: '/activities', label: 'Activity History', icon: History },
  { path: '/intelligence', label: 'Carbon Intelligence', icon: BrainCircuit },
  { path: '/simulator', label: 'What-If Simulator', icon: BarChart3 },
  { path: '/action-plan', label: 'AI Eco-Coach', icon: Leaf },
  { path: '/forecast', label: 'Forecast & Anomalies', icon: TrendingUp },
  { path: '/action-plan', label: 'Sustainability Goals', icon: Target },
  { path: '/profile', label: 'Impact Tracker', icon: Flag },
  { path: '/reports', label: 'Climate Reports', icon: FileText },
];

const Sidebar = () => {
  const { user, logout } = useContext(AuthContext);

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark"><Leaf size={20} /></span>
        <span>CarbonWise<span className="brand-dot">.</span></span>
      </div>

      <div className="sidebar-profile">
        <span className="sidebar-profile-avatar">{user?.name?.charAt(0)?.toUpperCase() || 'C'}</span>
        <div>
          <strong>{user?.name || 'CarbonWise member'}</strong>
          <span>Personal workspace</span>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Primary navigation">
        <span className="sidebar-label">Workspace</span>
        <ul>
          {navItems.map((item, index) => {
            const NavIcon = item.icon;
            return (
            <li key={`${item.label}-${index}`}>
              <NavLink to={item.path} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                <NavIcon size={18} aria-hidden="true" />
                <span>{item.label}</span>
              </NavLink>
            </li>
            );
          })}
        </ul>
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-goal">
          <div className="sidebar-goal-heading"><span>Annual goal</span><CalendarCheck2 size={16} /></div>
          <strong>Keep tracking your impact</strong>
          <div className="goal-progress"><span /></div>
          <small>Activity data powers your insights</small>
        </div>
        <button onClick={logout} className="logout-button" type="button">
          <LogOut size={17} />
          Log out
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
