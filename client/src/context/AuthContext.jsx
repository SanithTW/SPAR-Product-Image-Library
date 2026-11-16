import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  loginAdmin,
  verifyAdminSession,
  redeemAccessCode,
  getGuestAccess,
  saveGuestAccess,
  clearGuestAccess,
} from '../services/api';
import AccessCodeModal from '../components/AccessCodeModal';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('spar_admin_token') || null);
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  // Temporary download access granted by an access code.
  const [guestAccess, setGuestAccess] = useState(() => getGuestAccess());
  const [accessPrompt, setAccessPrompt] = useState(null); // { message } while the code box is open
  const promptResolver = useRef(null);

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

  const redeemCode = async (code) => {
    const data = await redeemAccessCode(code);
    const access = { token: data.token, label: data.label, expiresAt: data.expiresAt };
    saveGuestAccess(access);
    setGuestAccess(access);
    return access;
  };

  const endGuestAccess = useCallback(() => {
    clearGuestAccess();
    setGuestAccess(null);
  }, []);

  /** True when the current visitor may download: signed-in admin or an unexpired access code. */
  const canDownload = useCallback(
    () => Boolean(localStorage.getItem('spar_admin_token') || getGuestAccess()),
    []
  );

  /**
   * Resolve true if the visitor may download, asking for an access code first when needed.
   * Pass a message to explain why the code box opened (e.g. the old code expired).
   */
  const ensureDownloadAccess = useCallback(
    (message) => {
      if (!message && canDownload()) return Promise.resolve(true);
      if (message) endGuestAccess();
      return new Promise((resolve) => {
        promptResolver.current?.(false);
        promptResolver.current = resolve;
        setAccessPrompt({ message: message || '' });
      });
    },
    [canDownload, endGuestAccess]
  );

  const closePrompt = (granted) => {
    setAccessPrompt(null);
    promptResolver.current?.(granted);
    promptResolver.current = null;
  };

  // Drop expired access from state so the UI stops showing it as active.
  useEffect(() => {
    if (!guestAccess) return undefined;
    const ms = new Date(guestAccess.expiresAt).getTime() - Date.now();
    const timer = setTimeout(endGuestAccess, Math.max(0, Math.min(ms, 2 ** 31 - 1)));
    return () => clearTimeout(timer);
  }, [guestAccess, endGuestAccess]);

  const isAuthenticated = Boolean(token);

  return (
    <AuthContext.Provider
      value={{
        token,
        admin,
        isAuthenticated,
        loading,
        login,
        logout,
        guestAccess,
        redeemCode,
        endGuestAccess,
        ensureDownloadAccess,
      }}
    >
      {children}
      {accessPrompt && (
        <AccessCodeModal
          message={accessPrompt.message}
          onRedeem={redeemCode}
          onDone={() => closePrompt(true)}
          onCancel={() => closePrompt(false)}
        />
      )}
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
