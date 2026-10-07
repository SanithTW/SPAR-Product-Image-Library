import React, { createContext, useContext, useState, useEffect } from 'react';
import { loginAdmin, verifyAdminSession } from '../services/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('spar_admin_token') || null);
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      const storedToken = localStorage.getItem('spar_admin_token');
      if (!storedToken) {
        setToken(null);
        setAdmin(null);
        setLoading(false);
        return;
      }

      try {
        const res = await verifyAdminSession();
        setAdmin(res.user);
        setToken(storedToken);
      } catch (err) {
        console.warn('[Auth] Stored token invalid or expired:', err.message);
        localStorage.removeItem('spar_admin_token');
        setToken(null);
        setAdmin(null);
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, []);

  const login = async (username, password) => {
    const data = await loginAdmin(username, password);
    localStorage.setItem('spar_admin_token', data.token);
    setToken(data.token);
    setAdmin(data.user);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('spar_admin_token');
    setToken(null);
    setAdmin(null);
  };

  const isAuthenticated = Boolean(token);

  return (
    <AuthContext.Provider value={{ token, admin, isAuthenticated, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
