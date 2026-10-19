import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { listModels, deleteModel } from '../../services/api';
import {
  Search, Trash2, Play, Sparkles, RefreshCw,
  Award, Database, Clock, ChevronRight, AlertTriangle, X,
  CheckCircle2, Loader2, Gauge, Zap,
} from 'lucide-react';
import FlowMLIcon from '../../components/FlowMLIcon';

export default function ModelsView() {
  const { showToast } = useOutletContext();
  const navigate = useNavigate();

  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchModels = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listModels();
      setModels(Array.isArray(data) ? data : []);
    } catch (err) {
      setModels([]);
      setError(err.message || 'Unable to load models. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModels();
  }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteModel(deleteTarget.model_id);
      showToast('Model artifact deleted.', 'info');
      setModels((prev) => prev.filter((m) => m.model_id !== deleteTarget.model_id));
    } catch (err) {
      showToast(err.message || 'Failed to delete model.', 'error');
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleLaunchStudio = () => {
    navigate('/studio');
  };

  const filtered = models.filter((m) => {
    const q = search.toLowerCase();
    return (
      (m.algorithm && m.algorithm.toLowerCase().includes(q)) ||
      (m.dataset_id && m.dataset_id.toLowerCase().includes(q)) ||
      (m.model_id && m.model_id.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-[-0.02em] leading-tight" style={{ color: 'var(--color-text)' }}>
            Model Registry
          </h1>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Trained scikit-learn estimators, evaluation metrics, version snapshots, and deployment artifacts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchModels}
            disabled={loading}
            className="p-2.5 rounded-xl border text-slate-400 hover:text-white transition-colors"
            style={{
              borderColor: 'var(--color-border)',
              background: 'var(--color-surface)',
            }}
            title="Refresh models"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleLaunchStudio}
            className="px-4 py-2.5 rounded-xl font-bold text-xs text-white flex items-center gap-2 shadow-lg transition-all active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #7C3AED, #6D28D9)',
              boxShadow: '0 4px 16px rgba(124, 58, 237, 0.35)',
            }}
          >
            <Sparkles className="w-4 h-4" />
            Train New Model
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search models by algorithm or dataset…"
            className="w-full pl-9 pr-4 py-2 rounded-xl text-xs transition-all focus:outline-none focus:ring-1 focus:ring-primary"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
            }}
          />
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>
        <div className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>
          {filtered.length} trained models
        </div>
      </div>

      {/* Grid */}
      {error ? (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 flex items-center justify-between gap-4">
          <span>{error}</span>
          <button onClick={fetchModels} className="font-semibold underline">Retry</button>
        </div>
      ) : loading ? (
        <div className="p-16 flex flex-col items-center justify-center gap-3 text-slate-400">
          <FlowMLIcon size={56} />
          <p className="text-xs font-medium">Scanning model artifact store…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="rounded-3xl p-12 text-center border border-dashed flex flex-col items-center justify-center max-w-xl mx-auto my-8"
          style={{
            borderColor: 'var(--color-border)',
            background: 'var(--color-surface)',
          }}
        >
          <FlowMLIcon size={56} className="mb-4" />
          <h3 className="font-display font-semibold text-base mb-1" style={{ color: 'var(--color-text)' }}>
            No models found
          </h3>
          <p className="text-xs max-w-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
            Run a training workflow in the Studio Canvas to produce versioned models here.
          </p>
          <button
            onClick={handleLaunchStudio}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-2"
            style={{ background: 'linear-gradient(135deg, #7C3AED, #6D28D9)' }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Launch Studio Canvas
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((m) => {
            const isReg = m.task_type === 'regression';
            const primaryMetric = isReg
              ? { label: 'R² Score', val: m.r2 != null ? `${(m.r2 * 100).toFixed(1)}%` : '—' }
              : { label: 'Accuracy', val: m.accuracy != null ? `${(m.accuracy * 100).toFixed(1)}%` : '—' };

            return (
              <motion.div
                key={m.model_id}
                whileHover={{ y: -3 }}
                transition={{ duration: 0.2 }}
                className="rounded-2xl p-5 border flex flex-col justify-between transition-all group"
                style={{
                  background: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                }}
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0"
                        style={{
                          background: isReg ? 'rgba(249, 115, 22, 0.15)' : 'rgba(124, 58, 237, 0.15)',
                          color: isReg ? '#f97316' : '#7C3AED',
                        }}
                      >
                        <Zap className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-display font-semibold text-sm tracking-tight" style={{ color: 'var(--color-text)' }}>
                          {m.algorithm}
                        </h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-mono px-2 py-0.2 rounded-full font-bold bg-white/5 border border-white/10" style={{ color: 'var(--color-text-muted)' }}>
                            {m.version || '—'}
                          </span>
                          <span
                            className="text-[10px] font-mono font-semibold uppercase"
                            style={{ color: isReg ? '#f97316' : '#7C3AED' }}
                          >
                            {m.task_type || 'Classification'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setDeleteTarget(m)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Dataset Source */}
                  <div className="flex items-center gap-2 text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
                    <Database className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{m.dataset_id || 'Uploaded Dataset'}</span>
                  </div>

                  {/* Performance Badges */}
                  <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl border mb-2" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}>
                    <div>
                      <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                        {primaryMetric.label}
                      </div>
                      <div className="font-mono font-bold text-sm text-emerald-400 mt-0.5">
                        {primaryMetric.val}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                        Artifacts
                      </div>
                      <div className="font-mono text-xs text-slate-300 mt-0.5">
                        {m.artifacts?.length ?? 0} saved
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-4 pt-3.5 border-t flex items-center justify-between text-[11px]" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Clock className="w-3 h-3" />
                    <span>{m.created ? new Date(m.created).toLocaleDateString() : '—'}</span>
                  </div>

                  <button
                    onClick={handleLaunchStudio}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-primary hover:bg-primary/10 flex items-center gap-1 transition-colors"
                  >
                    Open Studio
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm rounded-3xl p-6 shadow-2xl relative text-center"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
              }}
            >
              <div className="w-12 h-12 rounded-2xl mx-auto mb-4 bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="font-display font-semibold text-base mb-1" style={{ color: 'var(--color-text)' }}>
                Delete Model?
              </h3>
              <p className="text-xs leading-relaxed mb-6" style={{ color: 'var(--color-text-muted)' }}>
                Are you sure you want to delete <span className="font-bold text-white">"{deleteTarget.algorithm}"</span> ({deleteTarget.model_id})? This will permanently remove the serialized estimator binaries.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-red-500 hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
                >
                  Delete Model
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
