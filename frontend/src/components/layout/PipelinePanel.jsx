/**
 * PipelinePanel.jsx
 * Right-side inspector panel for configuring individual nodes.
 * Supports data cleaning, preprocessing, models, AI decision, and outputs.
 */
import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Upload, Database, Wrench, Layers, FileText, Zap,
  CheckCircle2, AlertCircle, Loader2, Settings, Info,
  CopyCheck, SlidersHorizontal, GitFork, Users, Divide, Shapes,
  BrainCircuit, FlaskConical, Code, Play, Terminal,
  Link2, Globe, ExternalLink,
} from 'lucide-react';
import { uploadDataset, uploadDatasetFromUrl, runPythonCode } from '../../services/api';

/* ─── Node type groups ───────────────────────────────────────────────────────── */
const UPLOAD_TYPES     = ['upload', 'loadCsv', 'preview'];
const PREPROCESS_TYPES = ['fillMissing', 'encode', 'scale', 'removeDuplicates', 'selectColumns', 'splitData'];
const MODEL_TYPES      = ['randomForest', 'linearRegression', 'decisionTree', 'logisticRegression', 'knn', 'svm', 'kmeans'];
const AI_TYPES         = ['aiDecision', 'explainableAi'];
const OUTPUT_TYPES     = ['prediction', 'report'];

const TYPE_META = {
  // Data
  upload:             { label: 'Upload Dataset',       color: '#3b82f6', Icon: Database },
  loadCsv:            { label: 'Load CSV',              color: '#0ea5e9', Icon: Database },
  preview:            { label: 'Preview Dataset',       color: '#06b6d4', Icon: Database },
  removeDuplicates:   { label: 'Remove Duplicates',     color: '#0284c7', Icon: CopyCheck },
  selectColumns:      { label: 'Select Columns',        color: '#0369a1', Icon: SlidersHorizontal },

  // Preprocessing
  fillMissing:        { label: 'Fill Missing',          color: '#8b5cf6', Icon: Wrench  },
  encode:             { label: 'Encode Labels',         color: '#a855f7', Icon: Wrench  },
  scale:              { label: 'Scale Features',        color: '#d946ef', Icon: Wrench  },
  splitData:          { label: 'Split Train/Test',      color: '#7c3aed', Icon: GitFork },
  customPython:       { label: 'Custom Python',         color: '#7C3AED', Icon: Code    },

  // Models
  randomForest:       { label: 'Random Forest',         color: '#f59e0b', Icon: Layers  },
  linearRegression:   { label: 'Linear Regression',     color: '#f97316', Icon: Layers  },
  decisionTree:       { label: 'Decision Tree',         color: '#ef4444', Icon: Layers  },
  logisticRegression: { label: 'Logistic Regression',   color: '#ea580c', Icon: Layers  },
  knn:                { label: 'K-Nearest Neighbors',   color: '#d97706', Icon: Users   },
  svm:                { label: 'Support Vector Machine',color: '#b45309', Icon: Divide  },
  kmeans:             { label: 'K-Means Clustering',    color: '#059669', Icon: Shapes  },

  // AI & Outputs
  aiDecision:         { label: 'AI Decision',           color: '#22c55e', Icon: BrainCircuit },
  explainableAi:      { label: 'Explainable AI',        color: '#10b981', Icon: FlaskConical },
  prediction:         { label: 'Prediction Output',     color: '#ec4899', Icon: Zap      },
  report:             { label: 'Report',                color: '#f43f5e', Icon: FileText },
};

/* ─── Field wrapper ──────────────────────────────────────────────────────────── */
const Field = ({ label, children, hint }) => (
  <div className="space-y-1.5">
    <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
      {label}
    </label>
    {children}
    {hint && <p className="text-[9px]" style={{ color: 'var(--color-text-muted)' }}>{hint}</p>}
  </div>
);

