/**
 * ResultsPanel.jsx
 * Full right-side slide-in panel showing:
 *  - Live pipeline step progress
 *  - Model leaderboard
 *  - Prediction table + CSV download
 *  - Embedded charts
 */
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, CheckCircle2, AlertCircle, Loader2, RotateCcw,
  Trophy, BarChart3, Download, Search, ChevronLeft, ChevronRight,
  Clock, Zap, TrendingUp, Hash, Cpu, AlertTriangle,
} from 'lucide-react';

/* ─── Step status config ─────────────────────────────────────────────────────── */
const STEP_CFG = {
  running: { color: '#7C3AED', bg: 'rgba(124,58,237,0.1)',  Icon: Loader2,       spin: true  },
  done:    { color: '#22c55e', bg: 'rgba(34,197,94,0.08)',   Icon: CheckCircle2,  spin: false },
  error:   { color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   Icon: AlertCircle,   spin: false },
  warning: { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  Icon: AlertTriangle, spin: false },
  skipped: { color: '#6b7280', bg: 'rgba(107,114,128,0.05)', Icon: Clock,         spin: false },
};
const EMPTY_LIST = [];

const PAGE_SIZE = 25;

/* ─── Model Leaderboard ──────────────────────────────────────────────────────── */
function Leaderboard({ trainResult }) {
  const models   = trainResult?.models ?? EMPTY_LIST;
  const best     = trainResult?.best_model;
  const taskType = trainResult?.taskType ?? 'classification';

  if (!models.length) return null;

  const sorted = [...models].sort((a, b) => {
    const k = taskType === 'regression' ? 'r2' : 'accuracy';
    return (b[k] ?? -999) - (a[k] ?? -999);
  });

  const metricKey = taskType === 'regression' ? 'r2' : 'accuracy';

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="w-4 h-4 text-amber-400" />
        <span className="text-xs font-bold" style={{ color: 'var(--color-text)' }}>Model Leaderboard</span>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-400 font-semibold">{taskType}</span>
      </div>
      <div className="space-y-1.5">
        {sorted.map((m, i) => {
          const isBest = m.model_name === best;
          const val    = m[metricKey];
          const pct    = val != null ? Math.abs(val) * 100 : 0;
          return (
            <div
              key={m.model_name}
              className="rounded-xl px-3 py-2.5 transition-all"
              style={{
                background:  isBest ? 'rgba(124,58,237,0.08)' : 'var(--color-bg)',
                border:      `1px solid ${isBest ? 'rgba(124,58,237,0.3)' : 'var(--color-border)'}`,
              }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-mono w-4 text-center" style={{ color: 'var(--color-text-muted)' }}>
                    #{i + 1}
                  </span>
                  <span className="text-xs font-semibold" style={{ color: isBest ? '#7C3AED' : 'var(--color-text)' }}>
                    {m.model_name}
                  </span>
                  {isBest && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold text-white"
                      style={{ background: 'linear-gradient(135deg,#7C3AED,#6D28D9)' }}>
                      BEST
                    </span>
                  )}
                </div>
                <span className="text-xs font-bold font-mono" style={{ color: isBest ? '#7C3AED' : 'var(--color-text)' }}>
                  {val != null ? (val * (taskType === 'regression' && val < 1 ? 1 : 100)).toFixed(1)
                    + (taskType === 'regression' ? '' : '%') : 'N/A'}
                </span>
              </div>
              {/* Progress bar */}
              <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width:      `${Math.min(100, pct)}%`,
                    background: isBest ? 'linear-gradient(90deg,#7C3AED,#6D28D9)' : '#4b5563',
                  }}
                />
              </div>
              {/* Extra metrics */}
              {m.error ? (
                <p className="text-[9px] mt-1 text-danger">{m.error}</p>
              ) : taskType === 'classification' ? (
                <div className="flex gap-3 mt-1">
                  {[['F1', m.f1], ['Prec', m.precision], ['Rec', m.recall]].map(([l, v]) => v != null && (
                    <span key={l} className="text-[9px] font-mono" style={{ color: 'var(--color-text-muted)' }}>
                      {l}: {(v * 100).toFixed(1)}%
                    </span>
                  ))}
                </div>
              ) : (
                <div className="flex gap-3 mt-1">
                  {[['MSE', m.mse], ['MAE', m.mae]].map(([l, v]) => v != null && (
                    <span key={l} className="text-[9px] font-mono" style={{ color: 'var(--color-text-muted)' }}>
                      {l}: {v.toFixed(3)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Stat card ──────────────────────────────────────────────────────────────── */
function StatCard({ icon: Icon, label, value, color, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, type: 'spring', stiffness: 260, damping: 22 }}
      className="p-3 rounded-2xl relative overflow-hidden"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      <div className="w-7 h-7 rounded-xl flex items-center justify-center mb-2" style={{ background: color + '20' }}>
        <Icon className="w-3.5 h-3.5" style={{ color }} />
      </div>
      <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
      <p className="text-lg font-bold font-mono truncate mt-0.5" style={{ color: 'var(--color-text)' }}>{value}</p>
      <div className="absolute -right-3 -bottom-3 w-12 h-12 rounded-full blur-xl opacity-20" style={{ background: color }} />
    </motion.div>
  );
}

/* ─── Predictions table ──────────────────────────────────────────────────────── */
function PredTable({ predResult, trainResult }) {
  const [q, setQ]       = useState('');
  const [page, setPage] = useState(0);

  const preds   = predResult?.predictions ?? EMPTY_LIST;
  const taskType= trainResult?.taskType ?? 'classification';

  const classMap = useMemo(() => {
    const uniq = [...new Set(preds.map(String))];
    return Object.fromEntries(uniq.map((v, i) => [v, i]));
  }, [preds]);

  const COLORS = ['#7C3AED','#22c55e','#f59e0b','#3b82f6','#ef4444','#ec4899'];

  const filtered = useMemo(
    () => preds.filter((p) => String(p).toLowerCase().includes(q.toLowerCase())),
    [preds, q]
  );
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const slice      = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const startIdx   = page * PAGE_SIZE;

  const downloadCSV = () => {
    const csv  = ['index,prediction', ...preds.map((p, i) => `${i},${p}`)].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    Object.assign(document.createElement('a'), { href: url, download: 'predictions.csv' }).click();
    URL.revokeObjectURL(url);
  };

  if (!preds.length) return null;

  return (
    <div>
      {/* toolbar */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Hash className="w-3.5 h-3.5" style={{ color: 'var(--color-text-muted)' }} />
          <span className="text-xs font-bold" style={{ color: 'var(--color-text)' }}>Predictions</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
            style={{ background: 'rgba(124,58,237,0.12)', color: '#7C3AED' }}>
            {filtered.length.toLocaleString()} rows
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3" style={{ color: 'var(--color-text-muted)' }} />
            <input
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(0); }}
              placeholder="Filter…"
              className="pl-7 pr-2 py-1 text-[10px] rounded-lg w-28 focus:outline-none"
              style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
            />
          </div>
          <button
            onClick={downloadCSV}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold text-white"
            style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)' }}
          >
            <Download className="w-3 h-3" />CSV
          </button>
        </div>
      </div>

      {/* rows */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
        <div className="grid grid-cols-12 px-3 py-2 text-[9px] font-bold uppercase tracking-widest"
          style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
          <span className="col-span-3">Row</span>
          <span className="col-span-9">Prediction</span>
        </div>
        <div style={{ background: 'var(--color-bg)', maxHeight: 220, overflowY: 'auto' }}>
          {slice.map((p, ri) => {
            const idx  = startIdx + ri;
            const col  = COLORS[classMap[String(p)] % COLORS.length];
            return (
              <div key={idx}
                className="grid grid-cols-12 px-3 py-1.5 items-center transition-colors"
                style={{ borderBottom: '1px solid var(--color-border)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(124,58,237,0.04)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span className="col-span-3 text-[10px] font-mono" style={{ color: 'var(--color-text-muted)' }}>
                  {String(idx).padStart(4, '0')}
                </span>
                <span className="col-span-9">
                  {taskType === 'classification' ? (
                    <span className="inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white"
                      style={{ background: col }}>
                      {String(p)}
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono font-semibold" style={{ color: '#7C3AED' }}>{String(p)}</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-2">
          <span className="text-[9px]" style={{ color: 'var(--color-text-muted)' }}>
            Page {page + 1}/{totalPages}
          </span>
          <div className="flex gap-1">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
              className="w-6 h-6 rounded-lg flex items-center justify-center disabled:opacity-30"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
              <ChevronLeft className="w-3 h-3" />
            </button>
            <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              className="w-6 h-6 rounded-lg flex items-center justify-center disabled:opacity-30"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Charts ─────────────────────────────────────────────────────────────────── */
function Charts({ vizResult }) {
  const charts = Object.entries(vizResult ?? {});
  if (!charts.length) return null;
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="w-4 h-4" style={{ color: '#7C3AED' }} />
        <span className="text-xs font-bold" style={{ color: 'var(--color-text)' }}>Visualizations</span>
      </div>
      <div className="space-y-3">
        {charts.map(([key, src]) => (
          <div key={key} className="rounded-xl overflow-hidden p-3" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <p className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--color-text-muted)' }}>
              {key.replace(/_/g, ' ')}
            </p>
            <img
              src={src.startsWith('data:') ? src : `data:image/png;base64,${src}`}
              alt={key}
              className="w-full rounded-lg object-contain"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── ResultsPanel ───────────────────────────────────────────────────────────── */
export default function ResultsPanel({ pipelineState, steps, results, onClose, onReset }) {
  const [tab, setTab] = useState('progress'); // progress | results | charts

  const isDone    = pipelineState === 'done';
  const isError   = pipelineState === 'error';
  const isRunning = pipelineState === 'running';

  const { trainResult, predResult, vizResult, targetColumn, taskType } = results ?? {};
  const bestModel = trainResult?.best_model;
  const bestEntry = trainResult?.models?.find((m) => m.model_name === bestModel);
  const metric    = taskType === 'classification'
    ? bestEntry?.accuracy != null ? `${(bestEntry.accuracy * 100).toFixed(1)}%` : '—'
    : bestEntry?.r2 != null ? bestEntry.r2.toFixed(3) : '—';

  const TABS = [
    { id: 'progress', label: 'Progress', show: true },
    { id: 'results',  label: 'Results',  show: isDone && (trainResult || predResult) },
    { id: 'charts',   label: 'Charts',   show: isDone && vizResult },
  ].filter((t) => t.show);

  return (
    <motion.div
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ type: 'spring', stiffness: 240, damping: 28 }}
      className="w-96 shrink-0 flex flex-col h-full z-30 overflow-hidden"
      style={{ background: 'var(--color-surface)', borderLeft: '1px solid var(--color-border)' }}
    >
      {/* gradient bar */}
      <div className="h-0.5 w-full shrink-0"
        style={{ background: isError ? '#ef4444' : isDone ? 'linear-gradient(90deg,#7C3AED,#22c55e)' : 'linear-gradient(90deg,#7C3AED,#6D28D9)' }} />

      {/* header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <div className="flex items-center gap-2.5">
          {isRunning && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
          {isDone    && <CheckCircle2 className="w-4 h-4 text-success" />}
          {isError   && <AlertCircle  className="w-4 h-4 text-danger"  />}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
              {isRunning ? 'Executing…' : isDone ? 'Pipeline Complete' : isError ? 'Pipeline Error' : 'Pipeline'}
            </p>
            <p className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>Results</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {!isRunning && (
            <button onClick={onReset} title="Reset"
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
              style={{ color: 'var(--color-text-muted)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#ef4444'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-muted)'; }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* tabs */}
      {TABS.length > 1 && (
        <div className="flex border-b shrink-0" style={{ borderColor: 'var(--color-border)' }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex-1 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors"
              style={{
                color:       tab === t.id ? '#7C3AED' : 'var(--color-text-muted)',
                borderBottom: tab === t.id ? '2px solid #7C3AED' : '2px solid transparent',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">

        {/* ── Progress tab ── */}
        {tab === 'progress' && (
          <>
            {steps.map((step) => {
              const cfg = STEP_CFG[step.status] ?? STEP_CFG.running;
              return (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-3"
                >
                  <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: cfg.bg }}>
                    <cfg.Icon className={`w-3.5 h-3.5 ${cfg.spin ? 'animate-spin' : ''}`} style={{ color: cfg.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold" style={{ color: 'var(--color-text)' }}>{step.label}</p>
                      <span className="text-[9px] font-mono shrink-0 ml-2" style={{ color: 'var(--color-text-muted)' }}>{step.ts}</span>
                    </div>
                    {step.detail && (
                      <p className="text-[10px] mt-0.5 font-mono leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                        {step.detail}
                      </p>
                    )}
                  </div>
                </motion.div>
              );
            })}
            {steps.length === 0 && (
              <div className="py-12 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
                <Zap className="w-8 h-8 mx-auto mb-3 opacity-20" />
                Click <strong className="text-primary">Run Pipeline</strong> to start execution.
              </div>
            )}
          </>
        )}

        {/* ── Results tab ── */}
        {tab === 'results' && isDone && (
          <>
            {/* stat cards */}
            <div className="grid grid-cols-2 gap-2">
              <StatCard icon={Cpu}        label="Best Model"   value={bestModel ?? '—'}          color="#7C3AED" delay={0.05} />
              <StatCard icon={TrendingUp} label={taskType === 'regression' ? 'R²' : 'Accuracy'}  value={metric} color="#22c55e" delay={0.1}  />
              <StatCard icon={Hash}       label="Predictions"  value={(predResult?.predictions?.length ?? 0).toLocaleString()} color="#f59e0b" delay={0.15} />
              <StatCard icon={BarChart3}  label="Task Type"    value={taskType ?? '—'}             color="#3b82f6" delay={0.2}  />
            </div>

            {/* Target info */}
            {targetColumn && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
                style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
                <Zap className="w-3.5 h-3.5 text-primary shrink-0" />
                Target column: <span className="font-mono font-bold text-primary ml-1">"{targetColumn}"</span>
              </div>
            )}

            <Leaderboard trainResult={trainResult} />
            <PredTable predResult={predResult} trainResult={trainResult} />
          </>
        )}

        {/* ── Charts tab ── */}
        {tab === 'charts' && isDone && (
          <Charts vizResult={vizResult} />
        )}
      </div>
    </motion.div>
  );
}
