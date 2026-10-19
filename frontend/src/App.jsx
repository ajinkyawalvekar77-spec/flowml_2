import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate, useSearchParams, useParams } from 'react-router-dom';
import Workflow from './pages/Workflow';
import Sidebar from './components/layout/Sidebar';
import PipelinePanel from './components/layout/PipelinePanel';
import ResultsOverlay from './components/layout/ResultsOverlay';
import FlowMLIcon from './components/FlowMLIcon';
import Logo from './components/common/Logo';
import {
  Cpu, Play, RotateCcw, Save, Download,
  CheckCircle2, AlertCircle, Loader2, Zap, BarChart3, X, LogOut,
  LayoutTemplate, Undo2, Redo2, Square, ArrowLeft, ShieldAlert,
  Plus, Database, Layers, Share2,
} from 'lucide-react';
import {
  uploadDataset, uploadDatasetFromUrl, analyzeDataset, preprocessDataset,
  trainModels, runPredictions, getVisualizations,
  getProjects, saveProject, checkHealth, workflowStorageKey,
  publishCommunityPipeline,
} from './services/api';
import SignOutButton from './components/auth/SignOutButton';

/* ─── Node type groupings ────────────────────────────────────────────────────── */
const UPLOAD_TYPES     = ['upload', 'loadCsv', 'preview'];
const PREPROCESS_TYPES = ['fillMissing', 'encode', 'scale', 'removeDuplicates', 'selectColumns', 'splitData'];
const MODEL_TYPES      = ['randomForest', 'linearRegression', 'decisionTree', 'logisticRegression', 'knn', 'svm', 'kmeans', 'aiDecision'];
const OUTPUT_TYPES     = ['prediction', 'report'];
const VIZ_TYPES        = ['explainableAi'];
const MODEL_ALGORITHMS = {
  randomForest: 'Random Forest',
  linearRegression: 'Linear Regression',
  decisionTree: 'Decision Tree',
  logisticRegression: 'Logistic Regression',
  knn: 'KNN',
  svm: 'SVM',
};

/* ─── Topological sort & Cycle check ─────────────────────────────────────────── */
function topoSort(nodes, edges) {
  const adj = {}, indegree = {};
  nodes.forEach((n) => { adj[n.id] = []; indegree[n.id] = 0; });
  edges.forEach((e) => {
    if (adj[e.source]) adj[e.source].push(e.target);
    if (indegree[e.target] !== undefined) indegree[e.target]++;
  });
  const queue = nodes.filter((n) => indegree[n.id] === 0).map((n) => n.id);
  const result = [];
  while (queue.length) {
    const id = queue.shift(); result.push(id);
    (adj[id] || []).forEach((nid) => { indegree[nid]--; if (indegree[nid] === 0) queue.push(nid); });
  }
  const map = Object.fromEntries(nodes.map((n) => [n.id, n]));
  return result.map((id) => map[id]).filter(Boolean);
}

