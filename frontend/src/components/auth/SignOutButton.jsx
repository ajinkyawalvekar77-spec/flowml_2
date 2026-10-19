import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function SignOutButton({
  children = 'Sign Out',
  className = '',
  redirectTo = '/signin',
  onSignedOut,
  ...buttonProps
}) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isSigningOut) setIsOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSigningOut]);

  const handleConfirm = async () => {
    setIsSigningOut(true);
    setError('');
    try {
      await signOut();
      onSignedOut?.();
      setIsOpen(false);
      navigate(redirectTo);
    } catch (signOutError) {
      console.error('Unable to sign out:', signOutError);
      setError('Unable to sign out. Please try again.');
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <>
      <button
        {...buttonProps}
        type="button"
        onClick={() => {
          setError('');
          setIsOpen(true);
        }}
        className={className}
      >
        {children}
      </button>
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isSigningOut) setIsOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="sign-out-title"
            aria-describedby="sign-out-description"
            className="w-full max-w-sm rounded-3xl p-6 shadow-2xl text-center"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
            }}
          >
            <div className="w-12 h-12 rounded-2xl mx-auto mb-4 bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 id="sign-out-title" className="font-display font-semibold text-base mb-2">
              Sign out?
            </h2>
            <p id="sign-out-description" className="text-xs leading-relaxed mb-5" style={{ color: 'var(--color-text-muted)' }}>
              Are you sure you want to sign out of your FlowML account?
            </p>
            {error && (
              <p role="alert" className="mb-4 text-xs text-red-500">
                {error}
              </p>
            )}
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                autoFocus
                disabled={isSigningOut}
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSigningOut}
                onClick={handleConfirm}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-red-500 hover:bg-red-600 disabled:opacity-60 transition-colors shadow-lg shadow-red-500/20 flex items-center gap-2"
              >
                {isSigningOut && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Sign Out
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
