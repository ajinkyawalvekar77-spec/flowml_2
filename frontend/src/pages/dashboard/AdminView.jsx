import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Users, Activity, Cpu, HardDrive,
  Sliders, ShieldCheck, AlertTriangle, LogOut, Key,
  CheckCircle2, Save, RefreshCw, ArrowLeft,
} from 'lucide-react';
import {
  adminListUsers,
  adminSetUserStatus,
  adminListJobs,
  adminGetSystemMetrics,
  adminGetLimits,
  adminUpdateLimits,
  adminGetAuditLogs,
} from '../../services/api';
import Logo from '../../components/common/Logo';
import FlowMLIcon from '../../components/FlowMLIcon';
import { getFirebaseConfigStatus, isDevMode } from '../../services/firebase';

/* ─── Shared card wrapper ───────────────────────────────────────────────── */
function Card({ className = '', children }) {
  return (
    <div
      className={`rounded-2xl border shadow-sm ${className}`}
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
    >
      {children}
    </div>
  );
}

/* ─── Metric card ───────────────────────────────────────────────────────── */
function MetricCard({ label, value, sub, icon: Icon, iconColor }) {
  return (
    <Card className="p-4 space-y-1">
      <div className="flex items-center justify-between" style={{ color: 'var(--color-text-muted)' }}>
        <span className="text-xs font-medium">{label}</span>
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </div>
      <p className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{value}</p>
      <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{sub}</span>
    </Card>
  );
}

/* ─── Input field ───────────────────────────────────────────────────────── */
function Field({ label, ...props }) {
  return (
    <div>
      <label
        className="block text-xs font-semibold mb-1"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {label}
      </label>
      <input
        className="w-full px-3 py-2 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-violet-500/40 transition-all"
        style={{
          background: 'var(--color-bg)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text)',
        }}
        {...props}
      />
    </div>
  );
}

