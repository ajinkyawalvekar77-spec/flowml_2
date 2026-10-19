import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Square, Terminal, Code2, Clock, CheckCircle2,
  AlertTriangle, Copy, Check, RotateCcw, Save, History,
  FileCode, Layers, Image as ImageIcon, Table, Database,
  Sparkles, ExternalLink
} from 'lucide-react';
import { runPythonCode, stopPythonCode, getCodeHistory, listDatasets } from '../../services/api';

const STARTER_SNIPPETS = {
  clean: `# 1. Smart Data Cleaning & Inspection
import pandas as pd
import numpy as np

print("Input dataset shape:", df.shape if df is not None else "No dataset bound")

if df is not None:
    output_df = df.copy()
    # Fill numeric nulls with column median
    num_cols = output_df.select_dtypes(include=[np.number]).columns
    output_df[num_cols] = output_df[num_cols].fillna(output_df[num_cols].median())
    print("Null count after median imputation:\\n", output_df.isnull().sum())
else:
    # Synthetic demo dataframe
    output_df = pd.DataFrame({
        "feature_a": [1.2, np.nan, 3.4, 5.1, 2.8],
        "feature_b": [10, 20, 15, 35, 18],
        "target": [0, 1, 0, 1, 0]
    })
    output_df["feature_a"] = output_df["feature_a"].fillna(output_df["feature_a"].median())
    print("Created synthetic dataframe:", output_df.shape)
`,

  features: `# 2. Advanced Feature Engineering
import pandas as pd
import numpy as np

if df is not None:
    output_df = df.copy()
    num_cols = output_df.select_dtypes(include=[np.number]).columns[:2]
    if len(num_cols) >= 2:
        c1, c2 = num_cols[0], num_cols[1]
        output_df[f"{c1}_x_{c2}"] = output_df[c1] * output_df[c2]
        output_df[f"{c1}_log"] = np.log1p(np.maximum(0, output_df[c1]))
        print(f"Engineered interaction features from {c1} and {c2}")
else:
    output_df = pd.DataFrame({
        "revenue": [100, 250, 400, 150, 800],
        "costs": [80, 180, 310, 120, 600]
    })
    output_df["profit"] = output_df["revenue"] - output_df["costs"]
    output_df["margin"] = output_df["profit"] / output_df["revenue"]
    print("Engineered profit and margin metrics!")
`,

  model: `# 3. Scikit-Learn Custom Model Benchmark
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score

if df is not None and "target" in df.columns:
    X = df.drop(columns=["target"]).select_dtypes(include=["number"]).fillna(0)
    y = df["target"]
else:
    from sklearn.datasets import load_iris
    iris = load_iris(as_frame=True)
    X, y = iris.data, iris.target

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=42)
clf = RandomForestClassifier(n_estimators=50, random_state=42)
clf.fit(X_train, y_train)

preds = clf.predict(X_test)
acc = accuracy_score(y_test, preds)
print(f"RandomForest Accuracy: {acc * 100:.2f}%\\n")
print(classification_report(y_test, preds))

# Assign predictions to output
output_df = X_test.copy()
output_df["predicted_target"] = preds
`,

  plot: `# 4. Statistical Plotting (Matplotlib)
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

fig, ax = plt.subplots(figsize=(7, 4))

if df is not None:
    num_cols = df.select_dtypes(include=[np.number]).columns
    if len(num_cols) > 0:
        ax.hist(df[num_cols[0]].dropna(), bins=15, color="#7C3AED", edgecolor="white", alpha=0.85)
        ax.set_title(f"Distribution of {num_cols[0]}", fontsize=12, fontweight="bold")
    else:
        ax.plot([1, 2, 3], [4, 5, 6])
else:
    x = np.linspace(0, 10, 100)
    ax.plot(x, np.sin(x), label="sin(x)", color="#7C3AED", linewidth=2)
    ax.plot(x, np.cos(x), label="cos(x)", color="#ec4899", linewidth=2, linestyle="--")
    ax.set_title("Trigonometric Signal Benchmarking", fontsize=12, fontweight="bold")
    ax.legend()

ax.grid(True, linestyle=":", alpha=0.4)
plt.tight_layout()
print("Figure plotted successfully.")
`,
};

