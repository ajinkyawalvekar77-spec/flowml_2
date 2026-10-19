import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import {
  Mail, ArrowRight, Loader2, AlertCircle,
  CheckCircle2, ArrowLeft,
} from 'lucide-react';
import Logo from '../../components/common/Logo';
import FlowMLIcon from '../../components/FlowMLIcon';

export default function ForgotPassword() {
  const { resetPassword } = useAuth();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      setError('Please provide your email address.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await resetPassword(email);
      setSubmitted(true);
    } catch (err) {
      setError(err.message || 'Failed to send password reset email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-6 relative overflow-hidden font-sans"
      style={{ background: 'var(--color-bg)' }}
    >
      <div
        className="absolute top-1/4 left-1/3 w-96 h-96 rounded-full blur-3xl opacity-20 pointer-events-none"
        style={{ background: '#7C3AED' }}
      />

      <div className="absolute top-6 inset-x-6 max-w-7xl mx-auto flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <FlowMLIcon size={44} />
          <Logo size="text-2xl" />
        </Link>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md rounded-3xl p-8 relative shadow-xl z-10"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <FlowMLIcon size={56} />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight mb-2 text-[#1F1B2E]">
            Reset your password
          </h1>
          <p className="text-sm mb-3" style={{ color: 'var(--color-text-muted)' }}>
            Enter your email and we'll send you instructions to reset your account password.
          </p>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <span>Sent from: <strong>flowmlstudio@gmail.com</strong></span>
          </div>
        </div>

        {submitted ? (
          <div className="text-center space-y-5">
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs leading-relaxed flex items-start gap-3 text-left">
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm text-emerald-300 mb-1">Reset Link Sent!</p>
                <p>We've sent password reset instructions to <span className="font-mono font-semibold">{email}</span> from <strong className="text-purple-300">flowmlstudio@gmail.com</strong>. Please check your inbox and spam folder.</p>
              </div>
            </div>

            <Link
              to="/signin"
              className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3.5 rounded-xl flex items-start gap-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs leading-relaxed">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                Registered email
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@organization.com"
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/50"
                  style={{
                    background: 'var(--color-bg)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)',
                  }}
                />
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98] disabled:opacity-60"
              style={{
                background: 'linear-gradient(135deg, #7C3AED, #6D28D9)',
                boxShadow: '0 4px 20px rgba(99, 102, 241, 0.4)',
              }}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Send Reset Link
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>

            <div className="pt-2 text-center">
              <Link
                to="/signin"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Return to sign in
              </Link>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}
