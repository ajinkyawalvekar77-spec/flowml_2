import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Download, Search, Trophy, Cpu, BarChart3, Hash,
  CheckCircle2, TrendingUp, Zap, ChevronLeft, ChevronRight,
  Filter, Sparkles,
} from 'lucide-react';

const EMPTY_PREDICTIONS = [];

/* ─── helpers ──────────────────────────────────────────────────────────────── */
const fmtNum = (n) => (typeof n === 'number' ? n.toLocaleString() : n ?? '—');

const CLASS_PALETTE = [
  'from-violet-500 to-purple-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-sky-500 to-blue-600',
  'from-rose-500 to-pink-600',
  'from-lime-500 to-green-600',
];

/* ─── Stat card ─────────────────────────────────────────────────────────────── */
const StatCard = ({ icon: Icon, label, value, gradient, delay }) => (
  <motion.div
    initial={{ opacity: 0, y: 24 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, type: 'spring', stiffness: 200, damping: 22 }}
    className="relative overflow-hidden rounded-2xl p-5 flex flex-col gap-2"
    style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
  >
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${gradient} shadow-lg`}>
      <Icon className="w-5 h-5 text-white" />
    </div>
    <p className="text-[10px] font-semibold uppercase tracking-widest mt-1" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
    <p className="text-2xl font-bold font-mono truncate" style={{ color: 'var(--color-text)' }}>{value}</p>
    <div className={`absolute -right-4 -top-4 w-20 h-20 rounded-full bg-gradient-to-br ${gradient} opacity-10 blur-2xl pointer-events-none`} />
  </motion.div>
);

const PAGE_SIZE = 20;

export default function PredictionModal({ result, trainedConfig, onClose }) {
  const [search, setSearch]     = useState('');
  const [page, setPage]         = useState(0);
  const [showCharts, setShowCharts] = useState(false);

  const predictions = result?.predictions ?? EMPTY_PREDICTIONS;
  const charts      = result?.charts ?? {};
  const taskType    = trainedConfig?.taskType ?? 'classification';
  const bestModel   = result?.best_model ?? trainedConfig?.bestModel ?? 'Model';

  /* class-colour map */
  const classMap = useMemo(() => {
    const uniq = [...new Set(predictions.map(String))];
    return Object.fromEntries(uniq.map((v, i) => [v, i]));
  }, [predictions]);

  /* distribution */
  const distribution = useMemo(() => {
    const counts = {};
    predictions.forEach((p) => { const k = String(p); counts[k] = (counts[k] ?? 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [predictions]);

  /* filtered + paginated */
  const filtered = useMemo(
    () => predictions.filter((p) => String(p).toLowerCase().includes(search.toLowerCase())),
    [predictions, search]
  );
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageItems  = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const startIdx   = page * PAGE_SIZE;

  /* regression stats */
  const regStats = useMemo(() => {
    if (taskType !== 'regression') return null;
    const nums = predictions.map(Number).filter(Number.isFinite);
    if (!nums.length) return null;
    return {
      min:  Math.min(...nums).toFixed(4),
      max:  Math.max(...nums).toFixed(4),
      mean: (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(4),
    };
  }, [predictions, taskType]);

  const downloadCSV = () => {
    const rows = ['index,prediction', ...predictions.map((p, i) => `${i},${p}`)];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'flowml_predictions.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      key="pred-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex flex-col"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', stiffness: 180, damping: 26 }}
        className="relative flex flex-col w-full h-full overflow-hidden"
        style={{ backgroundColor: 'var(--color-bg)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* gradient bar */}
        <div className="h-1 w-full bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 shrink-0" />

        {/* header */}
        <div
          className="flex items-center justify-between px-8 py-4 shrink-0"
          style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-purple-400">FlowML · Inference Engine</p>
              <h2 className="text-lg font-bold font-display" style={{ color: 'var(--color-text)' }}>
                Prediction Results
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {Object.keys(charts).length > 0 && (
              <button
                onClick={() => setShowCharts((v) => !v)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
                style={{
                  background: showCharts ? 'linear-gradient(135deg,#7c3aed,#a21caf)' : 'var(--color-surface)',
                  color: showCharts ? 'white' : 'var(--color-text)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <BarChart3 className="w-4 h-4" />
                {showCharts ? 'Hide Charts' : 'View Charts'}
              </button>
            )}

            <button
              onClick={downloadCSV}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
              style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)' }}
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
              style={{ color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239,68,68,0.1)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* scrollable body */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">

          {/* stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={Hash}       label="Total Predictions" value={fmtNum(predictions.length)}                            gradient="from-violet-500 to-purple-600" delay={0.05} />
            <StatCard icon={Cpu}        label="Best Model"         value={bestModel}                                             gradient="from-sky-500 to-blue-600"     delay={0.1}  />
            <StatCard icon={TrendingUp} label="Task Type"          value={taskType.charAt(0).toUpperCase()+taskType.slice(1)}    gradient="from-emerald-500 to-teal-600" delay={0.15} />
            {taskType === 'classification'
              ? <StatCard icon={CheckCircle2} label="Unique Classes"  value={Object.keys(classMap).length}    gradient="from-amber-500 to-orange-600" delay={0.2} />
              : <StatCard icon={Zap}          label="Mean Prediction" value={regStats?.mean ?? '—'}            gradient="from-amber-500 to-orange-600" delay={0.2} />
            }
          </div>

          {/* classification distribution */}
          {taskType === 'classification' && distribution.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="p-5 rounded-2xl"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            >
              <p className="text-[10px] font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--color-text-muted)' }}>
                Prediction Distribution
              </p>
              <div className="flex flex-wrap gap-4">
                {distribution.map(([cls, cnt]) => {
                  const pct  = ((cnt / predictions.length) * 100).toFixed(1);
                  const grad = CLASS_PALETTE[classMap[cls] % CLASS_PALETTE.length];
                  return (
                    <div key={cls} className="flex flex-col items-center gap-1.5">
                      <div className={`px-4 py-1.5 rounded-full text-xs font-bold text-white bg-gradient-to-r ${grad} shadow-md`}>{cls}</div>
                      <span className="text-[10px] font-mono font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                        {fmtNum(cnt)} · {pct}%
                      </span>
                      <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
                        <div className={`h-full rounded-full bg-gradient-to-r ${grad}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* regression range cards */}
          {taskType === 'regression' && regStats && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="grid grid-cols-3 gap-4">
              {[['Min', regStats.min, 'from-sky-500 to-blue-600'], ['Mean', regStats.mean, 'from-violet-500 to-purple-600'], ['Max', regStats.max, 'from-rose-500 to-pink-600']].map(([lbl, val, grad]) => (
                <div key={lbl} className="p-4 rounded-2xl text-center" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--color-text-muted)' }}>{lbl}</p>
                  <p className={`text-xl font-bold font-mono bg-gradient-to-r ${grad} bg-clip-text text-transparent`}>{val}</p>
                </div>
              ))}
            </motion.div>
          )}

          {/* charts accordion */}
          <AnimatePresence>
            {showCharts && Object.keys(charts).length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-hidden"
              >
                {Object.entries(charts).map(([key, src]) => (
                  <div key={key} className="rounded-2xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--color-text-muted)' }}>
                      {key.replace(/_/g, ' ')}
                    </p>
                    <img
                      src={src.startsWith('data:') ? src : `data:image/png;base64,${src}`}
                      alt={key}
                      className="w-full rounded-xl object-contain"
                    />
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* prediction table */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-2xl overflow-hidden"
            style={{ border: '1px solid var(--color-border)' }}
          >
            {/* table toolbar */}
            <div
              className="flex items-center justify-between px-5 py-3"
              style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}
            >
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>Prediction Table</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-purple-500/15 text-purple-400">
                  {fmtNum(filtered.length)} rows
                </span>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--color-text-muted)' }} />
                <input
                  type="text"
                  placeholder="Filter by value…"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                  className="pl-8 pr-3 py-1.5 text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors"
                  style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)', width: 200 }}
                />
              </div>
            </div>

            {/* col headers */}
            <div
              className="grid grid-cols-12 px-5 py-2 text-[10px] font-bold uppercase tracking-widest"
              style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
            >
              <span className="col-span-2">Row #</span>
              <span className="col-span-10">Predicted Value</span>
            </div>

            {/* rows */}
            <div style={{ background: 'var(--color-bg)' }}>
              {pageItems.length === 0 ? (
                <div className="py-12 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  No predictions match your filter.
                </div>
              ) : (
                pageItems.map((pred, relIdx) => {
                  const absIdx = startIdx + relIdx;
                  const grad   = taskType === 'classification'
                    ? CLASS_PALETTE[classMap[String(pred)] % CLASS_PALETTE.length]
                    : null;
                  return (
                    <div
                      key={absIdx}
                      className="grid grid-cols-12 px-5 py-2.5 items-center transition-colors"
                      style={{ borderBottom: '1px solid var(--color-border)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(124,58,237,0.04)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span className="col-span-2 text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>
                        {String(absIdx).padStart(5, '0')}
                      </span>
                      <span className="col-span-10">
                        {grad ? (
                          <span className={`inline-flex px-3 py-0.5 rounded-full text-xs font-bold text-white bg-gradient-to-r ${grad} shadow-sm`}>
                            {String(pred)}
                          </span>
                        ) : (
                          <span className="text-xs font-mono font-semibold text-purple-400">{String(pred)}</span>
                        )}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* pagination */}
            {totalPages > 1 && (
              <div
                className="flex items-center justify-between px-5 py-3"
                style={{ background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)' }}
              >
                <span className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>
                  Page {page + 1} / {totalPages} · {fmtNum(filtered.length)} results
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors disabled:opacity-30"
                    style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {[...Array(Math.min(5, totalPages))].map((_, i) => {
                    const pg = Math.max(0, Math.min(page - 2, totalPages - 5)) + i;
                    return (
                      <button
                        key={pg}
                        onClick={() => setPage(pg)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-all"
                        style={pg === page
                          ? { background: 'linear-gradient(135deg,#7c3aed,#a21caf)', color: 'white' }
                          : { background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }
                        }
                      >
                        {pg + 1}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors disabled:opacity-30"
                    style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </motion.div>

          {/* footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex items-center justify-center gap-2 text-xs font-semibold pb-2"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <Trophy className="w-4 h-4 text-amber-400" />
            Powered by <span className="text-purple-400 font-bold">FlowML</span>
            &nbsp;·&nbsp;
            <span className="text-sky-400">{bestModel}</span> selected as best model
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}
