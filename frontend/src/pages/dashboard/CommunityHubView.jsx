import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, GitFork, Star, Share2, Sparkles, Database,
  ArrowRight, Download, Upload, Check, ExternalLink,
  Tag, Filter, Plus, BookOpen, Layers, Terminal, X,
  Activity, BarChart2, ShieldCheck, CheckCircle2,
} from 'lucide-react';
import {
  listCommunityPipelines,
  starCommunityPipeline,
  forkCommunityPipeline,
  publishCommunityPipeline,
  exportCommunityPipelineUrl,
  getProjects,
  saveProject,
  workflowStorageKey,
} from '../../services/api';
import api from '../../services/api';
import Toast from '../../components/common/Toast';

export default function CommunityHubView() {
  const navigate = useNavigate();

  const [pipelines, setPipelines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [taskFilter, setTaskFilter] = useState('all');
  const [sortBy, setSortBy] = useState('popular');
  const [toast, setToast] = useState(null);

  // Modals state
  const [selectedPipelineForDataset, setSelectedPipelineForDataset] = useState(null);
  const [availableDatasets, setAvailableDatasets] = useState([]);
  const [loadingDatasets, setLoadingDatasets] = useState(false);
  const [selectedDatasetId, setSelectedDatasetId] = useState(null);
  const [selectedDatasetName, setSelectedDatasetName] = useState('');

  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishForm, setPublishForm] = useState({
    title: '',
    description: '',
    task_type: 'regression',
    tags: 'regression, machine-learning, tabular',
    projectId: '',
  });
  const [userProjects, setUserProjects] = useState([]);
  const [publishing, setPublishing] = useState(false);

  const showToast = (msg, type = 'success', title = '') => {
    setToast({ msg, type, title });
    setTimeout(() => setToast(null), 4000);
  };

  // Fetch pipelines from backend
  const fetchPipelines = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await listCommunityPipelines({
        search: searchQuery || undefined,
        task_type: taskFilter !== 'all' ? taskFilter : undefined,
        sort: sortBy,
      });
      setPipelines(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || 'Failed to fetch community pipelines');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, taskFilter, sortBy]);

  useEffect(() => {
    fetchPipelines();
  }, [fetchPipelines]);

  // Load user datasets for dataset selection modal
  const handleOpenDatasetModal = async (pipeline) => {
    setSelectedPipelineForDataset(pipeline);
    setSelectedDatasetId(null);
    setSelectedDatasetName('');
    setLoadingDatasets(true);
    try {
      const res = await api.get('/api/datasets');
      const list = Array.isArray(res.data) ? res.data : [];
      // Combine with bundled samples
      const bundled = [
        {
          dataset_id: 'sample_housing',
          file_name: 'housing.csv (California Housing - Regression)',
          sample_type: 'regression',
          is_bundled: true,
          rows: 20640,
          columns: 9,
        },
        {
          dataset_id: 'sample_titanic',
          file_name: 'titanic.csv (Titanic Survival - Classification)',
          sample_type: 'classification',
          is_bundled: true,
          rows: 891,
          columns: 12,
        },
        {
          dataset_id: 'sample_iris',
          file_name: 'iris.csv (Iris Flowers - Multi-Class)',
          sample_type: 'classification',
          is_bundled: true,
          rows: 150,
          columns: 5,
        },
      ];
      setAvailableDatasets([...list, ...bundled]);
      if (list.length > 0) {
        setSelectedDatasetId(list[0].dataset_id);
        setSelectedDatasetName(list[0].file_name);
      } else {
        setSelectedDatasetId(bundled[0].dataset_id);
        setSelectedDatasetName(bundled[0].file_name);
      }
    } catch {
      setAvailableDatasets([]);
    } finally {
      setLoadingDatasets(false);
    }
  };

  // Apply community pipeline to selected dataset and open in Studio
  const handleApplyToDataset = async () => {
    if (!selectedPipelineForDataset || !selectedDatasetId) return;

    try {
      const res = await forkCommunityPipeline(
        selectedPipelineForDataset.id,
        selectedDatasetId,
        selectedDatasetName
      );
      const forked = res.pipeline;

      const newProjectId = `proj-${Date.now()}`;
      const title = `[Fork] ${forked.title}`;

      saveProject({
        id: newProjectId,
        name: title,
        description: forked.description,
        taskType: forked.task_type || 'regression',
        nodesCount: forked.nodes?.length || 0,
      });

      // Save workflow nodes and edges to localStorage
      localStorage.setItem(
        workflowStorageKey(newProjectId),
        JSON.stringify({
          nodes: forked.nodes || [],
          edges: forked.edges || [],
        })
      );

      showToast(`Pipeline applied! Opening "${title}" in Studio…`, 'success');
      setSelectedPipelineForDataset(null);
      setTimeout(() => {
        navigate(`/studio/${newProjectId}`);
      }, 500);
    } catch (err) {
      showToast(err.message || 'Failed to apply pipeline to dataset.', 'error');
    }
  };

  // Handle starring a pipeline
  const handleToggleStar = async (pipelineId, e) => {
    e.stopPropagation();
    try {
      const res = await starCommunityPipeline(pipelineId);
      setPipelines((prev) =>
        prev.map((p) =>
          p.id === pipelineId
            ? { ...p, stars: res.stars, is_starred: res.is_starred }
            : p
        )
      );
    } catch {
      showToast('Could not update star rating.', 'error');
    }
  };

  // Open Publish Modal
  const handleOpenPublish = () => {
    const projects = getProjects();
    setUserProjects(projects);
    if (projects.length > 0) {
      setPublishForm({
        title: projects[0].name,
        description: projects[0].description || 'Visual machine learning pipeline created in FlowML Studio.',
        task_type: projects[0].taskType || 'regression',
        tags: `${projects[0].taskType || 'regression'}, flowml, custom`,
        projectId: projects[0].id,
      });
    }
    setShowPublishModal(true);
  };

  // Handle Publish Submit
  const handlePublishSubmit = async (e) => {
    e.preventDefault();
    if (!publishForm.title.trim()) {
      showToast('Please provide a title.', 'warning');
      return;
    }

    setPublishing(true);
    try {
      let nodes = [];
      let edges = [];

      if (publishForm.projectId) {
        const rawWf = localStorage.getItem(workflowStorageKey(publishForm.projectId));
        if (rawWf) {
          const parsed = JSON.parse(rawWf);
          nodes = parsed.nodes || [];
          edges = parsed.edges || [];
        }
      }

      if (nodes.length === 0) {
        // Fallback default clean nodes
        nodes = [
          { id: 'node-1', type: 'upload', data: { label: 'Upload Dataset' }, position: { x: 50, y: 140 } },
          { id: 'node-2', type: 'fillMissing', data: { label: 'Fill Missing', missing_values: 'median' }, position: { x: 320, y: 140 } },
          { id: 'node-3', type: 'scale', data: { label: 'Scale Features', scaling: 'standard' }, position: { x: 590, y: 140 } },
          { id: 'node-4', type: 'linearRegression', data: { label: 'Linear Regression', task_type: publishForm.task_type }, position: { x: 860, y: 140 } },
          { id: 'node-5', type: 'prediction', data: { label: 'Prediction Engine' }, position: { x: 1130, y: 140 } },
        ];
        edges = [
          { id: 'e1-2', source: 'node-1', target: 'node-2', animated: true, style: { stroke: '#6366F1' } },
          { id: 'e2-3', source: 'node-2', target: 'node-3', animated: true, style: { stroke: '#6366F1' } },
          { id: 'e3-4', source: 'node-3', target: 'node-4', animated: true, style: { stroke: '#6366F1' } },
          { id: 'e4-5', source: 'node-4', target: 'node-5', animated: true, style: { stroke: '#6366F1' } },
        ];
      }

      const tagsArray = publishForm.tags
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);

      const res = await publishCommunityPipeline({
        title: publishForm.title.trim(),
        description: publishForm.description.trim(),
        task_type: publishForm.task_type,
        tags: tagsArray,
        author: 'data_scientist',
        nodes,
        edges,
        is_public: true,
      });

      showToast(`"${res.pipeline.title}" published to Community Hub!`, 'success');
      setShowPublishModal(false);
      fetchPipelines();
    } catch (err) {
      showToast(err.message || 'Failed to publish pipeline.', 'error');
    } finally {
      setPublishing(false);
    }
  };

  const filteredPipelines = useMemo(() => {
    return pipelines.filter((p) => {
      if (!searchQuery) return true;
      const s = searchQuery.toLowerCase();
      return (
        p.title?.toLowerCase().includes(s) ||
        p.description?.toLowerCase().includes(s) ||
        p.author?.toLowerCase().includes(s) ||
        p.tags?.some((t) => t.toLowerCase().includes(s))
      );
    });
  }, [pipelines, searchQuery]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl p-8 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xl border border-indigo-900/40">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(99,102,241,0.18),transparent_70%)] pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Public Community Hub — Similar to GitHub</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">
              Machine Learning Pipeline Hub
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Explore public end-to-end ML workflows published by the community.
              Directly attach any pipeline to <span className="text-indigo-400 font-semibold">your own dataset</span> with one click and run offline in Canvas Studio.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <button
              onClick={handleOpenPublish}
              className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs transition-all shadow-lg shadow-violet-600/30 hover:shadow-violet-600/50 cursor-pointer active:scale-95"
            >
              <Share2 className="w-4 h-4" />
              <span>Publish Pipeline</span>
            </button>
          </div>
        </div>
      </div>

      {/* Search & Filters Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search pipelines by name, author, or tag (e.g. regression, housing, random forest)…"
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-slate-800 placeholder-slate-400 transition-all"
          />
        </div>

        {/* Task Category Filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'all', label: 'All Tasks' },
            { id: 'regression', label: '📈 Regression' },
            { id: 'classification', label: '🎯 Classification' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTaskFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                taskFilter === tab.id
                  ? 'bg-violet-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Sorting Dropdown */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 cursor-pointer"
          >
            <option value="popular">🔥 Most Popular</option>
            <option value="stars">⭐ Most Starred</option>
            <option value="recent">🕒 Recently Published</option>
          </select>
        </div>
      </div>

      {/* Pipelines Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-64 rounded-3xl bg-slate-100 animate-pulse border border-slate-200" />
          ))}
        </div>
      ) : error ? (
        <div className="p-8 text-center rounded-3xl bg-red-50 border border-red-200 text-red-700">
          <p className="font-semibold">{error}</p>
          <button
            onClick={fetchPipelines}
            className="mt-3 px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold"
          >
            Retry
          </button>
        </div>
      ) : filteredPipelines.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center">
            <BookOpen className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">No pipelines found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              No community pipelines matched your search. Clear filters or be the first to publish a pipeline!
            </p>
          </div>
          <button
            onClick={() => {
              setSearchQuery('');
              setTaskFilter('all');
            }}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-violet-600 bg-violet-50 hover:bg-violet-100"
          >
            Clear Search
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredPipelines.map((pipe) => {
            const isReg = pipe.task_type === 'regression';
            const isClf = pipe.task_type === 'classification';

            return (
              <div
                key={pipe.id}
                className="group flex flex-col justify-between rounded-3xl bg-white border border-slate-200/80 p-6 shadow-xs hover:shadow-md hover:border-violet-300 transition-all"
              >
                <div className="space-y-4">
                  {/* Card Header: Author & Task Badge */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white text-[10px] font-bold font-mono shrink-0 shadow-xs">
                        {pipe.author?.slice(0, 2).toUpperCase() || 'ML'}
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-slate-700">@{pipe.author}</span>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {pipe.created_at ? new Date(pipe.created_at).toLocaleDateString() : 'Community'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          isReg
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : isClf
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {pipe.task_type || 'All'}
                      </span>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-violet-600 transition-colors">
                      {pipe.title}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                      {pipe.description}
                    </p>
                  </div>

                  {/* Mini Node Workflow Preview */}
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-1.5 overflow-x-auto text-[11px] text-slate-600 font-medium select-none">
                    {pipe.nodes && pipe.nodes.length > 0 ? (
                      pipe.nodes.map((node, idx) => (
                        <React.Fragment key={node.id || idx}>
                          <span className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 shadow-2xs whitespace-nowrap text-slate-700">
                            {node.data?.label || node.type}
                          </span>
                          {idx < pipe.nodes.length - 1 && (
                            <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                          )}
                        </React.Fragment>
                      ))
                    ) : (
                      <span className="text-slate-400">Standard 5-Node Flow</span>
                    )}
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {pipe.tags?.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-medium"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="pt-5 mt-5 border-t border-slate-100 flex items-center justify-between gap-3">
                  {/* Stars & Forks */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => handleToggleStar(pipe.id, e)}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        pipe.is_starred
                          ? 'bg-amber-50 text-amber-600 border border-amber-200'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                      title="Star this pipeline"
                    >
                      <Star className={`w-3.5 h-3.5 ${pipe.is_starred ? 'fill-amber-500 text-amber-500' : ''}`} />
                      <span>{pipe.stars || 0}</span>
                    </button>

                    <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-50 text-slate-500 text-xs font-medium">
                      <GitFork className="w-3.5 h-3.5" />
                      <span>{pipe.forks || 0}</span>
                    </div>

                    <a
                      href={exportCommunityPipelineUrl(pipe.id)}
                      download
                      className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                      title="Export .flowml definition file"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  </div>

                  {/* Primary Action: Use with My Dataset */}
                  <button
                    onClick={() => handleOpenDatasetModal(pipe)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold text-xs shadow-xs hover:shadow-md transition-all active:scale-95 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Use with My Dataset</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal: Select Dataset to apply pipeline ────────────────────── */}
      {selectedPipelineForDataset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-violet-600">
                  Bind Community Pipeline
                </div>
                <h2 className="text-lg font-bold text-slate-900 mt-0.5">
                  Apply &ldquo;{selectedPipelineForDataset.title}&rdquo; to Your Dataset
                </h2>
              </div>
              <button
                onClick={() => setSelectedPipelineForDataset(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Select one of your uploaded datasets or bundled sample data. The pipeline structure will automatically bind to your dataset and open directly in Canvas Studio.
            </p>

            {/* Dataset Picker */}
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {loadingDatasets ? (
                <div className="p-8 text-center text-xs text-slate-400">Loading datasets…</div>
              ) : availableDatasets.length === 0 ? (
                <div className="p-6 text-center rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
                  No datasets found. Please upload a dataset in Datasets tab first.
                </div>
              ) : (
                availableDatasets.map((ds) => {
                  const isSelected = selectedDatasetId === ds.dataset_id;
                  return (
                    <div
                      key={ds.dataset_id}
                      onClick={() => {
                        setSelectedDatasetId(ds.dataset_id);
                        setSelectedDatasetName(ds.file_name);
                      }}
                      className={`p-3.5 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                        isSelected
                          ? 'border-violet-500 bg-violet-50/70 text-violet-950 shadow-xs'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${isSelected ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                          <Database className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold leading-snug">{ds.file_name}</div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            {ds.rows?.toLocaleString()} rows · {ds.columns} cols
                            {ds.is_bundled && ' · Bundled'}
                          </div>
                        </div>
                      </div>

                      {isSelected && <CheckCircle2 className="w-5 h-5 text-violet-600" />}
                    </div>
                  );
                })
              )}
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedPipelineForDataset(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!selectedDatasetId}
                onClick={handleApplyToDataset}
                className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold shadow-md shadow-violet-600/30 transition-all cursor-pointer disabled:opacity-50"
              >
                Apply Pipeline & Open Studio
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Publish Pipeline to Hub ────────────────────────────── */}
      {showPublishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-violet-600">
                  Community Sharing
                </div>
                <h2 className="text-lg font-bold text-slate-900 mt-0.5">
                  Publish Pipeline to Community Hub
                </h2>
              </div>
              <button
                onClick={() => setShowPublishModal(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePublishSubmit} className="space-y-4">
              {/* Select from existing project */}
              {userProjects.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Select Workflow from My Projects:
                  </label>
                  <select
                    value={publishForm.projectId}
                    onChange={(e) => {
                      const p = userProjects.find((x) => x.id === e.target.value);
                      if (p) {
                        setPublishForm({
                          ...publishForm,
                          projectId: p.id,
                          title: p.name,
                          description: p.description || publishForm.description,
                          task_type: p.taskType || publishForm.task_type,
                        });
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                  >
                    {userProjects.map((proj) => (
                      <option key={proj.id} value={proj.id}>
                        {proj.name} ({proj.taskType || 'ml'})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pipeline Title:
                </label>
                <input
                  type="text"
                  required
                  value={publishForm.title}
                  onChange={(e) => setPublishForm({ ...publishForm, title: e.target.value })}
                  placeholder="e.g. Robust Real-Estate Price Regressor"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description:
                </label>
                <textarea
                  rows={3}
                  value={publishForm.description}
                  onChange={(e) => setPublishForm({ ...publishForm, description: e.target.value })}
                  placeholder="Describe your model nodes, preprocessing, and recommended dataset schema…"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500/20 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Problem Task Type:
                  </label>
                  <select
                    value={publishForm.task_type}
                    onChange={(e) => setPublishForm({ ...publishForm, task_type: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                  >
                    <option value="regression">Regression (Continuous)</option>
                    <option value="classification">Classification (Discrete)</option>
                    <option value="all">Universal / AutoML</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tags (comma-separated):
                  </label>
                  <input
                    type="text"
                    value={publishForm.tags}
                    onChange={(e) => setPublishForm({ ...publishForm, tags: e.target.value })}
                    placeholder="regression, housing, linear"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPublishModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={publishing}
                  className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold shadow-md shadow-violet-600/30 transition-all cursor-pointer disabled:opacity-50"
                >
                  {publishing ? 'Publishing…' : 'Publish to Community'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