/* ─── Select ─────────────────────────────────────────────────────────────────── */
const Sel = ({ value, onChange, options }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className="w-full px-3 py-2 rounded-xl text-xs focus:outline-none transition-colors appearance-none"
    style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
  >
    {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
  </select>
);

const ColumnSelection = ({ columns, value, onChange, automatic, onAutomaticChange }) => (
  <div className="space-y-2">
    <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text)' }}>
      <input
        type="checkbox"
        checked={automatic}
        onChange={(e) => onAutomaticChange(e.target.checked)}
        className="accent-violet-600"
      />
      Automatic (all applicable columns)
    </label>
    {!automatic && (
      <>
        <select
          multiple
          size={Math.min(Math.max(columns.length, 3), 6)}
          value={value}
          onChange={(e) => onChange(Array.from(e.target.selectedOptions, (option) => option.value))}
          className="w-full px-3 py-2 rounded-xl text-xs focus:outline-none"
          style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
          aria-label="Choose columns"
        >
          {columns.map((column) => <option key={column} value={column}>{column}</option>)}
        </select>
        {!columns.length && (
          <p className="text-[9px]" style={{ color: 'var(--color-text-muted)' }}>
            Upload a dataset to choose columns.
          </p>
        )}
      </>
    )}
  </div>
);