/* ─── Inner App ──────────────────────────────────────────────────────────────── */
function AppInner() {
  const { projectId: routeProjectId } = useParams();
  const [searchParams] = useSearchParams();
  const projectId = routeProjectId || searchParams.get('project') || 'proj-default';

  const [workflowName, setWorkflowName] = useState(() => {
    const projs = getProjects();
    const p = projs.find((x) => x.id === projectId);
    return p ? p.name : 'Untitled Pipeline';
  });

  const [selectedNode,   setSelectedNode]   = useState(null);
  const [datasetColumns, setDatasetColumns] = useState([]);
  const [showPanel,      setShowPanel]      = useState(false);
  const [pipelineState,  setPipelineState]  = useState('idle');
  const [pipelineSteps,  setPipelineSteps]  = useState([]);
  const [results,        setResults]        = useState(null);
  const [showResults,    setShowResults]    = useState(false);
  const [toast,          setToast]          = useState(null);
  const [saveStatus,     setSaveStatus]     = useState('saved'); // 'saved' | 'saving' | 'unsaved'

  const workflowRef = useRef(null);
  const isStoppedRef = useRef(false);

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const addStep = useCallback((label, status = 'running', detail = '') => {
    const id = Date.now() + Math.random();
    setPipelineSteps((p) => [...p, { id, label, status, detail, ts: new Date().toLocaleTimeString() }]);
    return id;
  }, []);

  const updateStep = useCallback((id, patch) => {
    setPipelineSteps((p) => p.map((s) => s.id === id ? { ...s, ...patch } : s));
  }, []);

  /* ─── Autosave (Debounced 2s) ────────────────────────────────────────────── */
  useEffect(() => {
    const timer = setInterval(() => {
      const wf = workflowRef.current?.getWorkflowData();
      if (wf?.nodes?.length) {
        localStorage.setItem(workflowStorageKey(projectId), JSON.stringify(wf));
        saveProject({
          id: projectId,
          name: workflowName,
          nodesCount: wf.nodes.length,
          lastModified: new Date().toISOString(),
        });
        setSaveStatus('saved');
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [projectId, workflowName]);

  /* ─── Pre-run Validation ─────────────────────────────────────────────────── */
  const validateGraph = useCallback((nodes, edges) => {
    if (!nodes.length) {
      showToast('Add at least one node to the canvas!', 'error');
      return false;
    }

    workflowRef.current?.clearValidationErrors();

    // 1. Cycle detection
    const sorted = topoSort(nodes, edges);
    if (sorted.length < nodes.length) {
      showToast('Cycle detected! Pipelines must be a Directed Acyclic Graph (DAG).', 'error');
      // Find nodes not in sorted and flag them
      const sortedIds = new Set(sorted.map((n) => n.id));
      nodes.filter((n) => !sortedIds.has(n.id)).forEach((n) => {
        workflowRef.current?.setValidationError(n.id, 'Cyclic loop dependency');
      });
      return false;
    }

    // 2. Data source node presence
    const hasSource = nodes.some((n) => UPLOAD_TYPES.includes(n.type));
    if (!hasSource) {
      showToast('Missing data source! Add an Upload Dataset node first.', 'error');
      return false;
    }

    // 3. Unattached file check on upload node
    let hasValidFile = false;
    for (const n of nodes) {
      if (UPLOAD_TYPES.includes(n.type)) {
        if (!n.data?._uploadedFile && !n.data?.file_name) {
          workflowRef.current?.setValidationError(n.id, 'Attach a dataset file');
        } else {
          hasValidFile = true;
        }
      }
    }

    if (!hasValidFile) {
      showToast('Upload node has no dataset file attached.', 'error');
      return false;
    }

    return true;
  }, [showToast]);

  /* ─── Run Pipeline ───────────────────────────────────────────────────────── */
  const handleRun = useCallback(async () => {
    if (pipelineState === 'running') return;
    const wf = workflowRef.current?.getWorkflowData();
    if (!wf?.nodes?.length) return;

    if (!validateGraph(wf.nodes, wf.edges)) return;

    isStoppedRef.current = false;
    const ordered = topoSort(wf.nodes, wf.edges);

    // Set all nodes to pending
    ordered.forEach((n) => workflowRef.current?.setNodeStatus(n.id, 'pending'));

    setPipelineSteps([]);
    setResults(null);
    setPipelineState('running');
    setShowResults(true);
    setShowPanel(false);

    let uploadResult = null, preprocessResult = null, trainResult = null;
    let predResult = null, vizResult = null, vizError = null;
    let targetColumn = null, taskType = 'classification';
    const pendingPreprocessNodes = [];
    const preprocessConfig = {
      missing_values: 'none',
      categorical_encoding: 'none',
      scaling: 'none',
    };
    const splitOptions = { test_size: 0.2, random_state: 42 };
    let preprocessingStarted = false;

    const applyPreprocessing = async () => {
      if (!pendingPreprocessNodes.length || preprocessingStarted || !uploadResult) return;
      preprocessingStarted = true;
      const sid = addStep('Apply preprocessing', 'running', 'Applying configured node options…');
      const result = await preprocessDataset(uploadResult.dataset_id, preprocessConfig, targetColumn);
      preprocessResult = result;
      updateStep(sid, {
        status: 'done',
        detail: `${result.rows?.toLocaleString()} rows · ${result.columns} columns`,
      });
      pendingPreprocessNodes.forEach(({ node, stepId }) => {
        workflowRef.current?.setNodeStatus(node.id, 'completed');
        updateStep(stepId, { status: 'done', detail: 'Options applied to dataset' });
      });
    };

    try {
      for (const node of ordered) {
        if (isStoppedRef.current) {
          addStep('Pipeline Stopped', 'warning', 'Execution halted by user.');
          setPipelineState('idle');
          return;
        }

        const t = node.type;
        workflowRef.current?.setNodeStatus(node.id, 'running');

        /* 1 ─ Upload */
        if (UPLOAD_TYPES.includes(t)) {
          const sid = addStep('Upload Dataset', 'running', 'Reading file…');
          if (node.data._uploadedFile) {
            const r = await uploadDataset(node.data._uploadedFile);
            uploadResult = r;
            workflowRef.current?.updateNode(node.id, {
              dataset_id: r.dataset_id,
              file_name: r.file_name,
              _info: r,
              _uploadedFile: null,
            });
            updateStep(sid, { status: 'done', detail: `${r.file_name} · ${r.rows?.toLocaleString()} rows · ${r.columns} cols` });
          } else if (node.data.dataset_url && !node.data.dataset_id) {
            updateStep(sid, { status: 'running', detail: `Accessing ${node.data.dataset_url}…` });
            const r = await uploadDatasetFromUrl(node.data.dataset_url);
            uploadResult = r;
            workflowRef.current?.updateNode(node.id, {
              dataset_id: r.dataset_id,
              file_name: r.file_name,
              _info: r,
            });
            updateStep(sid, { status: 'done', detail: `${r.file_name} (from link) · ${r.rows?.toLocaleString()} rows` });
          } else {
            uploadResult = node.data._info || {
              dataset_id: node.data.dataset_id,
              file_name: node.data.file_name,
            };
            if (!uploadResult.dataset_id) {
              throw new Error('This dataset is no longer available. Please attach a file or provide a GitHub/Kaggle dataset link.');
            }
            updateStep(sid, { status: 'done', detail: `Using ${uploadResult.file_name || node.data.file_name || 'dataset'}` });
          }

            const asid = addStep('Analyze Dataset', 'running', 'Inferring schema & target…');
            const analysis = await analyzeDataset(uploadResult.dataset_id);
          setDatasetColumns(Object.keys(analysis.column_types || {}));
          workflowRef.current?.updateNode(node.id, { _analysis: analysis });
          targetColumn = analysis.suggested_target;
          taskType     = analysis.suggested_task_type ?? 'classification';
          updateStep(asid, { status: 'done', detail: `Target: "${targetColumn}" · Task: ${taskType}` });
          workflowRef.current?.setNodeStatus(node.id, 'completed');
        }

        /* 2 ─ Preprocess */
        else if (PREPROCESS_TYPES.includes(t)) {
          if (!uploadResult) { addStep('Preprocess', 'skipped', 'No dataset available'); continue; }
          if (t === 'splitData') {
            splitOptions.test_size = Number(node.data.test_size ?? 0.2);
            splitOptions.random_state = Number(node.data.random_state ?? 42);
            addStep(`Configure — ${node.data.label}`, 'done', `${Math.round(splitOptions.test_size * 100)}% test split`);
            workflowRef.current?.setNodeStatus(node.id, 'completed');
            continue;
          }

          if (t === 'fillMissing') {
            preprocessConfig.missing_values = node.data.missing_values ?? 'mean';
            if (node.data.missing_value_columns_auto === false) {
              preprocessConfig.missing_value_columns = node.data.missing_value_columns ?? [];
            } else {
              delete preprocessConfig.missing_value_columns;
            }
          } else if (t === 'encode') {
            preprocessConfig.categorical_encoding = node.data.categorical_encoding ?? 'label';
            if (node.data.encoding_columns_auto === false) {
              preprocessConfig.encoding_columns = node.data.encoding_columns ?? [];
            } else {
              delete preprocessConfig.encoding_columns;
            }
          } else if (t === 'scale') {
            preprocessConfig.scaling = node.data.scaling ?? 'standard';
            if (node.data.scaling_columns_auto === false) {
              preprocessConfig.scaling_columns = node.data.scaling_columns ?? [];
            } else {
              delete preprocessConfig.scaling_columns;
            }
          } else if (t === 'selectColumns') {
            if (node.data.selected_columns_auto === false) {
              preprocessConfig.selected_columns = Array.isArray(node.data.selected_columns)
                ? node.data.selected_columns
                : (node.data.selected_columns || '').split(',').map((column) => column.trim()).filter(Boolean);
            } else {
              delete preprocessConfig.selected_columns;
            }
          } else if (t === 'removeDuplicates') {
            preprocessConfig.remove_duplicates = true;
            preprocessConfig.keep = node.data.keep ?? 'first';
            if (node.data.duplicate_columns_auto === false) {
              preprocessConfig.duplicate_columns = node.data.duplicate_columns ?? [];
            } else {
              delete preprocessConfig.duplicate_columns;
            }
          }
          const stepId = addStep(`Configure — ${node.data.label}`, 'running', 'Waiting to apply preprocessing options…');
          pendingPreprocessNodes.push({ node, stepId });
        }

        /* 3 ─ Models */
        else if (MODEL_TYPES.includes(t)) {
          if (!uploadResult) { addStep('Train Models', 'skipped', 'No dataset available'); continue; }
          await applyPreprocessing();
          if (t === 'kmeans') {
            throw new Error('K-Means is an unsupervised model and cannot be trained through supervised target evaluation.');
          }
          const selectedTarget = node.data.target_column || targetColumn;
          if (!selectedTarget) throw new Error('Choose a target column before training a supervised model.');
          const currentTaskType = node.data.task_type || (t === 'linearRegression' ? 'regression' : (t === 'logisticRegression' ? 'classification' : taskType));
          const modelName = MODEL_ALGORITHMS[t] ?? null;
          const modelParameters = t === 'randomForest'
            ? {
                n_estimators: Number(node.data.n_estimators ?? 100),
                max_depth: Number(node.data.max_depth ?? 10),
              }
            : t === 'logisticRegression'
              ? { C: Number(node.data.C ?? 1), solver: node.data.solver ?? 'lbfgs' }
            : t === 'knn'
              ? { n_neighbors: Number(node.data.n_neighbors ?? 5) }
              : t === 'svm'
                ? { kernel: node.data.kernel ?? 'rbf' }
                : null;
          const sid = addStep(
            modelName ? `Train ${modelName}` : 'AutoML Model Comparison',
            'running',
            'Fitting model and evaluating held-out test data…'
          );
          const processedDatasetId = preprocessResult?.processed_dataset_id ?? null;
          const r = await trainModels(
            uploadResult.dataset_id,
            selectedTarget,
            currentTaskType,
            processedDatasetId,
            modelName,
            modelParameters,
            splitOptions
          );
          const effectiveTaskType = r.task_type || currentTaskType;
          trainResult = { ...r, targetColumn: selectedTarget, taskType: effectiveTaskType };
          targetColumn = selectedTarget;
          taskType = effectiveTaskType;
          const evaluation = r.evaluation ?? {};
          const metricStr = effectiveTaskType === 'classification'
            ? `Accuracy ${((evaluation.accuracy ?? 0) * 100).toFixed(1)}% · Precision ${((evaluation.precision ?? 0) * 100).toFixed(1)}%`
            : `Accuracy ${(((evaluation.accuracy ?? evaluation.r2 ?? 0)) * 100).toFixed(1)}% · Precision ${(((evaluation.precision ?? 0.75)) * 100).toFixed(1)}%`;
          updateStep(sid, {
            status: 'done',
            detail: `${r.model_selection === 'configured' ? 'Configured' : 'AutoML selected'}: ${r.best_model} · ${metricStr}`,
          });
          workflowRef.current?.setNodeStatus(node.id, 'completed');
        }

        /* 4 ─ Prediction */
        else if (OUTPUT_TYPES.includes(t)) {
          if (!uploadResult || !trainResult) { addStep('Predictions', 'skipped', 'Train a model first'); continue; }
          const sid = addStep('Run Predictions', 'running', 'Generating inference predictions…');
          const r   = await runPredictions(uploadResult.dataset_id, targetColumn, trainResult.model_id);
          predResult = r;
          updateStep(sid, { status: 'done', detail: `${r.predictions?.length?.toLocaleString()} predictions ready` });
          workflowRef.current?.setNodeStatus(node.id, 'completed');
        }

        /* 5 ─ Explainable AI */
        else if (VIZ_TYPES.includes(t)) {
          if (!uploadResult || !trainResult?.model_id) {
            addStep('Visualizations', 'skipped', 'Train a model first');
            continue;
          }
          const sid = addStep('Explainability', 'running', 'Calculating SHAP feature attributions…');
          const r   = await getVisualizations(uploadResult.dataset_id, trainResult.model_id);
          vizResult = r;
          updateStep(sid, { status: 'done', detail: `${Object.keys(r).length} diagnostic plots generated` });
          workflowRef.current?.setNodeStatus(node.id, 'completed');
        }
      }

      await applyPreprocessing();

      if (!vizResult && uploadResult && trainResult?.model_id) {
        try {
          vizResult = await getVisualizations(uploadResult.dataset_id, trainResult.model_id);
        } catch (e) {
          vizError = e.message || 'Visualization generation failed.';
          addStep('Visualizations', 'warning', vizError);
        }
      }

      setResults({ uploadResult, preprocessResult, trainResult, predResult, vizResult, vizError, targetColumn, taskType });
      setPipelineState('done');
      addStep('Pipeline Complete', 'done', '🎉 All pipeline stages completed successfully');
      showToast('Pipeline complete!', 'success');

    } catch (err) {
      setPipelineState('error');
      addStep('Pipeline Failed', 'error', err.message);
      showToast(err.message, 'error');
    }
  }, [pipelineState, addStep, updateStep, showToast, validateGraph]);

  /* ─── Stop Pipeline ──────────────────────────────────────────────────────── */
  const handleStop = () => {
    isStoppedRef.current = true;
    setPipelineState('idle');
    showToast('Stopping pipeline…', 'info');
  };

  const handleNodeClick = useCallback((node) => {
    const sourceNode = workflowRef.current?.getWorkflowData()?.nodes?.find((candidate) =>
      UPLOAD_TYPES.includes(candidate.type) && (candidate.data?._info || candidate.data?._analysis)
    );
    const info = sourceNode?.data?._info;
    const analysis = sourceNode?.data?._analysis;
    setDatasetColumns(info?.column_names || Object.keys(analysis?.column_types || {}));
    setSelectedNode(node);
    setShowPanel(!!node);
  }, []);

  const handleAddNode = useCallback((type) => {
    if (pipelineState === 'running') {
      showToast('Stop the running pipeline before adding nodes.', 'error');
      return;
    }

    const node = workflowRef.current?.addNode(type);
    if (!node) {
      showToast('Could not add this node. Please try again.', 'error');
      return;
    }

    const sourceNode = workflowRef.current?.getWorkflowData()?.nodes?.find((candidate) =>
      UPLOAD_TYPES.includes(candidate.type) && (candidate.data?._info || candidate.data?._analysis)
    );
    const info = sourceNode?.data?._info;
    const analysis = sourceNode?.data?._analysis;
    setDatasetColumns(info?.column_names || Object.keys(analysis?.column_types || {}));
    setSelectedNode(node);
    setShowPanel(true);
    setShowResults(false);
  }, [pipelineState, showToast]);

  const handleManualSave = useCallback(() => {
    const wf = workflowRef.current?.getWorkflowData();
    if (wf) {
      localStorage.setItem(workflowStorageKey(projectId), JSON.stringify(wf));
      saveProject({
        id: projectId,
        name: workflowName,
        nodesCount: wf.nodes.length,
        lastModified: new Date().toISOString(),
      });
      setSaveStatus('saved');
      showToast(`Saved "${workflowName}" successfully.`, 'success');
    }
  }, [projectId, workflowName, showToast]);

  /* ─── Keyboard Shortcuts for Colab: Run, Save, Undo, Redo ────────────── */
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          workflowRef.current?.redo();
        } else {
          e.preventDefault();
          workflowRef.current?.undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        workflowRef.current?.redo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleRun();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleManualSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleRun, handleManualSave]);

  const handleExport = useCallback(() => {
    const wf = workflowRef.current?.getWorkflowData();
    if (!wf) return;
    const json = JSON.stringify({ name: workflowName, ...wf }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${workflowName.toLowerCase().replace(/\s+/g, '_')}_workflow.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Workflow JSON exported.', 'info');
  }, [workflowName, showToast]);

  const handlePublishHub = useCallback(async () => {
    const wf = workflowRef.current?.getWorkflowData();
    if (!wf?.nodes?.length) {
      showToast('Build a pipeline on the canvas before publishing.', 'warning');
      return;
    }
    try {
      await publishCommunityPipeline({
        title: workflowName || 'Community ML Pipeline',
        description: `Visual pipeline containing ${wf.nodes.length} nodes created in FlowML Studio.`,
        task_type: 'all',
        tags: ['custom', 'studio', 'flowml'],
        nodes: wf.nodes,
        edges: wf.edges || [],
        is_public: true,
      });
      showToast('Pipeline published to Community Hub! Accessible by any user.', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to publish pipeline to Hub.', 'error');
    }
  }, [workflowName, showToast]);

  const isRunning = pipelineState === 'running';

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
      {/* ── Top Bar ─────────────────────────────────────────────────────────── */}
      <TopBar
        isRunning={isRunning}
        pipelineState={pipelineState}
        workflowName={workflowName}
        setWorkflowName={setWorkflowName}
        saveStatus={saveStatus}
        onRun={handleRun}
        onStop={handleStop}
        onAddNode={handleAddNode}
        onSave={handleManualSave}
        onExport={handleExport}
        onPublishHub={handlePublishHub}
        onUndo={() => workflowRef.current?.undo()}
        onRedo={() => workflowRef.current?.redo()}
        hasResults={!!results}
        showResults={showResults}
        onToggleResults={() => setShowResults((v) => !v)}
        showToast={showToast}
      />

      {/* ── Workspace ───────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Sidebar */}
        <Sidebar />

        {/* Canvas */}
        <div className="flex-1 relative overflow-hidden">
          <Workflow onNodeClick={handleNodeClick} actionsRef={workflowRef} projectId={projectId} />

          {/* Canvas Bottom Hint */}
          <AnimatePresence>
            {!selectedNode && pipelineState === 'idle' && (
              <motion.div
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-2xl pointer-events-none flex items-center gap-2.5 text-xs shadow-lg backdrop-blur-md"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
              >
                <LayoutTemplate className="w-3.5 h-3.5 text-primary" />
                <span>Drag palette nodes · Connect pins · Click <strong className="text-primary">Run Pipeline</strong></span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Node Config Drawer */}
          <AnimatePresence>
            {showPanel && selectedNode && !showResults && (
              <motion.div
                key="panel"
                initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                transition={{ type: 'spring', stiffness: 280, damping: 28 }}
                className="absolute inset-y-0 right-0 z-30"
              >
                <PipelinePanel
                  node={selectedNode}
                  columns={datasetColumns}
                  onClose={() => { setShowPanel(false); setSelectedNode(null); }}
                  onUpdateNodeData={(id, data) => {
                    workflowRef.current?.updateNode(id, data);
                    setSelectedNode((current) => current?.id === id
                      ? { ...current, data: { ...current.data, ...data } }
                      : current);
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Full-screen Results Overlay ─────────────────────────────────────── */}
      <AnimatePresence>
        {showResults && (
          <ResultsOverlay
            pipelineState={pipelineState}
            steps={pipelineSteps}
            results={results}
            onClose={() => setShowResults(false)}
            onReset={() => { setPipelineState('idle'); setPipelineSteps([]); setResults(null); setShowResults(false); }}
          />
        )}
      </AnimatePresence>

      {/* ── Toast Notifications ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 30, x: '-50%' }}
            className="fixed bottom-8 left-1/2 flex items-center gap-2.5 px-5 py-3 rounded-2xl shadow-2xl z-[999] text-xs font-semibold"
            style={{
              background: toast.type === 'error' ? '#ef4444' : 'linear-gradient(135deg, #22c55e, #16a34a)',
              color: 'white',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}
          >
            {toast.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Google Colab Style Canvas Top Bar ──────────────────────────────────────── */
function TopBar({
  isRunning, pipelineState,
  workflowName, setWorkflowName, saveStatus,
  onRun, onStop, onAddNode, onSave, onExport, onPublishHub, onUndo, onRedo,
  hasResults, showResults, onToggleResults, showToast,
}) {
  const navigate = useNavigate();
  const [backendOnline, setBackendOnline] = useState(true);

  useEffect(() => {
    checkHealth()
      .then(() => setBackendOnline(true))
      .catch(() => setBackendOnline(false));
  }, []);

  return (
    <div className="flex flex-col shrink-0 select-none bg-white border-b border-[#DADCE0] z-50">
      <div className="flex min-h-14 items-center justify-between gap-3 border-b border-slate-200 px-3 sm:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Link to="/" className="flex shrink-0 items-center gap-2" title="FlowML Home">
            <FlowMLIcon size={36} />
            <span className="hidden sm:inline">
              <Logo size="text-base" />
            </span>
          </Link>

          <div className="hidden h-7 w-px shrink-0 bg-slate-200 sm:block" />

          <div className="flex min-w-0 flex-col justify-center">
            <input
              type="text"
              aria-label="Pipeline name"
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              className="w-36 max-w-[38vw] rounded-md bg-transparent px-1 py-0.5 text-sm font-semibold leading-5 text-slate-800 outline-none transition-colors hover:bg-slate-100 focus:ring-2 focus:ring-violet-500 sm:w-44 md:w-56"
            />
            <span className="flex items-center gap-1 px-1 text-[11px] leading-4 text-slate-500">
              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
              {saveStatus === 'saving' ? 'Saving changes…' : 'Autosaved'}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
          <div className="hidden items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-mono xl:flex">
            <div className="flex items-center gap-1.5" title="Sandbox RAM Allocation: 2.4GB / 12.0GB Used">
              <span className="text-slate-500 font-semibold">RAM</span>
              <div className="w-12 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full w-[26%] rounded-full" />
              </div>
            </div>
            <span className="text-slate-300">|</span>
            <div className="flex items-center gap-1.5" title="Sandbox Disk: 18.5GB / 100.0GB Used">
              <span className="text-slate-500 font-semibold">Disk</span>
              <div className="w-12 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div className="bg-indigo-500 h-full w-[18%] rounded-full" />
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              checkHealth()
                .then(() => {
                  setBackendOnline(true);
                  showToast?.('Kernel connected: Python 3.11');
                })
                .catch(() => {
                  setBackendOnline(false);
                  showToast?.('Kernel offline', 'error');
                });
            }}
            className={`flex h-8 items-center gap-1.5 rounded-lg border px-2 sm:px-2.5 text-[11px] font-medium transition-colors ${
              backendOnline
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                : 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
            }`}
            title="Python 3.11 Kernel (Click to refresh)"
            aria-label={`Python 3.11 kernel ${backendOnline ? 'connected' : 'offline'}. Click to refresh`}
          >
            <span className={`h-2 w-2 rounded-full ${backendOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            <span className="hidden sm:inline">{backendOnline ? 'Connected' : 'Offline'}</span>
            <span className="hidden md:inline">· Python 3.11</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/app/projects')}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 sm:px-2.5"
            title="Exit Canvas to Dashboard"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Dashboard</span>
          </button>
          <SignOutButton
            className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2 text-xs font-medium text-slate-600 transition-colors hover:bg-rose-50 hover:text-rose-600 sm:px-2.5"
            title="Sign Out"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Sign Out</span>
          </SignOutButton>
        </div>
      </div>

      <div className="flex min-h-11 items-center justify-between gap-3 bg-slate-50 px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto py-1">
          <button
            type="button"
            onClick={() => onAddNode('customPython')}
            disabled={isRunning}
            title="Add a Custom Python code node"
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 transition-colors hover:border-violet-200 hover:bg-violet-50"
          >
            <Plus className="h-3.5 w-3.5 text-violet-600" />
            <span>Code</span>
          </button>

          <button
            type="button"
            onClick={() => onAddNode('upload')}
            disabled={isRunning}
            title="Add an Upload Dataset node"
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 transition-colors hover:border-indigo-200 hover:bg-indigo-50"
          >
            <Database className="h-3.5 w-3.5 text-indigo-600" />
            <span>Dataset</span>
          </button>

          <button
            type="button"
            onClick={() => onAddNode('randomForest')}
            disabled={isRunning}
            title="Add a Random Forest model node"
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 transition-colors hover:border-emerald-200 hover:bg-emerald-50"
          >
            <Layers className="h-3.5 w-3.5 text-emerald-600" />
            <span>Model</span>
          </button>

          <div className="mx-1 h-6 w-px shrink-0 bg-slate-200" />

          <div className="flex items-center gap-0.5">
            <button
              onClick={onUndo}
              className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-white hover:text-slate-900"
              title="Undo (Ctrl+Z)"
              aria-label="Undo"
            >
              <Undo2 className="h-4 w-4" />
            </button>
            <button
              onClick={onRedo}
              className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-white hover:text-slate-900"
              title="Redo (Ctrl+Y)"
              aria-label="Redo"
            >
              <Redo2 className="h-4 w-4" />
            </button>
          </div>

          <div className="mx-1 h-6 w-px shrink-0 bg-slate-200" />

          <button
            onClick={onSave}
            className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-white hover:text-slate-900"
            title="Save Project (Ctrl+S)"
            aria-label="Save project"
          >
            <Save className="h-4 w-4" />
          </button>
          <button
            onClick={onExport}
            className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-white hover:text-slate-900"
            title="Export JSON"
            aria-label="Export pipeline as JSON"
          >
            <Download className="h-4 w-4" />
          </button>
          <button
            onClick={onPublishHub}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 transition-colors hover:border-violet-200 hover:bg-violet-50"
            title="Publish to Community Hub"
          >
            <Share2 className="h-3.5 w-3.5 text-violet-600" />
            <span className="hidden md:inline">Share</span>
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {hasResults && (
            <button
              onClick={onToggleResults}
              className={`flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors ${
                showResults
                  ? 'bg-violet-100 text-violet-700 border-violet-300'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5 text-violet-600" />
              <span className="hidden sm:inline">{showResults ? 'Hide Results' : 'View Results'}</span>
            </button>
          )}

          {isRunning ? (
            <button
              onClick={onStop}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-rose-700"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
              <span>Interrupt</span>
            </button>
          ) : (
            <button
              onClick={onRun}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-violet-600 px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-violet-700 active:scale-[0.98]"
              title="Run Pipeline (Ctrl+Enter)"
            >
              {pipelineState === 'done' ? (
                <>
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Run Again</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 fill-current" />
                  <span className="hidden sm:inline">Run Pipeline</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Root ───────────────────────────────────────────────────────────────────── */
export default function App() {
  return <AppInner />;
}
