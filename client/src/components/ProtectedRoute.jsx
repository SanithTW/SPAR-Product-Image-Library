import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
          Verifying administrator credentials...
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  return children;
}