/* ─── Main Component ────────────────────────────────────────────────────── */
export default function AdminView({ onSignOut }) {
  const [users, setUsers] = useState([]);
  const [jobs, setJobs] = useState({ summary: {}, running_jobs: [], failed_jobs: [] });
  const [system, setSystem] = useState(null);
  const [limits, setLimits] = useState({
    execution_timeout_sec: 15,
    memory_limit_mb: 256,
    max_upload_size_mb: 50,
    per_user_quota_datasets: 25,
  });
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingLimits, setSavingLimits] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState('users');
  const firebaseStatus = getFirebaseConfigStatus();
  const authEnvironment = [
    ['VITE_FIREBASE_API_KEY', import.meta.env.VITE_FIREBASE_API_KEY],
    ['VITE_FIREBASE_AUTH_DOMAIN', import.meta.env.VITE_FIREBASE_AUTH_DOMAIN],
    ['VITE_FIREBASE_PROJECT_ID', import.meta.env.VITE_FIREBASE_PROJECT_ID],
    ['VITE_FIREBASE_STORAGE_BUCKET', import.meta.env.VITE_FIREBASE_STORAGE_BUCKET],
    ['VITE_API_BASE_URL', import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000 (Default)'],
  ];

  const loadData = async () => {
    setLoading(true);
    try {
      const [u, j, s, l, a] = await Promise.all([
        adminListUsers().catch(() => []),
        adminListJobs().catch(() => ({ summary: {}, running_jobs: [], failed_jobs: [] })),
        adminGetSystemMetrics().catch(() => null),
        adminGetLimits().catch(() => null),
        adminGetAuditLogs(30).catch(() => []),
      ]);
      setUsers(u || []);
      setJobs(j || { summary: {}, running_jobs: [], failed_jobs: [] });
      setSystem(s);
      if (l) setLimits(l);
      setAuditLogs(a || []);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleToggleUserStatus = async (uid, currentStatus) => {
    try {
      const res = await adminSetUserStatus(uid, !currentStatus);
      setUsers((prev) => prev.map((u) => (u.uid === uid ? { ...u, is_active: res.is_active } : u)));
    } catch (err) {
      alert(err?.response?.data?.detail || 'Failed to update user status');
    }
  };

  const handleSaveLimits = async (e) => {
    e.preventDefault();
    setSavingLimits(true);
    try {
      const updated = await adminUpdateLimits(limits);
      setLimits(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      alert(err?.response?.data?.detail || 'Failed to update limits');
    } finally {
      setSavingLimits(false);
    }
  };

  const TABS = [
    { id: 'users',  label: 'Users',         icon: Users },
    { id: 'jobs',   label: 'Job Queue',      icon: Activity },
    { id: 'limits', label: 'Exec Limits',    icon: Sliders },
    { id: 'auth',   label: 'Auth Status',    icon: Key },
    { id: 'audit',  label: 'Audit Logs',     icon: ShieldCheck },
  ];

  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 font-sans" style={{ color: 'var(--color-text)' }}>
      {/* Admin Topbar */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/app/projects')}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-violet-600 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to App
          </button>
          <span className="text-slate-300">|</span>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-rose-600 flex items-center justify-center">
              <ShieldCheck className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-bold text-slate-900">Admin Console</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200 uppercase tracking-wider">Restricted Access</span>
          </div>
        </div>

        <div className="flex items-center gap-5">
          <button
            type="button"
            onClick={onSignOut}
            className="flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-rose-600 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
          <Link to="/" className="flex items-center gap-2" title="FlowML Home">
            <FlowMLIcon size={40} />
            <Logo size="text-sm" />
          </Link>
        </div>
      </header>

      {/* Page Content */}
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-50 text-rose-600 border border-rose-200">
              Admin
            </span>
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Platform telemetry, limits & audit trail
            </span>
          </div>
          <h1 className="font-display text-2xl font-extrabold tracking-[-0.02em] leading-tight" style={{ color: 'var(--color-text)' }}>
            Security & Operations Center
          </h1>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all self-start sm:self-auto"
          style={{
            background: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-muted)',
          }}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Registered Users" value={users.length}
          sub={`${users.filter((u) => u.is_active).length} active`}
          icon={Users} iconColor="text-violet-500"
        />
        <MetricCard
          label="Active Workers" value={jobs.summary?.running || 0}
          sub={`${jobs.summary?.queued || 0} queued`}
          icon={Activity} iconColor="text-emerald-500"
        />
        <MetricCard
          label="Memory Load"
          value={system?.memory ? `${system.memory.used_pct}%` : '—'}
          sub={system?.memory ? `${system.memory.available_mb} MB free` : 'Bounded'}
          icon={Cpu} iconColor="text-amber-500"
        />
        <MetricCard
          label="Storage"
          value={system?.storage ? `${system.storage.used_pct}%` : '—'}
          sub={system?.storage ? `${system.storage.free_gb} GB free` : 'Local store'}
          icon={HardDrive} iconColor="text-blue-500"
        />
      </div>

      {/* Tabs */}
      <div
        className="flex items-center gap-1 border-b text-xs font-semibold pb-0"
        style={{ borderColor: 'var(--color-border)' }}
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-t-xl transition-all border-b-2 -mb-px ${
                active
                  ? 'bg-violet-50 text-violet-700 border-violet-500'
                  : 'border-transparent hover:bg-slate-50'
              }`}
              style={{ color: active ? undefined : 'var(--color-text-muted)' }}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab: Users */}
      {activeTab === 'users' && (
        <Card className="overflow-hidden">
          <div
            className="p-4 border-b flex items-center justify-between"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <h3 className="font-display font-semibold text-sm" style={{ color: 'var(--color-text)' }}>
              Managed Accounts
            </h3>
            <span className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>
              {users.length} accounts
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead
                className="text-[10px] uppercase tracking-wider font-bold"
                style={{ background: 'var(--color-bg)', color: 'var(--color-text-muted)' }}
              >
                <tr>
                  {['UID', 'Status', 'Datasets', 'Models', 'Runs', 'Storage', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody style={{ color: 'var(--color-text)' }}>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center" style={{ color: 'var(--color-text-muted)' }}>
                      No user accounts found.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr
                      key={u.uid}
                      className="border-t transition-colors hover:bg-slate-50"
                      style={{ borderColor: 'var(--color-border)' }}
                    >
                      <td className="px-4 py-3 font-mono font-semibold">{u.uid}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            u.is_active
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-600 border border-rose-200'
                          }`}
                        >
                          {u.is_active ? 'Active' : 'Deactivated'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono">{u.dataset_count}</td>
                      <td className="px-4 py-3 font-mono">{u.model_count}</td>
                      <td className="px-4 py-3 font-mono">{u.run_count}</td>
                      <td className="px-4 py-3 font-mono">{u.storage_mb} MB</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleToggleUserStatus(u.uid, u.is_active)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                            u.is_active
                              ? 'bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200'
                              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {u.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab: Jobs */}
      {activeTab === 'jobs' && (
        <div className="grid sm:grid-cols-2 gap-4">
          <Card className="p-4 space-y-3">
            <h4 className="font-display font-semibold text-sm flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
              <Activity className="w-4 h-4 text-emerald-500" />
              Running Jobs ({jobs.running_jobs.length})
            </h4>
            {jobs.running_jobs.length === 0 ? (
              <p className="text-xs py-4" style={{ color: 'var(--color-text-muted)' }}>
                No active pipeline jobs running.
              </p>
            ) : (
              <div className="space-y-2">
                {jobs.running_jobs.map((j) => (
                  <div
                    key={j.run_id}
                    className="p-3 rounded-xl text-xs font-mono"
                    style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
                  >
                    <div className="flex items-center justify-between text-emerald-600 font-bold mb-1">
                      <span>{j.run_id}</span>
                      <span className="animate-pulse">● Running</span>
                    </div>
                    <div style={{ color: 'var(--color-text-muted)' }}>UID: {j.uid}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-4 space-y-3">
            <h4 className="font-display font-semibold text-sm flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              Recent Failures ({jobs.failed_jobs.length})
            </h4>
            {jobs.failed_jobs.length === 0 ? (
              <p className="text-xs py-4" style={{ color: 'var(--color-text-muted)' }}>
                Zero failed executions recorded.
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {jobs.failed_jobs.map((j) => (
                  <div
                    key={j.run_id}
                    className="p-3 rounded-xl text-xs font-mono bg-rose-50 border border-rose-200"
                  >
                    <div className="flex items-center justify-between text-rose-600 font-bold mb-1">
                      <span>{j.run_id}</span>
                      <span>Failed</span>
                    </div>
                    <div className="truncate" style={{ color: 'var(--color-text-muted)' }}>
                      Err: {j.error || 'Execution halted'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Tab: Limits */}
      {activeTab === 'limits' && (
        <Card className="p-6 max-w-xl">
          <form onSubmit={handleSaveLimits} className="space-y-5">
            <div
              className="flex items-center justify-between border-b pb-3"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <div>
                <h3 className="font-display font-semibold text-sm" style={{ color: 'var(--color-text)' }}>
                  Platform Execution Limits
                </h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                  Sandbox boundaries enforced across all worker processes
                </p>
              </div>
              {saveSuccess && (
                <span className="flex items-center gap-1 text-xs text-emerald-600 font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Updated
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field
                label="Timeout Limit (Seconds)"
                type="number" min="1" max="120"
                value={limits.execution_timeout_sec}
                onChange={(e) => setLimits({ ...limits, execution_timeout_sec: parseInt(e.target.value) || 15 })}
              />
              <Field
                label="Worker RAM Limit (MB)"
                type="number" min="64" max="2048" step="64"
                value={limits.memory_limit_mb}
                onChange={(e) => setLimits({ ...limits, memory_limit_mb: parseInt(e.target.value) || 256 })}
              />
              <Field
                label="Max Upload Size (MB)"
                type="number" min="5" max="500"
                value={limits.max_upload_size_mb}
                onChange={(e) => setLimits({ ...limits, max_upload_size_mb: parseInt(e.target.value) || 50 })}
              />
              <Field
                label="Per-User Dataset Quota"
                type="number" min="5" max="200"
                value={limits.per_user_quota_datasets}
                onChange={(e) => setLimits({ ...limits, per_user_quota_datasets: parseInt(e.target.value) || 25 })}
              />
            </div>

            <button
              type="submit"
              disabled={savingLimits}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs shadow-md transition-all disabled:opacity-60"
            >
              <Save className="w-3.5 h-3.5" />
              {savingLimits ? 'Saving…' : 'Save Platform Limits'}
            </button>
          </form>
        </Card>
      )}

      {/* Tab: Authentication Infrastructure */}
      {activeTab === 'auth' && (
        <Card className="p-6 max-w-2xl space-y-5">
          <div className="flex items-center justify-between gap-4 border-b pb-4" style={{ borderColor: 'var(--color-border)' }}>
            <div>
              <h3 className="font-display font-semibold text-sm" style={{ color: 'var(--color-text)' }}>
                Authentication Infrastructure Status
              </h3>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                Authentication provider and runtime configuration for the platform.
              </p>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border ${
              isDevMode
                ? 'text-violet-700 bg-violet-50 border-violet-200'
                : firebaseStatus.isConfigured
                  ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                  : 'text-rose-700 bg-rose-50 border-rose-200'
            }`}>
              {isDevMode ? 'DEV_AUTH Mock Active' : firebaseStatus.isConfigured ? 'Live Firebase Auth' : 'Firebase Not Configured'}
            </span>
          </div>

          <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            {isDevMode
              ? 'Development authentication is active. User sessions are simulated locally.'
              : firebaseStatus.isConfigured
                ? 'Firebase Authentication is configured for live user sign-in.'
                : 'Firebase Authentication is not configured. Check the environment variables below.'}
          </p>

          <div className="rounded-2xl border overflow-hidden text-xs" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}>
            <div className="p-3 border-b text-[10px] uppercase font-bold tracking-wider" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
              Environment Configuration
            </div>
            <div className="divide-y text-[11px] font-mono" style={{ borderColor: 'var(--color-border)' }}>
              {authEnvironment.map(([key, value]) => (
                <div key={key} className="p-3 flex items-center justify-between gap-4">
                  <span className="font-semibold" style={{ color: 'var(--color-text)' }}>{key}</span>
                  <span className={value ? 'text-emerald-600' : 'text-slate-400'}>
                    {value ? (key === 'VITE_API_BASE_URL' && !import.meta.env.VITE_API_BASE_URL ? value : 'Configured') : 'Missing / Using Dev Mock'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Tab: Audit Logs */}
      {activeTab === 'audit' && (
        <Card className="overflow-hidden">
          <div
            className="p-4 border-b flex items-center justify-between"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <h3 className="font-display font-semibold text-sm" style={{ color: 'var(--color-text)' }}>
              Security Audit Trail
            </h3>
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Chronological tamper-evident records
            </span>
          </div>
          <div>
            {auditLogs.length === 0 ? (
              <p className="p-8 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
                No security audit events recorded.
              </p>
            ) : (
              auditLogs.map((evt, idx) => (
                <div
                  key={idx}
                  className="p-3.5 flex items-start justify-between gap-4 text-xs font-mono border-b transition-colors hover:bg-slate-50"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          evt.severity === 'WARNING'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-violet-50 text-violet-700 border border-violet-200'
                        }`}
                      >
                        {evt.event_type}
                      </span>
                      <span className="font-semibold" style={{ color: 'var(--color-text)' }}>{evt.actor_uid}</span>
                    </div>
                    <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                      {JSON.stringify(evt.details)}
                    </p>
                  </div>
                  <span className="text-[10px] whitespace-nowrap" style={{ color: 'var(--color-text-muted)' }}>
                    {evt.timestamp}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>
      )}
    </div>
    </div>
  );
}
