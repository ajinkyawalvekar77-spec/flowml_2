import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { listRuns, getRun, stopRun } from '../../services/api';
import {
  PlayCircle, RefreshCw, Clock, CheckCircle2, AlertCircle,
  Loader2, X, Terminal, BarChart2, StopCircle,
  ArrowRight, Sparkles,
} from 'lucide-react';
import FlowMLIcon from '../../components/FlowMLIcon';

const STATUS_CONFIG = {
  Completed: { label: 'Completed', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.12)', border: 'rgba(34, 197, 94, 0.25)', icon: CheckCircle2 },
  Running:   { label: 'Running',   color: '#7C3AED', bg: 'rgba(124, 58, 237, 0.12)', border: 'rgba(124, 58, 237, 0.25)', icon: Loader2, spin: true },
  Failed:    { label: 'Failed',    color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.25)', icon: AlertCircle },
  Stopping:  { label: 'Stopping',  color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.25)', icon: StopCircle },
  Queued:    { label: 'Queued',    color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)', border: 'rgba(59, 130, 246, 0.25)', icon: Clock },
};

export default function RunsView() {
  const { showToast } = useOutletContext();
  const navigate = useNavigate();

  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRunId, setSelectedRunId] = useState(null);
  const [runDetail, setRunDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);

  const fetchRuns = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listRuns();
      setRuns(Array.isArray(data) ? data : []);
    } catch (err) {
      setRuns([]);
      setError(err.message || 'Unable to load run history. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
    const timer = setInterval(() => {
      listRuns()
        .then((data) => {
          if (Array.isArray(data)) {
            setRuns(data);
            setError(null);
          }
        })
        .catch((err) => setError(err.message || 'Unable to refresh run history.'));
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  const handleOpenDetail = async (runId) => {
    setSelectedRunId(runId);
    setDetailLoading(true);
    setRunDetail(null);
    setDetailError(null);
    try {
      const detail = await getRun(runId);
      setRunDetail(detail);
    } catch (e) {
      setDetailError(e.message || 'Unable to load this run.');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleStopRun = async (runId, e) => {
    e.stopPropagation();
    try {
      await stopRun(runId);
      showToast(`Stop request sent for run ${runId}.`, 'info');
      fetchRuns();
    } catch (_err) {
      showToast(_err.message || 'Failed to stop run.', 'error');
    }
  };

  const handleOpenStudio = () => {
    navigate('/studio');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-[-0.02em] leading-tight" style={{ color: 'var(--color-text)' }}>
            Execution Run History
          </h1>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Track background pipeline jobs, execution run times, real-time node outputs, and console logs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchRuns}
            disabled={loading}
            className="p-2.5 rounded-xl border text-slate-400 hover:text-white transition-colors"
            style={{
              borderColor: 'var(--color-border)',
              background: 'var(--color-surface)',
            }}
            title="Refresh runs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => navigate('/studio')}
            className="px-4 py-2.5 rounded-xl font-bold text-xs text-white flex items-center gap-2 shadow-lg transition-all active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #7C3AED, #6D28D9)',
              boxShadow: '0 4px 16px rgba(124, 58, 237, 0.35)',
            }}
          >
            <PlayCircle className="w-4 h-4" />
            Launch New Run
          </button>
        </div>
      </div>

      {/* Runs Table */}
      {error ? (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 flex items-center justify-between gap-4">
          <span>{error}</span>
          <button onClick={fetchRuns} className="font-semibold underline">Retry</button>
        </div>
      ) : loading ? (
        <div className="p-16 flex flex-col items-center justify-center gap-3 text-slate-400">
          <FlowMLIcon size={56} />
          <p className="text-xs font-medium">Fetching job history…</p>
        </div>
      ) : runs.length === 0 ? (
        <div
          className="rounded-3xl p-12 text-center border border-dashed flex flex-col items-center justify-center max-w-xl mx-auto my-8"
          style={{
            borderColor: 'var(--color-border)',
            background: 'var(--color-surface)',
          }}
        >
          <FlowMLIcon size={56} className="mb-4" />
          <h3 className="font-display font-semibold text-base mb-1" style={{ color: 'var(--color-text)' }}>
            No execution runs yet
          </h3>
          <p className="text-xs max-w-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
            Execute a pipeline from the Studio Canvas to see real-time background job logs and results here.
          </p>
          <button
            onClick={() => navigate('/studio')}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-2"
            style={{ background: 'linear-gradient(135deg, #7C3AED, #6D28D9)' }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Open Studio
          </button>
        </div>
      ) : (
        <div
          className="rounded-2xl border overflow-hidden shadow-sm"
          style={{
            background: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
          }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b uppercase font-bold text-[10px] tracking-wider" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                <tr>
                  <th className="py-3.5 px-4">Run Identifier</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Started At</th>
                  <th className="py-3.5 px-4">Duration</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                {runs.map((r) => {
                  const state = r.state || 'Completed';
                  const cfg = STATUS_CONFIG[state] || STATUS_CONFIG.Completed;
                  const Icon = cfg.icon;

                  let duration = r.duration || '—';
                  if (r.created && r.finished && !r.duration) {
                    const ms = new Date(r.finished) - new Date(r.created);
                    duration = `${(ms / 1000).toFixed(1)}s`;
                  }

                  return (
                    <tr
                      key={r.run_id}
                      onClick={() => handleOpenDetail(r.run_id)}
                      className="hover:bg-white/[0.02] transition-colors cursor-pointer"
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center font-mono font-bold text-xs"
                            style={{ background: cfg.bg, color: cfg.color }}
                          >
                            <PlayCircle className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-mono font-bold text-xs" style={{ color: 'var(--color-text)' }}>
                              {r.run_id}
                            </div>
                            <div className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                              Pipeline execution
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
                          style={{
                            background: cfg.bg,
                            color: cfg.color,
                            border: `1px solid ${cfg.border}`,
                          }}
                        >
                          <Icon className={`w-3 h-3 ${cfg.spin ? 'animate-spin' : ''}`} />
                          {cfg.label}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                        {r.created ? new Date(r.created).toLocaleString() : 'Recent'}
                      </td>

                      <td className="py-3.5 px-4 font-mono font-medium" style={{ color: 'var(--color-text)' }}>
                        {duration}
                      </td>

                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          {state === 'Running' && (
                            <button
                              onClick={(e) => handleStopRun(r.run_id, e)}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 flex items-center gap-1"
                              title="Stop Running Pipeline"
                            >
                              <StopCircle className="w-3.5 h-3.5" />
                              Stop
                            </button>
                          )}

                          <button
                            onClick={handleOpenStudio}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 flex items-center gap-1 transition-colors"
                            title="Open Studio"
                          >
                            Open Studio
                          </button>

                          <button
                            onClick={() => handleOpenDetail(r.run_id)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-primary hover:bg-primary/10 flex items-center gap-1 transition-colors"
                          >
                            Details
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Run Detail Modal / Drawer */}
      <AnimatePresence>
        {selectedRunId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-3xl max-h-[85vh] rounded-3xl p-6 shadow-2xl flex flex-col relative"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
              }}
            >
              <div className="flex items-start justify-between pb-4 border-b shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                <div>
                  <div className="flex items-center gap-2">
                    <Terminal className="w-5 h-5 text-primary" />
                    <h3 className="font-display font-semibold text-base" style={{ color: 'var(--color-text)' }}>
                      Run Detail: <span className="font-mono text-primary">{selectedRunId}</span>
                    </h3>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                    Execution audit logs, node statuses, and trained model metrics.
                  </p>
                </div>

                <button
                  onClick={() => setSelectedRunId(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-white/5"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-5 space-y-5">
                {detailLoading ? (
                  <div className="p-16 flex flex-col items-center justify-center gap-3">
                    <FlowMLIcon size={56} />
                    <p className="text-xs text-slate-400">Loading run logs and execution outputs…</p>
                  </div>
                ) : detailError ? (
                  <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center justify-between gap-4">
                    <span>{detailError}</span>
                    <button onClick={() => handleOpenDetail(selectedRunId)} className="font-semibold underline">Retry</button>
                  </div>
                ) : runDetail ? (
                  <>
                    {/* Status Pill & Summary */}
                    <div className="p-4 rounded-2xl border flex items-center justify-between" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}>
                      <div>
                        <div className="text-[10px] uppercase font-bold text-slate-400">Run State</div>
                        <div className="font-bold text-sm text-white mt-0.5">{runDetail.state || 'Completed'}</div>
                      </div>

                      {runDetail.result?.best_model && (
                        <div>
                          <div className="text-[10px] uppercase font-bold text-slate-400">Best Model</div>
                          <div className="font-bold text-sm text-primary mt-0.5">{runDetail.result.best_model}</div>
                        </div>
                      )}

                      <div>
                        <button
                          onClick={handleOpenStudio}
                          className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white flex items-center gap-1.5"
                          style={{ background: 'linear-gradient(135deg, #7C3AED, #6D28D9)' }}
                        >
                          Open Studio
                        </button>
                      </div>
                    </div>

                    {/* Console Logs */}
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2" style={{ color: 'var(--color-text-muted)' }}>
                        <Terminal className="w-3.5 h-3.5" />
                        Execution Console Logs
                      </h4>
                      <div className="rounded-2xl p-4 font-mono text-[11px] leading-relaxed bg-black/60 border border-white/5 max-h-56 overflow-y-auto text-slate-300">
                        {Array.isArray(runDetail.logs) && runDetail.logs.length > 0 ? (
                          runDetail.logs.map((log, i) => (
                            <div key={i} className="py-0.5">
                              {typeof log === 'string' ? log : JSON.stringify(log)}
                            </div>
                          ))
                        ) : (
                          <div className="text-slate-500 italic">No console logs recorded for this run.</div>
                        )}
                      </div>
                    </div>

                    {/* Results / Metrics if present */}
                    {runDetail.result?.metrics && (
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>
                          Model Metrics
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          {Object.entries(runDetail.result.metrics).map(([k, v]) => (
                            <div key={k} className="p-3 rounded-xl border" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}>
                              <div className="text-[9px] uppercase font-bold text-slate-400">{k}</div>
                              <div className="font-mono font-bold text-sm text-emerald-400 mt-0.5">
                                {typeof v === 'number' ? (v <= 1 ? `${(v * 100).toFixed(1)}%` : v.toFixed(3)) : String(v)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : null}
              </div>

              <div className="pt-4 border-t flex justify-end shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                <button
                  onClick={() => setSelectedRunId(null)}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white shadow-md"
                  style={{ background: 'linear-gradient(135deg, #7C3AED, #6D28D9)' }}
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
