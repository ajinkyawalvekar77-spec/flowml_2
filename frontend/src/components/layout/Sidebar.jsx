import React, { useState, useMemo } from 'react';
import {
  Database, Wrench, Layers, Zap, FileText,
  GripVertical, ChevronRight, ChevronLeft,
  Search, Cpu, Activity, BarChart2,
  TreePine, FlaskConical, BrainCircuit,
  SquareFunction, ScanSearch, Gauge, Network,
  CopyCheck, SlidersHorizontal, GitFork, Users,
  Divide, Shapes, Code,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/* ─── Node Catalog ────────────────────────────────────────────────────────────── */
const NODE_CATEGORIES = [
  {
    id: 'data', title: 'Data',
    icon: Database, color: '#3b82f6',
    items: [
      { type: 'upload',           label: 'Upload Dataset',    desc: 'CSV, Excel, JSON',        icon: Database,          color: '#3b82f6' },
      { type: 'loadCsv',          label: 'Load CSV',           desc: 'Local file loader',       icon: FileText,          color: '#0ea5e9' },
      { type: 'preview',          label: 'Preview Dataset',    desc: 'Analyze & explore',       icon: ScanSearch,        color: '#06b6d4' },
      { type: 'removeDuplicates', label: 'Remove Duplicates',  desc: 'Drop duplicate rows',     icon: CopyCheck,         color: '#0284c7' },
      { type: 'selectColumns',    label: 'Select Columns',     desc: 'Keep or drop features',   icon: SlidersHorizontal, color: '#0369a1' },
    ],
  },
  {
    id: 'processing', title: 'Processing',
    icon: Wrench, color: '#8b5cf6',
    items: [
      { type: 'fillMissing',  label: 'Fill Missing',      desc: 'Mean · Median · Mode',    icon: Activity,       color: '#8b5cf6' },
      { type: 'encode',       label: 'Encode Labels',     desc: 'One-hot · Label enc.',    icon: SquareFunction, color: '#a855f7' },
      { type: 'scale',        label: 'Scale Features',    desc: 'Standard · MinMax',       icon: Gauge,          color: '#d946ef' },
      { type: 'splitData',    label: 'Split Train/Test',  desc: 'Train / Validation split',icon: GitFork,        color: '#7c3aed' },
      { type: 'customPython', label: 'Custom Python',     desc: 'Code transformation',     icon: Code,           color: '#7C3AED' },
    ],
  },
  {
    id: 'models', title: 'Models',
    icon: Layers, color: '#f59e0b',
    items: [
      { type: 'randomForest',       label: 'Random Forest',          desc: 'Ensemble forest',        icon: TreePine, color: '#f59e0b' },
      { type: 'logisticRegression', label: 'Logistic Regression',    desc: 'Linear classification',  icon: Activity, color: '#ea580c' },
      { type: 'linearRegression',   label: 'Linear Regression',      desc: 'Baseline regression',    icon: Activity, color: '#f97316' },
      { type: 'decisionTree',       label: 'Decision Tree',          desc: 'Recursive split',        icon: Network,  color: '#ef4444' },
      { type: 'knn',                label: 'K-Nearest Neighbors',    desc: 'Neighborhood classifier',icon: Users,    color: '#d97706' },
      { type: 'svm',                label: 'Support Vector Machine', desc: 'Max-margin hyperplane',  icon: Divide,   color: '#b45309' },
      { type: 'kmeans',             label: 'K-Means Clustering',     desc: 'Unsupervised cohorts',   icon: Shapes,   color: '#059669' },
    ],
  },
  {
    id: 'ai', title: 'AI Intelligence',
    icon: BrainCircuit, color: '#22c55e',
    items: [
      { type: 'aiDecision',    label: 'AI Decision',     desc: 'Auto model selection', icon: BrainCircuit,  color: '#22c55e' },
      { type: 'explainableAi', label: 'Explainable AI',  desc: 'SHAP / Feature maps',  icon: FlaskConical,  color: '#10b981' },
    ],
  },
  {
    id: 'output', title: 'Output',
    icon: BarChart2, color: '#ec4899',
    items: [
      { type: 'prediction', label: 'Prediction',   desc: 'Run inference',      icon: Zap,      color: '#ec4899' },
      { type: 'report',     label: 'Report',       desc: 'Export PDF / HTML',  icon: FileText, color: '#f43f5e' },
    ],
  },
];

/* ─── Node card ──────────────────────────────────────────────────────────────── */
const NodeCard = ({ item, collapsed }) => {
  const Icon = item.icon;

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -1 }}
      whileTap={{ scale: 0.98 }}
      className="group relative cursor-grab active:cursor-grabbing rounded-xl transition-all overflow-hidden"
      style={{
        background: 'var(--color-bg)',
        border:     '1px solid var(--color-border)',
      }}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/reactflow', item.type);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = item.color + '50';
        e.currentTarget.style.boxShadow  = `0 4px 16px ${item.color}18`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-border)';
        e.currentTarget.style.boxShadow  = 'none';
      }}
    >
      {/* left accent bar */}
      <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-l-xl" style={{ background: item.color }} />

      <div className={`flex items-center gap-3 px-3 py-2.5 ${collapsed ? 'justify-center' : ''}`}>
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: item.color + '1a' }}
        >
          <Icon className="w-3.5 h-3.5" style={{ color: item.color }} />
        </div>

        {!collapsed && (
          <div className="min-w-0">
            <div className="text-xs font-semibold truncate" style={{ color: 'var(--color-text)' }}>
              {item.label}
            </div>
            <div className="text-[9px] truncate mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              {item.desc}
            </div>
          </div>
        )}
      </div>

      {/* drag handle hint */}
      {!collapsed && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-40 transition-opacity">
          <GripVertical className="w-3 h-3" style={{ color: 'var(--color-text-muted)' }} />
        </div>
      )}

      {/* Tooltip for collapsed */}
      {collapsed && (
        <div
          className="absolute left-14 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap z-50 pointer-events-none shadow-xl"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
        >
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: item.color }} />
          {item.label}
        </div>
      )}
    </motion.div>
  );
};

