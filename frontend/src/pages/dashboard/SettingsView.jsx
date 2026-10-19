import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import SignOutButton from '../../components/auth/SignOutButton';
import { useOutletContext } from 'react-router-dom';
import { sendProjectUpdateEmail } from '../../services/api';
import {
  Settings, User, Shield, LogOut, Mail, CalendarDays,
  CheckCircle2, AlertCircle, Copy, Check, Loader2, Send,
} from 'lucide-react';

export default function SettingsView() {
  const { user, resetPassword, resendVerification } = useAuth();
  const { showToast } = useOutletContext();

  const [copiedKey, setCopiedKey] = useState(false);
  const [autoSave, setAutoSave] = useState('2');
  const [securityAction, setSecurityAction] = useState('');
  const createdAt = user?.metadata?.creationTime || user?.createdAt;
  const createdDate = createdAt && !Number.isNaN(new Date(createdAt).getTime())
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(createdAt))
    : 'Not available';


  const handleCopyUid = async () => {
    if (user?.uid) {
      try {
        await navigator.clipboard.writeText(user.uid);
        setCopiedKey(true);
        setTimeout(() => setCopiedKey(false), 2000);
        showToast('User UID copied to clipboard.', 'info');
      } catch {
        showToast('Unable to copy the user ID. Check your browser clipboard permissions.', 'error');
      }
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email) {
      showToast('A valid account email is required to reset your password.', 'error');
      return;
    }

    setSecurityAction('password');
    try {
      await resetPassword(user.email);
      showToast(`Password reset instructions sent to ${user.email}.`, 'success');
    } catch (error) {
      showToast(error?.message || 'Unable to send password reset instructions.', 'error');
    } finally {
      setSecurityAction('');
    }
  };

  const handleResendVerification = async () => {
    setSecurityAction('verification');
    try {
      await resendVerification();
      showToast('Email verification instructions sent from flowmlstudio@gmail.com.', 'success');
    } catch (error) {
      showToast(error?.message || 'Unable to send email verification instructions.', 'error');
    } finally {
      setSecurityAction('');
    }
  };

  const handleSendTestUpdate = async () => {
    if (!user?.email) {
      showToast('No user email address found.', 'error');
      return;
    }
    setSecurityAction('test_update');
    try {
      await sendProjectUpdateEmail({
        email: user.email,
        projectName: 'Customer Churn Predictor',
        updateType: 'Pipeline Execution Completed',
        details: {
          status: 'Pipeline Succeeded',
          records_count: '150,000 records',
          metrics: {
            'Accuracy': '94.2%',
            'F1-Score': '0.928',
            'Execution Time': '4.1s',
          },
        },
      });
      showToast(`Test project update dispatched to ${user.email} from flowmlstudio@gmail.com!`, 'success');
    } catch (error) {
      showToast(error?.message || 'Unable to send project update email.', 'error');
    } finally {
      setSecurityAction('');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-[-0.02em] leading-tight" style={{ color: 'var(--color-text)' }}>
          Account Settings
        </h1>
        <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
          Manage your profile, account security, and workspace preferences.
        </p>
      </div>

      {/* User Profile Card */}
      <div
        className="rounded-3xl p-6 border shadow-sm"
        style={{
          background: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
        }}
      >
        <h3 className="font-display font-semibold text-base mb-4 flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
          <User className="w-4 h-4 text-primary" />
          Active Profile
        </h3>

        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center font-bold text-xl text-white shadow-lg shrink-0"
            style={{ background: 'linear-gradient(135deg, #7C3AED, #8b5cf6)' }}
          >
            {(user?.displayName || user?.email || 'U').charAt(0).toUpperCase()}
          </div>

          <div className="space-y-1 min-w-0 flex-1">
            <h4 className="font-display font-semibold text-base" style={{ color: 'var(--color-text)' }}>
              {user?.displayName || 'FlowML Engineer'}
            </h4>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {user?.email || 'dev@flowml.studio'}
            </p>

            <div className="flex items-center gap-2 pt-1">
              <span
                className="text-[10px] font-mono px-2 py-0.5 rounded-md"
                style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
              >
                UID: {user?.uid || 'dev-user-demo'}
              </span>
              <button
                onClick={handleCopyUid}
                className="p-1 transition-colors"
                style={{ color: 'var(--color-text-muted)' }}
                title="Copy UID"
              >
                {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-[11px] pt-1 flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
              <CalendarDays className="w-3 h-3" />
              Member since {createdDate}
            </p>
          </div>

          <SignOutButton
            className="px-4 py-2 rounded-xl text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 flex items-center gap-1.5 transition-colors self-start sm:self-center"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </SignOutButton>
        </div>
      </div>

      {/* Account Security */}
      <div
        className="rounded-3xl p-6 border shadow-sm"
        style={{
          background: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-base flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
            <Shield className="w-4 h-4 text-primary" />
            Account Security
          </h3>
          <span
            className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border ${
              user?.emailVerified
                ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                : 'text-amber-700 bg-amber-50 border-amber-200'
            }`}
          >
            {user?.emailVerified ? 'Email verified' : 'Email not verified'}
          </span>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4 py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex items-center gap-2 min-w-0">
              <Mail className="w-4 h-4 shrink-0" style={{ color: 'var(--color-text-muted)' }} />
              <div className="min-w-0">
                <div className="text-xs font-bold" style={{ color: 'var(--color-text)' }}>Sign-in email</div>
                <div className="text-[11px] truncate" style={{ color: 'var(--color-text-muted)' }}>
                  {user?.email || 'No email on file'}
                </div>
              </div>
            </div>
            {user?.emailVerified ? (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                <CheckCircle2 className="w-3.5 h-3.5" /> Verified
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-600">
                <AlertCircle className="w-3.5 h-3.5" /> Unverified
              </span>
            )}
          </div>

          <div className="flex items-center justify-end gap-4 py-2">
            <div className="flex flex-wrap justify-end gap-2">
              {!user?.emailVerified && user?.email && (
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={Boolean(securityAction)}
                  className="px-3 py-2 rounded-xl text-xs font-semibold border transition-colors disabled:opacity-60"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
                >
                  {securityAction === 'verification' && <Loader2 className="w-3 h-3 inline mr-1 animate-spin" />}
                  Verify email
                </button>
              )}
              <button
                type="button"
                onClick={handlePasswordReset}
                disabled={Boolean(securityAction) || !user?.email}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 transition-colors disabled:opacity-60"
              >
                {securityAction === 'password' && <Loader2 className="w-3 h-3 inline mr-1 animate-spin" />}
                Reset password
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Project Email & Notifications Configuration */}
      <div
        className="rounded-3xl p-6 border shadow-sm"
        style={{
          background: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-base flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
            <Mail className="w-4 h-4 text-purple-500" />
            Project Email & Notifications
          </h3>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-purple-500/10 text-purple-600 border border-purple-500/20">
            flowmlstudio@gmail.com
          </span>
        </div>

        <p className="text-xs mb-4 leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
          All account verification links, password recovery tokens, and automated pipeline execution reports are dispatched from the official project email address.
        </p>

        <div className="p-4 rounded-2xl bg-purple-500/5 border border-purple-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="text-xs font-bold text-purple-400">Project Sender Address</div>
            <div className="text-xs font-mono font-semibold" style={{ color: 'var(--color-text)' }}>
              flowmlstudio@gmail.com
            </div>
            <div className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
              Supported: Account verification, password reset, dataset alert updates.
            </div>
          </div>

          <button
            type="button"
            onClick={handleSendTestUpdate}
            disabled={Boolean(securityAction) || !user?.email}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 transition-colors disabled:opacity-60 flex items-center gap-1.5 shrink-0 shadow-sm"
          >
            {securityAction === 'test_update' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            Send Test Project Update
          </button>
        </div>
      </div>

      {/* Workspace Preferences */}
      <div
        className="rounded-3xl p-6 border shadow-sm"
        style={{
          background: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
        }}
      >
        <h3 className="font-display font-semibold text-base mb-4 flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
          <Settings className="w-4 h-4 text-primary" />
          Workspace Preferences
        </h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <div>
              <div className="text-xs font-bold" style={{ color: 'var(--color-text)' }}>
                Interface Theme
              </div>
              <div className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                FlowML uses a clean light theme optimised for focus
              </div>
            </div>

            <span
              className="px-3 py-1.5 rounded-xl border text-xs font-semibold"
              style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
            >
              Light Mode
            </span>
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <div className="text-xs font-bold" style={{ color: 'var(--color-text)' }}>
                Studio Autosave Interval
              </div>
              <div className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                Frequency of debounced canvas state synchronization
              </div>
            </div>

            <select
              value={autoSave}
              onChange={(e) => {
                setAutoSave(e.target.value);
                showToast(`Autosave interval set to ${e.target.value}s`, 'success');
              }}
              className="px-3 py-1.5 rounded-xl text-xs border focus:outline-none"
              style={{
                background: 'var(--color-bg)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text)',
              }}
            >
              <option value="1">1 second (Instant)</option>
              <option value="2">2 seconds (Balanced)</option>
              <option value="5">5 seconds (Conservative)</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
