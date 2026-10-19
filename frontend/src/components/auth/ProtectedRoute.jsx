import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import FlowMLIcon from '../FlowMLIcon';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div
        className="min-h-screen w-full flex flex-col items-center justify-center"
        style={{ background: 'var(--color-bg)' }}
      >
        <FlowMLIcon size={56} />
        <div className="mt-4 text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
          Authenticating FlowML workspace…
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/signin" state={{ from: location }} replace />;
  }

  return children;
}