/* ─── Status message ─────────────────────────────────────────────────────────── */
const Msg = ({ type, text }) => {
  const cfg = {
    success: { bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.25)',  color: '#22c55e', Icon: CheckCircle2 },
    error:   { bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.25)',  color: '#ef4444', Icon: AlertCircle  },
    info:    { bg: 'rgba(124,58,237,0.08)', border: 'rgba(124,58,237,0.25)', color: '#7C3AED', Icon: Info         },
    loading: { bg: 'rgba(124,58,237,0.08)', border: 'rgba(124,58,237,0.25)', color: '#7C3AED', Icon: Loader2      },
  };
  const c = cfg[type] ?? cfg.info;
  return (
    <div className="flex items-start gap-2 p-3 rounded-xl text-xs" style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.color }}>
      <c.Icon className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${type === 'loading' ? 'animate-spin' : ''}`} />
      <span>{text}</span>
    </div>
  );
};

/* ─── Upload Config Panel ────────────────────────────────────────────────────── */
function UploadConfig({ node, onUpdate }) {
  const [tab, setTab] = useState(node.data.dataset_url ? 'link' : 'file');
  const [uploading, setUploading] = useState(false);
  const [linkUrl, setLinkUrl] = useState(node.data.dataset_url || '');
  const [importingLink, setImportingLink] = useState(false);
  const [msg, setMsg] = useState(null);
  const fileRef = useRef(null);
  const fileName = node.data.file_name;

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMsg({ type: 'loading', text: `Uploading "${file.name}"…` });
    try {
      const r = await uploadDataset(file);
      onUpdate(node.id, {
        dataset_id: r.dataset_id,
        file_name: r.file_name,
        _uploadedFile: null,
        _info: r,
        validationError: null,
      });
      setMsg({ type: 'success', text: `✓ "${r.file_name}" — ${r.rows?.toLocaleString()} rows · ${r.columns} cols` });
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleLinkImport = async (e) => {
    e?.preventDefault();
    const cleanUrl = linkUrl.trim();
    if (!cleanUrl) return;

    setImportingLink(true);
    setMsg({ type: 'loading', text: `Fetching dataset from link…` });
    try {
      const r = await uploadDatasetFromUrl(cleanUrl);
      onUpdate(node.id, {
        dataset_id: r.dataset_id,
        file_name: r.file_name,
        dataset_url: cleanUrl,
        _uploadedFile: null,
        _info: r,
        validationError: null,
      });
      setMsg({ type: 'success', text: `✓ "${r.file_name}" — ${r.rows?.toLocaleString()} rows · ${r.columns} cols` });
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setImportingLink(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Mode Switch Tabs */}
      <div className="flex p-1 rounded-xl" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
        <button
          type="button"
          onClick={() => setTab('link')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
            tab === 'link' ? 'bg-primary text-white shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Link2 className="w-3.5 h-3.5" />
          GitHub / Kaggle Link
        </button>
        <button
          type="button"
          onClick={() => setTab('file')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
            tab === 'file' ? 'bg-primary text-white shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Upload className="w-3.5 h-3.5" />
          Local File
        </button>
      </div>

      {tab === 'link' ? (
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-bold mb-1" style={{ color: 'var(--color-text)' }}>
              Dataset URL (GitHub, Kaggle, Web)
            </label>
            <div className="relative">
              <Globe className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://github.com/... or https://www.kaggle.com/datasets/..."
                className="w-full pl-8 pr-3 py-2 rounded-xl text-xs font-mono border outline-none transition-all focus:border-primary"
                style={{
                  background: 'var(--color-bg)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text)',
                }}
              />
            </div>
          </div>

          {/* Quick presets */}
          <div>
            <p className="text-[9px] uppercase font-bold text-slate-400 mb-1 tracking-wider">Quick Presets</p>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => {
                  const url = 'https://github.com/datasciencedojo/datasets/blob/master/titanic.csv';
                  setLinkUrl(url);
                }}
                className="px-2 py-0.5 rounded text-[10px] border text-slate-300 hover:text-white hover:border-primary transition-all"
                style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
              >
                Titanic (GitHub)
              </button>
              <button
                type="button"
                onClick={() => {
                  const url = 'https://raw.githubusercontent.com/mwaskom/seaborn-data/master/iris.csv';
                  setLinkUrl(url);
                }}
                className="px-2 py-0.5 rounded text-[10px] border text-slate-300 hover:text-white hover:border-primary transition-all"
                style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
              >
                Iris (GitHub)
              </button>
              <button
                type="button"
                onClick={() => {
                  const url = 'https://www.kaggle.com/datasets/heptapod/titanic';
                  setLinkUrl(url);
                }}
                className="px-2 py-0.5 rounded text-[10px] border text-slate-300 hover:text-white hover:border-primary transition-all"
                style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
              >
                Titanic (Kaggle)
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLinkImport}
            disabled={!linkUrl.trim() || importingLink}
            className="w-full py-2 rounded-xl text-xs font-bold text-white shadow-md disabled:opacity-50 flex items-center justify-center gap-2 transition-all hover:opacity-95"
            style={{ background: 'linear-gradient(135deg, #7C3AED, #6D28D9)' }}
          >
            {importingLink ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Accessing Dataset Link…
              </>
            ) : (
              <>
                <ExternalLink className="w-3.5 h-3.5" />
                Access & Load Dataset
              </>
            )}
          </button>
        </div>
      ) : (
        <div
          className="border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all"
          style={{ borderColor: uploading ? '#7C3AED' : 'var(--color-border)' }}
          onClick={() => fileRef.current?.click()}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#7C3AED')}
          onMouseLeave={(e) => { if (!uploading) e.currentTarget.style.borderColor = 'var(--color-border)'; }}
        >
          {fileName ? (
            <div>
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text)' }}>{fileName}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Click to replace file</p>
            </div>
          ) : (
            <div>
              <Upload className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
              <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                {uploading ? 'Uploading…' : 'Click to attach dataset'}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>CSV, XLSX, XLS supported</p>
            </div>
          )}
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.tsv,.txt,*" className="hidden" onChange={handleFile} />
        </div>
      )}

      {/* Info Badge if Dataset is Attached */}
      {fileName && (
        <div className="p-2.5 rounded-xl border flex items-center justify-between" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}>
          <div className="flex items-center gap-2 truncate">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-xs font-mono font-semibold truncate" style={{ color: 'var(--color-text)' }}>{fileName}</span>
          </div>
          <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
            Attached
          </span>
        </div>
      )}

      <AnimatePresence>
        {msg && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><Msg {...msg} /></motion.div>}
      </AnimatePresence>

      {node.data._info && (
        <div className="grid grid-cols-2 gap-2">
          {[['Rows', node.data._info.rows?.toLocaleString()], ['Columns', node.data._info.columns]].map(([l, v]) => (
            <div key={l} className="p-3 rounded-xl text-center" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
              <p className="text-xs font-bold" style={{ color: 'var(--color-text)' }}>{v ?? '—'}</p>
              <p className="text-[9px] uppercase tracking-widest mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{l}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Preprocess Config Panel ────────────────────────────────────────────────── */
function PreprocessConfig({ node, onUpdate, columns }) {
  const d = node.data;
  const up = (k, v) => onUpdate(node.id, { [k]: v, validationError: null });

  if (node.type === 'removeDuplicates') {
    return (
      <div className="space-y-4">
        <Msg type="info" text="Scans dataset rows and eliminates identical duplicate observations." />
        <Field label="Keep Strategy">
          <Sel value={d.keep ?? 'first'} onChange={(v) => up('keep', v)} options={[
            ['first', 'Keep First Occurrence'],
            ['last',  'Keep Last Occurrence'],
          ]} />
        </Field>
        <Field label="Compare Columns">
          <ColumnSelection
            columns={columns}
            value={d.duplicate_columns ?? []}
            onChange={(v) => up('duplicate_columns', v)}
            automatic={d.duplicate_columns_auto ?? true}
            onAutomaticChange={(v) => up('duplicate_columns_auto', v)}
          />
        </Field>
      </div>
    );
  }

  if (node.type === 'selectColumns') {
    return (
      <div className="space-y-4">
        <Msg type="info" text="Specify which feature columns to retain in the downstream pipeline." />
        <Field label="Columns to Keep">
          <ColumnSelection
            columns={columns}
            value={Array.isArray(d.selected_columns) ? d.selected_columns : (d.selected_columns || '').split(',').map((c) => c.trim()).filter(Boolean)}
            onChange={(v) => up('selected_columns', v)}
            automatic={d.selected_columns_auto ?? !d.selected_columns?.length}
            onAutomaticChange={(v) => up('selected_columns_auto', v)}
          />
        </Field>
      </div>
    );
  }

  if (node.type === 'splitData') {
    return (
      <div className="space-y-4">
        <Msg type="info" text="Partitions dataset into Training and Evaluation validation splits." />
        <Field label="Holdout Test Ratio">
          <Sel value={d.test_size ?? '0.2'} onChange={(v) => up('test_size', v)} options={[
            ['0.15', '15% Test (85% Train)'],
            ['0.2',  '20% Test (80% Train)'],
            ['0.25', '25% Test (75% Train)'],
            ['0.3',  '30% Test (70% Train)'],
          ]} />
        </Field>
        <Field label="Random Seed (Reproducibility)">
          <input
            type="number"
            value={d.random_state ?? 42}
            onChange={(e) => {
              const value = Number.parseInt(e.target.value, 10);
              up('random_state', Number.isNaN(value) ? 42 : value);
            }}
            className="w-full px-3 py-2 rounded-xl text-xs focus:outline-none"
            style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
          />
        </Field>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {node.type === 'fillMissing' && (
        <>
          <Field label="Missing Value Strategy">
            <Sel value={d.missing_values ?? 'mean'} onChange={(v) => up('missing_values', v)} options={[
              ['mean', 'Mean (Numeric columns)'],
              ['median', 'Median (Skewed data)'],
              ['most_frequent', 'Mode (Categorical)'],
              ['constant', 'Constant Fill (0 / "missing")'],
              ['drop', 'Drop Rows with Missing Values'],
            ]} />
          </Field>
          <Field label="Columns to Impute">
            <ColumnSelection
              columns={columns}
              value={d.missing_value_columns ?? []}
              onChange={(v) => up('missing_value_columns', v)}
              automatic={d.missing_value_columns_auto ?? true}
              onAutomaticChange={(v) => up('missing_value_columns_auto', v)}
            />
          </Field>
        </>
      )}

      {node.type === 'encode' && (
        <>
          <Field label="Categorical Encoding">
            <Sel value={d.categorical_encoding ?? 'label'} onChange={(v) => up('categorical_encoding', v)} options={[
              ['label', 'Label Encoding (Integer IDs)'],
              ['onehot', 'One-Hot Encoding (Binary vectors)'],
            ]} />
          </Field>
          <Field label="Columns to Encode">
            <ColumnSelection
              columns={columns}
              value={d.encoding_columns ?? []}
              onChange={(v) => up('encoding_columns', v)}
              automatic={d.encoding_columns_auto ?? true}
              onAutomaticChange={(v) => up('encoding_columns_auto', v)}
            />
          </Field>
        </>
      )}

      {node.type === 'scale' && (
        <Field label="Feature Normalization">
          <Sel value={d.scaling ?? 'standard'} onChange={(v) => up('scaling', v)} options={[
            ['standard', 'StandardScaler (Mean=0, Std=1)'],
            ['minmax', 'MinMaxScaler (Range [0, 1])'],
            ['robust', 'RobustScaler (Outlier-resilient)'],
          ]} />
        </Field>
      )}
      {node.type === 'scale' && (
        <Field label="Columns to Scale">
          <ColumnSelection
            columns={columns}
            value={d.scaling_columns ?? []}
            onChange={(v) => up('scaling_columns', v)}
            automatic={d.scaling_columns_auto ?? true}
            onAutomaticChange={(v) => up('scaling_columns_auto', v)}
          />
        </Field>
      )}
    </div>
  );
}

/* ─── Model Config Panel ─────────────────────────────────────────────────────── */
function ModelConfig({ node, onUpdate, columns }) {
  const d = node.data;
  const up = (k, v) => onUpdate(node.id, { [k]: v, validationError: null });

  return (
    <div className="space-y-4">
      <Msg type="info" text={`Configuring estimator hyper-parameters for ${TYPE_META[node.type]?.label || 'Model'}.`} />

      {node.type === 'randomForest' && (
        <>
          <Field label="Number of Trees (n_estimators)">
            <Sel value={d.n_estimators ?? '100'} onChange={(v) => up('n_estimators', v)} options={[
              ['50', '50 Estimators'],
              ['100', '100 Estimators (Default)'],
              ['200', '200 Estimators'],
            ]} />
          </Field>
          <Field label="Max Tree Depth">
            <Sel value={d.max_depth ?? '10'} onChange={(v) => up('max_depth', v)} options={[
              ['5', 'Shallow (Depth = 5)'],
              ['10', 'Balanced (Depth = 10)'],
              ['20', 'Deep (Depth = 20)'],
            ]} />
          </Field>
        </>
      )}

      {node.type === 'logisticRegression' && (
        <>
          <Field label="Inverse Regularization (C)">
            <Sel value={d.C ?? '1.0'} onChange={(v) => up('C', v)} options={[
              ['0.1', '0.1 (Strong regularization)'],
              ['1.0', '1.0 (Default)'],
              ['10.0', '10.0 (Weak regularization)'],
            ]} />
          </Field>
          <Field label="Solver Algorithm">
            <Sel value={d.solver ?? 'lbfgs'} onChange={(v) => up('solver', v)} options={[
              ['lbfgs', 'lbfgs (Quasi-Newton)'],
              ['liblinear', 'liblinear (Small datasets)'],
            ]} />
          </Field>
        </>
      )}

      {node.type === 'knn' && (
        <Field label="K Neighbors Count">
          <Sel value={d.n_neighbors ?? '5'} onChange={(v) => up('n_neighbors', v)} options={[
            ['3', '3 Neighbors'],
            ['5', '5 Neighbors (Default)'],
            ['9', '9 Neighbors'],
          ]} />
        </Field>
      )}

      {node.type === 'svm' && (
        <Field label="Kernel Function">
          <Sel value={d.kernel ?? 'rbf'} onChange={(v) => up('kernel', v)} options={[
            ['rbf', 'Radial Basis (RBF)'],
            ['linear', 'Linear Hyperplane'],
            ['poly', 'Polynomial'],
          ]} />
        </Field>
      )}

      {node.type === 'kmeans' && (
        <Field label="Number of Clusters (k)">
          <Sel value={d.n_clusters ?? '4'} onChange={(v) => up('n_clusters', v)} options={[
            ['2', '2 Clusters'],
            ['3', '3 Clusters'],
            ['4', '4 Clusters (Default)'],
            ['5', '5 Clusters'],
            ['8', '8 Clusters'],
          ]} />
        </Field>
      )}

      {/* Target Column Override */}
      <Field label="Target Column" hint="Automatic uses the target detected from your dataset">
        <Sel
          value={d.target_column ?? ''}
          onChange={(v) => up('target_column', v || null)}
          options={[['', 'Automatic'], ...columns.map((column) => [column, column])]}
        />
      </Field>

      {/* Supervised Task Type Override */}
      <Field label="Task Type" hint="Specify regression for numeric outputs or classification for discrete labels">
        <Sel
          value={d.task_type ?? ''}
          onChange={(v) => up('task_type', v || null)}
          options={[
            ['', 'Automatic (Auto-detect)'],
            ['regression', 'Regression (Continuous: Price, Income, Quantity)'],
            ['classification', 'Classification (Discrete classes / Categories)'],
          ]}
        />
      </Field>
    </div>
  );
}

/* ─── AI Config Panel ────────────────────────────────────────────────────────── */
function AIConfig({ node, onUpdate }) {
  const d = node.data;
  const up = (k, v) => onUpdate(node.id, { [k]: v, validationError: null });

  if (node.type === 'aiDecision') {
    return (
      <div className="space-y-4">
        <Msg type="info" text="Autonomous AutoML reasoning selects best model architectures & parameters." />
        <Field label="Optimization Goal">
          <Sel value={d.optimize_metric ?? 'accuracy'} onChange={(v) => up('optimize_metric', v)} options={[
            ['accuracy', 'Accuracy Score'],
            ['f1', 'Balanced F1 Score'],
            ['r2', 'R² Score (Regression)'],
          ]} />
        </Field>
        <Field label="Time Budget Limit">
          <Sel value={d.time_budget ?? '30'} onChange={(v) => up('time_budget', v)} options={[
            ['15', '15 Seconds'],
            ['30', '30 Seconds (Default)'],
            ['60', '60 Seconds'],
          ]} />
        </Field>
      </div>
    );
  }

  // explainableAi
  return (
    <div className="space-y-4">
      <Msg type="info" text="Computes SHAP feature importance attribution and model interpretability maps." />
      <Field label="Attribution Algorithm">
        <Sel value={d.method ?? 'shap'} onChange={(v) => up('method', v)} options={[
          ['shap', 'TreeSHAP / KernelSHAP'],
          ['permutation', 'Permutation Importance'],
        ]} />
      </Field>
      <Field label="Top Features Count">
        <Sel value={d.top_k ?? '10'} onChange={(v) => up('top_k', v)} options={[
          ['5', 'Top 5 Features'],
          ['10', 'Top 10 Features (Default)'],
          ['20', 'Top 20 Features'],
        ]} />
      </Field>
    </div>
  );
}

/* ─── Output & Report Config Panel ───────────────────────────────────────────── */
function OutputConfig({ node, onUpdate }) {
  const d = node.data;
  const up = (k, v) => onUpdate(node.id, { [k]: v, validationError: null });

  if (node.type === 'report') {
    return (
      <div className="space-y-4">
        <Msg type="info" text="Compiles complete pipeline execution audit report." />
        <Field label="Report Document Title">
          <input
            type="text"
            value={d.reportTitle ?? 'FlowML Model Validation Report'}
            onChange={(e) => up('reportTitle', e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-xs focus:outline-none"
            style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
          />
        </Field>
        <Field label="Export Format">
          <Sel value={d.format ?? 'html'} onChange={(v) => up('format', v)} options={[
            ['html', 'Interactive Web HTML'],
            ['pdf', 'PDF Document'],
            ['json', 'Machine-Readable JSON'],
          ]} />
        </Field>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Msg type="info" text="Predictions run automatically during pipeline execution. Results appear in the Results overlay." />
      <div className="p-4 rounded-2xl space-y-2" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
        {['Leaderboard Benchmarks', 'Prediction Table', 'Actual vs Predicted', 'Download CSV'].map((f) => (
          <div key={f} className="flex items-center gap-2 text-xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span style={{ color: 'var(--color-text)' }}>{f}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Custom Python Config Panel ─────────────────────────────────────────────── */
function CustomPythonConfig({ node, onUpdate }) {
  const d = node.data;
  const up = (k, v) => onUpdate(node.id, { [k]: v, validationError: null });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const TEMPLATES = [
    {
      label: 'Log-Transform Numeric Features',
      code: `# Transform skewed numerical features using np.log1p
