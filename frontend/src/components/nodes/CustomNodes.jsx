import React, { memo } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';
import { motion } from 'framer-motion';
import {
  Database, Wrench, Layers, Zap, FileText,
  Trash2, Table, CheckCircle2, Clock, AlertCircle,
  Loader2, TreePine, Activity, Network, SquareFunction,
  Gauge, BrainCircuit, FlaskConical, ScanSearch,
  CopyCheck, SlidersHorizontal, GitFork, Users,
  Divide, Shapes, ShieldAlert, Code,
} from 'lucide-react';

/* ─── Node type → visual config ─────────────────────────────────────────────── */
const NODE_CONFIG = {
  // Data
  upload:             { label: 'Upload Dataset',    Icon: Database,          color: '#3b82f6', category: 'Data'       },
  loadCsv:            { label: 'Load CSV',           Icon: FileText,          color: '#0ea5e9', category: 'Data'       },
  preview:            { label: 'Preview Dataset',    Icon: ScanSearch,        color: '#06b6d4', category: 'Data'       },
  removeDuplicates:   { label: 'Remove Duplicates',  Icon: CopyCheck,         color: '#0284c7', category: 'Data'       },
  selectColumns:      { label: 'Select Columns',     Icon: SlidersHorizontal, color: '#0369a1', category: 'Data'       },

  // Processing
  fillMissing:        { label: 'Fill Missing',        Icon: Activity,          color: '#8b5cf6', category: 'Processing' },
  encode:             { label: 'Encode Labels',       Icon: SquareFunction,    color: '#a855f7', category: 'Processing' },
  scale:              { label: 'Scale Features',      Icon: Gauge,             color: '#d946ef', category: 'Processing' },
  splitData:          { label: 'Split Train/Test',    Icon: GitFork,           color: '#7c3aed', category: 'Processing' },
  customPython:       { label: 'Custom Python',       Icon: Code,              color: '#7C3AED', category: 'Processing' },

  // Models
  randomForest:       { label: 'Random Forest',       Icon: TreePine,          color: '#f59e0b', category: 'Model'      },
  linearRegression:   { label: 'Linear Regression',   Icon: Activity,          color: '#f97316', category: 'Model'      },
  decisionTree:       { label: 'Decision Tree',       Icon: Network,           color: '#ef4444', category: 'Model'      },
  logisticRegression: { label: 'Logistic Regression', Icon: Activity,          color: '#ea580c', category: 'Model'      },
  knn:                { label: 'K-Nearest Neighbors', Icon: Users,             color: '#d97706', category: 'Model'      },
  svm:                { label: 'Support Vector Machine',Icon: Divide,          color: '#b45309', category: 'Model'      },
  kmeans:             { label: 'K-Means Clustering',  Icon: Shapes,            color: '#059669', category: 'Model'      },

  // AI & Explainability
  aiDecision:         { label: 'AI Decision',         Icon: BrainCircuit,      color: '#22c55e', category: 'AI'         },
  explainableAi:      { label: 'Explainable AI',      Icon: FlaskConical,      color: '#10b981', category: 'AI'         },

  // Output
  prediction:         { label: 'Prediction',          Icon: Zap,               color: '#ec4899', category: 'Output'     },
  report:             { label: 'Report',              Icon: FileText,          color: '#f43f5e', category: 'Output'     },
};

const STATUS_CFG = {
  // Live pipeline statuses
  pending:   { label: 'Pending',   color: '#8892a4', Icon: Clock,         pulse: false },
  running:   { label: 'Running…',  color: '#7C3AED', Icon: Loader2,       pulse: true  },
  completed: { label: 'Completed', color: '#22c55e', Icon: CheckCircle2,  pulse: false },
  failed:    { label: 'Failed',    color: '#ef4444', Icon: AlertCircle,   pulse: false },

  // Backward compatibility
  uploaded:  { label: 'Uploaded',  color: '#22c55e', Icon: CheckCircle2,  pulse: false },
  analyzed:  { label: 'Analyzed',  color: '#22c55e', Icon: CheckCircle2,  pulse: false },
  processed: { label: 'Processed', color: '#22c55e', Icon: CheckCircle2,  pulse: false },
  trained:   { label: 'Trained',   color: '#22c55e', Icon: CheckCircle2,  pulse: false },
  predicted: { label: 'Predicted', color: '#22c55e', Icon: CheckCircle2,  pulse: false },
  error:     { label: 'Error',     color: '#ef4444', Icon: AlertCircle,   pulse: false },
};

