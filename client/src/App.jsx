import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import Header from './components/Header';
import SearchHome from './pages/SearchHome';
import AdminWorkspaceModal from './components/AdminWorkspaceModal';

export default function App() {
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleProductChange = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <Header onOpenAdmin={() => setIsAdminOpen(true)} />

            <div style={{ flex: 1 }}>
              <Routes>
                <Route
                  path="/"
                  element={<SearchHome refreshTrigger={refreshTrigger} />}
                />
                <Route
                  path="/admin"
                  element={
                    <SearchHome
                      refreshTrigger={refreshTrigger}
                      // When user navigates directly to /admin, trigger open modal
                    />
                  }
                />
                <Route
                  path="/admin/login"
                  element={<SearchHome refreshTrigger={refreshTrigger} />}
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>

            {/* Admin Workspace / Login Modal */}
            <AdminWorkspaceModal
              isOpen={isAdminOpen}
              onClose={() => setIsAdminOpen(false)}
              onProductChange={handleProductChange}
            />
          </div>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
