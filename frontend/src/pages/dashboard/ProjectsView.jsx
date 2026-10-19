import React, { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getProjects, saveProject, deleteProject, duplicateProject,
} from '../../services/api';
import {
  Plus, Search, MoreVertical, Edit2, Copy, Trash2,
  ExternalLink, Calendar, Clock, Layers, Sparkles, AlertTriangle, X,
  CheckCircle2, ArrowRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import FlowMLIcon from '../../components/FlowMLIcon';

export default function ProjectsView({ initialCreateOpen = false }) {
  const { showToast } = useOutletContext();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [projects, setProjects] = useState(() => getProjects());
  const [dismissedTourUser, setDismissedTourUser] = useState(null);
  const [tourStep, setTourStep] = useState(0);
  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(initialCreateOpen);
  const [renameTarget, setRenameTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // New project form state
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newType, setNewType] = useState('classification');

  // Rename form state
  const [renameTitle, setRenameTitle] = useState('');
  const [renameDesc, setRenameDesc] = useState('');

  const tourVisible = Boolean(
    user?.uid &&
    projects.length === 0 &&
    dismissedTourUser !== user.uid &&
    localStorage.getItem(`flowml_onboarding_seen_${user.uid}`) !== 'true'
  );

  const finishTour = () => {
    if (user?.uid) localStorage.setItem(`flowml_onboarding_seen_${user.uid}`, 'true');
    setDismissedTourUser(user?.uid ?? null);
  };

  const tourSteps = [
    { title: 'Welcome to FlowML', detail: 'Build machine-learning workflows visually, from data upload through predictions.' },
    { title: 'Start with a dataset', detail: 'Upload your own CSV or Excel file, or begin from a workflow template.' },
    { title: 'Run and explore', detail: 'Connect nodes, run the workflow, and review results and predictions.' },
  ];

  const refreshProjects = () => {
    setProjects(getProjects());
  };

  const handleCreate = (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newProj = {
      id: `proj-${Date.now()}`,
      name: newTitle.trim(),
      description: newDesc.trim() || 'Custom visual ML pipeline',
      taskType: newType,
      nodesCount: 2,
    };

    saveProject(newProj);
    finishTour();
    refreshProjects();
    setIsCreateOpen(false);
    setNewTitle('');
    setNewDesc('');
    showToast(`Project "${newProj.name}" created successfully!`, 'success');
  };

  const handleRename = (e) => {
    e.preventDefault();
    if (!renameTarget || !renameTitle.trim()) return;

    saveProject({
      ...renameTarget,
      name: renameTitle.trim(),
      description: renameDesc.trim(),
    });
    refreshProjects();
    setRenameTarget(null);
    showToast('Project renamed successfully.', 'success');
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    try {
      deleteProject(deleteTarget.id);
      refreshProjects();
      showToast(`Project "${deleteTarget.name}" deleted.`, 'info');
      setDeleteTarget(null);
    } catch (error) {
      showToast(error.message || 'Failed to delete project.', 'error');
    }
  };

  const handleDuplicate = (id) => {
    const copy = duplicateProject(id);
    if (copy) {
      refreshProjects();
      showToast(`Duplicated as "${copy.name}".`, 'success');
    }
  };

  const handleOpenStudio = (id) => {
    navigate(`/studio/${id}`);
  };

  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.description && p.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner & Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight" style={{ color: 'var(--color-text)' }}>
            ML Projects
          </h1>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Create and manage your visual machine learning pipelines, graphs, and experiment artifacts.
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="px-4 py-2.5 rounded-xl font-bold text-xs text-white flex items-center gap-2 shadow-lg transition-all active:scale-95 shrink-0 self-start md:self-auto"
          style={{
            background: 'linear-gradient(135deg, #7C3AED, #6D28D9)',
            boxShadow: '0 4px 16px rgba(124, 58, 237, 0.35)',
          }}
        >
          <Plus className="w-4 h-4" />
          New Project
        </button>
      </div>

      {tourVisible && (
        <section
          aria-label="Getting started tour"
          className="rounded-2xl border border-violet-200 bg-violet-50 p-5 flex flex-col sm:flex-row sm:items-center gap-4"
        >
          <div className="flex-1">
            <p className="text-[10px] uppercase tracking-wider font-bold text-violet-700">
              Getting started · {tourStep + 1} of {tourSteps.length}
            </p>
            <h2 className="mt-1 text-sm font-bold text-slate-900">{tourSteps[tourStep].title}</h2>
            <p className="mt-1 text-xs text-slate-600">{tourSteps[tourStep].detail}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={finishTour} className="px-3 py-2 text-xs font-semibold text-slate-600">
              Skip tour
            </button>
            {tourStep < tourSteps.length - 1 ? (
              <button
                onClick={() => setTourStep((step) => step + 1)}
                className="px-3 py-2 rounded-lg bg-violet-600 text-xs font-bold text-white"
              >
                Next
              </button>
            ) : (
              <button
                onClick={() => {
                  finishTour();
                  navigate('/studio');
                }}
                className="px-3 py-2 rounded-lg bg-violet-600 text-xs font-bold text-white"
              >
                Create your first workflow
              </button>
            )}
          </div>
        </section>
      )}

      {/* Filter / Search Bar */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects by name or description…"
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
          Showing {filtered.length} of {projects.length} projects
        </div>
      </div>

      {/* Projects Grid */}
      {filtered.length === 0 ? (
        <div
          className="rounded-3xl p-12 text-center border border-dashed flex flex-col items-center justify-center max-w-xl mx-auto my-8"
          style={{
            borderColor: 'var(--color-border)',
            background: 'var(--color-surface)',
          }}
        >
          <FlowMLIcon size={56} className="mb-4" />
          <h3 className="font-display font-bold text-base mb-1" style={{ color: 'var(--color-text)' }}>
            No projects found
          </h3>
          <p className="text-xs max-w-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
            {search ? 'No project matches your search terms.' : 'You haven’t created any projects yet. Start with a blank canvas or browse our pre-built templates.'}
          </p>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-2"
            style={{ background: 'linear-gradient(135deg, #7C3AED, #6D28D9)' }}
          >
            <Plus className="w-3.5 h-3.5" />
            Create First Project
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((proj) => (
            <motion.div
              key={proj.id}
              whileHover={{ y: -3 }}
              transition={{ duration: 0.2 }}
              className="rounded-2xl p-5 border flex flex-col justify-between transition-all group relative"
              style={{
                background: 'var(--color-surface)',
                borderColor: 'var(--color-border)',
              }}
            >
              {/* Card Header */}
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs"
                      style={{ background: 'rgba(124, 58, 237, 0.12)', color: '#7C3AED' }}
                    >
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <h3
                        onClick={() => handleOpenStudio(proj.id)}
                        className="font-display font-bold text-sm tracking-tight hover:text-primary transition-colors cursor-pointer"
                        style={{ color: 'var(--color-text)' }}
                      >
                        {proj.name}
                      </h3>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full uppercase font-bold"
                        style={{
                          background: proj.taskType === 'regression' ? 'rgba(249, 115, 22, 0.12)' : 'rgba(124, 58, 237, 0.12)',
                          color: proj.taskType === 'regression' ? '#f97316' : '#7C3AED',
                        }}
                      >
                        {proj.taskType || 'Classification'}
                      </span>
                    </div>
                  </div>

                  {/* Actions Dropdown Trigger */}
                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => {
                        setRenameTarget(proj);
                        setRenameTitle(proj.name);
                        setRenameDesc(proj.description || '');
                      }}
                      title="Rename"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDuplicate(proj.id)}
                      title="Duplicate"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(proj)}
                      title="Delete"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-xs line-clamp-2 mt-2 leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                  {proj.description || 'Visual machine learning workflow.'}
                </p>
              </div>

              {/* Card Footer */}
              <div className="mt-5 pt-4 border-t flex items-center justify-between text-[11px]" style={{ borderColor: 'var(--color-border)' }}>
                <div className="flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
                  <Clock className="w-3 h-3" />
                  <span>
                    Modified {proj.lastModified ? new Date(proj.lastModified).toLocaleDateString() : 'recently'}
                  </span>
                </div>

                <button
                  onClick={() => handleOpenStudio(proj.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-primary hover:bg-primary/10 flex items-center gap-1 transition-colors"
                >
                  Open Studio
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Project Modal */}
      <AnimatePresence>
        {isCreateOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-3xl p-6 shadow-2xl relative"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-bold text-base" style={{ color: 'var(--color-text)' }}>
                  Create New ML Project
                </h3>
                <button
                  onClick={() => setIsCreateOpen(false)}
                  className="p-1 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                    Project Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Churn Risk Predictor"
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    style={{
                      background: 'var(--color-bg)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text)',
                    }}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                    Description
                  </label>
                  <textarea
                    rows={3}
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="Describe the workflow goal or dataset source…"
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    style={{
                      background: 'var(--color-bg)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text)',
                    }}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                    Primary Task Type
                  </label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    style={{
                      background: 'var(--color-bg)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text)',
                    }}
                  >
                    <option value="classification">Classification (Predict discrete classes/labels)</option>
                    <option value="regression">Regression (Predict continuous values)</option>
                    <option value="clustering">Clustering (Unsupervised segmentation)</option>
                  </select>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl text-xs font-bold text-white shadow-lg"
                    style={{ background: 'linear-gradient(135deg, #7C3AED, #6D28D9)' }}
                  >
                    Create Project
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Rename Modal */}
      <AnimatePresence>
        {renameTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-3xl p-6 shadow-2xl relative"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
              }}
            >
              <h3 className="font-display font-bold text-base mb-4" style={{ color: 'var(--color-text)' }}>
                Rename Project
              </h3>
              <form onSubmit={handleRename} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                    Project Name
                  </label>
                  <input
                    type="text"
                    required
                    value={renameTitle}
                    onChange={(e) => setRenameTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    style={{
                      background: 'var(--color-bg)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text)',
                    }}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                    Description
                  </label>
                  <textarea
                    rows={2}
                    value={renameDesc}
                    onChange={(e) => setRenameDesc(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    style={{
                      background: 'var(--color-bg)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text)',
                    }}
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setRenameTarget(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white"
                    style={{ background: 'linear-gradient(135deg, #7C3AED, #6D28D9)' }}
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
              <h3 className="font-display font-bold text-base mb-1" style={{ color: 'var(--color-text)' }}>
                Delete Project?
              </h3>
              <p className="text-xs leading-relaxed mb-6" style={{ color: 'var(--color-text-muted)' }}>
                Are you sure you want to delete <span className="font-bold" style={{ color: 'var(--color-text)' }}>"{deleteTarget.name}"</span>? This will permanently delete the project and its stored canvas workflow.
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
                  Delete Project
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