/* ─── Sidebar ─────────────────────────────────────────────────────────────────── */
const Sidebar = () => {
  const [collapsed,  setCollapsed]  = useState(false);
  const [query,      setQuery]      = useState('');
  const [openCats,   setOpenCats]   = useState(() => Object.fromEntries(NODE_CATEGORIES.map((c) => [c.id, true])));

  const filtered = useMemo(() => {
    if (!query.trim()) return NODE_CATEGORIES;
    const q = query.toLowerCase();
    return NODE_CATEGORIES.map((cat) => ({
      ...cat,
      items: cat.items.filter(
        (it) => it.label.toLowerCase().includes(q) || it.desc.toLowerCase().includes(q)
      ),
    })).filter((c) => c.items.length > 0);
  }, [query]);

  const toggleCat = (id) => setOpenCats((p) => ({ ...p, [id]: !p[id] }));

  return (
    <aside
      className="h-full flex flex-col z-40 shrink-0 transition-all duration-300"
      style={{
        width:       collapsed ? '60px' : '260px',
        background:  'var(--color-surface)',
        borderRight: '1px solid var(--color-border)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
        {!collapsed && (
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
            Components
          </span>
        )}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setCollapsed((v) => !v)}
          className="ml-auto w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
          style={{ color: 'var(--color-text-muted)', background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </motion.button>
      </div>

      {/* Search (only when expanded) */}
      {!collapsed && (
        <div className="px-3 py-2.5" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--color-text-muted)' }} />
            <input
              type="text"
              placeholder="Search nodes…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-xs rounded-xl focus:outline-none focus:ring-1 focus:ring-primary/40 transition-colors"
              style={{
                background: 'var(--color-bg)',
                border:     '1px solid var(--color-border)',
                color:      'var(--color-text)',
              }}
            />
          </div>
        </div>
      )}

      {/* Categories */}
      <div className="flex-1 overflow-y-auto py-2 space-y-0.5 px-2">
        {filtered.map((cat) => {
          const CatIcon = cat.icon;
          const isOpen  = openCats[cat.id] ?? true;

          return (
            <div key={cat.id}>
              {/* Category header */}
              <button
                onClick={() => !collapsed && toggleCat(cat.id)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg mb-1 transition-colors"
                style={{ color: 'var(--color-text-muted)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <CatIcon className="w-3.5 h-3.5 shrink-0" style={{ color: cat.color }} />
                {!collapsed && (
                  <>
                    <span className="text-[10px] font-bold uppercase tracking-widest flex-1 text-left">
                      {cat.title}
                    </span>
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                      style={{ background: cat.color + '20', color: cat.color }}
                    >
                      {cat.items.length}
                    </span>
                    <ChevronRight
                      className="w-3 h-3 transition-transform duration-200"
                      style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
                    />
                  </>
                )}
              </button>

              {/* Items */}
              <AnimatePresence initial={false}>
                {(isOpen || collapsed) && (
                  <motion.div
                    initial={collapsed ? false : { height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    className="overflow-hidden space-y-1 mb-2"
                    style={{ paddingLeft: collapsed ? 0 : '4px' }}
                  >
                    {cat.items.map((item) => (
                      <NodeCard key={item.type} item={item} collapsed={collapsed} />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="py-8 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
            No nodes match "{query}"
          </div>
        )}
      </div>

      {/* Footer tip */}
      {!collapsed && (
        <div className="px-3 py-3" style={{ borderTop: '1px solid var(--color-border)' }}>
          <div
            className="p-3 rounded-xl text-[10px] leading-relaxed"
            style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.15)', color: 'var(--color-text-muted)' }}
          >
            <span className="font-bold text-primary">Drag</span> nodes onto the canvas.
            Connect them by pulling from a handle to another node.
          </div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
