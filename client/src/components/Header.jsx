import React from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

import sparLogo from '../assets/spar-logo.png';

export default function Header({ onOpenAdmin }) {
  const { theme, toggleTheme } = useTheme();
  const { isAuthenticated, logout } = useAuth();

  return (
    <header className="topbar">
      <Link to="/" style={{ display: 'inline-flex', alignItems: 'center' }}>
        <img className="logo" src={sparLogo} alt="SPAR" />
      </Link>
      <nav className="nav">
        <button
          className="icon-btn"
          id="themeBtn"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to Light mode' : 'Switch to Dark mode'}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? '☀' : '☾'}
        </button>
        {isAuthenticated ? (
          <>
            <button
              className="admin-btn"
              onClick={onOpenAdmin}
            >
              Admin workspace →
            </button>
            <button
              className="icon-btn"
              onClick={logout}
              title="Sign out of Admin"
              style={{ color: '#d32f2f' }}
            >
              Sign out
            </button>
          </>
        ) : (
          <button
            className="admin-btn"
            id="adminBtn"
            onClick={onOpenAdmin}
          >
            Admin portal →
          </button>
        )}
      </nav>
    </header>
  );
}
