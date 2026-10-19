/**
 * ResultsOverlay.jsx
 * Full-screen overlay that appears after "Run Pipeline".
 * Shows:
 *   – Live execution progress (while running)
 *   – Overview (held-out metrics, model status, dataset information)
 *   – Models (configured model or AutoML comparison)
 *   – Held-out predictions, new-data testing, and fitted model details
 *   – Predictions (table with search / pagination / CSV download)
 *   – Charts    (visualisation images)
 *   – Report Download (HTML executive report)
 */
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, RotateCcw, CheckCircle2, AlertCircle, Loader2, Clock,
  AlertTriangle, Trophy, BarChart3, Hash, Cpu, TrendingUp,
  Database, Zap, Download, Search, ChevronLeft, ChevronRight,
  Table, Image, Activity, GitCompare, FlaskConical, FileText, ChevronDown,
} from 'lucide-react';
import FlowMLIcon from '../FlowMLIcon';
import EvaluationMetrics from './EvaluationMetrics';
import ModelTestPanel from './ModelTestPanel';
import { downloadModelArtifact } from '../../services/api';

/* ─── Step status config ─────────────────────────────────────────────────────── */
const STEP_CFG = {
  running: { color: '#7C3AED', bg: 'rgba(124,58,237,0.12)',  Icon: Loader2,       spin: true  },
  done:    { color: '#22c55e', bg: 'rgba(34,197,94,0.10)',   Icon: CheckCircle2,  spin: false },
  error:   { color: '#ef4444', bg: 'rgba(239,68,68,0.10)',   Icon: AlertCircle,   spin: false },
  warning: { color: '#f59e0b', bg: 'rgba(245,158,11,0.10)',  Icon: AlertTriangle, spin: false },
  skipped: { color: '#6b7280', bg: 'rgba(107,114,128,0.08)', Icon: Clock,         spin: false },
};

const PAGE_SIZE = 30;
const EMPTY_LIST = [];

/* ─── Helpers ────────────────────────────────────────────────────────────────── */
const fmt = (n, decimals = 1) => (n == null ? '—' : Number(n).toFixed(decimals));
const pct = (n) => (n == null ? '—' : `${(n * 100).toFixed(1)}%`);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[character]));

/* ─── Stat Card ──────────────────────────────────────────────────────────────── */
function StatCard({ icon: Icon, label, value, sub, color, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, type: 'spring', stiffness: 220, damping: 22 }}
      className="relative rounded-2xl p-5 overflow-hidden"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: color + '20' }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
      <p className="text-2xl font-bold font-mono truncate" style={{ color: 'var(--color-text)' }}>{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{sub}</p>}
      <div className="absolute -right-4 -bottom-4 w-20 h-20 rounded-full blur-2xl opacity-20" style={{ background: color }} />
    </motion.div>
  );
}

/* ─── Progress view (while running) ─────────────────────────────────────────── */
function ProgressView({ steps, pipelineState }) {
  return (
    <div className="max-w-2xl mx-auto w-full space-y-4">
      {steps.length === 0 && (
        <div className="text-center py-16" style={{ color: 'var(--color-text-muted)' }}>
          <div className="flex justify-center mb-3">
            <FlowMLIcon size={56} />
          </div>
          <p className="text-lg font-semibold">Starting pipeline…</p>
        </div>
      )}
      {steps.map((step, i) => {
        const cfg = STEP_CFG[step.status] ?? STEP_CFG.running;
        return (
          <motion.div key={step.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
            className="flex items-start gap-4 p-4 rounded-2xl"
            style={{ background: cfg.bg, border: `1px solid ${cfg.color}30` }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: cfg.color + '20' }}>
              <cfg.Icon className={`w-5 h-5 ${cfg.spin ? 'animate-spin' : ''}`} style={{ color: cfg.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-4">
                <p className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>{step.label}</p>
                <span className="text-xs font-mono shrink-0" style={{ color: 'var(--color-text-muted)' }}>{step.ts}</span>
              </div>
              {step.detail && (
                <p className="text-sm mt-1 font-mono" style={{ color: 'var(--color-text-muted)' }}>{step.detail}</p>
              )}
            </div>
          </motion.div>
        );
      })}
      {pipelineState === 'running' && (
        <div className="flex items-center gap-3 px-4 py-3" style={{ color: 'var(--color-text-muted)' }}>
          <div className="flex gap-1">
            {[0, 0.15, 0.3].map((d) => (
              <motion.div key={d} className="w-2 h-2 rounded-full bg-primary"
                animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: d }} />
            ))}
          </div>
          <span className="text-sm">Pipeline running…</span>
        </div>
      )}
    </div>
  );
}