export default function PythonEditor({
  initialCode = '',
  datasetId = null,
  onCodeChange = null,
  compact = false,
  showHistoryTab = true,
}) {
  const [code, setCode] = useState(initialCode || STARTER_SNIPPETS.clean);
  const [selectedDataset, setSelectedDataset] = useState(datasetId || '');
  const [datasets, setDatasets] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentRunId, setCurrentRunId] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | running | completed | failed
  const [duration, setDuration] = useState(null);
  const [stdout, setStdout] = useState('');
  const [stderr, setStderr] = useState('');
  const [traceback, setTraceback] = useState(null);
  const [plots, setPlots] = useState([]);
  const [outputPreview, setOutputPreview] = useState(null);
  const [activeTab, setActiveTab] = useState('console'); // console | error | plots | table
  const [copied, setCopied] = useState(false);
  const [historyList, setHistoryList] = useState([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const textareaRef = useRef(null);

  // Load datasets and history
  useEffect(() => {
    listDatasets()
      .then((data) => {
        if (Array.isArray(data)) setDatasets(data);
      })
      .catch(() => {});

    loadHistory();
  }, []);

  const loadHistory = () => {
    getCodeHistory()
      .then((data) => {
        if (Array.isArray(data)) setHistoryList(data);
      })
      .catch(() => {});
  };

  const handleCodeChange = (newCode) => {
    setCode(newCode);
    if (onCodeChange) onCodeChange(newCode);
  };

  const handleKeyDown = (e) => {
    // Handle tab key
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.target.selectionStart;
      const end = e.target.selectionEnd;
      const val = e.target.value;
      const updated = val.substring(0, start) + '    ' + val.substring(end);
      handleCodeChange(updated);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 4;
        }
      }, 0);
    }
    // Ctrl + Enter to run
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleRun();
    }
  };

  const handleRun = async () => {
    if (!code.trim() || isRunning) return;
    setIsRunning(true);
    setStatus('running');
    setStdout('');
    setStderr('');
    setTraceback(null);
    setPlots([]);
    setOutputPreview(null);
    setActiveTab('console');

    try {
      const res = await runPythonCode(code, selectedDataset || null, 20);
      setCurrentRunId(res.run_id);
      setStatus(res.status);
      setDuration(res.duration_ms);
      setStdout(res.stdout || '');
      setStderr(res.stderr || '');
      setTraceback(res.traceback || null);
      setPlots(res.plots || []);
      setOutputPreview(res.output_preview || null);

      if (res.traceback) {
        setActiveTab('error');
      } else if (res.plots && res.plots.length > 0) {
        setActiveTab('plots');
      } else if (res.output_preview) {
        setActiveTab('table');
      }

      loadHistory();
    } catch (err) {
      setStatus('failed');
      const errDetail = err?.response?.data?.detail || err.message || 'Execution failed';
      setStderr(typeof errDetail === 'string' ? errDetail : JSON.stringify(errDetail));
      setTraceback(typeof errDetail === 'string' ? errDetail : JSON.stringify(errDetail));
      setActiveTab('error');
    } finally {
      setIsRunning(false);
    }
  };

  const handleStop = async () => {
    if (currentRunId) {
      try {
        await stopPythonCode(currentRunId);
        setStderr((prev) => prev + '\n[Aborted] Execution stopped by user.');
        setStatus('failed');
      } catch (e) {
        console.warn('Execution stop request failed:', e);
      }
    }
    setIsRunning(false);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Line numbers calculation
  const lineCount = code.split('\n').length;
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1);

  return (
    <div className={`flex flex-col rounded-2xl bg-[#0a0f1d] border border-white/10 overflow-hidden ${compact ? 'h-[480px]' : 'h-[640px]'}`}>
      {/* ── Top Header Toolbar ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-[#0e1526] border-b border-white/10 text-xs">
        {/* Left: Starters & Dataset selector */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-300 font-semibold">
            <Code2 className="w-3.5 h-3.5" /> Python 3.10 Worker
          </div>

          <select
            value=""
            onChange={(e) => {
              if (e.target.value && STARTER_SNIPPETS[e.target.value]) {
                handleCodeChange(STARTER_SNIPPETS[e.target.value]);
              }
            }}
            className="px-2.5 py-1 rounded-lg bg-[#141d33] border border-white/10 text-slate-300 hover:border-white/20 focus:outline-none cursor-pointer"
          >
            <option value="" disabled>Load Template…</option>
            <option value="clean">1. Clean & Impute</option>
            <option value="features">2. Feature Engineering</option>
            <option value="model">3. Scikit-Learn Model</option>
            <option value="plot">4. Matplotlib Chart</option>
          </select>

          {datasets.length > 0 && (
            <select
              value={selectedDataset}
              onChange={(e) => setSelectedDataset(e.target.value)}
              className="px-2.5 py-1 rounded-lg bg-[#141d33] border border-white/10 text-slate-300 hover:border-white/20 focus:outline-none cursor-pointer max-w-[140px] truncate"
            >
              <option value="">No dataset bound</option>
              {datasets.map((d) => (
                <option key={d.dataset_id} value={d.dataset_id}>
                  df: {d.original_name || d.dataset_id}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Right: Run, Stop, Status, Copy */}
        <div className="flex items-center gap-2">
          {duration !== null && (
            <span className="flex items-center gap-1 text-[11px] font-mono text-slate-400">
              <Clock className="w-3 h-3 text-slate-500" /> {duration}ms
            </span>
          )}

          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
              status === 'completed'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : status === 'failed'
                ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                : status === 'running'
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse'
                : 'bg-slate-700/30 text-slate-400 border border-slate-700/50'
            }`}
          >
            {status}
          </span>

          <button
            onClick={copyCode}
            title="Copy Code"
            className="p-1.5 rounded-lg bg-[#141d33] border border-white/5 text-slate-400 hover:text-white transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {showHistoryTab && (
            <button
              onClick={() => setShowHistoryModal(true)}
              title="Execution History"
              className="p-1.5 rounded-lg bg-[#141d33] border border-white/5 text-slate-400 hover:text-white transition-colors"
            >
              <History className="w-3.5 h-3.5" />
            </button>
          )}

          {isRunning ? (
            <button
              onClick={handleStop}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition-all"
            >
              <Square className="w-3.5 h-3.5 fill-current" /> Stop
            </button>
          ) : (
            <button
              onClick={handleRun}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/30 transition-all"
            >
              <Play className="w-3.5 h-3.5 fill-current" /> Run Script
            </button>
          )}
        </div>
      </div>

      {/* ── Main Split View (Code Editor + Output Console) ────────────────── */}
      <div className="flex-1 grid grid-rows-2 sm:grid-rows-1 sm:grid-cols-2 overflow-hidden divide-y sm:divide-y-0 sm:divide-x divide-white/10">
        {/* Editor Area with Line Numbers */}
        <div className="relative flex flex-1 h-full bg-[#080d19] overflow-hidden">
          {/* Gutter / Line numbers */}
          <div className="w-10 py-3 select-none text-right pr-2.5 font-mono text-xs text-slate-600 bg-[#060a14] border-r border-white/5 overflow-hidden">
            {lineNumbers.map((n) => (
              <div key={n} className="leading-6">
                {n}
              </div>
            ))}
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={code}
            onChange={(e) => handleCodeChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="# Enter Python code here...&#10;# Available: df (upstream DataFrame), np, pd, sklearn, plt"
            spellCheck={false}
            className="flex-1 p-3 bg-transparent text-slate-100 font-mono text-xs leading-6 resize-none focus:outline-none selection:bg-violet-500/30"
          />
        </div>

        {/* Output & Visuals Area */}
        <div className="flex flex-col h-full bg-[#070b16] overflow-hidden">
          {/* Output Tabs Bar */}
          <div className="flex items-center justify-between px-3 bg-[#0d1322] border-b border-white/10 text-xs">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab('console')}
                className={`flex items-center gap-1.5 px-3 py-2 font-semibold border-b-2 transition-all ${
                  activeTab === 'console'
                    ? 'border-violet-500 text-white'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Terminal className="w-3.5 h-3.5" /> Output
              </button>

              <button
                onClick={() => setActiveTab('plots')}
                className={`flex items-center gap-1.5 px-3 py-2 font-semibold border-b-2 transition-all ${
                  activeTab === 'plots'
                    ? 'border-violet-500 text-white'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" /> Plots
                {plots.length > 0 && (
                  <span className="w-4 h-4 rounded-full bg-violet-500/30 text-[10px] flex items-center justify-center font-bold text-violet-300">
                    {plots.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('table')}
                className={`flex items-center gap-1.5 px-3 py-2 font-semibold border-b-2 transition-all ${
                  activeTab === 'table'
                    ? 'border-violet-500 text-white'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Table className="w-3.5 h-3.5" /> Table
                {outputPreview && (
                  <span className="w-4 h-4 rounded-full bg-emerald-500/30 text-[10px] flex items-center justify-center font-bold text-emerald-300">
                    ✓
                  </span>
                )}
              </button>

              {traceback && (
                <button
                  onClick={() => setActiveTab('error')}
                  className={`flex items-center gap-1.5 px-3 py-2 font-semibold border-b-2 transition-all ${
                    activeTab === 'error'
                      ? 'border-rose-500 text-rose-300'
                      : 'border-transparent text-rose-400/80 hover:text-rose-300'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" /> Traceback
                </button>
              )}
            </div>

            <span className="text-[10px] text-slate-500 font-mono">
              Press Ctrl+Enter to Run
            </span>
          </div>

          {/* Tab Contents */}
          <div className="flex-1 p-3 overflow-auto font-mono text-xs">
            {activeTab === 'console' && (
              <div className="space-y-1">
                {stdout ? (
                  <pre className="text-emerald-300/90 whitespace-pre-wrap leading-relaxed select-text">
                    {stdout}
                  </pre>
                ) : null}
                {stderr && !traceback ? (
                  <pre className="text-amber-300/90 whitespace-pre-wrap leading-relaxed select-text">
                    {stderr}
                  </pre>
                ) : null}
                {!stdout && !stderr && (
                  <div className="h-full flex items-center justify-center text-slate-600 select-none py-12">
                    Run the script to see terminal output and print() calls.
                  </div>
                )}
              </div>
            )}

            {activeTab === 'error' && (
              <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/20 text-rose-300 whitespace-pre-wrap leading-relaxed">
                {traceback || stderr || 'No errors reported.'}
              </div>
            )}

            {activeTab === 'plots' && (
              <div className="space-y-4">
                {plots.length > 0 ? (
                  plots.map((b64, idx) => (
                    <div key={idx} className="p-2 rounded-xl bg-[#0e1422] border border-white/10 shadow-lg">
                      <img
                        src={`data:image/png;base64,${b64}`}
                        alt={`Figure ${idx + 1}`}
                        className="w-full rounded-lg object-contain max-h-[300px]"
                      />
                    </div>
                  ))
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-600 select-none py-12">
                    No matplotlib figures generated. Use plt.plot() and run.
                  </div>
                )}
              </div>
            )}

            {activeTab === 'table' && (
              <div>
                {outputPreview ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-[11px] text-slate-400">
                      <span>Shape: {outputPreview.rows} rows × {outputPreview.columns.length} cols</span>
                    </div>
                    <div className="overflow-x-auto border border-white/5 rounded-xl">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-[#12192c] text-slate-300">
                          <tr>
                            {outputPreview.columns.map((c) => (
                              <th key={c} className="px-3 py-2 font-semibold border-b border-white/10 whitespace-nowrap">
                                {c}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-slate-300">
                          {outputPreview.head.map((row, i) => (
                            <tr key={i} className="hover:bg-white/[0.02]">
                              {outputPreview.columns.map((c) => (
                                <td key={c} className="px-3 py-1.5 whitespace-nowrap">
                                  {String(row[c] ?? '')}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-600 select-none py-12">
                    Assign output_df = ... in your code to view the transformed dataset.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── History Modal ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showHistoryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg p-6 rounded-2xl bg-[#0e1422] border border-white/10 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <History className="w-4 h-4 text-violet-400" /> Execution History
                </h3>
                <button
                  onClick={() => setShowHistoryModal(false)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Close
                </button>
              </div>

              <div className="max-h-80 overflow-y-auto space-y-2">
                {historyList.length === 0 ? (
                  <p className="text-xs text-slate-500 py-6 text-center">No previous runs recorded.</p>
                ) : (
                  historyList.map((h) => (
                    <div
                      key={h.run_id}
                      className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between hover:border-violet-500/30 transition-all"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              h.status === 'completed' ? 'bg-emerald-400' : 'bg-rose-400'
                            }`}
                          />
                          <span className="text-xs font-mono font-bold text-slate-200">{h.run_id}</span>
                          <span className="text-[10px] text-slate-500">{h.created_at}</span>
                        </div>
                        <p className="text-[11px] font-mono text-slate-400 line-clamp-1 max-w-xs">
                          {h.code}
                        </p>
                      </div>

                      <button
                        onClick={() => {
                          handleCodeChange(h.code);
                          setShowHistoryModal(false);
                        }}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-violet-500/10 hover:bg-violet-600 text-violet-300 hover:text-white transition-all"
                      >
                        Load
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
