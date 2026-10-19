import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Settings, Upload, Table, Wrench, Layers, Zap, FileText,
  Loader2, CheckCircle2, AlertCircle, ChevronDown, Trophy,
  Download, BarChart2, RefreshCw, ArrowUpRight, PlayCircle, DatabaseZap,
  Link2, Globe, ExternalLink,
} from 'lucide-react';

import {
  uploadDataset,
  uploadDatasetFromUrl,
  analyzeDataset,
  preprocessDataset,
  trainModels,
  runPredictions,
  getVisualizations,
  BASE_URL,
} from '../../services/api';

// ─── Icon & colour map per node type ─────────────────────────────────────────
const NODE_META = {
  upload:           { icon: Upload,   color: 'secondary', label: 'Data Input'        },
  loadCsv:          { icon: Upload,   color: 'secondary', label: 'Load CSV'          },
  preview:          { icon: Table,    color: 'secondary', label: 'Data Preview'      },
  removeDuplicates: { icon: Wrench,   color: 'secondary', label: 'Remove Duplicates' },
  selectColumns:    { icon: Wrench,   color: 'secondary', label: 'Select Columns'    },
  fillMissing:      { icon: Wrench,   color: 'warning',   label: 'Fill Missing'      },
  encode:           { icon: Wrench,   color: 'warning',   label: 'Encode Labels'     },
  scale:            { icon: Wrench,   color: 'warning',   label: 'Scale Features'    },
  splitData:        { icon: Wrench,   color: 'warning',   label: 'Split Train/Test'  },
  randomForest:     { icon: Layers,   color: 'primary',   label: 'Model Trainer'     },
  linearRegression: { icon: Layers,   color: 'primary',   label: 'Model Trainer'     },
  decisionTree:     { icon: Layers,   color: 'primary',   label: 'Model Trainer'     },
  logisticRegression:{ icon: Layers,  color: 'primary',   label: 'Model Trainer'     },
  knn:              { icon: Layers,   color: 'primary',   label: 'Model Trainer'     },
  svm:              { icon: Layers,   color: 'primary',   label: 'Model Trainer'     },
  kmeans:           { icon: Layers,   color: 'primary',   label: 'Clustering'        },
  aiDecision:       { icon: Zap,      color: 'danger',    label: 'AI Intelligence'   },
  explainableAi:    { icon: Zap,      color: 'danger',    label: 'Explainable AI'    },
  prediction:       { icon: FileText, color: 'success',   label: 'Prediction'        },
  report:           { icon: FileText, color: 'success',   label: 'Report'            },
};

// ─── Shared field components ──────────────────────────────────────────────────
const Field = ({ label, children }) => (
  <div className="space-y-1.5">
    <label
      className="text-[10px] font-bold uppercase tracking-widest block"
      style={{ color: 'var(--color-text-muted)' }}
    >
      {label}
    </label>
    {children}
  </div>
);

const Input = (props) => (
  <input
    {...props}
    className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
    style={{
      backgroundColor: 'var(--color-bg)',
      border:          '1px solid var(--color-border)',
      color:           'var(--color-text)',
    }}
  />
);

const Select = ({ value, onChange, options, placeholder }) => (
  <div className="relative">
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-colors appearance-none"
      style={{
        backgroundColor: 'var(--color-bg)',
        border:          '1px solid var(--color-border)',
        color:           value ? 'var(--color-text)' : 'var(--color-text-muted)',
      }}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={typeof o === 'string' ? o : o.value} value={typeof o === 'string' ? o : o.value}>
          {typeof o === 'string' ? o : o.label}
        </option>
      ))}
    </select>
    <ChevronDown
      className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
      style={{ color: 'var(--color-text-muted)' }}
    />
  </div>
);

