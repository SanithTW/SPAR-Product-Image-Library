import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Shield, Lock, User, Eye, EyeOff, Loader2, ArrowLeft, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AdminLogin() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // If already logged in, redirect to dashboard
  if (isAuthenticated) {
    return <Navigate to="/admin" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please provide both username and password.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await login(username.trim(), password);
      navigate('/admin');
    } catch (err) {
      console.error('[AdminLogin] Login failed:', err);
      const msg = err.response?.data?.error || 'Invalid credentials or server error. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4.5rem)] flex items-center justify-center p-4 sm:p-6 bg-slate-50 dark:bg-slate-950">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
        {/* Brand Icon & Heading */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 mb-4 shadow-xs">
            <Shield className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Admin Authentication
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Sign in to upload, update, or remove SPAR product images.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs sm:text-sm">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
              Username
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Admin username"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm transition-all"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Admin password"
                className="w-full pl-10 pr-11 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm transition-all"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-sm shadow-md shadow-emerald-700/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <KeyRound className="w-4 h-4" />
                <span>Sign In as Admin</span>
              </>
            )}
          </button>
        </form>

        {/* Setup Tip */}
        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 text-center">
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Initial setup credentials: <code className="text-emerald-700 dark:text-emerald-400 font-mono font-semibold">admin</code> / <code className="text-emerald-700 dark:text-emerald-400 font-mono font-semibold">admin123</code>
          </p>
        </div>
      </div>
    </div>
  );
}