/* ─── Base node ──────────────────────────────────────────────────────────────── */
const BaseNode = memo(({ id, data, type, selected }) => {
  const { setNodes, setEdges } = useReactFlow();
  const cfg = NODE_CONFIG[type] ?? { label: data.label ?? type, Icon: Database, color: '#7C3AED', category: 'Node' };
  const { Icon, color, category } = cfg;
  const label = data.label ?? cfg.label;

  const rawStatus = (data.status || '').toLowerCase();
  const statusCfg = STATUS_CFG[rawStatus] || null;
  const StatusIcon = statusCfg?.Icon;

  const hasValidationError = Boolean(data.validationError);

  const onDelete = (e) => {
    e.stopPropagation();
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  };

  const isSource = ['upload', 'loadCsv'].includes(type);
  const isSink   = ['prediction', 'report'].includes(type);

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0, y: 8 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      className="relative group"
      style={{ minWidth: 210 }}
    >
      {/* Target handle (left) */}
      {!isSource && (
        <Handle
          type="target"
          position={Position.Left}
          style={{
            width: 12, height: 12,
            background: color,
            border: '2.5px solid var(--color-surface)',
            left: -6,
            boxShadow: `0 0 8px ${color}60`,
          }}
        />
      )}
      {!isSource && (
        <Handle
          id="target-top"
          type="target"
          position={Position.Top}
          style={{
            width: 12, height: 12,
            background: color,
            border: '2.5px solid var(--color-surface)',
            top: -6,
            boxShadow: `0 0 8px ${color}60`,
          }}
        />
      )}

      {/* Card */}
      <div
        className="rounded-2xl overflow-hidden transition-all duration-200"
        style={{
          background: 'var(--color-surface)',
          border: hasValidationError
            ? '2px solid #ef4444'
            : `1.5px solid ${selected ? color : 'var(--color-border)'}`,
          boxShadow: hasValidationError
            ? '0 0 16px rgba(239, 68, 68, 0.4)'
            : selected
            ? `0 0 0 3px ${color}20, 0 8px 24px rgba(0,0,0,0.15)`
            : '0 4px 12px rgba(0,0,0,0.1)',
        }}
      >
        {/* Top color bar */}
        <div className="h-0.5 w-full" style={{ background: hasValidationError ? '#ef4444' : color }} />

        {/* Validation Error Banner */}
        {hasValidationError && (
          <div className="bg-red-500/15 border-b border-red-500/25 px-3 py-1 flex items-center gap-1.5 text-[9px] font-semibold text-red-400">
            <ShieldAlert className="w-3 h-3 shrink-0" />
            <span className="truncate">{data.validationError}</span>
          </div>
        )}

        {/* Body */}
        <div className="px-3.5 pt-3 pb-3">
          {/* Header row */}
          <div className="flex items-start justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: color + '18' }}
              >
                <Icon className="w-4 h-4" style={{ color }} />
              </div>
              <div>
                <p className="text-[8px] font-bold uppercase tracking-widest" style={{ color: color + 'c0' }}>
                  {category}
                </p>
                <p className="text-xs font-bold leading-tight" style={{ color: 'var(--color-text)' }}>
                  {label}
                </p>
              </div>
            </div>

            {/* Delete btn */}
            <button
              onClick={onDelete}
              className="opacity-0 group-hover:opacity-100 transition-all w-6 h-6 rounded-lg flex items-center justify-center"
              style={{ color: '#ef4444' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239,68,68,0.12)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              title="Delete node"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>

          {/* Description */}
          {data.description && (
            <p className="text-[10px] leading-snug mb-2 line-clamp-2" style={{ color: 'var(--color-text-muted)' }}>
              {data.description}
            </p>
          )}

          {/* Config / File badge */}
          {data.file_name && (
            <div
              className="px-2 py-1 rounded-lg text-[9px] font-mono truncate mb-2"
              style={{ background: color + '10', color: color, border: `1px solid ${color}30` }}
            >
              📄 {data.file_name}
            </div>
          )}

          {/* Status footer with Live badge */}
          <div
            className="flex items-center justify-between pt-2"
            style={{ borderTop: '1px solid var(--color-border)' }}
          >
            <div className="flex items-center gap-1.5">
              {statusCfg ? (
                <>
                  <StatusIcon
                    className={`w-3 h-3 ${statusCfg.pulse ? 'animate-spin' : ''}`}
                    style={{ color: statusCfg.color }}
                  />
                  <span className="text-[9px] font-semibold" style={{ color: statusCfg.color }}>
                    {statusCfg.label}
                  </span>
                </>
              ) : (
                <>
                  <Clock className="w-3 h-3" style={{ color: 'var(--color-text-muted)' }} />
                  <span className="text-[9px] font-medium" style={{ color: 'var(--color-text-muted)' }}>
                    Ready
                  </span>
                </>
              )}
            </div>
            <span className="text-[8px] font-mono" style={{ color: 'var(--color-border)' }}>
              {id.slice(-4).toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {/* Source handle (right) */}
      {!isSink && (
        <Handle
          type="source"
          position={Position.Right}
          style={{
            width: 12, height: 12,
            background: color,
            border: '2.5px solid var(--color-surface)',
            right: -6,
            boxShadow: `0 0 8px ${color}60`,
          }}
        />
      )}
      {!isSink && (
        <Handle
          id="source-bottom"
          type="source"
          position={Position.Bottom}
          style={{
            width: 12, height: 12,
            background: color,
            border: '2.5px solid var(--color-surface)',
            bottom: -6,
            boxShadow: `0 0 8px ${color}60`,
          }}
        />
      )}
    </motion.div>
  );
});

BaseNode.displayName = 'BaseNode';

/* ─── Typed exports ──────────────────────────────────────────────────────────── */
export const UploadNode        = memo((p) => <BaseNode {...p} />);
export const PreviewNode       = memo((p) => <BaseNode {...p} />);
export const PreprocessNode    = memo((p) => <BaseNode {...p} />);
export const CustomPythonNode  = memo((p) => <BaseNode {...p} />);
export const ModelNode         = memo((p) => <BaseNode {...p} />);
export const AIDecisionNode    = memo((p) => <BaseNode {...p} />);
export const OutputNode        = memo((p) => <BaseNode {...p} />);

UploadNode.displayName       = 'UploadNode';
PreviewNode.displayName      = 'PreviewNode';
PreprocessNode.displayName   = 'PreprocessNode';
CustomPythonNode.displayName = 'CustomPythonNode';
ModelNode.displayName        = 'ModelNode';
AIDecisionNode.displayName   = 'AIDecisionNode';
OutputNode.displayName       = 'OutputNode';

export default BaseNode;
