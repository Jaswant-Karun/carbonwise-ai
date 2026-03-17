import React, { useContext } from 'react';
import { NavLink } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const navItems = [
  { path: '/dashboard', label: '📊 Dashboard' },
  { path: '/activities', label: '🏃 Activity Tracker' },
  { path: '/insights', label: '🔍 AI Insights' },
  { path: '/action-plan', label: '🌱 Eco Action Plan' },
  { path: '/reports', label: '📋 Reports' },
  { path: '/profile', label: '👤 Profile' },
];

const Sidebar = () => {
  const { user, logout } = useContext(AuthContext);

  return (
    <aside
      className="sidebar glass-panel"
      style={{
        borderRadius: 0,
        borderTop: 'none',
        borderBottom: 'none',
        borderLeft: 'none',
      }}
    >
      <h2
        className="auth-title"
        style={{ fontSize: '1.5rem', marginBottom: '2rem' }}
      >
        CarbonWise.ai
      </h2>

      <div style={{ flex: 1 }}>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          Welcome,
          <br />
          <b style={{ color: 'white', fontSize: '1.1rem' }}>{user?.name}</b>
        </p>

        <nav>
          <ul
            style={{
              listStyle: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            {navItems.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  style={({ isActive }) => ({
                    display: 'block',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                    fontWeight: isActive ? '600' : '400',
                    background: isActive
                      ? 'rgba(16, 185, 129, 0.12)'
                      : 'transparent',
                    textDecoration: 'none',
                    transition: 'all 0.2s',
                    borderLeft: isActive
                      ? '3px solid var(--primary)'
                      : '3px solid transparent',
                  })}
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <button
        onClick={logout}
        className="btn"
        style={{
          background: 'transparent',
          border: '1px solid var(--danger)',
          color: 'var(--danger)',
        }}
      >
        Logout
      </button>
    </aside>
  );
};

export default Sidebar;
