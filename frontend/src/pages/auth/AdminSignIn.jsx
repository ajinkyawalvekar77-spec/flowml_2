import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import FlowMLIcon from '../../components/FlowMLIcon';
import Logo from '../../components/common/Logo';
import { adminLogin } from '../../services/api';

export default function AdminSignIn({ onAuthenticated }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const session = await adminLogin(username.trim(), password);
      onAuthenticated(session.access_token);
    } catch (loginError) {
      setError(loginError.message || 'Unable to sign in to the admin console.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4 py-10"
      style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}
    >
      <section
        className="w-full max-w-md rounded-3xl border p-8 shadow-xl"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        <Link to="/" className="inline-flex items-center gap-2 mb-8" title="FlowML Home">
          <FlowMLIcon size={40} />
          <Logo size="text-lg" />
        </Link>

        <div className="w-12 h-12 rounded-2xl bg-violet-100 text-violet-700 flex items-center justify-center mb-5">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h1 className="font-display text-2xl font-bold">Admin sign in</h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Sign in with an authorized admin account to open the restricted console.
        </p>

        <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="admin-username" className="block text-xs font-semibold mb-1.5">
              Username
            </label>
            <input
              id="admin-username"
              name="username"
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="w-full px-3.5 py-3 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-violet-500/40"
              style={{
                background: 'var(--color-bg)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text)',
              }}
            />
          </div>
          <div>
            <label htmlFor="admin-password" className="block text-xs font-semibold mb-1.5">
              Password
            </label>
            <input
              id="admin-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full px-3.5 py-3 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-violet-500/40"
              style={{
                background: 'var(--color-bg)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text)',
              }}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold text-sm py-3 transition-colors disabled:opacity-60"
          >
            {isSubmitting
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <KeyRound className="w-4 h-4" />}
            {isSubmitting ? 'Signing in…' : 'Sign in to Admin'}
          </button>
        </form>
      </section>
    </main>
  );
}