import numpy as np

num_cols = df.select_dtypes(include=[np.number]).columns
for col in num_cols:
    if (df[col] >= 0).all():
        df[col + '_log'] = np.log1p(df[col])

print(f"Log transformed columns. New shape: {df.shape}")
`
    },
    {
      label: 'Outlier Removal (IQR Rule)',
      code: `# Filter outlier rows across numeric columns
import numpy as np

numeric_df = df.select_dtypes(include=[np.number])
if not numeric_df.empty:
    Q1 = numeric_df.quantile(0.25)
    Q3 = numeric_df.quantile(0.75)
    IQR = Q3 - Q1
    outlier_mask = ~((numeric_df < (Q1 - 1.5 * IQR)) | (numeric_df > (Q3 + 1.5 * IQR))).any(axis=1)
    df = df[outlier_mask].copy()

print(f"Cleaned outliers. Retained rows: {len(df)}")
`
    },
    {
      label: 'Feature Engineering (Interaction Terms)',
      code: `# Create polynomial or interaction features
import numpy as np

num_cols = list(df.select_dtypes(include=[np.number]).columns)
if len(num_cols) >= 2:
    col1, col2 = num_cols[0], num_cols[1]
    df[f"{col1}_x_{col2}"] = df[col1] * df[col2]
    print(f"Generated interaction feature: {col1}_x_{col2}")
