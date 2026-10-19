import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { verifyEmailToken } from '../../services/api';
import { markUserEmailVerified } from '../../services/firebase';
import SignOutButton from '../../components/auth/SignOutButton';
import {
  MailCheck, ArrowRight, Loader2, CheckCircle2,
  RefreshCw, LogOut, Sparkles, Mail, ShieldCheck, AlertCircle,
} from 'lucide-react';

export default function VerifyEmail() {
  const { user, resendVerification } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const tokenParam = searchParams.get('token');
  const [verifyingToken, setVerifyingToken] = useState(Boolean(tokenParam));
  const [tokenVerified, setTokenVerified] = useState(false);
  const [tokenError, setTokenError] = useState(null);

  const [sending, setSending] = useState(false);
  const [sentMessage, setSentMessage] = useState(false);
  const [lastDispatchedInfo, setLastDispatchedInfo] = useState(null);

  // If URL has ?token=..., auto-verify immediately
  useEffect(() => {
    if (!tokenParam) return;
    let mounted = true;
    setVerifyingToken(true);
    setTokenError(null);

    verifyEmailToken(tokenParam)
      .then((res) => {
        if (!mounted) return;
        if (res.valid) {
          setTokenVerified(true);
          markUserEmailVerified(res.email);
        } else {
          setTokenError(res.error || 'Verification token is invalid or expired.');
        }
      })
      .catch((err) => {
        if (!mounted) return;
        setTokenError(err.response?.data?.detail || err.message || 'Verification failed.');
      })
      .finally(() => {
        if (mounted) setVerifyingToken(false);
      });

    return () => {
      mounted = false;
    };
  }, [tokenParam]);

  const handleResend = async () => {
    setSending(true);
    try {
      const res = await resendVerification();
      setSentMessage(true);
      if (res?.verify_url) {
        setLastDispatchedInfo(res);
      }
      setTimeout(() => setSentMessage(false), 6000);
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const handleContinue = () => {
    navigate('/app/projects');
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-6 relative overflow-hidden"
      style={{ background: 'var(--color-bg)' }}
    >
      <div
        className="absolute top-1/4 right-1/3 w-96 h-96 rounded-full blur-3xl opacity-20 pointer-events-none"
        style={{ background: '#7C3AED' }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md rounded-3xl p-8 relative shadow-2xl z-10 text-center"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div
          className="w-16 h-16 rounded-3xl mx-auto mb-5 flex items-center justify-center shadow-lg"
          style={{ background: 'linear-gradient(135deg, #7C3AED, #6D28D9)' }}
        >
          {tokenVerified ? (
            <ShieldCheck className="w-8 h-8 text-white" />
          ) : (
            <MailCheck className="w-8 h-8 text-white" />
          )}
        </div>

        <h1 className="font-display text-2xl font-bold tracking-tight mb-2 text-[#1F1B2E]">
          {tokenVerified ? 'Email verified!' : 'Verify your email'}
        </h1>

        {/* Official Project Sender Info Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium mb-4 bg-purple-500/10 border border-purple-500/20 text-purple-400">
          <Mail className="w-3.5 h-3.5" />
          <span>From: <strong>flowmlstudio@gmail.com</strong></span>
        </div>

        {verifyingToken ? (
          <div className="py-6 flex flex-col items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
            <p className="text-xs text-slate-400">Verifying secure confirmation token...</p>
          </div>
        ) : tokenVerified ? (
          <p className="text-sm leading-relaxed mb-6 text-emerald-400">
            Your email has been verified successfully. Your account now has full access to the FlowML visual studio.
          </p>
        ) : (
          <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--color-text-muted)' }}>
            We've sent a verification link to <span className="font-semibold text-primary">{user?.email || 'your email'}</span> from our project email.
            Please check your inbox or spam folder.
          </p>
        )}

        {tokenError && (
          <div className="mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2 text-left">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{tokenError}</span>
          </div>
        )}

        {sentMessage && (
          <div className="mb-5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Verification email sent from flowmlstudio@gmail.com!</span>
          </div>
        )}

        {lastDispatchedInfo?.verify_url && (
          <div className="mb-5 p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-left">
            <span className="font-semibold text-purple-300 block mb-1">Instant Verification Link:</span>
            <a
              href={lastDispatchedInfo.verify_url}
              className="text-purple-400 underline break-all text-[11px] block hover:text-purple-300"
            >
              {lastDispatchedInfo.verify_url}
            </a>
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={handleContinue}
            className="w-full py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98]"
            style={{
              background: 'linear-gradient(135deg, #7C3AED, #6D28D9)',
              boxShadow: '0 4px 20px rgba(99, 102, 241, 0.4)',
            }}
          >
            {tokenVerified ? 'Enter FlowML Workspace' : 'Continue to FlowML Workspace'}
            <ArrowRight className="w-4 h-4" />
          </button>

          {!tokenVerified && (
            <button
              onClick={handleResend}
              disabled={sending}
              className="w-full py-2.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
              style={{
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)',
              }}
            >
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Resend Verification Link
            </button>
          )}
        </div>

        <div className="mt-6 pt-5 border-t flex items-center justify-center" style={{ borderColor: 'var(--color-border)' }}>
          <SignOutButton
            redirectTo="/"
            className="text-xs font-medium text-slate-400 hover:text-red-400 flex items-center gap-1.5 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out and switch account
          </SignOutButton>
        </div>
      </motion.div>
    </div>
  );
}
