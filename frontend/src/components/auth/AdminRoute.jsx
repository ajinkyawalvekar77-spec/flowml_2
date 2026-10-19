import React, { useEffect, useState } from 'react';
import AdminSignIn from '../../pages/auth/AdminSignIn.jsx';
import AdminView from '../../pages/dashboard/AdminView.jsx';

const ADMIN_TOKEN_KEY = 'flowml_admin_token';

export default function AdminRoute() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => Boolean(localStorage.getItem(ADMIN_TOKEN_KEY)),
  );

  useEffect(() => {
    const handleSessionExpired = () => setIsAuthenticated(false);
    window.addEventListener('flowml-admin-session-expired', handleSessionExpired);
    return () => window.removeEventListener('flowml-admin-session-expired', handleSessionExpired);
  }, []);

  const handleAuthenticated = (token) => {
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
    setIsAuthenticated(true);
  };

  const handleSignOut = () => {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    setIsAuthenticated(false);
  };

  return isAuthenticated
    ? <AdminView onSignOut={handleSignOut} />
    : <AdminSignIn onAuthenticated={handleAuthenticated} />;
}