`
    },
    {
      label: 'Drop High Null Columns',
      code: `# Drop features with more than 40% missing data
threshold = 0.40
cols_to_drop = [c for c in df.columns if df[c].isna().mean() > threshold]
df.drop(columns=cols_to_drop, inplace=True)
print(f"Dropped {len(cols_to_drop)} columns exceeding {threshold*100}% nulls: {cols_to_drop}")
`
    }
  ];

  const handleTestRun = async () => {
    if (!d.code?.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await runPythonCode({
        code: d.code,
        timeout: parseInt(d.timeout || 15)
      });
      setTestResult(res);
    } catch (err) {
      setTestResult({
        status: 'failed',
        stderr: err?.response?.data?.detail || err.message
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Msg
        type="info"
        text="Transforms the upstream DataFrame in an isolated sandbox. Input DataFrame is provided as 'df'."
      />

      {d.validationError && (
        <Msg type="error" text={d.validationError} />
      )}

      {/* Starter Template */}
      <Field label="Starter Code Snippet">
        <select
          onChange={(e) => {
            const idx = parseInt(e.target.value);
            if (!isNaN(idx) && TEMPLATES[idx]) {
              up('code', TEMPLATES[idx].code);
            }
          }}
          defaultValue=""
          className="w-full px-3 py-2 rounded-xl text-xs focus:outline-none appearance-none"
          style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
        >
          <option value="" disabled>Load a transformation template…</option>
          {TEMPLATES.map((t, idx) => (
            <option key={idx} value={idx}>{t.label}</option>
          ))}
        </select>
      </Field>

      {/* Code Area */}
      <Field label="Python Script (df in → df out)" hint="Libraries available: numpy, pandas, matplotlib, scikit-learn">
        <textarea
          rows={11}
          value={d.code ?? '# Transform upstream df\n# Example:\ndf["sample_col"] = df.iloc[:, 0] * 10\nprint("Transformed df:", df.shape)\n'}
          onChange={(e) => up('code', e.target.value)}
          placeholder="Enter Python code here..."
          className="w-full p-3 rounded-xl font-mono text-xs focus:outline-none resize-y leading-relaxed"
          style={{
            background: 'rgba(15, 23, 42, 0.75)',
            border: '1px solid var(--color-border)',
            color: '#a5f3fc'
          }}
        />
      </Field>

      {/* Timeout & Settings */}
      <Field label="Execution Timeout (Seconds)">
        <input
          type="number"
          min={5}
          max={60}
          value={d.timeout ?? 15}
          onChange={(e) => up('timeout', Math.max(5, parseInt(e.target.value) || 15))}
          className="w-full px-3 py-2 rounded-xl text-xs focus:outline-none"
          style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
        />
      </Field>

      {/* Test Sandbox Run */}
      <div className="pt-2">
        <button
          onClick={handleTestRun}
          disabled={testing || !d.code?.trim()}
          className="w-full py-2.5 px-3 rounded-xl font-bold text-xs text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          style={{
            background: 'linear-gradient(135deg, #7C3AED, #6D28D9)',
            boxShadow: '0 4px 12px rgba(124, 58, 237, 0.25)'
          }}
        >
          {testing ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Executing in Sandbox…
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              Test Run Sandbox Code
            </>
          )}
        </button>
      </div>

      {/* Inline Test Output */}
      {testResult && (
        <div
          className="p-3 rounded-xl text-xs space-y-2 border"
          style={{
            background: testResult.status === 'completed' ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)',
            borderColor: testResult.status === 'completed' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)',
          }}
        >
          <div className="flex items-center justify-between font-bold text-[10px] uppercase tracking-wider">
            <span style={{ color: testResult.status === 'completed' ? '#22c55e' : '#ef4444' }}>
              Status: {testResult.status} {testResult.duration_ms ? `(${testResult.duration_ms}ms)` : ''}
            </span>
          </div>
          {testResult.stdout && (
            <pre className="p-2 rounded bg-black/40 font-mono text-[10px] text-emerald-300 max-h-32 overflow-auto whitespace-pre-wrap">
              {testResult.stdout}
            </pre>
          )}
          {(testResult.stderr || testResult.traceback) && (
            <pre className="p-2 rounded bg-black/40 font-mono text-[10px] text-red-400 max-h-32 overflow-auto whitespace-pre-wrap">
              {testResult.stderr || testResult.traceback}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Main PipelinePanel ─────────────────────────────────────────────────────── */
export default function PipelinePanel({ node, onClose, onUpdateNodeData, columns = [] }) {
  const meta = TYPE_META[node.type] ?? { label: node.data.label ?? node.type, color: '#7C3AED', Icon: Settings };
  const { Icon, color } = meta;

  const renderContent = () => {
    if (UPLOAD_TYPES.includes(node.type))     return <UploadConfig     node={node} onUpdate={onUpdateNodeData} />;
    if (PREPROCESS_TYPES.includes(node.type)) return <PreprocessConfig  node={node} onUpdate={onUpdateNodeData} columns={columns} />;
    if (node.type === 'customPython')         return <CustomPythonConfig node={node} onUpdate={onUpdateNodeData} />;
    if (MODEL_TYPES.includes(node.type))      return <ModelConfig       node={node} onUpdate={onUpdateNodeData} columns={columns} />;
    if (AI_TYPES.includes(node.type))         return <AIConfig          node={node} onUpdate={onUpdateNodeData} />;
    if (OUTPUT_TYPES.includes(node.type))     return <OutputConfig      node={node} onUpdate={onUpdateNodeData} />;
    return <p className="text-xs text-slate-400">Configure parameters for this node.</p>;
  };

  return (
    <motion.div
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      className="w-80 shrink-0 flex flex-col h-full overflow-hidden z-30"
      style={{ background: 'var(--color-surface)', borderLeft: '1px solid var(--color-border)' }}
    >
      <div className="h-0.5 w-full" style={{ background: color }} />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: color + '18' }}>
            <Icon className="w-4 h-4" style={{ color }} />
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Configure Node</p>
            <p className="text-sm font-bold truncate max-w-[170px]" style={{ color: 'var(--color-text)' }}>{meta.label}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-400 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4">
        {renderContent()}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t text-[10px] font-mono text-center text-slate-500" style={{ borderColor: 'var(--color-border)' }}>
        Node ID: {node.id}
      </div>
    </motion.div>
  );
}