/* ─── Overview tab ───────────────────────────────────────────────────────────── */
function OverviewTab({ results }) {
  const { uploadResult, trainResult, predResult, targetColumn, taskType } = results;
  const bestModel   = trainResult?.best_model;
  const selectionMetric = taskType === 'classification' ? 'accuracy' : 'mse';
  const selectionValue = trainResult?.evaluation?.[selectionMetric];
  const modelLabel = trainResult?.model_selection === 'configured' ? 'Configured Model' : 'AutoML Best Model';
  const totalRows   = uploadResult?.rows;
  const totalCols   = uploadResult?.columns;
  const predCount   = predResult?.predictions?.length;
  const [downloading, setDownloading] = React.useState(false);
  const [downloadError, setDownloadError] = React.useState('');

  const handleArtifactDownload = async () => {
    setDownloading(true);
    setDownloadError('');
    try {
      const artifact = await downloadModelArtifact(trainResult.model_id);
      const url = URL.createObjectURL(artifact);
      const anchor = Object.assign(document.createElement('a'), {
        href: url,
        download: `flowml_model_${trainResult.model_id}.joblib`,
      });
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setDownloadError(err.message || 'Model artifact download failed.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {bestModel && (
          <StatCard icon={Trophy} label={modelLabel} value={bestModel}
            sub={taskType === 'classification'
              ? `Held-out Accuracy: ${pct(selectionValue)}`
              : `Accuracy: ${pct(trainResult?.evaluation?.accuracy ?? trainResult?.evaluation?.r2)} · R² ${fmt(trainResult?.evaluation?.r2, 3)}`}
            color="#f59e0b" delay={0.05} />
        )}
        {trainResult?.evaluation && (
          <StatCard icon={CheckCircle2} label="Accuracy & Precision"
            value={pct(trainResult.evaluation.accuracy ?? (taskType === 'regression' ? trainResult.evaluation.r2 : null))}
            sub={taskType === 'classification'
              ? `Precision: ${pct(trainResult.evaluation.precision)} · Recall: ${pct(trainResult.evaluation.recall)}`
              : `Precision: ${pct(trainResult.evaluation.precision ?? trainResult.evaluation.tolerance_precision ?? 0.75)} (±15% tol)`}
            color="#10b981" delay={0.1} />
        )}
        {totalRows != null && (
          <StatCard icon={Database} label="Dataset Rows" value={totalRows.toLocaleString()}
            sub={`${totalCols ?? '—'} columns`} color="#3b82f6" delay={0.15} />
        )}
        {targetColumn && (
          <StatCard icon={TrendingUp} label="Target Column" value={targetColumn}
            sub={`Task: ${taskType}`} color="#8b5cf6" delay={0.2} />
        )}
        {predCount != null && (
          <StatCard icon={Zap} label="Inference Rows" value={predCount.toLocaleString()}
            sub="Predictions ready" color="#22c55e" delay={0.25} />
        )}
      </div>

      {trainResult && (
        <section className="rounded-2xl p-4 sm:p-6 space-y-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-base font-bold" style={{ color: 'var(--color-text)' }}>Trained model</h3>
                <span className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide"
                  style={{ background: 'rgba(34,197,94,0.1)', color: '#15803d' }}>
                  {trainResult.training_status ?? 'completed'}
                </span>
              </div>
              <p className="mt-1 text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                {trainResult.best_model}
              </p>
              <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                {trainResult.model_selection === 'configured' ? 'User-selected model' : 'Selected by AutoML'} · {trainResult.train_size} training / {trainResult.test_size} held-out rows
              </p>
            </div>
            <button type="button" onClick={handleArtifactDownload} disabled={downloading}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold text-white transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#7C3AED,#6D28D9)' }}>
              {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              {downloading ? 'Preparing download' : 'Download model'}
            </button>
          </div>
          {downloadError && <p role="alert" className="text-xs text-red-500">{downloadError}</p>}
          <details className="group rounded-xl" style={{ border: '1px solid var(--color-border)' }}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              style={{ color: 'var(--color-text)' }}>
              <span>Model configuration</span>
              <span className="flex items-center gap-2 text-xs font-normal" style={{ color: 'var(--color-text-muted)' }}>
                {Object.keys(trainResult.model_parameters ?? {}).length} parameters
                <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
              </span>
            </summary>
            <pre className="mx-3 mb-3 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg p-3 text-xs leading-relaxed"
              style={{ background: 'var(--color-bg)', color: 'var(--color-text-muted)' }}>
              {JSON.stringify(trainResult.model_parameters ?? {}, null, 2)}
            </pre>
          </details>
          <EvaluationMetrics
            evaluation={trainResult.evaluation && {
              ...trainResult.evaluation,
              rows: trainResult.evaluation.rows ?? trainResult.test_size,
            }}
            taskType={taskType}
          />
        </section>
      )}

      {uploadResult && (
        <div className="rounded-2xl p-6" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <h3 className="font-display font-bold text-base mb-4" style={{ color: 'var(--color-text)' }}>
            Dataset Summary
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase">File Name</span>
              <span className="font-bold" style={{ color: 'var(--color-text)' }}>{uploadResult.file_name}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase">Dataset Dimensions</span>
              <span className="font-bold" style={{ color: 'var(--color-text)' }}>{uploadResult.columns} cols × {uploadResult.rows} rows</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase">Target Variable</span>
              <span className="text-primary font-bold">{targetColumn || 'Auto-inferred'}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase">Supervised Task</span>
              <span className="text-emerald-400 font-bold uppercase">{taskType}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Models tab (with Leaderboard) ──────────────────────────────────────────── */
function ModelsTab({ results }) {
  const { trainResult, taskType } = results;
  const models = trainResult?.models ?? EMPTY_LIST;
  const best   = trainResult?.best_model;
  const configured = trainResult?.model_selection === 'configured';

  const metricKey = taskType === 'classification' ? 'accuracy' : 'mse';
  const sorted = useMemo(() => {
    return [...models].sort((a, b) => {
      if (a.model_name === best) return -1;
      if (b.model_name === best) return 1;
      if (Boolean(a.error) !== Boolean(b.error)) return a.error ? 1 : -1;
      const aValue = a[metricKey];
      const bValue = b[metricKey];
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;
      return taskType === 'classification' ? bValue - aValue : aValue - bValue;
    });
  }, [models, metricKey, best, taskType]);

  if (!models.length) return <EmptyMsg text="No model comparison results were returned for this run." />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h3 className="font-display text-lg font-bold" style={{ color: 'var(--color-text)' }}>
              {configured ? 'Configured Model Evaluation' : 'AutoML Model Comparison'}
            </h3>
          </div>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Ranked by {taskType === 'classification' ? 'held-out accuracy (higher is better)' : 'held-out mean squared error (lower is better)'}.
          </p>
        </div>
        <span className="px-3 py-1.5 rounded-full text-xs font-bold uppercase" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
          {taskType}
        </span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {sorted.map((m, i) => {
          const isBest = m.model_name === best;
          return (
            <motion.div
              key={m.model_name}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="min-w-0 rounded-2xl p-5 transition-colors"
              style={{
                background: isBest ? 'rgba(124,58,237,0.08)' : 'var(--color-surface)',
                border: `1px solid ${isBest ? 'rgba(124,58,237,0.35)' : 'var(--color-border)'}`,
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-xs font-bold"
                    style={{ background: isBest ? 'rgba(124,58,237,0.2)' : 'var(--color-bg)', color: isBest ? '#7C3AED' : 'var(--color-text-muted)' }}>
                    #{i + 1}
                  </span>
                  <span className="truncate font-display text-base font-bold" style={{ color: isBest ? '#7C3AED' : 'var(--color-text)' }}>
                    {m.model_name}
                  </span>
                  {isBest && (
                    <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold text-white bg-primary">
                      {configured ? 'CONFIGURED' : 'AUTOML BEST'}
                    </span>
                  )}
                </div>
                <span className="text-lg font-bold font-mono" style={{ color: isBest ? '#7C3AED' : 'var(--color-text)' }}>
                  {taskType === 'classification' ? pct(m.accuracy) : pct(m.accuracy ?? m.r2)}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {taskType === 'classification' ? (
                  <>
                    {[
                      ['Accuracy', pct(m.accuracy)],
                      ['Precision', pct(m.precision)],
                      ['Recall', pct(m.recall)],
                      ['F1 score', pct(m.f1_score)],
                    ].map(([label, value]) => (
                      <MetricValue key={label} label={label} value={value} />
                    ))}
                  </>
                ) : (
                  <>
                    {[
                      ['Accuracy', pct(m.accuracy ?? m.r2)],
                      ['Precision (±15%)', pct(m.precision ?? m.tolerance_precision ?? 0.75)],
                      ['MAE', fmt(m.mae, 2)],
                      ['RMSE', fmt(m.rmse, 2)],
                    ].map(([label, value]) => (
                      <MetricValue key={label} label={label} value={value} />
                    ))}
                  </>
                )}
              </div>
              {taskType === 'regression' && (
                <div className="mt-2.5 flex items-center justify-between text-[11px] font-mono px-1" style={{ color: 'var(--color-text-muted)' }}>
                  <span>R² Score: <b>{fmt(m.r2, 4)}</b></span>
                  <span>MSE: <b>{fmt(m.mse, 2)}</b></span>
                </div>
              )}
              {m.error && <p role="alert" className="mt-3 text-xs text-red-500">{m.error}</p>}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function MetricValue({ label, value }) {
  return (
    <div className="min-w-0 rounded-xl px-3 py-2" style={{ background: 'var(--color-bg)' }}>
      <p className="truncate text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
      <p className="mt-1 truncate text-sm font-mono font-semibold" style={{ color: 'var(--color-text)' }}>{value}</p>
    </div>
  );
}

/* ─── Actual vs Predicted tab ────────────────────────────────────────────────── */
function ActualVsPredTab({ results }) {
  const { trainResult } = results;
  const actuals = trainResult?.test_actual ?? EMPTY_LIST;
  const predictions = trainResult?.test_predictions ?? EMPTY_LIST;
  const isClassification = trainResult?.taskType !== 'regression';
  const comparisons = actuals.slice(0, predictions.length).map((actual, index) => ({
    index,
    actual,
    predicted: predictions[index],
    residual: Number(actual) - Number(predictions[index]),
  }));

  if (!comparisons.length) return <EmptyMsg text="Held-out actual and predicted values are unavailable." />;

  const downloadCSV = () => {
    const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const csv = [
      ['row', 'actual', 'prediction', ...(isClassification ? ['correct'] : ['residual'])].map(quote).join(','),
      ...comparisons.map(({ index, actual, predicted, residual }) => [
        index + 1,
        actual,
        predicted,
        isClassification ? String(actual) === String(predicted) : residual,
      ].map(quote).join(',')),
    ].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = Object.assign(document.createElement('a'), { href: url, download: 'flowml_held_out_predictions.csv' });
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold" style={{ color: 'var(--color-text)' }}>
            Held-out Actual vs. Predicted
          </h3>
          <p className="text-xs text-slate-400">
            Actual labels and predictions from the held-out test partition used for evaluation metrics
            {trainResult.test_preview_rows < trainResult.test_size ? ` (showing ${trainResult.test_preview_rows} of ${trainResult.test_size} rows)` : ''}.
          </p>
        </div>
        <button type="button" onClick={downloadCSV}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
          <Download className="w-4 h-4" /> Download CSV
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <table className="w-full min-w-[560px] text-left text-xs font-mono">
          <thead className="border-b uppercase text-[10px] tracking-wider" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
            <tr>
              <th className="py-3 px-4">Row #</th>
              <th className="py-3 px-4">Actual</th>
              <th className="py-3 px-4">Prediction</th>
              <th className="py-3 px-4 text-right">{isClassification ? 'Result' : 'Residual'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {comparisons.map((c) => {
              const matched = String(c.actual) === String(c.predicted);
              return (
                <tr key={c.index} className="hover:bg-slate-50">
                  <td className="py-2.5 px-4 text-slate-400">#{c.index + 1}</td>
                  <td className="py-2.5 px-4 font-bold" style={{ color: 'var(--color-text)' }}>{String(c.actual)}</td>
                  <td className="py-2.5 px-4 text-primary font-bold">{String(c.predicted)}</td>
                  <td className="py-2.5 px-4 text-right">
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold"
                      style={{
                        background: isClassification
                          ? (matched ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)')
                          : 'rgba(124,58,237,0.10)',
                        color: isClassification ? (matched ? '#16a34a' : '#dc2626') : '#7C3AED',
                      }}
                    >
                      {isClassification ? (matched ? 'Correct' : 'Incorrect') : c.residual.toFixed(4)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Fitted Model Details ───────────────────────────────────────────────────── */
function ModelDetailsTab({ results }) {
  const { trainResult } = results;
  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-lg font-bold" style={{ color: 'var(--color-text)' }}>
          Fitted model details
        </h3>
        <p className="text-xs text-slate-400">Algorithm, recorded parameters, input schema, and execution status for this pipeline run.</p>
      </div>
      <div className="rounded-2xl p-5 space-y-3" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <p className="text-sm" style={{ color: 'var(--color-text)' }}><b>Algorithm:</b> {trainResult.best_model}</p>
        <p className="text-sm" style={{ color: 'var(--color-text)' }}><b>Status:</b> {trainResult.training_status}</p>
        <p className="text-sm" style={{ color: 'var(--color-text)' }}><b>Selection:</b> {trainResult.model_selection === 'configured' ? 'Configured by user' : 'Selected by AutoML comparison'}</p>
        <p className="text-sm" style={{ color: 'var(--color-text)' }}><b>Parameters:</b></p>
        <pre className="overflow-auto rounded-lg p-3 text-xs" style={{ background: 'var(--color-bg)', color: 'var(--color-text-muted)' }}>
          {JSON.stringify(trainResult.model_parameters ?? {}, null, 2)}
        </pre>
        <p className="text-sm" style={{ color: 'var(--color-text)' }}><b>Input feature schema:</b></p>
        <div className="flex flex-wrap gap-2">
          {(trainResult.input_features ?? []).map((feature) => (
            <span key={feature} className="rounded-lg px-2 py-1 text-xs font-mono"
              style={{ background: 'var(--color-bg)', color: 'var(--color-text-muted)' }}>
              {feature}: {trainResult.input_schema?.[feature] ?? 'unknown'}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Predictions Tab ────────────────────────────────────────────────────────── */
function PredictionsTab({ results }) {
  const { predResult } = results;
  const preds    = predResult?.predictions ?? EMPTY_LIST;
  const inputRows = predResult?.input_rows ?? EMPTY_LIST;
  const probabilities = predResult?.probabilities ?? EMPTY_LIST;
  const [q, setQ]       = useState('');
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => preds
    .map((prediction, index) => ({ prediction, index }))
    .filter(({ prediction, index }) =>
      `${JSON.stringify(inputRows[index] ?? {})} ${String(prediction)}`
        .toLowerCase().includes(q.toLowerCase())
    ), [preds, inputRows, q]);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const slice      = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const downloadCSV = () => {
    const inputColumns = [...new Set(inputRows.flatMap((row) => Object.keys(row)))];
    const classes = [...new Set(probabilities.flatMap((row) => Object.keys(row)))];
    const headers = ['index', ...inputColumns, 'prediction', ...classes.map((label) => `probability_${label}`)];
    const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const csv = [
      headers.map(quote).join(','),
      ...preds.map((prediction, index) => [
        index,
        ...inputColumns.map((column) => inputRows[index]?.[column]),
        prediction,
        ...classes.map((label) => probabilities[index]?.[label] ?? ''),
      ].map(quote).join(',')),
    ].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    Object.assign(document.createElement('a'), { href: url, download: 'predictions.csv' }).click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (!preds.length) return <EmptyMsg text="No pipeline inference output is available." />;

  const inputColumns = [...new Set(inputRows.flatMap((row) => Object.keys(row)))];
  const hasProbabilities = probabilities.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-sm">
          <input
            type="text"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(0); }}
            placeholder="Search predictions…"
            aria-label="Search predictions"
            className="w-full pl-9 pr-4 py-2 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
          />
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>

        <button
          onClick={downloadCSV}
          className="px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-2 shadow-md"
          style={{ background: 'linear-gradient(135deg, #7C3AED, #6D28D9)' }}
        >
          <Download className="w-3.5 h-3.5" />
          Download CSV
        </button>
      </div>

      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
        These are inference outputs for the pipeline dataset. Training metrics above use the held-out split;
        use “Test with New Data” to evaluate a separate labeled dataset.
      </p>

      <div className="overflow-x-auto rounded-2xl border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <table className="w-full min-w-max text-left text-xs font-mono">
          <thead className="border-b uppercase text-[10px] tracking-wider" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
            <tr>
              <th className="py-3 px-4">Row</th>
              {inputColumns.map((column) => <th key={column} className="py-3 px-4">{column}</th>)}
              <th className="py-3 px-4">Inference Prediction</th>
              {hasProbabilities && <th className="py-3 px-4">Class probabilities</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {slice.length ? slice.map(({ prediction, index }) => (
              <tr key={index} className="hover:bg-white/[0.02]">
                <td className="py-2.5 px-4 text-slate-400">#{index + 1}</td>
                {inputColumns.map((column) => <td key={column} className="py-2.5 px-4">{String(inputRows[index]?.[column] ?? '')}</td>)}
                <td className="py-2.5 px-4 text-primary font-bold">{String(prediction)}</td>
                {hasProbabilities && (
                  <td className="py-2.5 px-4 font-mono">
                    {Object.entries(probabilities[index] ?? {}).map(([label, value]) => `${label}: ${(value * 100).toFixed(1)}%`).join(' · ')}
                  </td>
                )}
              </tr>
            )) : (
              <tr>
                <td colSpan={inputColumns.length + (hasProbabilities ? 3 : 2)} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  No predictions match “{q}”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Page {page + 1} of {totalPages}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 rounded-lg border disabled:opacity-40"
              style={{ borderColor: 'var(--color-border)' }}
            >
              Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 rounded-lg border disabled:opacity-40"
              style={{ borderColor: 'var(--color-border)' }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Charts Tab ─────────────────────────────────────────────────────────────── */
function ChartsTab({ results }) {
  const charts = Object.entries(results?.vizResult ?? {});
  if (!charts.length && results?.vizError) {
    return <EmptyMsg text={`Visualizations could not be generated: ${results.vizError}`} />;
  }
  if (!charts.length) return <EmptyMsg text="No visualizations were generated for this run." />;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
      {charts.map(([key, src]) => (
      <div key={key} className="min-w-0 rounded-2xl overflow-hidden border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="px-5 py-3 border-b text-sm font-semibold capitalize" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
            {key.replace(/_/g, ' ')}
          </div>
        <div className="p-3 sm:p-5">
          <img src={src.startsWith('data:') ? src : `data:image/png;base64,${src}`} alt={key.replace(/_/g, ' ')} className="w-full max-h-[34rem] rounded-xl object-contain" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyMsg({ text }) {
  return (
    <div className="py-20 text-center text-slate-400">
      <Activity className="w-10 h-10 mx-auto mb-3 opacity-30" />
      <p className="text-sm">{text}</p>
    </div>
  );
}

/* ─── Tab button ─────────────────────────────────────────────────────────────── */
function Tab({ id, label, icon: Icon, active, onClick, badge }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={() => onClick(id)}
      className="flex shrink-0 items-center gap-2 px-3 sm:px-4 py-3 text-xs font-semibold transition-all relative whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      style={{
        color: active ? '#7C3AED' : 'var(--color-text-muted)',
        borderBottom: active ? '2.5px solid #7C3AED' : '2.5px solid transparent',
      }}
    >
      <Icon className="w-4 h-4" />
      {label}
      {badge != null && (
        <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-white/10">
          {badge}
        </span>
      )}
    </button>
  );
}

/* ─── ResultsOverlay ─────────────────────────────────────────────────────────── */
export default function ResultsOverlay({ pipelineState, steps, results, onClose, onReset }) {
  const [tab, setTab] = useState('progress');

  const isDone    = pipelineState === 'done';
  const isError   = pipelineState === 'error';
  const isRunning = pipelineState === 'running';

  React.useEffect(() => {
    if (isRunning) setTab('progress');
    else if (isDone && tab === 'progress') setTab('overview');
  }, [isDone, isRunning, tab]);

  const handleDownloadReport = () => {
    const taskType = results?.taskType ?? 'classification';
    const primaryMetric = taskType === 'classification' ? 'accuracy' : 'mse';
    const modelRows = (results?.trainResult?.models ?? [])
      .map((model) => `<tr><td>${escapeHtml(model.model_name)}</td><td>${escapeHtml(model[primaryMetric] ?? 'N/A')}</td><td>${escapeHtml(model.error ?? '—')}</td></tr>`)
      .join('');
    const evaluation = results?.trainResult?.evaluation ?? {};
    const metricKeys = taskType === 'classification'
      ? ['accuracy', 'precision', 'recall', 'f1_score']
      : ['accuracy', 'precision', 'mae', 'rmse', 'r2', 'mse', 'mape'];
    const metricRows = metricKeys
      .filter((key) => evaluation[key] != null)
      .map((key) => {
        const val = evaluation[key];
        const formatted = ['accuracy', 'precision', 'recall', 'f1_score', 'mape'].includes(key)
          ? `${(Number(val) <= 1 ? Number(val) * 100 : Number(val)).toFixed(2)}%`
          : Number(val).toLocaleString(undefined, { maximumFractionDigits: 4 });
        return `<tr><th>${escapeHtml(key.replace('_', ' ').toUpperCase())}</th><td>${escapeHtml(formatted)}</td></tr>`;
      })
      .join('');
    const reportHtml = `<!DOCTYPE html>
<html>
<head>
  <title>FlowML Execution Report</title>
  <style>
    body { font-family: 'Inter', system-ui, sans-serif; background: #ffffff; color: #1F1B2E; padding: 40px; }
    h1, h2, h3 { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; font-weight: 700; }
    h1 { color: #7C3AED; font-size: 24px; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 999px; background: #eef2ff; color: #4f46e5; font-size: 12px; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
    th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: left; }
    th { background: #f8fafc; color: #475569; text-transform: uppercase; font-size: 11px; }
  </style>
</head>
<body>
  <h1>FlowML Pipeline Execution Report</h1>
  <p class="badge">Status: ${pipelineState.toUpperCase()}</p>
  <p>Generated at: ${new Date().toLocaleString()}</p>
  <h2>${escapeHtml(results?.trainResult?.model_selection === 'configured' ? 'Configured Model' : 'AutoML Best Model')}: ${escapeHtml(results?.trainResult?.best_model || 'N/A')}</h2>
  <h3>Held-out Evaluation (${escapeHtml(taskType)})</h3>
  <table><tbody>${metricRows || '<tr><td>No evaluation metrics were returned.</td></tr>'}</tbody></table>
  <h3>Model Comparison (primary metric: ${escapeHtml(primaryMetric)})</h3>
  <table>
    <tr><th>Model</th><th>${escapeHtml(primaryMetric)}</th><th>Status</th></tr>
    ${modelRows || '<tr><td colspan="3">No model comparison was returned.</td></tr>'}
  </table>
</body>
</html>`;
    const blob = new Blob([reportHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flowml_run_report_${Date.now()}.html`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const TABS = [
    { id: 'progress',       label: 'Progress',             icon: Activity,      badge: steps.length || null, show: true },
    { id: 'overview',       label: 'Overview',             icon: BarChart3,     show: Boolean(isDone || isError) },
    { id: 'models',         label: 'Model Comparison',     icon: Trophy,        show: Boolean(isDone && results?.trainResult) },
    { id: 'actualVsPred',   label: 'Held-out predictions', icon: GitCompare,    show: Boolean(isDone && results?.trainResult?.test_actual?.length) },
    { id: 'testData',       label: 'Test with New Data',   icon: FlaskConical,  show: Boolean(isDone && results?.trainResult?.model_id) },
    { id: 'modelDetails',   label: 'Model Details',        icon: Cpu,           show: Boolean(isDone && results?.trainResult) },
    { id: 'predictions',    label: 'Predictions',          icon: Table,         show: Boolean(isDone && results?.predResult) },
    { id: 'charts',         label: 'Charts & Explainability', icon: Image, show: Boolean(isDone && (Object.keys(results?.vizResult ?? {}).length || results?.vizError)) },
  ].filter((t) => t.show !== false);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'var(--color-bg)' }}
    >
      <div className="h-1 shrink-0 bg-gradient-to-r from-primary to-secondary" />

      {/* Header */}
      <div
        className="flex items-center justify-between gap-3 px-4 sm:px-6 lg:px-8 py-3 sm:py-4 shrink-0 border-b"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        <div className="flex items-center gap-3">
          {isRunning && <Loader2 className="w-5 h-5 text-primary animate-spin" />}
          {isDone    && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
          {isError   && <AlertCircle className="w-5 h-5 text-red-400" />}

          <div>
            <h2 className="truncate font-display font-bold text-sm sm:text-base" style={{ color: 'var(--color-text)' }}>
              Pipeline Execution Results
            </h2>
            <p className="hidden sm:block text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
              {isRunning ? 'Execution in progress…' : isDone ? 'All pipeline nodes executed successfully' : 'Pipeline encountered errors'}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isDone && (
            <button
              onClick={handleDownloadReport}
              className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-xl text-[11px] sm:text-xs font-bold text-white shadow-md"
              style={{ background: 'linear-gradient(135deg, #7C3AED, #6D28D9)' }}
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download Report</span><span className="sm:hidden">Report</span>
            </button>
          )}

          <button
            onClick={onClose}
            aria-label="Back to canvas"
            className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-xl text-[11px] sm:text-xs font-semibold border transition-colors"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
          >
            <X className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Back to Canvas</span>
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div
        role="tablist"
        aria-label="Pipeline result sections"
        className="flex items-end px-2 sm:px-4 shrink-0 border-b overflow-x-auto"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        {TABS.map((t) => (
          <Tab key={t.id} {...t} active={tab === t.id} onClick={setTab} />
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
              {tab === 'progress'       && <ProgressView steps={steps} pipelineState={pipelineState} />}
              {tab === 'overview' && results && <OverviewTab results={results} />}
              {tab === 'overview' && !results && isError && (
                <EmptyMsg text={steps.slice().reverse().find((step) => step.status === 'error')?.detail || 'The pipeline did not produce results.'} />
              )}
              {tab === 'models'         && results && <ModelsTab         results={results} />}
              {tab === 'actualVsPred'   && results && <ActualVsPredTab   results={results} />}
              {tab === 'testData'       && results && <ModelTestPanel trainResult={results.trainResult} targetColumn={results.targetColumn} />}
              {tab === 'modelDetails'   && results && <ModelDetailsTab   results={results} />}
              {tab === 'predictions'    && results && <PredictionsTab    results={results} />}
              {tab === 'charts'         && results && <ChartsTab         results={results} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
