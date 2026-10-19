import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import ReactFlow, {
  addEdge,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  MiniMap,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  MarkerType,
  getBezierPath,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';

import {
  UploadNode,
  PreprocessNode,
  CustomPythonNode,
  ModelNode,
  AIDecisionNode,
  OutputNode,
  PreviewNode,
} from '../components/nodes/CustomNodes';
import { workflowStorageKey } from '../services/api';

const nodeTypes = {
  // Data
  upload: UploadNode,
  loadCsv: UploadNode,
  preview: PreviewNode,
  removeDuplicates: PreprocessNode,
  selectColumns: PreprocessNode,

  // Preprocessing
  fillMissing: PreprocessNode,
  encode: PreprocessNode,
  scale: PreprocessNode,
  splitData: PreprocessNode,
  customPython: CustomPythonNode,

  // Models
  randomForest: ModelNode,
  linearRegression: ModelNode,
  decisionTree: ModelNode,
  logisticRegression: ModelNode,
  knn: ModelNode,
  svm: ModelNode,
  kmeans: ModelNode,

  // AI & Explainability
  aiDecision: AIDecisionNode,
  explainableAi: AIDecisionNode,

  // Output
  prediction: OutputNode,
  report: OutputNode,
};

const LABEL_MAP = {
  upload: 'Upload Dataset',
  loadCsv: 'Load CSV',
  preview: 'Preview Dataset',
  removeDuplicates: 'Remove Duplicates',
  selectColumns: 'Select Columns',
  fillMissing: 'Fill Missing',
  encode: 'Encode Labels',
  scale: 'Scale Features',
  splitData: 'Split Train/Test',
  customPython: 'Custom Python',
  randomForest: 'Random Forest',
  linearRegression: 'Linear Regression',
  decisionTree: 'Decision Tree',
  logisticRegression: 'Logistic Regression',
  knn: 'K-Nearest Neighbors',
  svm: 'Support Vector Machine',
  kmeans: 'K-Means Clustering',
  aiDecision: 'AI Decision',
  explainableAi: 'Explainable AI',
  prediction: 'Prediction',
  report: 'Report',
};

const DESC_MAP = {
  upload: 'CSV, Excel — primary data source',
  loadCsv: 'Load a local tabular file',
  preview: 'Inspect data as a table',
  removeDuplicates: 'Drop duplicate rows based on keys',
  selectColumns: 'Keep or drop specific feature columns',
  fillMissing: 'Mean, Median, or Constant strategy',
  encode: 'One-hot or Label encoding',
  scale: 'Normalize or Standardize features',
  splitData: 'Train / Validation set partition',
  randomForest: 'Ensemble learning model',
  linearRegression: 'Baseline regression model',
  decisionTree: 'Recursive partitioning tree',
  logisticRegression: 'Linear classification estimator',
  knn: 'Neighborhood vote classification',
  svm: 'Maximum margin classification hyperplane',
  kmeans: 'Unsupervised clustering grouping',
  aiDecision: 'Autonomous reasoning engine',
  explainableAi: 'Feature importance & SHAP maps',
  prediction: 'Run model inference',
  report: 'Generate PDF / HTML report',
};

const initialNodes = [
  {
    id: 'node-1',
    type: 'upload',
    data: { label: 'Upload Dataset', description: 'CSV, Excel — primary data source' },
    position: { x: 80, y: 140 },
  },
  {
    id: 'node-2',
    type: 'randomForest',
    data: { label: 'Random Forest', description: 'Ensemble learning model' },
    position: { x: 420, y: 140 },
  },
];

const initialEdges = [
  {
    id: 'e1-2',
    type: 'deletable',
    source: 'node-1',
    target: 'node-2',
    animated: true,
    style: { stroke: '#7C3AED' },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#7C3AED' },
  },
];

const DeletableEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  selected,
}) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  const { deleteElements } = useReactFlow();

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />
      {selected && (
        <EdgeLabelRenderer>
          <button
            type="button"
            aria-label="Remove connection"
            title="Remove connection"
            className="nodrag nopan pointer-events-auto flex h-6 w-6 items-center justify-center rounded-full border border-red-300 bg-white text-red-500 shadow-md transition-colors hover:bg-red-50"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
            onClick={(event) => {
              event.stopPropagation();
              deleteElements({ edges: [{ id }] });
            }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

const edgeTypes = {
  deletable: DeletableEdge,
};

// Inner component — must be inside ReactFlowProvider
const WorkflowInner = ({ onNodeClick, actionsRef, projectId: routeProjectId }) => {
  const [searchParams] = useSearchParams();
  const projectId = routeProjectId || searchParams.get('project');

  // Load from local project workflow key if exists
  const getSavedWorkflow = () => {
    if (projectId) {
      try {
        const raw = localStorage.getItem(workflowStorageKey(projectId));
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.nodes && parsed.edges) return parsed;
        }
      } catch (err) {
        console.warn('Could not load project workflow:', err);
      }
    }
    return { nodes: initialNodes, edges: initialEdges };
  };

  const saved = getSavedWorkflow();
  const [nodes, setNodes, onNodesChange] = useNodesState(saved.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    saved.edges.map((edge) => ({ ...edge, type: 'deletable' }))
  );
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const flowWrapperRef = useRef(null);

  // Undo / Redo history stacks
  const historyRef = useRef({
    past: [],
    future: [],
  });

  const pushHistory = useCallback(() => {
    historyRef.current.past.push({
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
    });
    // Cap history size to 30 states
    if (historyRef.current.past.length > 30) {
      historyRef.current.past.shift();
    }
    historyRef.current.future = [];
  }, [nodes, edges]);

  const undo = useCallback(() => {
    if (!historyRef.current.past.length) return false;
    const previous = historyRef.current.past.pop();
    historyRef.current.future.push({
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
    });
    setNodes(previous.nodes);
    setEdges(previous.edges);
    return true;
  }, [nodes, edges, setNodes, setEdges]);

  const redo = useCallback(() => {
    if (!historyRef.current.future.length) return false;
    const next = historyRef.current.future.pop();
    historyRef.current.past.push({
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
    });
    setNodes(next.nodes);
    setEdges(next.edges);
    return true;
  }, [nodes, edges, setNodes, setEdges]);

  const addNode = useCallback((type) => {
    if (!Object.prototype.hasOwnProperty.call(nodeTypes, type) || !reactFlowInstance || !flowWrapperRef.current) {
      return null;
    }

    const bounds = flowWrapperRef.current.getBoundingClientRect();
    const zoom = reactFlowInstance.getZoom();
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;
    const offsets = [[0, 0]];

    for (let ring = 1; ring <= Math.ceil(Math.sqrt(nodes.length)) + 1; ring += 1) {
      for (let x = -ring; x <= ring; x += 1) offsets.push([x, -ring]);
      for (let y = -ring + 1; y <= ring; y += 1) offsets.push([ring, y]);
      for (let x = ring - 1; x >= -ring; x -= 1) offsets.push([x, ring]);
      for (let y = ring - 1; y > -ring; y -= 1) offsets.push([-ring, y]);
    }

    const position = offsets
      .map(([x, y]) => {
        const center = reactFlowInstance.screenToFlowPosition({
          x: centerX + x * 250,
          y: centerY + y * 165,
        });
        return { x: center.x - 110, y: center.y - 75 };
      })
      .find((candidate) => nodes.every((node) => {
        const width = (node.width ?? 220) + 24 / zoom;
        const height = (node.height ?? 150) + 24 / zoom;
        return candidate.x + 220 <= node.position.x
          || candidate.x >= node.position.x + width
          || candidate.y + 150 <= node.position.y
          || candidate.y >= node.position.y + height;
      }));

    if (!position) return null;

    const newNode = {
      id: `node-${Math.random().toString(36).slice(2, 11)}`,
      type,
      position,
      data: {
        label: LABEL_MAP[type] || type,
        description: DESC_MAP[type] || `Configure ${type} node`,
      },
    };

    pushHistory();
    setNodes((currentNodes) => currentNodes.concat(newNode));
    return newNode;
  }, [nodes, pushHistory, reactFlowInstance, setNodes]);

  const dotColor = '#dde3ed';
  const canvasBg  = '#f0f4f8';

  // Expose workflow actions to parent (App.jsx) via ref
  useEffect(() => {
    if (!actionsRef) return;
    actionsRef.current = {
      getWorkflowData: () => ({ nodes, edges }),
      addNode,
      setWorkflowData: (data) => {
        if (data.nodes) setNodes(data.nodes);
        if (data.edges) {
          setEdges(data.edges.map((edge) => ({ ...edge, type: 'deletable' })));
        }
      },
      updateNode: (nodeId, newData) => {
        pushHistory();
        setNodes((nds) =>
          nds.map((n) =>
            n.id === nodeId ? { ...n, data: { ...n.data, ...newData } } : n
          )
        );
      },
      undo,
      redo,
      canUndo: () => historyRef.current.past.length > 0,
      canRedo: () => historyRef.current.future.length > 0,
      clearValidationErrors: () => {
        setNodes((nds) =>
          nds.map((n) => {
            const restData = { ...(n.data || {}) };
            delete restData.validationError;
            return { ...n, data: restData };
          })
        );
      },
      setValidationError: (nodeId, errorMsg) => {
        setNodes((nds) =>
          nds.map((n) =>
            n.id === nodeId ? { ...n, data: { ...n.data, validationError: errorMsg } } : n
          )
        );
      },
      setNodeStatus: (nodeId, status) => {
        setNodes((nds) =>
          nds.map((n) =>
            n.id === nodeId ? { ...n, data: { ...n.data, status } } : n
          )
        );
      },
      resetNodeStatuses: () => {
        setNodes((nds) =>
          nds.map((n) => ({
            ...n,
            data: { ...n.data, status: null, validationError: null },
          }))
        );
      },
    };
  }, [nodes, edges, actionsRef, setNodes, setEdges, undo, redo, pushHistory, addNode]);

  const onConnect = useCallback(
    (params) => {
      pushHistory();
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: 'deletable',
            animated: true,
            style: { stroke: '#7C3AED' },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#7C3AED' },
          },
          eds
        )
      );
    },
    [setEdges, pushHistory]
  );

  const onEdgesDeleteWithHistory = useCallback(() => {
    pushHistory();
  }, [pushHistory]);

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow');
      if (!type || !reactFlowInstance) return;

      pushHistory();
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode = {
        id: `node-${Math.random().toString(36).substr(2, 9)}`,
        type,
        position,
        data: {
          label: LABEL_MAP[type] || type,
          description: DESC_MAP[type] || `Configure ${type} node`,
        },
      };
      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes, pushHistory]
  );

  return (
    <div className="w-full h-full relative">
      <div
        ref={flowWrapperRef}
        className="w-full h-full"
        style={{
          '--dot-color': dotColor,
          backgroundImage: `radial-gradient(circle, ${dotColor} 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
          backgroundColor: canvasBg,
        }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onEdgesDelete={onEdgesDeleteWithHistory}
          onConnect={onConnect}
          onInit={setReactFlowInstance}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onNodeClick={(_, node) => onNodeClick(node)}
          onPaneClick={() => onNodeClick(null)}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          snapToGrid
          snapGrid={[20, 20]}
          minZoom={0.25}
          maxZoom={2}
          defaultEdgeOptions={{
            type: 'deletable',
            animated: true,
            style: { stroke: '#7C3AED', strokeWidth: 2.5 },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#7C3AED' },
          }}
          style={{ background: 'transparent' }}
        >
          <Controls />
          <MiniMap
            nodeColor={(n) => {
              const COLORS = {
                upload: '#3b82f6', loadCsv: '#0ea5e9', preview: '#06b6d4',
                removeDuplicates: '#0284c7', selectColumns: '#0369a1',
                fillMissing: '#8b5cf6', encode: '#a855f7', scale: '#d946ef', splitData: '#7c3aed',
                randomForest: '#f59e0b', linearRegression: '#f97316', decisionTree: '#ef4444',
                logisticRegression: '#ea580c', knn: '#d97706', svm: '#b45309', kmeans: '#059669',
                aiDecision: '#22c55e', explainableAi: '#10b981',
                prediction: '#ec4899', report: '#f43f5e',
              };
              return COLORS[n.type] ?? '#7C3AED';
            }}
            maskColor="rgba(240,244,248,0.8)"
            style={{ borderRadius: 12 }}
          />
        </ReactFlow>
      </div>
    </div>
  );
};

// Wrap with provider so useReactFlow() works inside CustomNodes
const Workflow = ({ onNodeClick, actionsRef, projectId }) => (
  <ReactFlowProvider>
    <WorkflowInner onNodeClick={onNodeClick} actionsRef={actionsRef} projectId={projectId} />
  </ReactFlowProvider>
);

export default Workflow;