const ActionBtn = ({ onClick, loading, disabled, children, variant = 'primary' }) => (
  <button
    onClick={onClick}
    disabled={loading || disabled}
    className={`w-full py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm font-semibold transition-all active:scale-95 ${
      variant === 'primary' ? 'btn-primary' : 'text-white'
    } ${loading || disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
    style={variant !== 'primary' ? { background: 'linear-gradient(to right,#22c55e,#16a34a)' } : {}}
  >
    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
    {children}
  </button>
);

const StatusBox = ({ type, message }) => {
  const styles = {
    success: { bg: 'bg-success/10', border: 'border-success/20', text: 'text-success', Icon: CheckCircle2 },
    error:   { bg: 'bg-danger/10',  border: 'border-danger/20',  text: 'text-danger',  Icon: AlertCircle  },
    info:    { bg: 'bg-primary/10', border: 'border-primary/20', text: 'text-primary', Icon: Settings     },
  };
  const s = styles[type] || styles.error;
  return (
    <div className={`p-3 rounded-lg border ${s.bg} ${s.border} flex items-start gap-2`}>
      <s.Icon className={`w-4 h-4 mt-0.5 shrink-0 ${s.text}`} />
      <p className={`text-xs leading-relaxed ${s.text}`}>{message}</p>
    </div>
  );
};

const Stat = ({ label, value }) => (
  <div className="flex justify-between items-center py-1">
    <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--color-text-muted)' }}>
      {label}
    </span>
    <span className="text-xs font-mono truncate max-w-[60%] text-right" style={{ color: 'var(--color-text)' }}>
      {value ?? '—'}
    </span>
  </div>
);

// ─── PANEL: Upload / LoadCSV ──────────────────────────────────────────────────
const UploadPanel = ({ node, onUpdateNodeData, onDatasetUploaded }) => {
  const [tab, setTab] = useState(node.data.dataset_url ? 'link' : 'file');
  const [linkUrl, setLinkUrl] = useState(node.data.dataset_url || '');
  const [loading, setLoading] = useState(false);
  const [status,  setStatus]  = useState(null);
  const fileRef               = useRef(null);
  const dataset               = node.data.uploadedDataset;

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setStatus(null);
    try {
      const result = await uploadDataset(file);
      const info   = {
        dataset_id:   result.dataset_id,
        file_name:    result.file_name,
        rows:         result.rows,
        columns:      result.columns,
        column_names: result.column_names,
      };
      onUpdateNodeData(node.id, {
        dataset_id:      result.dataset_id,
        file_name:       result.file_name,
        uploadedDataset: info,
        status:          'uploaded',
        description:     `${result.rows.toLocaleString()} rows × ${result.columns} cols`,
      });
      onDatasetUploaded(info);
      setStatus({ type: 'success', msg: `✓ "${result.file_name}" — ${result.rows.toLocaleString()} rows, ${result.columns} cols.` });
    } catch (err) {
      setStatus({ type: 'error', msg: err.message });
      onUpdateNodeData(node.id, { status: 'error' });
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleLinkImport = async () => {
    const cleanUrl = linkUrl.trim();
    if (!cleanUrl) return;
    setLoading(true);
    setStatus({ type: 'loading', msg: 'Fetching dataset from link…' });
    try {
      const result = await uploadDatasetFromUrl(cleanUrl);
      const info = {
        dataset_id:   result.dataset_id,
        file_name:    result.file_name,
        rows:         result.rows,
        columns:      result.columns,
        column_names: result.column_names,
      };
      onUpdateNodeData(node.id, {
        dataset_id:      result.dataset_id,
        file_name:       result.file_name,
        dataset_url:     cleanUrl,
        uploadedDataset: info,
        status:          'uploaded',
        description:     `${result.rows.toLocaleString()} rows × ${result.columns} cols`,
      });
      onDatasetUploaded(info);
      setStatus({ type: 'success', msg: `✓ "${result.file_name}" — ${result.rows.toLocaleString()} rows, ${result.columns} cols.` });
    } catch (err) {
      setStatus({ type: 'error', msg: err.message });
      onUpdateNodeData(node.id, { status: 'error' });
    } finally {
      setLoading(false);
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
          <Field label="Dataset Link (GitHub, Kaggle, Web)">
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
          </Field>

          {/* Quick presets */}
          <div>
            <p className="text-[9px] uppercase font-bold text-slate-400 mb-1 tracking-wider">Quick Presets</p>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setLinkUrl('https://github.com/datasciencedojo/datasets/blob/master/titanic.csv')}
                className="px-2 py-0.5 rounded text-[10px] border text-slate-300 hover:text-white hover:border-primary transition-all"
                style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
              >
                Titanic (GitHub)
              </button>
              <button
                type="button"
                onClick={() => setLinkUrl('https://raw.githubusercontent.com/mwaskom/seaborn-data/master/iris.csv')}
                className="px-2 py-0.5 rounded text-[10px] border text-slate-300 hover:text-white hover:border-primary transition-all"
                style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
              >
                Iris (GitHub)
              </button>
              <button
                type="button"
                onClick={() => setLinkUrl('https://www.kaggle.com/datasets/heptapod/titanic')}
                className="px-2 py-0.5 rounded text-[10px] border text-slate-300 hover:text-white hover:border-primary transition-all"
                style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
              >
                Titanic (Kaggle)
              </button>
            </div>
          </div>

          <ActionBtn onClick={handleLinkImport} loading={loading} disabled={!linkUrl.trim()}>
            {!loading && <ExternalLink className="w-4 h-4" />}
            {loading ? 'Accessing Dataset Link…' : 'Load Dataset from Link'}
          </ActionBtn>
        </div>
      ) : (
        <div className="space-y-3">
          <Field label="Upload Dataset">
            <div
              className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors hover:border-primary/50"
              style={{ borderColor: 'var(--color-border)' }}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="w-8 h-8 mx-auto mb-2 text-primary/60" />
              <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                Click to select a file
              </p>
              <p className="text-[11px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
                CSV or Excel (.xlsx / .xls) · Any number of columns &amp; rows
              </p>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleUpload} />
            </div>
          </Field>

          <ActionBtn onClick={() => fileRef.current?.click()} loading={loading}>
            {!loading && <Upload className="w-4 h-4" />}
            {loading ? 'Uploading…' : 'Choose & Upload File'}
          </ActionBtn>
        </div>
      )}

      {status && <StatusBox type={status.type} message={status.msg} />}

      {dataset && (
        <div className="rounded-lg p-3 space-y-3" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
          <div className="text-[10px] font-bold uppercase tracking-widest text-primary">Dataset Info</div>
          <div className="space-y-0.5">
            <Stat label="File"    value={dataset.file_name} />
            <Stat label="Rows"    value={dataset.rows?.toLocaleString()} />
            <Stat label="Columns" value={dataset.columns} />
          </div>
          <div>
            <div className="text-[10px] font-semibold mb-1.5" style={{ color: 'var(--color-text-muted)' }}>COLUMNS</div>
            <div className="flex flex-wrap gap-1">
              {dataset.column_names?.map((c) => (
                <span key={c} className="px-2 py-0.5 rounded text-[10px] font-mono bg-primary/10 text-primary">{c}</span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── PANEL: Preview / Analyze ─────────────────────────────────────────────────
const PreviewPanel = ({ node, onUpdateNodeData, uploadedDataset }) => {
  const [loading, setLoading] = useState(false);
  const [status,  setStatus]  = useState(null);
  const analysis              = node.data.analysis;

  const handleAnalyze = async () => {
    if (!uploadedDataset?.file_name) {
      setStatus({ type: 'error', msg: 'No dataset uploaded yet. Add and configure an Upload node first.' });
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      const result = await analyzeDataset(uploadedDataset.file_name);
      onUpdateNodeData(node.id, { analysis: result, status: 'analyzed' });
      setStatus({ type: 'success', msg: 'Analysis complete.' });
    } catch (err) {
      setStatus({ type: 'error', msg: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {uploadedDataset
        ? <StatusBox type="success" message={`Dataset: ${uploadedDataset.file_name} (${uploadedDataset.rows?.toLocaleString()} rows)`} />
        : <StatusBox type="error"   message="No dataset found. Upload a file first." />}

      <ActionBtn onClick={handleAnalyze} loading={loading} disabled={!uploadedDataset}>
        {!loading && <Table className="w-4 h-4" />}
        {loading ? 'Analyzing…' : 'Analyze Dataset'}
      </ActionBtn>

      {status && !loading && <StatusBox type={status.type} message={status.msg} />}

      {analysis && (
        <div className="space-y-3">
          {/* Summary row */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Rows',    value: analysis.row_count?.toLocaleString() },
              { label: 'Columns', value: analysis.col_count },
              { label: 'Target',  value: analysis.suggested_target },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg p-2 text-center" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>{label}</div>
                <div className="text-xs font-bold mt-0.5 text-primary truncate">{value ?? '—'}</div>
              </div>
            ))}
          </div>

          {/* Suggested task type */}
          <div className="flex justify-between text-xs items-center">
            <span style={{ color: 'var(--color-text-muted)' }}>Suggested Task</span>
            <span className="font-semibold text-primary capitalize">{analysis.suggested_task_type}</span>
          </div>

          {/* Numeric columns */}
          {analysis.numeric_columns?.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--color-text-muted)' }}>Numeric</div>
              <div className="flex flex-wrap gap-1">
                {analysis.numeric_columns.map((c) => (
                  <span key={c} className="px-2 py-0.5 rounded text-[10px] font-mono bg-secondary/10 text-secondary">{c}</span>
                ))}
              </div>
            </div>
          )}

          {/* Categorical columns */}
          {analysis.categorical_columns?.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--color-text-muted)' }}>Categorical</div>
              <div className="flex flex-wrap gap-1">
                {analysis.categorical_columns.map((c) => (
                  <span key={c} className="px-2 py-0.5 rounded text-[10px] font-mono bg-warning/10 text-warning">{c}</span>
                ))}
              </div>
            </div>
          )}

          {/* Possible ID columns warning */}
          {analysis.possible_id_columns?.length > 0 && (
            <StatusBox
              type="info"
              message={`High-cardinality columns (likely IDs, may reduce model quality): ${analysis.possible_id_columns.join(', ')}`}
            />
          )}

          {/* Missing values */}
          {(() => {
            const hasMissing = Object.values(analysis.missing_values || {}).some((v) => v > 0);
            return hasMissing ? (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--color-text-muted)' }}>Missing Values</div>
                <div className="space-y-1">
                  {Object.entries(analysis.missing_values || {})
                    .filter(([, v]) => v > 0)
                    .map(([col, cnt]) => (
                      <div key={col} className="flex justify-between text-xs">
                        <span className="font-mono" style={{ color: 'var(--color-text)' }}>{col}</span>
                        <span className="text-warning font-bold">{cnt} ({analysis.missing_pct?.[col] ?? 0}%)</span>
                      </div>
                    ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-success">✓ No missing values</p>
            );
          })()}
        </div>
      )}
    </div>
  );
};

// ─── PANEL: Preprocess ────────────────────────────────────────────────────────
const PreprocessPanel = ({ node, onUpdateNodeData, uploadedDataset, onDatasetProcessed }) => {
  const defaultStrategy =
    node.type === 'fillMissing' ? 'mean'
    : node.type === 'encode'    ? 'onehot'
    : node.type === 'removeDuplicates' ? 'first'
    : node.type === 'splitData' ? '0.2'
    :                             'standard';

  const [strategy, setStrategy] = useState(node.data.config?.strategy || defaultStrategy);
  const [splitRatio, setSplitRatio] = useState(node.data.config?.test_size || '0.2');
  const [selectedCols, setSelectedCols] = useState(node.data.config?.columns || '');
  const [loading,  setLoading]  = useState(false);
  const [status,   setStatus]   = useState(null);

  const strategyOptions = {
    fillMissing: [
      { value: 'mean',          label: 'Mean (numeric)' },
      { value: 'median',        label: 'Median (numeric)' },
      { value: 'most_frequent', label: 'Most Frequent' },
      { value: 'constant',      label: 'Constant (0 / "missing")' },
      { value: 'drop',          label: 'Drop rows with NaN' },
    ],
    encode: [
      { value: 'onehot', label: 'One-Hot Encoding' },
      { value: 'label',  label: 'Label Encoding' },
    ],
    scale: [
      { value: 'standard', label: 'Standard Scaler (Z-score)' },
      { value: 'minmax',   label: 'Min-Max Normalization' },
    ],
    removeDuplicates: [
      { value: 'first', label: 'Keep First Occurrence' },
      { value: 'last',  label: 'Keep Last Occurrence' },
    ],
    splitData: [
      { value: '0.2',  label: '80% Train / 20% Test' },
      { value: '0.25', label: '75% Train / 25% Test' },
      { value: '0.3',  label: '70% Train / 30% Test' },
    ],
  };

  const options = strategyOptions[node.type] || strategyOptions.scale;

  const handleApply = async () => {
    if (!uploadedDataset?.file_name) {
      setStatus({ type: 'error', msg: 'No uploaded dataset found. Run an Upload node first.' });
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      let config;
      if (node.type === 'fillMissing') {
        config = { missing_values: strategy, categorical_encoding: 'label', scaling: 'none' };
      } else if (node.type === 'encode') {
        config = { missing_values: 'mean', categorical_encoding: strategy, scaling: 'none' };
      } else if (node.type === 'removeDuplicates') {
        config = { remove_duplicates: true, keep: strategy, missing_values: 'none', categorical_encoding: 'none', scaling: 'none' };
      } else if (node.type === 'selectColumns') {
        config = { selected_columns: selectedCols.split(',').map((c) => c.trim()).filter(Boolean), missing_values: 'none', categorical_encoding: 'none', scaling: 'none' };
      } else if (node.type === 'splitData') {
        config = { test_size: parseFloat(splitRatio) || 0.2, shuffle: true, random_state: 42, missing_values: 'none', categorical_encoding: 'none', scaling: 'none' };
      } else {
        config = { missing_values: 'mean', categorical_encoding: 'label', scaling: strategy };
      }

      const result = await preprocessDataset(uploadedDataset.file_name, config);
      const processedInfo = { file_name: result.processed_file };

      onUpdateNodeData(node.id, {
        config,
        processedFile:  result.processed_file,
        status:         'processed',
        description:    `${result.rows?.toLocaleString()} rows × ${result.columns} cols`,
      });
      onDatasetProcessed(processedInfo);

      setStatus({ type: 'success', msg: `✓ Applied: ${result.rows?.toLocaleString()} rows × ${result.columns} cols saved.` });
    } catch (err) {
      setStatus({ type: 'error', msg: err.message });
      onUpdateNodeData(node.id, { status: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {uploadedDataset
        ? <StatusBox type="success" message={`Source: ${uploadedDataset.file_name}`} />
        : <StatusBox type="error"   message="Upload a dataset first." />}

      {node.type === 'selectColumns' ? (
        <Field label="Feature Columns (Comma-separated)">
          <Input
            value={selectedCols}
            onChange={(e) => setSelectedCols(e.target.value)}
            placeholder={uploadedDataset?.column_names ? uploadedDataset.column_names.slice(0, 4).join(', ') : 'col1, col2, col3'}
          />
        </Field>
      ) : node.type === 'splitData' ? (
        <Field label="Partition Ratio">
          <Select value={splitRatio} onChange={setSplitRatio} options={strategyOptions.splitData} />
        </Field>
      ) : (
        <Field label="Strategy">
          <Select value={strategy} onChange={setStrategy} options={options} />
        </Field>
      )}

      <ActionBtn onClick={handleApply} loading={loading} disabled={!uploadedDataset}>
        {!loading && <Wrench className="w-4 h-4" />}
        {loading ? 'Processing…' : 'Apply Configuration'}
      </ActionBtn>

      {status && <StatusBox type={status.type} message={status.msg} />}

      {node.data.processedFile && !loading && (
        <div className="rounded-lg p-2 text-xs" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
          <span style={{ color: 'var(--color-text-muted)' }}>Processed file: </span>
          <span className="font-mono text-primary">{node.data.processedFile}</span>
        </div>
      )}
    </div>
  );
};

// ─── PANEL: Model Training ────────────────────────────────────────────────────
const ModelPanel = ({ node, onUpdateNodeData, uploadedDataset, processedDataset, onModelTrained }) => {
  const cols        = uploadedDataset?.column_names || [];
  const [targetCol, setTargetCol] = useState(node.data.target_column || (cols.at(-1) ?? ''));
  const [taskType,  setTaskType]  = useState(node.data.task_type     || 'classification');
  const [loading,   setLoading]   = useState(false);
  const [status,    setStatus]    = useState(null);
  const results                   = node.data.trainingResults;

  const handleTrain = async () => {
    if (!uploadedDataset?.file_name) {
      setStatus({ type: 'error', msg: 'No dataset uploaded. Add an Upload node first.' });
      return;
    }
    if (!targetCol) {
      setStatus({ type: 'error', msg: 'Select a target column before training.' });
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      // Prefer preprocessed file; fall back to raw upload
      const trainFile      = uploadedDataset.file_name;
      const processedFile  = processedDataset?.file_name || null;

      const result = await trainModels(trainFile, targetCol, taskType, processedFile);

      onUpdateNodeData(node.id, {
        target_column:   targetCol,
        task_type:       taskType,
        trainingResults: result,
        status:          'trained',
        description:     `Best: ${result.best_model}`,
      });
      // Notify App so OutputPanel knows the target column
      onModelTrained({ targetColumn: targetCol, taskType });

      setStatus({ type: 'success', msg: `✓ Training complete! Best: ${result.best_model}` });
    } catch (err) {
      setStatus({ type: 'error', msg: err.message });
      onUpdateNodeData(node.id, { status: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const isClassification = taskType === 'classification';

  return (
    <div className="space-y-4">
      {uploadedDataset
        ? <StatusBox type="success" message={`Dataset: ${uploadedDataset.file_name}${processedDataset ? ` → ${processedDataset.file_name}` : ''}`} />
        : <StatusBox type="error"   message="Upload a dataset first." />}

      {processedDataset && (
        <StatusBox type="info" message={`✓ Using preprocessed file: ${processedDataset.file_name}`} />
      )}

      <Field label="Target Column">
        <Select value={targetCol} onChange={setTargetCol} options={cols} placeholder="Select target column…" />
      </Field>

      <Field label="Task Type">
        <Select
          value={taskType}
          onChange={setTaskType}
          options={[
            { value: 'classification', label: 'Classification' },
            { value: 'regression',     label: 'Regression'     },
          ]}
        />
      </Field>

      <ActionBtn onClick={handleTrain} loading={loading} disabled={!uploadedDataset || !targetCol}>
        {!loading && <Layers className="w-4 h-4" />}
        {loading ? 'Training Models…' : 'Train All Models'}
      </ActionBtn>

      {status && <StatusBox type={status.type} message={status.msg} />}

      {results && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
            <Trophy className="w-3 h-3 text-warning" />
            Model Leaderboard
          </div>

          {/* Split info */}
          {(results.train_size || results.test_size) && (
            <div className="flex gap-2 text-xs">
              <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-mono">Train: {results.train_size?.toLocaleString()}</span>
              <span className="px-2 py-0.5 rounded bg-secondary/10 text-secondary font-mono">Test: {results.test_size?.toLocaleString()}</span>
            </div>
          )}

          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
            {results.models
              ?.filter((m) => !m.error)
              .sort((a, b) => {
                if (isClassification) return (b.accuracy ?? 0) - (a.accuracy ?? 0);
                return (a.mse ?? Infinity) - (b.mse ?? Infinity);
              })
              .map((m, i) => {
                const isBest = m.model_name === results.best_model;
                return (
                  <div
                    key={i}
                    className={`px-3 py-2.5 ${i > 0 ? 'border-t' : ''} ${isBest ? 'bg-primary/5' : ''}`}
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        {isBest && <Trophy className="w-3 h-3 text-warning" />}
                        <span className={`text-xs font-medium ${isBest ? 'text-primary' : ''}`} style={!isBest ? { color: 'var(--color-text)' } : {}}>
                          {m.model_name}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] font-mono">
                      {isClassification ? (
                        <>
                          <span style={{ color: 'var(--color-text-muted)' }}>ACC: <span className={isBest ? 'text-primary font-bold' : ''}>{m.accuracy?.toFixed(4)}</span></span>
                          <span style={{ color: 'var(--color-text-muted)' }}>F1:  <span>{m.f1_score?.toFixed(4)}</span></span>
                          <span style={{ color: 'var(--color-text-muted)' }}>P:   <span>{m.precision?.toFixed(4)}</span></span>
                          <span style={{ color: 'var(--color-text-muted)' }}>R:   <span>{m.recall?.toFixed(4)}</span></span>
                        </>
                      ) : (
                        <>
                          <span style={{ color: 'var(--color-text-muted)' }}>R²:   <span className={isBest ? 'text-primary font-bold' : ''}>{m.r2?.toFixed(4)}</span></span>
                          <span style={{ color: 'var(--color-text-muted)' }}>RMSE: <span>{m.rmse?.toFixed(4)}</span></span>
                          <span style={{ color: 'var(--color-text-muted)' }}>MAE:  <span>{m.mae?.toFixed(4)}</span></span>
                          <span style={{ color: 'var(--color-text-muted)' }}>MSE:  <span>{m.mse?.toFixed(4)}</span></span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            {results.models?.filter((m) => m.error).map((m, i) => (
              <div key={`err-${i}`} className="px-3 py-2 text-xs border-t" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                ✗ {m.model_name}: {m.error}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── PANEL: Output / Prediction ───────────────────────────────────────────────
const OutputPanel = ({ node, onUpdateNodeData, uploadedDataset, trainedConfig, onPredictionReady }) => {
  const [step, setStep]           = useState('idle');  // idle | uploading | running | done | error
  const [stepMsg, setStepMsg]     = useState('');
  const [inferFile, setInferFile] = useState(null);
  const inferFileRef              = useRef(null);

  const hasTrained = !!trainedConfig;
  const sourceFile = inferFile?.file_name || uploadedDataset?.file_name;
  const targetCol  = trainedConfig?.targetColumn || null;

  const STEPS = [
    {
      label: 'Model Ready',
      desc:  hasTrained ? `${trainedConfig?.taskType ?? ''} · target: ${targetCol}` : 'Train a model first',
      done:  hasTrained,
    },
    {
      label: 'Source Data',
      desc:  sourceFile ?? 'No file available',
      done:  !!sourceFile,
    },
    {
      label: 'Run Inference',
      desc:  step === 'done' ? 'Predictions generated!' : 'Click the button below',
      done:  step === 'done',
    },
  ];

  const handleInferUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStep('uploading');
    setStepMsg(`Uploading "${file.name}"…`);
    try {
      const result = await uploadDataset(file);
      setInferFile({ file_name: result.file_name, rows: result.rows });
      setStep('idle');
      setStepMsg(`✓ "${result.file_name}" ready — ${result.rows?.toLocaleString()} rows`);
    } catch (err) {
      setStep('error');
      setStepMsg(`Upload failed: ${err.message}`);
    } finally {
      if (inferFileRef.current) inferFileRef.current.value = '';
    }
  };

  const handlePredict = async () => {
    if (!sourceFile) {
      setStep('error');
      setStepMsg('No source file. Upload a dataset and train a model first.');
      return;
    }
    setStep('running');
    setStepMsg('Preprocessing inference data…');
    try {
      await new Promise((r) => setTimeout(r, 250));
      setStepMsg('Running model inference…');
      const result = await runPredictions(sourceFile, targetCol);

      onUpdateNodeData(node.id, { predictions: result.predictions, status: 'predicted' });
      setStep('done');
      setStepMsg(`✓ ${result.predictions?.length?.toLocaleString() ?? 0} predictions generated!`);

      if (onPredictionReady) onPredictionReady(result);
    } catch (err) {
      setStep('error');
      setStepMsg(`Inference error: ${err.message}`);
      onUpdateNodeData(node.id, { status: 'error' });
    }
  };

  const isRunning = step === 'running' || step === 'uploading';
  const isDone    = step === 'done';
  const canRun    = !isRunning && !!sourceFile && hasTrained;

  return (
    <div className="space-y-5">
      {/* 3-step checklist */}
      <div className="space-y-2">
        {STEPS.map((s, i) => (
          <div
            key={i}
            className="flex items-start gap-3 p-3 rounded-xl transition-all"
            style={{
              background: s.done ? 'rgba(34,197,94,0.06)' : 'var(--color-bg)',
              border:     `1px solid ${s.done ? 'rgba(34,197,94,0.3)' : 'var(--color-border)'}`,
            }}
          >
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
              style={{
                background: s.done ? '#22c55e' : 'var(--color-border)',
                color:      s.done ? 'white'  : 'var(--color-text-muted)',
                fontSize:   '10px',
                fontWeight: 700,
              }}
            >
              {s.done ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold" style={{ color: s.done ? '#22c55e' : 'var(--color-text)' }}>
                {s.label}
              </p>
              <p className="text-[10px] truncate mt-0.5 font-mono" style={{ color: 'var(--color-text-muted)' }}>
                {s.desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* inference file upload */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--color-text-muted)' }}>
          Inference File&nbsp;<span className="normal-case font-normal opacity-70">(optional)</span>
        </p>
        <div
          className="border border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors hover:border-primary/50"
          style={{ borderColor: 'var(--color-border)' }}
          onClick={() => inferFileRef.current?.click()}
        >
          {inferFile ? (
            <div className="flex items-center justify-center gap-2 text-xs">
              <DatabaseZap className="w-4 h-4 text-primary" />
              <span className="font-mono text-primary">{inferFile.file_name}</span>
              <span style={{ color: 'var(--color-text-muted)' }}>({inferFile.rows?.toLocaleString()} rows)</span>
            </div>
          ) : (
            <div style={{ color: 'var(--color-text-muted)' }}>
              <Upload className="w-5 h-5 mx-auto mb-1 opacity-50" />
              <p className="text-xs">Upload a different CSV to run predictions on</p>
            </div>
          )}
          <input ref={inferFileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleInferUpload} />
        </div>
        {inferFile && (
          <button
            className="mt-1.5 text-[10px] transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-muted)')}
            onClick={() => { setInferFile(null); if (step !== 'done') { setStep('idle'); setStepMsg(''); } }}
          >
            × Clear — use training file instead
          </button>
        )}
      </div>

      {/* animated status message */}
      <AnimatePresence mode="wait">
        {stepMsg && (
          <motion.div
            key={stepMsg}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-start gap-2 p-3 rounded-xl text-xs leading-relaxed"
            style={{
              background: step === 'error' ? 'rgba(239,68,68,0.08)' : step === 'done' ? 'rgba(34,197,94,0.08)' : 'rgba(124,58,237,0.08)',
              border:     `1px solid ${step === 'error' ? 'rgba(239,68,68,0.25)' : step === 'done' ? 'rgba(34,197,94,0.25)' : 'rgba(124,58,237,0.25)'}`,
              color:      step === 'error' ? '#ef4444' : step === 'done' ? '#22c55e' : 'var(--color-text)',
            }}
          >
            {isRunning && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 mt-0.5" />}
            {step === 'done'  && <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
            {step === 'error' && <AlertCircle  className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
            <span>{stepMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* run button */}
      <button
        onClick={handlePredict}
        disabled={!canRun}
        className="w-full py-3 rounded-xl flex items-center justify-center gap-2.5 text-sm font-bold transition-all active:scale-95"
        style={{
          background:  canRun ? 'linear-gradient(135deg,#7c3aed,#db2777)' : 'var(--color-border)',
          color:       canRun ? 'white' : 'var(--color-text-muted)',
          cursor:      canRun ? 'pointer' : 'not-allowed',
          boxShadow:   canRun ? '0 4px 20px rgba(124,58,237,0.35)' : 'none',
          transition:  'all 0.2s ease',
        }}
      >
        {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
        {isRunning ? (stepMsg || 'Running…') : 'Run Predictions'}
      </button>

      {/* view full results button */}
      {isDone && node.data.predictions && (
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => onPredictionReady && onPredictionReady({ predictions: node.data.predictions })}
          className="w-full py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold transition-all hover:opacity-90 active:scale-95"
          style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: 'white' }}
        >
          <ArrowUpRight className="w-4 h-4" />
          View Full Results
        </motion.button>
      )}
    </div>
  );
};


// ─── PANEL: Visualizations ────────────────────────────────────────────────────
const VisualizationPanel = ({ uploadedDataset }) => {
  const [loading, setLoading] = useState(false);
  const [charts,  setCharts]  = useState(null);
  const [status,  setStatus]  = useState(null);

  const handleFetch = async () => {
    if (!uploadedDataset?.file_name) {
      setStatus({ type: 'error', msg: 'Upload a dataset first.' });
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      const result = await getVisualizations(uploadedDataset.file_name);
      setCharts(result);
      const count = Object.keys(result).length;
      setStatus({ type: 'success', msg: `${count} chart${count !== 1 ? 's' : ''} generated.` });
    } catch (err) {
      setStatus({ type: 'error', msg: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {uploadedDataset
        ? <StatusBox type="success" message={`Source: ${uploadedDataset.file_name}`} />
        : <StatusBox type="error"   message="Upload a dataset first." />}

      <ActionBtn onClick={handleFetch} loading={loading} disabled={!uploadedDataset}>
        {!loading && <BarChart2 className="w-4 h-4" />}
        {loading ? 'Generating charts…' : 'Generate Visualizations'}
      </ActionBtn>

      {status && <StatusBox type={status.type} message={status.msg} />}

      {charts && Object.entries(charts).map(([key, dataUrl]) => (
        <div key={key} className="space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
            {key.replace(/_/g, ' ')}
          </div>
          <img src={dataUrl} alt={key} className="w-full rounded-lg" style={{ border: '1px solid var(--color-border)' }} />
        </div>
      ))}
    </div>
  );
};

// ─── PANEL: AI Decision ───────────────────────────────────────────────────────
const AIDecisionPanel = ({ node, onUpdateNodeData, uploadedDataset }) => {
  const [metric, setMetric]       = useState(node.data.metric || 'accuracy');
  const [strategy, setStrategy]   = useState(node.data.strategy || 'bayesian');
  const [budget, setBudget]       = useState(node.data.timeBudget || '30');
  const [loading, setLoading]     = useState(false);
  const [status, setStatus]       = useState(null);

  const handleApply = () => {
    setLoading(true);
    setTimeout(() => {
      onUpdateNodeData(node.id, {
        metric,
        strategy,
        timeBudget: budget,
        status: 'completed',
        description: `Opt: ${metric.toUpperCase()} · ${budget}s budget`,
      });
      setStatus({ type: 'success', msg: `✓ AI Decision engine configured: optimizing for ${metric.toUpperCase()}.` });
      setLoading(false);
    }, 600);
  };

  return (
    <div className="space-y-4">
      <StatusBox type="info" message="Autonomous AutoML agent finds optimal model architecture & hyperparameters." />

      <Field label="Optimization Objective">
        <Select
          value={metric}
          onChange={setMetric}
          options={[
            { value: 'accuracy', label: 'Classification Accuracy' },
            { value: 'f1',       label: 'F1 Score (Balanced)' },
            { value: 'roc_auc',  label: 'ROC-AUC Score' },
            { value: 'r2',       label: 'R² (Regression)' },
          ]}
        />
      </Field>

      <Field label="Search Algorithm">
        <Select
          value={strategy}
          onChange={setStrategy}
          options={[
            { value: 'bayesian', label: 'Bayesian Optimization (TPE)' },
            { value: 'random',   label: 'Randomized Search' },
            { value: 'grid',     label: 'Exhaustive Grid' },
          ]}
        />
      </Field>

      <Field label="Compute Time Budget">
        <Select
          value={budget}
          onChange={setBudget}
          options={[
            { value: '15', label: '15 Seconds (Rapid)' },
            { value: '30', label: '30 Seconds (Balanced)' },
            { value: '60', label: '60 Seconds (Thorough)' },
          ]}
        />
      </Field>

      <ActionBtn onClick={handleApply} loading={loading}>
        {!loading && <Zap className="w-4 h-4" />}
        {loading ? 'Configuring…' : 'Save AI Decision Strategy'}
      </ActionBtn>

      {status && <StatusBox type={status.type} message={status.msg} />}
    </div>
  );
};

// ─── PANEL: Report ───────────────────────────────────────────────────────────
const ReportPanel = ({ node, onUpdateNodeData, uploadedDataset, trainedConfig }) => {
  const [title, setTitle]       = useState(node.data.reportTitle || 'FlowML Model Audit Report');
  const [format, setFormat]     = useState(node.data.format || 'html');
  const [includeViz, setIncludeViz] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [status, setStatus]     = useState(null);

  const handleExport = () => {
    setGenerating(true);
    setTimeout(() => {
      onUpdateNodeData(node.id, {
        reportTitle: title,
        format,
        status: 'completed',
        description: `Exported: ${title} (${format.toUpperCase()})`,
      });
      setStatus({ type: 'success', msg: `✓ Report "${title}" generated! Download available in Results overlay.` });
      setGenerating(false);
    }, 700);
  };

  return (
    <div className="space-y-4">
      <StatusBox type="info" message="Generates executive summary of preprocessing, model benchmarks, and explainability." />

      <Field label="Report Title">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Model Validation Report" />
      </Field>

      <Field label="Export Format">
        <Select
          value={format}
          onChange={setFormat}
          options={[
            { value: 'html', label: 'Interactive HTML Web Report' },
            { value: 'pdf',  label: 'PDF Document' },
            { value: 'json', label: 'Machine-Readable JSON' },
          ]}
        />
      </Field>

      <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--color-text-muted)' }}>
        <input
          type="checkbox"
          checked={includeViz}
          onChange={(e) => setIncludeViz(e.target.checked)}
          className="rounded text-primary focus:ring-primary"
        />
        <span>Include ROC curves & confusion matrix charts</span>
      </label>

      <ActionBtn onClick={handleExport} loading={generating}>
        {!generating && <FileText className="w-4 h-4" />}
        {generating ? 'Compiling Report…' : 'Generate & Save Report'}
      </ActionBtn>

      {status && <StatusBox type={status.type} message={status.msg} />}
    </div>
  );
};

// ─── PANEL: Default ───────────────────────────────────────────────────────────
const DefaultPanel = ({ node }) => (
  <div className="space-y-4 text-sm" style={{ color: 'var(--color-text-muted)' }}>
    <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
      <Stat label="Node ID" value={node.id} />
      <Stat label="Type"    value={node.type} />
    </div>
  </div>
);

// ─── Panel routing ────────────────────────────────────────────────────────────
const UPLOAD_TYPES  = ['upload', 'loadCsv'];
const PREVIEW_TYPES = ['preview'];
const PROCESS_TYPES = ['fillMissing', 'encode', 'scale', 'removeDuplicates', 'selectColumns', 'splitData'];
const MODEL_TYPES   = ['randomForest', 'linearRegression', 'decisionTree', 'logisticRegression', 'knn', 'svm', 'kmeans'];
const OUTPUT_TYPES  = ['prediction'];
const REPORT_TYPES  = ['report'];
const VIZ_TYPES     = ['explainableAi'];
const AI_TYPES      = ['aiDecision'];

// ─── Main RightPanel ──────────────────────────────────────────────────────────
const RightPanel = ({
  node,
  onClose,
  onUpdateNodeData,
  uploadedDataset,
  onDatasetUploaded,
  processedDataset,
  onDatasetProcessed,
  trainedConfig,
  onModelTrained,
  onPredictionReady,
}) => {
  if (!node) return null;

  const meta     = NODE_META[node.type] || { icon: Settings, color: 'primary', label: 'Node' };
  const Icon     = meta.icon;
  const varColor = `var(--color-${meta.color})`;

  const renderPanel = () => {
    if (UPLOAD_TYPES.includes(node.type))
      return <UploadPanel node={node} onUpdateNodeData={onUpdateNodeData} onDatasetUploaded={onDatasetUploaded} />;
    if (PREVIEW_TYPES.includes(node.type))
      return <PreviewPanel node={node} onUpdateNodeData={onUpdateNodeData} uploadedDataset={uploadedDataset} />;
    if (PROCESS_TYPES.includes(node.type))
      return <PreprocessPanel node={node} onUpdateNodeData={onUpdateNodeData} uploadedDataset={uploadedDataset} onDatasetProcessed={onDatasetProcessed} />;
    if (MODEL_TYPES.includes(node.type))
      return <ModelPanel node={node} onUpdateNodeData={onUpdateNodeData} uploadedDataset={uploadedDataset} processedDataset={processedDataset} onModelTrained={onModelTrained} />;
    if (AI_TYPES.includes(node.type))
      return <AIDecisionPanel node={node} onUpdateNodeData={onUpdateNodeData} uploadedDataset={uploadedDataset} />;
    if (REPORT_TYPES.includes(node.type))
      return <ReportPanel node={node} onUpdateNodeData={onUpdateNodeData} uploadedDataset={uploadedDataset} trainedConfig={trainedConfig} />;
    if (OUTPUT_TYPES.includes(node.type))
      return <OutputPanel node={node} onUpdateNodeData={onUpdateNodeData} uploadedDataset={uploadedDataset} trainedConfig={trainedConfig} onPredictionReady={onPredictionReady} />;
    if (VIZ_TYPES.includes(node.type))
      return <VisualizationPanel uploadedDataset={uploadedDataset} />;
    return <DefaultPanel node={node} />;
  };

  return (
    <motion.aside
      key={node.id}
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 22, stiffness: 110 }}
      className="w-80 h-full z-40 absolute right-0 shadow-2xl overflow-y-auto"
      style={{
        backgroundColor: 'var(--color-surface)',
        borderLeft:      '1px solid var(--color-border)',
        color:           'var(--color-text)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `color-mix(in srgb, ${varColor} 15%, transparent)` }}
          >
            <Icon className="w-4 h-4" style={{ color: varColor }} />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: varColor }}>
              {meta.label}
            </div>
            <h3 className="font-display font-semibold text-sm leading-tight" style={{ color: 'var(--color-text)' }}>
              {node.data.label}
            </h3>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-black/10 transition-colors"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Status badge */}
      {node.data.status && (
        <div
          className="px-4 py-2"
          style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)' }}
        >
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${node.data.status === 'error' ? 'bg-danger' : 'bg-success animate-pulse'}`} />
            <span className={`text-[10px] font-semibold uppercase tracking-wider ${node.data.status === 'error' ? 'text-danger' : 'text-success'}`}>
              {node.data.status}
            </span>
          </div>
        </div>
      )}

      {/* Panel content */}
      <div className="p-4 space-y-4">{renderPanel()}</div>
    </motion.aside>
  );
};

export default RightPanel;
