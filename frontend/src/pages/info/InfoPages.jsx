import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import SignOutButton from '../../components/auth/SignOutButton';
import {
  ArrowLeft, Shield, FileText, Mail, BookOpen, Video,
  Cpu, CheckCircle2, Send, ExternalLink, HelpCircle, Layers,
  Sparkles, Lock, ArrowRight, Code2, Terminal, Database,
  Copy, Check, Zap, Play, Sliders, Search, FileCode, LogOut,
} from 'lucide-react';
import Logo from '../../components/common/Logo';
import FlowMLIcon from '../../components/FlowMLIcon';

function PageHeader({ title, subtitle, badge, icon: Icon }) {
  const navigate = useNavigate();

  return (
    <div
      className="relative pt-24 pb-12 border-b overflow-hidden"
      style={{ borderColor: 'var(--color-border)' }}
    >
      <div
        className="absolute -top-40 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full blur-3xl pointer-events-none"
        style={{ background: 'rgba(99,102,241,0.07)' }}
      />
      <div className="max-w-5xl mx-auto px-6 relative z-10">
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 text-xs font-semibold transition-colors mb-6 group hover:text-violet-600"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          Back to FlowML
        </button>

        <div className="flex items-center gap-3 mb-4">
          {Icon && (
            <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-200 flex items-center justify-center text-violet-600">
              <Icon className="w-5 h-5" />
            </div>
          )}
          {badge && (
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-violet-50 text-violet-600 border border-violet-200">
              {badge}
            </span>
          )}
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3" style={{ color: 'var(--color-text)' }}>
          {title}
        </h1>
        <p className="text-base max-w-2xl leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
          {subtitle}
        </p>
      </div>
    </div>
  );
}

function PageLayout({ children, title, subtitle, badge, icon }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div
      className="min-h-screen flex flex-col font-sans"
      style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}
    >
      {/* Top Nav */}
      <header
        className="fixed top-0 inset-x-0 z-50 h-16 flex items-center"
        style={{
          background: 'var(--color-surface)',
          borderBottom: '1px solid var(--color-border)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div className="max-w-5xl mx-auto px-6 w-full flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <FlowMLIcon size={44} />
            <Logo size="text-lg" />
          </Link>

          <div className="flex items-center gap-4">
            {user ? (
              <>
                <button
                  onClick={() => navigate('/app')}
                  className="text-xs font-semibold transition-colors hover:text-violet-600"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  Dashboard
                </button>
                <SignOutButton
                  redirectTo="/"
                  className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-violet-600 hover:bg-violet-500 text-white shadow-sm transition-all flex items-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </SignOutButton>
              </>
            ) : (
              <>
                <button
                  onClick={() => navigate('/signin')}
                  className="text-xs font-semibold transition-colors hover:text-violet-600"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  Sign In
                </button>
                <button
                  onClick={() => navigate('/app')}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-violet-600 hover:bg-violet-500 text-white shadow-sm transition-all"
                >
                  Open App
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <PageHeader title={title} subtitle={subtitle} badge={badge} icon={icon} />
        <div className="max-w-5xl mx-auto px-6 py-12">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer
        className="py-8 border-t text-xs"
        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
      >
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 FlowML Studio. Visual AutoML Platform.</p>
          <div className="flex items-center gap-6">
            <button onClick={() => navigate('/privacy')} className="hover:text-violet-600 transition-colors">Privacy</button>
            <button onClick={() => navigate('/terms')} className="hover:text-violet-600 transition-colors">Terms</button>
            <button onClick={() => navigate('/contact')} className="hover:text-violet-600 transition-colors">Contact</button>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ─── 1. Documentation Page ─────────────────────────────────────────────────── */
export function DocsPage() {
  const [activeTab, setActiveTab] = React.useState('quickstart');
  const [nodeCategory, setNodeCategory] = React.useState('all');
  const [search, setSearch] = React.useState('');
  const [copiedCode, setCopiedCode] = React.useState(false);
  const navigate = useNavigate();

  const copySnippet = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const NODE_CATALOG = [
    {
      id: 'ingestion',
      category: 'Data Ingestion',
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
      nodes: [
        {
          name: 'Upload Dataset',
          type: 'upload',
          inputs: 'None (Root Node)',
          outputs: 'DataFrame (csv / xlsx / xls)',
          params: 'file: Binary File Upload (Max 25MB)',
          when: 'Use as the entry point of your pipeline to upload CSV or Excel files from your computer.',
          tip: 'Automatically infers column data types, missing value percentages, and row counts.'
        },
        {
          name: 'Load CSV',
          type: 'loadCsv',
          inputs: 'None (Root Node)',
          outputs: 'DataFrame (csv)',
          params: 'file_path: Internal relative storage path',
          when: 'Attach previously uploaded workspace datasets or built-in sample datasets (Titanic, Housing).',
          tip: 'Fastest way to prototype models without re-uploading large data files.'
        },
        {
          name: 'Preview Dataset',
          type: 'preview',
          inputs: 'DataFrame',
          outputs: 'DataFrame (Pass-through) + Schema Profile',
          params: 'sample_rows: Top N rows to inspect (default 10)',
          when: 'Inspect column schemas, data distributions, and value spreads before preprocessing.',
          tip: 'Displays a live interactive table directly inside the canvas drawer.'
        },
        {
          name: 'Remove Duplicates',
          type: 'removeDuplicates',
          inputs: 'DataFrame',
          outputs: 'De-duplicated DataFrame',
          params: 'keep: First or Last occurrence; compare all columns automatically or choose a subset',
          when: 'Eliminate duplicate rows to prevent over-weighting repeated observations.',
          tip: 'Connect right after Upload Node for clean baseline data hygiene.'
        },
        {
          name: 'Select Columns',
          type: 'selectColumns',
          inputs: 'DataFrame',
          outputs: 'Filtered DataFrame',
          params: 'selected_columns: Choose feature columns to keep, or use Automatic to retain all',
          when: 'Drop uninformative IDs, tracking timestamps, or data leakage columns.',
          tip: 'Drastically reduces memory usage and speeds up model training.'
        }
      ]
    },
    {
      id: 'preprocess',
      category: 'Preprocessing & Transforms',
      badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
      nodes: [
        {
          name: 'Fill Missing',
          type: 'fillMissing',
          inputs: 'DataFrame',
          outputs: 'Imputed DataFrame',
          params: 'strategy: mean | median | most_frequent | constant | drop; impute all compatible columns automatically or choose columns',
          when: 'Handle null or NaN values. Scikit-learn estimators fail if missing values are present.',
          tip: 'Use median for skewed numeric distributions; use most_frequent for categories.'
        },
        {
          name: 'Encode Labels',
          type: 'encode',
          inputs: 'DataFrame',
          outputs: 'Numerically Encoded DataFrame',
          params: 'categorical_encoding: label | onehot; encode all categorical columns automatically or choose columns',
          when: 'Convert textual categorical values into machine-readable numbers.',
          tip: 'Use One-Hot for nominal categories (<10 unique values); Label Encoding for ordinal ranks.'
        },
        {
          name: 'Scale Features',
          type: 'scale',
          inputs: 'DataFrame',
          outputs: 'Normalized Feature DataFrame',
          params: 'scaling: standard | minmax | robust; scale all numeric columns automatically or choose columns',
          when: 'Normalize feature magnitudes so features with large values do not dominate the model.',
          tip: 'Mandatory for KNN, SVM, Logistic Regression, and Neural Networks.'
        },
        {
          name: 'Split Train/Test',
          type: 'splitData',
          inputs: 'DataFrame',
          outputs: 'Train DataFrame & Test DataFrame',
          params: 'test_size: 0.15 - 0.30, random_state: 42 (seed)',
          when: 'Divide data into training and evaluation sets to prevent overfitting.',
          tip: 'Always evaluate models on holdout test data to measure true generalization.'
        },
        {
          name: 'Custom Python',
          type: 'customPython',
          inputs: 'DataFrame (accessible as "df")',
          outputs: 'Transformed DataFrame',
          params: 'code: Python script string (Sandboxed execution)',
          when: 'Perform custom domain logic, mathematical formulas, regex parsing, or feature synthesis.',
          tip: 'Executes inside an isolated worker with NumPy and Pandas pre-loaded.'
        }
      ]
    },
    {
      id: 'models',
      category: 'Machine Learning Models',
      badgeColor: 'bg-violet-50 text-violet-700 border-violet-200',
      nodes: [
        {
          name: 'Random Forest',
          type: 'randomForest',
          inputs: 'Train DataFrame',
          outputs: 'Trained Model Artifact + Validation Metrics',
          params: 'n_estimators (50-200), max_depth (5-20), target_col: Target name',
          when: 'Gold-standard ensemble algorithm. Handles non-linear relationships and resistant to overfitting.',
          tip: 'Excellent default baseline for tabular classification and regression.'
        },
        {
          name: 'Linear / Logistic Regression',
          type: 'linearRegression / logisticRegression',
          inputs: 'Scaled Train DataFrame',
          outputs: 'Model Artifact + Feature Weights',
          params: 'C: Inverse regularization strength, solver: lbfgs',
          when: 'Fast, highly interpretable baseline for continuous values or binary classifications.',
          tip: 'Ensure features are scaled using the Scale Features node before training.'
        },
        {
          name: 'Decision Tree',
          type: 'decisionTree',
          inputs: 'Train DataFrame',
          outputs: 'Decision Tree Graph + Rules',
          params: 'max_depth: Maximum tree depth, criterion: gini | entropy',
          when: 'Requires transparent white-box decision logic that can be audited by humans.',
          tip: 'Keep max_depth between 3 and 6 to prevent deep tree overfitting.'
        },
        {
          name: 'Support Vector Machine (SVM)',
          type: 'svm',
          inputs: 'Scaled Train DataFrame',
          outputs: 'Max-Margin Model Artifact',
          params: 'kernel: rbf | linear, C: Margin penalty, gamma: scale',
          when: 'Excels with high-dimensional data where features outnumber observations.',
          tip: 'Requires scaled inputs; training complexity scales quadratically with dataset size.'
        },
        {
          name: 'K-Means Clustering',
          type: 'kmeans',
          inputs: 'Scaled Feature DataFrame',
          outputs: 'Cluster Labels + Centroids',
          params: 'n_clusters: Number of clusters (2-10), init: k-means++',
          when: 'Unsupervised grouping, customer segmentation, or anomaly detection.',
          tip: 'Inspect the Silhouette Score to find the optimal number of clusters.'
        }
      ]
    },
    {
      id: 'ai_output',
      category: 'AI Tournament & Explainability',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      nodes: [
        {
          name: 'AI Decision (AutoML Tournament)',
          type: 'aiDecision',
          inputs: 'Preprocessed Dataset',
          outputs: 'Champion Model Recommendation + Leaderboard',
          params: 'metric_focus: accuracy | f1 | r2 | speed',
          when: 'Automatically train, evaluate, and rank candidate models in a competitive tournament.',
          tip: 'Selects the champion model based on validation metrics and training latency.'
        },
        {
          name: 'Explainable AI (SHAP)',
          type: 'explainableAi',
          inputs: 'Trained Model + Dataset',
          outputs: 'SHAP Feature Importance & Force Plots',
          params: 'explainer_type: TreeExplainer | KernelExplainer',
          when: 'Audit model decisions, understand why individual predictions were made, and comply with AI regulations.',
          tip: 'Identifies which features drove predictions higher or lower for each observation.'
        },
        {
          name: 'Prediction Output',
          type: 'prediction',
          inputs: 'Trained Model + Records to Predict',
          outputs: 'Prediction Array + Class Probabilities',
          params: 'batch_inference: true | false',
          when: 'Generate predictions for new unlabelled observations.',
          tip: 'Export predictions as CSV or inspect directly in the results modal.'
        },
        {
          name: 'Report Generator',
          type: 'report',
          inputs: 'Pipeline Execution Context',
          outputs: 'Audit Report (HTML / PDF / JSON)',
          params: 'reportTitle: Document heading',
          when: 'Create an exportable compliance report documenting pipeline architecture, hyperparameters, and metrics.',
          tip: 'Ready to share with stakeholders and regulatory compliance teams.'
        }
      ]
    }
  ];

  const METRICS = [
    {
      category: 'Classification Metrics',
      items: [
        { name: 'Accuracy', formula: '(TP + TN) / Total', best: '1.0 (100%)', desc: 'Overall percentage of correct predictions across all classes. Best for balanced datasets.' },
        { name: 'Precision', formula: 'TP / (TP + FP)', best: '1.0', desc: 'Out of all positive predictions, how many were true positives. High precision avoids costly false alarms.' },
        { name: 'Recall (Sensitivity)', formula: 'TP / (TP + FN)', best: '1.0', desc: 'Out of all actual positive cases, how many were correctly detected. Critical for medical screening and fraud.' },
        { name: 'F1 Score', formula: '2 · (Precision · Recall) / (Precision + Recall)', best: '1.0', desc: 'Harmonic mean of precision and recall. The best single metric for imbalanced classification tasks.' },
        { name: 'ROC-AUC', formula: 'Area under Receiver Operating Characteristic', best: '1.0 (0.5 is random)', desc: 'Measures class separation ability across all decision thresholds. Invariant to class imbalance.' },
      ]
    },
    {
      category: 'Regression & Clustering Metrics',
      items: [
        { name: 'R² (Determination)', formula: '1 - (SS_res / SS_tot)', best: '1.0 (Higher is better)', desc: 'Proportion of target variance explained by the model. 1.0 represents a perfect fit; 0.0 is equal to mean baseline.' },
        { name: 'RMSE', formula: '√[ Mean((y - ŷ)²) ]', best: '0.0 (Lower is better)', desc: 'Root Mean Squared Error. Heavily penalizes large outlier mistakes and is expressed in target units.' },
        { name: 'MAE', formula: 'Mean(|y - ŷ|)', best: '0.0 (Lower is better)', desc: 'Mean Absolute Error. Average magnitude of prediction errors, resilient to outlier anomalies.' },
        { name: 'Silhouette Score', formula: '(b - a) / max(a, b)', best: '+1.0 (-1 to +1)', desc: 'Measures cluster cohesion and separation. Higher scores indicate well-separated distinct clusters.' },
      ]
    }
  ];

  const FAQS = [
    {
      q: 'How do I build my first pipeline in FlowML?',
      a: 'Go to Canvas Studio (click Launch Canvas). Drag an "Upload Dataset" or "Load CSV" node onto the canvas. Next, add a "Fill Missing" and "Encode Labels" preprocessing node and connect them with a cable. Add a model node (e.g. Random Forest) and connect the preprocessed output to the model input. Finally, click "Run Pipeline" to execute!'
    },
    {
      q: 'What is the correct order of nodes in a pipeline?',
      a: 'Standard FlowML workflow: [1. Data Ingestion] ➔ [2. Data Cleaning: Fill Missing / Remove Duplicates] ➔ [3. Feature Encoding & Scaling] ➔ [4. Split Train/Test] ➔ [5. Model Training or AI Decision] ➔ [6. Explainable AI or Prediction Output].'
    },
    {
      q: 'Can I export trained models to production Python applications?',
      a: 'Yes! Trained model artifacts can be downloaded directly from the Models tab as standalone Python joblib or pickle files. You can load and use them in FastAPI, Flask, AWS Lambda, or Docker with standard scikit-learn.'
    },
    {
      q: 'How does the AI Decision AutoML tournament work?',
      a: 'When you include the AI Decision node, FlowML automatically trains Random Forest, Logistic Regression, Decision Tree, and SVM candidates across your dataset in parallel. It benchmarks each candidate on validation accuracy, F1 score, and inference latency, and automatically crowns the champion model.'
    },
    {
      q: 'How is user-authored Python code executed securely?',
      a: 'Custom Python scripts execute inside a restricted worker sandbox with a 256MB memory cap, 1.0 CPU quota, 15-second timeout watchdog, read-only root filesystem, and zero outbound network access. It will never crash the server or affect other users.'
    },
    {
      q: 'What dataset formats and file sizes are supported?',
      a: 'FlowML natively parses CSV (.csv), Excel spreadsheets (.xlsx, .xls), and structured JSON tables up to 25MB per file. Datasets are securely stored in your user-isolated storage namespace.'
    }
  ];

  const filteredNodes = NODE_CATALOG.filter(cat =>
    nodeCategory === 'all' || cat.id === nodeCategory
  ).map(cat => ({
    ...cat,
    nodes: cat.nodes.filter(n =>
      n.name.toLowerCase().includes(search.toLowerCase()) ||
      n.when.toLowerCase().includes(search.toLowerCase()) ||
      n.type.toLowerCase().includes(search.toLowerCase())
    )
  })).filter(cat => cat.nodes.length > 0);

  return (
    <PageLayout
      title="System Documentation & Knowledge Base"
      subtitle="Comprehensive guides, step-by-step pipeline architectures, 14 node specifications, and mathematical metrics glossary for FlowML Studio."
      badge="User Manual"
      icon={BookOpen}
    >
      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 mb-8 overflow-x-auto">
        {[
          { id: 'quickstart', label: '🚀 Quickstart & Pipeline Basics' },
          { id: 'nodes', label: '🧩 14 Visual Nodes Catalog' },
          { id: 'metrics', label: '📐 Metrics & Loss Glossary' },
          { id: 'sandbox', label: '🛡️ Sandbox & Security Limits' },
          { id: 'python', label: '🐍 Custom Python Scripting' },
          { id: 'faq', label: '❓ FAQs & Troubleshooting' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === tab.id
                ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
                : 'text-slate-600 hover:text-violet-600 hover:bg-violet-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── 1. Quickstart & Pipeline Basics Tab ────────────────────────────── */}
      {activeTab === 'quickstart' && (
        <div className="space-y-10">
          {/* Hero Banner */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg space-y-3">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/20 text-white backdrop-blur-sm">
              <Sparkles className="w-3.5 h-3.5" /> Getting Started
            </div>
            <h2 className="text-xl sm:text-2xl font-bold">How FlowML Visual Pipelines Work</h2>
            <p className="text-sm text-violet-100 max-w-2xl leading-relaxed">
              FlowML replaces complex machine learning code with an intuitive node-and-cable canvas. Each node represents a validated data transformation or machine learning algorithm. When you click <strong>Run Pipeline</strong>, FlowML compiles your graph into an optimized Directed Acyclic Graph (DAG) executed in real time.
            </p>
            <div className="pt-2 flex items-center gap-3">
              <button
                onClick={() => navigate('/studio')}
                className="px-4 py-2 rounded-xl bg-white text-violet-700 font-bold text-xs hover:bg-violet-50 transition-colors shadow-sm"
              >
                Open Canvas Studio
              </button>
              <button
                onClick={() => navigate('/tutorials')}
                className="px-4 py-2 rounded-xl bg-white/10 text-white border border-white/20 font-bold text-xs hover:bg-white/20 transition-colors"
              >
                Try Sample Tutorials
              </button>
            </div>
          </div>

          {/* 5-Step Pipeline Lifecycle Cards */}
          <div className="space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Zap className="w-4 h-4 text-violet-600" />
              The 5-Step Pipeline Lifecycle
            </h3>

            <div className="grid md:grid-cols-5 gap-4">
              {[
                {
                  step: '01',
                  title: 'Upload Data',
                  desc: 'Drop in your CSV or Excel file. FlowML profiles schema, column types, and null counts.',
                  color: 'border-blue-200 bg-blue-50/50 text-blue-700',
                  badge: 'Ingestion'
                },
                {
                  step: '02',
                  title: 'Clean & Encode',
                  desc: 'Connect Fill Missing to impute NaNs, and Encode Labels to turn text into numbers.',
                  color: 'border-amber-200 bg-amber-50/50 text-amber-700',
                  badge: 'Preprocessing'
                },
                {
                  step: '03',
                  title: 'Train Model',
                  desc: 'Attach Random Forest, SVM, or AI Decision to train models concurrently.',
                  color: 'border-violet-200 bg-violet-50/50 text-violet-700',
                  badge: 'Training'
                },
                {
                  step: '04',
                  title: 'Validate & SHAP',
                  desc: 'Evaluate Accuracy, ROC-AUC, F1 score, and audit feature impacts with SHAP values.',
                  color: 'border-emerald-200 bg-emerald-50/50 text-emerald-700',
                  badge: 'Explainability'
                },
                {
                  step: '05',
                  title: 'Export Model',
                  desc: 'Download model weights as Python pickle/joblib binaries or export batch predictions.',
                  color: 'border-rose-200 bg-rose-50/50 text-rose-700',
                  badge: 'Deployment'
                },
              ].map((s, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-xl border ${s.color} flex flex-col justify-between space-y-3 bg-white`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-lg text-slate-400">{s.step}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-white">
                      {s.badge}
                    </span>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 mb-1">{s.title}</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Valid Connection Pin Rules */}
          <div className="p-6 rounded-2xl border border-slate-200 bg-white space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Pin Connection Rules (How Cables Work)
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Every node has output pins (right side) and input pins (left side). FlowML enforces type-safe DAG rules so invalid configurations are prevented automatically:
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50">
                    <th className="py-2.5 px-3">Upstream Output</th>
                    <th className="py-2.5 px-3">Connects To (Downstream)</th>
                    <th className="py-2.5 px-3">Example Nodes</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-2.5 px-3 font-mono font-semibold text-blue-700">DataFrame (Raw)</td>
                    <td className="py-2.5 px-3 text-slate-700">Preprocessing Nodes, Preview Node</td>
                    <td className="py-2.5 px-3 font-mono text-slate-500">Upload ➔ Fill Missing</td>
                    <td className="py-2.5 px-3 text-emerald-600 font-bold">✓ Valid</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-mono font-semibold text-amber-700">DataFrame (Cleaned)</td>
                    <td className="py-2.5 px-3 text-slate-700">Train/Test Split, Scaling, Model Nodes</td>
                    <td className="py-2.5 px-3 font-mono text-slate-500">Fill Missing ➔ Random Forest</td>
                    <td className="py-2.5 px-3 text-emerald-600 font-bold">✓ Valid</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-mono font-semibold text-violet-700">Trained Model Artifact</td>
                    <td className="py-2.5 px-3 text-slate-700">Explainable AI (SHAP), Prediction Output</td>
                    <td className="py-2.5 px-3 font-mono text-slate-500">Random Forest ➔ SHAP</td>
                    <td className="py-2.5 px-3 text-emerald-600 font-bold">✓ Valid</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-mono font-semibold text-rose-700">Model Artifact</td>
                    <td className="py-2.5 px-3 text-slate-700">Preprocessing Node (Direct)</td>
                    <td className="py-2.5 px-3 font-mono text-slate-500">Random Forest ➔ Scale Features</td>
                    <td className="py-2.5 px-3 text-rose-600 font-bold">✗ Invalid (Cycle)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── 2. 14 Visual Nodes Catalog Tab ─────────────────────────────────── */}
      {activeTab === 'nodes' && (
        <div className="space-y-6">
          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { id: 'all', label: 'All 14 Nodes' },
                { id: 'ingestion', label: 'Data Ingestion' },
                { id: 'preprocess', label: 'Preprocessing' },
                { id: 'models', label: 'ML Algorithms' },
                { id: 'ai_output', label: 'AI & Output' },
              ].map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setNodeCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    nodeCategory === cat.id
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Live Search */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search nodes, inputs, params..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
              />
            </div>
          </div>

          {/* Node Cards */}
          <div className="space-y-8">
            {filteredNodes.map((cat, idx) => (
              <div key={idx} className="space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                    {cat.category}
                  </h3>
                  <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    {cat.nodes.length} nodes
                  </span>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {cat.nodes.map((node, i) => (
                    <div
                      key={i}
                      className="p-5 rounded-2xl border border-slate-200 bg-white hover:border-violet-300 hover:shadow-md transition-all space-y-3"
                    >
                      {/* Node Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <h4 className="text-sm font-bold text-slate-900">{node.name}</h4>
                          <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md border ${cat.badgeColor}`}>
                            type: {node.type}
                          </span>
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-xs text-slate-700 leading-relaxed">
                        {node.when}
                      </p>

                      {/* Pro Tip */}
                      {node.tip && (
                        <div className="p-2.5 rounded-xl bg-violet-50 border border-violet-100 text-[11px] text-violet-800 flex items-start gap-2">
                          <Sparkles className="w-3.5 h-3.5 shrink-0 text-violet-600 mt-0.5" />
                          <span><strong>Best Practice:</strong> {node.tip}</span>
                        </div>
                      )}

                      {/* Specs Grid */}
                      <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-[11px]">
                        <div className="p-2 rounded-lg bg-slate-50">
                          <span className="text-slate-500 font-semibold block text-[10px] uppercase">Inputs</span>
                          <span className="text-slate-800 font-mono text-[11px]">{node.inputs}</span>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-50">
                          <span className="text-slate-500 font-semibold block text-[10px] uppercase">Outputs</span>
                          <span className="text-slate-800 font-mono text-[11px]">{node.outputs}</span>
                        </div>
                        <div className="col-span-2 p-2 rounded-lg bg-slate-50">
                          <span className="text-slate-500 font-semibold block text-[10px] uppercase">Parameters</span>
                          <span className="text-violet-700 font-mono text-[11px] break-all">{node.params}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── 3. Metrics & Loss Glossary Tab ─────────────────────────────────── */}
      {activeTab === 'metrics' && (
        <div className="space-y-8">
          <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
            Mathematical loss functions and evaluation benchmarks calculated during pipeline runs, model tournament leaderboards, and SHAP explainability analyses.
          </p>

          {METRICS.map((group, gIdx) => (
            <div key={gIdx} className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-violet-600" />
                {group.category}
              </h3>

              <div className="grid md:grid-cols-2 gap-4">
                {group.items.map((m, idx) => (
                  <div key={idx} className="p-5 rounded-2xl border border-slate-200 bg-white space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-slate-900">{m.name}</h4>
                      <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Target: {m.best}
                      </span>
                    </div>

                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                      <code className="text-xs font-mono font-bold text-violet-700 block">
                        {m.formula}
                      </code>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      {m.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── 4. Sandbox & Security Limits Tab ───────────────────────────────── */}
      {activeTab === 'sandbox' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl border border-slate-200 bg-white space-y-3">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Lock className="w-4 h-4 text-violet-600" />
              Isolated Execution Sandbox Architecture
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              To guarantee zero disruption to the primary API server, all user-authored custom Python transformations execute inside a hardened sandbox container worker. If Docker is unavailable in local environments, the backend seamlessly falls back to a restricted OS child process with active runtime watchdog enforcement.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { title: 'CPU Quota', val: '1.0 Core', desc: 'Isolated worker CPU quota to prevent compute exhaustion from multi-threaded loops.' },
              { title: 'RAM Memory Ceiling', val: '256 MB', desc: 'Active memory watch. Exceeding triggers automatic process termination without leaking memory.' },
              { title: 'Execution Timeout', val: '15 - 60s', desc: 'Strict supervisor watchdog aborts any infinite while loops or frozen executions.' },
              { title: 'Process PID Ceiling', val: '64 Processes', desc: 'Fork bombs and unauthorized subprocess spawns are blocked proactively.' },
              { title: 'Network Policy', val: 'Blocked (None)', desc: 'Zero outbound or inbound network connections permitted to eliminate data exfiltration.' },
              { title: 'Root Filesystem', val: 'Read-Only', desc: 'Temp storage is strictly limited to a memory tmpfs mounted at /tmp.' },
            ].map((lim, idx) => (
              <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-white space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">{lim.title}</span>
                <span className="text-lg font-black text-violet-700 font-mono block">{lim.val}</span>
                <p className="text-xs text-slate-600 leading-relaxed">{lim.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── 5. Custom Python Scripting Tab ─────────────────────────────────── */}
      {activeTab === 'python' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl border border-slate-200 bg-white space-y-3">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Code2 className="w-4 h-4 text-violet-600" />
              Writing Custom Python Transformation Nodes
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              The <strong>Custom Python Node</strong> allows you to execute arbitrary pandas data transformations directly within your visual pipeline. The upstream dataset is automatically injected into your code as a pandas DataFrame named <code>df</code>.
            </p>
          </div>

          {/* Code Example Card */}
          <div className="p-5 rounded-2xl border border-slate-200 bg-slate-900 text-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-xs font-mono text-slate-400 ml-2">custom_transform.py</span>
              </div>
              <button
                onClick={() => copySnippet(`# FlowML Custom Python Transformation
import numpy as np

# 1. Fill missing age with column median
if 'Age' in df.columns:
    df['Age'] = df['Age'].fillna(df['Age'].median())

# 2. Extract family size feature
if 'SibSp' in df.columns and 'Parch' in df.columns:
    df['FamilySize'] = df['SibSp'] + df['Parch'] + 1

# 3. Log-transform skewed fare distribution
if 'Fare' in df.columns:
    df['Fare_Log'] = np.log1p(df['Fare'])

# Return the modified DataFrame:
# The variable 'df' is automatically captured as the node output`)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition-colors"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? 'Copied!' : 'Copy Code'}</span>
              </button>
            </div>

            <pre className="text-xs font-mono text-violet-300 overflow-x-auto p-2 leading-relaxed">
{`# FlowML Custom Python Transformation
# Note: 'df' is automatically provided by the upstream node

import numpy as np

# 1. Fill missing age with column median
if 'Age' in df.columns:
    df['Age'] = df['Age'].fillna(df['Age'].median())

# 2. Extract family size feature
if 'SibSp' in df.columns and 'Parch' in df.columns:
    df['FamilySize'] = df['SibSp'] + df['Parch'] + 1

# 3. Log-transform skewed fare distribution
if 'Fare' in df.columns:
    df['Fare_Log'] = np.log1p(df['Fare'])

# The modified 'df' is automatically returned to downstream nodes!`}
            </pre>
          </div>

          {/* Supported Packages */}
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { name: 'NumPy', ver: '>= 1.24', desc: 'Vectorized tensor math, log/exp transforms, arrays.' },
              { name: 'Pandas', ver: '>= 2.0', desc: 'DataFrame filtering, grouping, date arithmetic, one-hot encoding.' },
              { name: 'Scikit-Learn', ver: '>= 1.4', desc: 'Preprocessing scalers, estimators, and loss metrics.' },
            ].map((pkg, idx) => (
              <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-white space-y-1">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-slate-900">{pkg.name}</h4>
                  <span className="text-[10px] font-mono text-slate-400">{pkg.ver}</span>
                </div>
                <p className="text-xs text-slate-600">{pkg.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── 6. FAQs & Troubleshooting Tab ─────────────────────────────────── */}
      {activeTab === 'faq' && (
        <div className="space-y-4">
          {FAQS.map((faq, idx) => (
            <div key={idx} className="p-5 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-2">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-violet-600 shrink-0" />
                {faq.q}
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed pl-6">{faq.a}</p>
            </div>
          ))}
        </div>
      )}
    </PageLayout>
  );
}

/* ─── 2. Tutorials Page ─────────────────────────────────────────────────────── */
export function TutorialsPage() {
  const navigate = useNavigate();
  const [copiedIndex, setCopiedIndex] = React.useState(null);

  const copyCode = (code, idx) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2500);
  };

  const SAMPLE_DATASETS = [
    {
      name: 'Titanic Passenger Survival',
      filename: 'titanic.csv',
      task: 'Binary Classification',
      rows: '891 Observations',
      cols: '11 Features',
      target: 'Survived (0 = Died, 1 = Lived)',
      desc: 'Predict passenger survival probabilities based on passenger class, age, fare, and cabin embarkation port.',
      downloadUrl: '/samples/titanic.csv',
      templateId: 'classification'
    },
    {
      name: 'California Real Estate Housing',
      filename: 'housing.csv',
      task: 'Continuous Regression',
      rows: '506 Observations',
      cols: '9 Numerical Metrics',
      target: 'MedHouseVal (Median Property Price)',
      desc: 'Predict median home values across block groups based on median household income, house age, and room averages.',
      downloadUrl: '/samples/housing.csv',
      templateId: 'regression'
    }
  ];

  const STARTER_CODES = [
    {
      title: '1. Custom Data Cleaning & Null Treatment',
      desc: 'Handle missing values with domain logic and strip outliers using pandas and numpy.',
      code: `# FlowML Custom Python Transformation
# df is automatically provided by the upstream node
import numpy as np

# 1. Fill missing age values with median
if 'Age' in df.columns:
    median_age = df['Age'].median()
    df['Age'] = df['Age'].fillna(median_age)
    print(f"Imputed Age column with median: {median_age}")

# 2. Extract title prefixes from passenger names
if 'Name' in df.columns:
    df['Title'] = df['Name'].str.extract(r' ([A-Za-z]+)\\.', expand=False)
    print("Extracted title categories:", df['Title'].value_counts().head(3).to_dict())

print(f"Transformation complete. Result shape: {df.shape}")
`
    },
    {
      title: '2. Log Transform & Interaction Feature Engineering',
      desc: 'Synthesize polynomial features and normalize skewed distributions for linear models.',
      code: `# Feature Engineering: Outliers and Interaction Terms
import numpy as np

# Apply log1p transform to positive numerical columns to compress long tails
num_cols = df.select_dtypes(include=[np.number]).columns
for col in num_cols:
    if (df[col] >= 0).all():
        df[f'{col}_log'] = np.log1p(df[col])

# Create interaction features if multiple numeric columns exist
if len(num_cols) >= 2:
    f1, f2 = num_cols[0], num_cols[1]
    df[f'{f1}_mult_{f2}'] = df[f1] * df[f2]
    print(f"Created interaction feature: {f1}_mult_{f2}")

print(f"Engineered feature set: {list(df.columns)}")
`
    },
    {
      title: '3. Custom Matplotlib Visualizer',
      desc: 'Generate distribution figures. Charts are rendered by matplotlib Agg and returned directly to the UI.',
      code: `# Plot generation in FlowML Sandbox
import matplotlib.pyplot as plt

plt.figure(figsize=(7, 4))
plt.title("Distribution of Primary Numerical Column")
first_num = df.select_dtypes(include=['number']).columns[0]
plt.hist(df[first_num].dropna(), bins=20, color='#6366f1', edgecolor='black', alpha=0.8)
plt.xlabel(first_num)
plt.ylabel("Frequency")
plt.grid(True, linestyle='--', alpha=0.5)
plt.tight_layout()
# Matplotlib figures are automatically captured and displayed!
print(f"Chart rendered for column: {first_num}")
`
    }
  ];

  return (
    <PageLayout
      title="Hands-On Tutorials & Quickstarts"
      subtitle="Kickstart your visual machine learning workflow with ready-to-run sample datasets and reusable Python scripts."
      badge="Interactive Guides"
      icon={Video}
    >
      <div className="space-y-12">
        {/* Sample Datasets Section */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="w-7 h-7 rounded-lg bg-violet-500/20 text-violet-400 flex items-center justify-center font-bold text-xs">
              01
            </span>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Pre-Loaded Sample Datasets (1-Click Run)
            </h2>
          </div>
          <p className="text-xs text-slate-500 mb-6 max-w-2xl">
            Download our curated sample datasets or launch them directly with ready-made visual pipelines in the Studio.
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            {SAMPLE_DATASETS.map((ds, idx) => (
              <div
                key={idx}
                className="p-6 rounded-2xl border border-slate-200 hover:border-violet-300 bg-white shadow-xs transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs mb-3">
                    <span className="px-2.5 py-0.5 rounded-full bg-violet-50 text-violet-700 font-bold border border-violet-200">
                      {ds.task}
                    </span>
                    <span className="text-slate-500 font-mono text-[11px]">{ds.rows} · {ds.cols}</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mb-1">{ds.name}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed mb-4">{ds.desc}</p>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] font-mono text-slate-600 mb-6">
                    <span className="text-slate-500 block text-[10px] uppercase font-sans font-bold">Target Variable</span>
                    <span className="text-emerald-600 font-bold">{ds.target}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
                  <a
                    href={ds.downloadUrl}
                    download={ds.filename}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-800 text-center transition-all border border-slate-200"
                  >
                    Download CSV
                  </a>
                  <button
                    onClick={() => navigate('/app/templates')}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-all shadow-md shadow-violet-600/30"
                  >
                    Open Blueprint <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 4-Step Walkthrough Section */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="w-7 h-7 rounded-lg bg-violet-500/20 text-violet-400 flex items-center justify-center font-bold text-xs">
              02
            </span>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              4-Step Visual Modeling Workflow
            </h2>
          </div>
          <p className="text-xs text-slate-400 mb-6">
            Follow this end-to-end framework to build and evaluate models in minutes.
          </p>

          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {
                step: 'Step 1',
                title: 'Data Ingestion & Profiling',
                desc: 'Upload CSV or connect datasets. The preview inspector automatically infers column types, missing value ratios, and distributions.'
              },
              {
                step: 'Step 2',
                title: 'Feature Engineering',
                desc: 'Connect Fill Missing, One-Hot Encoding, and StandardScaler blocks. Drop in a Custom Python block for domain formulas.'
              },
              {
                step: 'Step 3',
                title: 'Tournament Benchmark',
                desc: 'Add multiple algorithm nodes or the AI Decision node. FlowML trains candidates concurrently across a thread pool.'
              },
              {
                step: 'Step 4',
                title: 'Audit & Export',
                desc: 'Inspect the accuracy leaderboard, confusion matrix, and SHAP explainability charts. Download the production joblib artifact.'
              }
            ].map((step, idx) => (
              <div key={idx} className="p-5 rounded-2xl border border-slate-100 bg-white space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-violet-400">{step.step}</span>
                <h4 className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>{step.title}</h4>
                <p className="text-xs text-slate-400 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Starter Python Snippets */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="w-7 h-7 rounded-lg bg-violet-500/20 text-violet-400 flex items-center justify-center font-bold text-xs">
              03
            </span>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Starter Python Sandbox Code Examples
            </h2>
          </div>
          <p className="text-xs text-slate-400 mb-6">
            Tested starter code ready to copy into your Custom Python DAG blocks or Python Studio.
          </p>

          <div className="space-y-6">
            {STARTER_CODES.map((item, idx) => (
              <div key={idx} className="rounded-2xl border border-slate-100 bg-white overflow-hidden">
                <div className="p-4 bg-white/[0.02] border-b border-white/5 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>{item.title}</h3>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{item.desc}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyCode(item.code, idx)}
                      className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300 hover:text-white transition-all flex items-center gap-1.5 border border-white/10"
                    >
                      {copiedIndex === idx ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Code2 className="w-3.5 h-3.5" />
                          Copy Script
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => navigate('/app/code')}
                      className="px-3 py-1.5 rounded-lg bg-violet-600/30 hover:bg-violet-600 text-xs font-semibold text-violet-300 hover:text-white transition-all border border-violet-500/30"
                    >
                      Open in Studio
                    </button>
                  </div>
                </div>
                <div className="p-4 bg-slate-50">
                  <pre className="font-mono text-xs text-violet-200/90 leading-relaxed overflow-x-auto whitespace-pre">
                    {item.code}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}

/* ─── 3. About Page ─────────────────────────────────────────────────────────── */
export function AboutPage() {
  const team = [
    {
      name: 'Vishwajeet Chandole',
      initials: 'VC',
      color: 'bg-violet-600',
      role: 'Full-Stack ML Engineer & Lead Developer',
      bio: 'Architect of the FlowML visual pipeline engine and DAG execution runtime. Vishwajeet designed the core canvas, node system, AutoML tournament engine, and FastAPI backend from the ground up.',
      skills: ['React', 'FastAPI', 'Python ML', 'System Design', 'Canvas Engine'],
      contributions: ['Pipeline DAG runtime', 'AutoML tournament', 'REST API design', 'Frontend architecture'],
    },
    {
      name: 'Ajinkya Walvekar',
      initials: 'AW',
      color: 'bg-indigo-600',
      role: 'ML Systems & Data Engineering',
      bio: 'Led the development of FlowML\'s data ingestion pipelines, preprocessing node library, and code sandbox execution infrastructure. Built the isolated Python execution environment with memory and timeout enforcement.',
      skills: ['Pandas', 'Scikit-Learn', 'Sandbox Security', 'Data Pipelines', 'Docker'],
      contributions: ['Preprocessing nodes', 'Code sandbox', 'Dataset management', 'Export tooling'],
    },
    {
      name: 'Kush Zalavadiya',
      initials: 'KZ',
      color: 'bg-emerald-600',
      role: 'UI/UX Design & Frontend Engineer',
      bio: 'Designed and implemented FlowML\'s visual identity, landing page, and dashboard interface. Kush crafted the light theme design system, component library, and interactive pipeline canvas animations.',
      skills: ['UI Design', 'TailwindCSS', 'Framer Motion', 'Design Systems', 'Figma'],
      contributions: ['Design system', 'Landing page', 'Component library', 'Theming & animations'],
    },
  ];

  return (
    <PageLayout
      title="About FlowML"
      subtitle="Bridging the gap between code-first ML engineering and intuitive no-code workflow design."
      badge="Our Mission"
      icon={Cpu}
    >
      <div className="space-y-16">
        {/* Mission Statement */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-xs">
            <h2 className="text-lg font-bold text-slate-900 mb-3">Visual Power Without The Black Box</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              FlowML Studio was created with a clear principle: machine learning should be visual and rapid, without sacrificing the rigour, auditability, and execution performance of state-of-the-art Python toolchains.
            </p>
            <p className="text-sm text-slate-600 leading-relaxed mt-3">
              Every block on the canvas maps directly to verified scikit-learn transformers, real pandas dataframes, and mathematical loss functions. When you click run, your graph compiles into a validated Directed Acyclic Graph (DAG) executed with isolated memory sandboxes.
            </p>
          </div>
          <div className="space-y-4">
            <div className="p-5 rounded-2xl bg-violet-50 border border-violet-200 text-center">
              <span className="text-3xl font-black text-violet-600 block mb-1">100%</span>
              <span className="text-xs font-semibold text-violet-700">Scikit-Learn Compatible</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-center">
                <span className="text-2xl font-black text-blue-600 block mb-1">0ms</span>
                <span className="text-xs font-semibold text-blue-700">Cloud Lock-in</span>
              </div>
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
                <span className="text-2xl font-black text-emerald-600 block mb-1">SHAP</span>
                <span className="text-xs font-semibold text-emerald-700">Explainability</span>
              </div>
            </div>
          </div>
        </div>

        {/* Team Section */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="w-7 h-7 rounded-lg bg-violet-500/10 text-violet-600 flex items-center justify-center font-bold text-xs">
              👥
            </span>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Meet the Team</h2>
          </div>
          <p className="text-sm text-slate-500 mb-8">
            FlowML was built by three engineers passionate about making machine learning accessible, transparent, and production-ready.
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            {team.map((member, i) => (
              <div
                key={i}
                className="p-6 rounded-2xl border border-slate-200 bg-white shadow-xs hover:shadow-md hover:border-violet-200 transition-all"
              >
                {/* Avatar */}
                <div className="flex items-center gap-4 mb-5">
                  <div className={`w-14 h-14 rounded-2xl ${member.color} text-white flex items-center justify-center font-bold text-lg shadow-md`}>
                    {member.initials}
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-900 leading-tight">{member.name}</h3>
                    <p className="text-xs text-violet-600 font-semibold mt-0.5">{member.role}</p>
                  </div>
                </div>

                {/* Bio */}
                <p className="text-xs text-slate-600 leading-relaxed mb-5">{member.bio}</p>

                {/* Skills */}
                <div className="mb-4">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Core Skills</p>
                  <div className="flex flex-wrap gap-1.5">
                    {member.skills.map((skill) => (
                      <span key={skill} className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Contributions */}
                <div className="pt-4 border-t border-slate-100">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Key Contributions</p>
                  <ul className="space-y-1">
                    {member.contributions.map((c) => (
                      <li key={c} className="flex items-center gap-2 text-xs text-slate-600">
                        <span className="w-1 h-1 rounded-full bg-violet-400 shrink-0" />
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Values */}
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-6">Our Core Values</h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { icon: '🔬', title: 'Scientific Rigour', desc: 'Every node is backed by peer-reviewed ML algorithms and production-tested pipelines.' },
              { icon: '🔍', title: 'Transparency', desc: 'SHAP explainability built-in so you always know why a model made a decision.' },
              { icon: '🚀', title: 'Speed to Production', desc: 'From raw CSV to FastAPI endpoint in under 30 minutes. No DevOps expertise required.' },
              { icon: '🔒', title: 'Privacy-First', desc: 'All data is user-scoped. No shared storage, no telemetry, no vendor cloud lock-in.' },
              { icon: '🎨', title: 'Accessible Design', desc: 'Visual canvas for non-engineers, with Python export for expert control at any time.' },
              { icon: '🤝', title: 'Open Collaboration', desc: 'Real-time shared workspaces so data science teams can prototype and review together.' },
            ].map((v, i) => (
              <div key={i} className="p-5 rounded-xl border border-slate-100 bg-white hover:border-violet-200 transition-colors">
                <span className="text-xl block mb-2">{v.icon}</span>
                <h4 className="text-sm font-bold text-slate-900 mb-1">{v.title}</h4>
                <p className="text-xs text-slate-500 leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}

/* ─── 4. Contact Page ───────────────────────────────────────────────────────── */
export function ContactPage() {
  const [submitted, setSubmitted] = React.useState(false);
  const [form, setForm] = React.useState({ name: '', email: '', message: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <PageLayout
      title="Contact Support & Sales"
      subtitle="Have questions about deploying FlowML on your private cloud or custom dataset integrations?"
      badge="Get in Touch"
      icon={Mail}
    >
      <div className="max-w-xl p-8 rounded-2xl border border-slate-200 bg-white shadow-sm">
        {submitted ? (
          <div className="text-center py-10 space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-900 text-lg">Message Dispatched</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Thank you for reaching out! Our engineering team will review your inquiry and follow up within 24 hours.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
              <input
                required
                type="text"
                placeholder="Jane Doe"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-violet-500 focus:bg-white transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Work Email</label>
              <input
                required
                type="email"
                placeholder="jane@company.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-violet-500 focus:bg-white transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Message</label>
              <textarea
                required
                rows={4}
                placeholder="Tell us about your pipeline requirements..."
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-violet-500 focus:bg-white transition-all resize-none"
              />
            </div>
            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-violet-600/30 transition-all cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" /> Send Inquiry
            </button>
          </form>
        )}
      </div>
    </PageLayout>
  );
}

/* ─── 5. Privacy Policy Page ─────────────────────────────────────────────────── */
export function PrivacyPage() {
  return (
    <PageLayout
      title="Privacy Policy"
      subtitle="How FlowML handles your telemetry, training data, and user identity."
      badge="Security & Compliance"
      icon={Shield}
    >
      <div className="max-w-3xl space-y-6 text-sm text-slate-600 leading-relaxed">
        <section className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
          <h2 className="text-base font-bold text-slate-900 font-display">1. Data Ownership & Sovereignty</h2>
          <p>
            Your datasets, feature columns, and trained models remain 100% your property. FlowML never uses customer datasets to train foundational models or shared services.
          </p>
        </section>

        <section className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
          <h2 className="text-base font-bold text-slate-900 font-display">2. User Authentication</h2>
          <p>
            Authentication credentials are processed through Firebase Authentication. We store only your email identifier and unique user identification token (UID) to scope file system directories and sandbox isolation.
          </p>
        </section>

        <section className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
          <h2 className="text-base font-bold text-slate-900 font-display">3. Local & Dev Mode</h2>
          <p>
            In offline development mode (DEV_AUTH), all storage paths reside locally within your disk workspace storage folder. No network telemetry is sent externally.
          </p>
        </section>
      </div>
    </PageLayout>
  );
}

/* ─── 6. Terms of Service Page ───────────────────────────────────────────────── */
export function TermsPage() {
  return (
    <PageLayout
      title="Terms of Service"
      subtitle="Standard software usage license and rights when executing FlowML pipelines."
      badge="Legal Agreement"
      icon={FileText}
    >
      <div className="max-w-3xl space-y-6 text-sm text-slate-600 leading-relaxed">
        <section className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
          <h2 className="text-base font-bold text-slate-900 font-display">1. Permitted Use</h2>
          <p>
            You may use FlowML Studio for personal, educational, research, and commercial machine learning applications. You are solely responsible for ensuring training data meets applicable privacy regulations (such as HIPAA and GDPR).
          </p>
        </section>

        <section className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
          <h2 className="text-base font-bold text-slate-900 font-display">2. Execution Safety</h2>
          <p>
            Machine learning outputs are probabilistic inferences. You agree that model predictions are advisory and must be verified before deployment in critical safety-of-life or high-liability systems.
          </p>
        </section>
      </div>
    </PageLayout>
  );
}

/* ─── 7. Features Page ───────────────────────────────────────────────────────── */
export function FeaturesPage() {
  const navigate = useNavigate();

  const featureCards = [
    {
      title: 'Visual DAG Pipeline Studio',
      description: 'Design end-to-end machine learning workflows with drag-and-drop ease. Inspect shapes, intermediate outputs, and execution states at each node.',
      icon: Layers,
      tag: 'Visual Canvas',
    },
    {
      title: 'Automated Model Comparison',
      description: 'Train Random Forest, SVM, Logistic Regression, KNN, and KMeans simultaneously. View leaderboard rankings with automated metric selection.',
      icon: Cpu,
      tag: 'AutoML',
    },
    {
      title: 'Sandboxed Python Studio',
      description: 'Execute bespoke Python scripts in hardened execution sandboxes with resource limits and pre-installed NumPy, Pandas, Scikit-learn, and Matplotlib.',
      icon: Code2,
      tag: 'Code Execution',
    },
    {
      title: 'SHAP Explainability & Attribution',
      description: 'Understand every prediction with global and local feature importance attributions, transparent decision boundaries, and model explainability.',
      icon: Sparkles,
      tag: 'Interpretability',
    },
    {
      title: 'Per-User Isolated Storage',
      description: 'Strict filesystem boundary preventing path traversal and cross-user data leakage. Complete GDPR wipe and account management capabilities.',
      icon: Shield,
      tag: 'Enterprise Security',
    },
    {
      title: 'Export & Production Reports',
      description: 'Download self-contained HTML execution summaries, serialized trained model joblibs, and batch prediction CSV files with 1 click.',
      icon: Database,
      tag: 'Export Ready',
    },
  ];

  return (
    <PageLayout
      title="Platform Features"
      subtitle="Comprehensive tools for visual machine learning, automated evaluation, and secure Python script execution."
      badge="FlowML Capabilities"
      icon={Sparkles}
    >
      <div className="space-y-8">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {featureCards.map((f) => {
            const FIcon = f.icon;
            return (
              <div
                key={f.title}
                className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center text-violet-600">
                    <FIcon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                    {f.tag}
                  </span>
                </div>
                <h3 className="font-display font-bold text-base text-slate-900">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.description}</p>
              </div>
            );
          })}
        </div>

        <div className="p-8 rounded-2xl bg-gradient-to-r from-violet-50 to-blue-50 border border-violet-100 text-center space-y-4">
          <h3 className="text-xl font-bold font-display text-slate-900">Ready to build your first model?</h3>
          <p className="text-sm text-slate-600 max-w-xl mx-auto">
            Choose from ready-made workflow blueprints or upload a CSV dataset to train models in seconds.
          </p>
          <button
            onClick={() => navigate('/studio')}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-600/20 transition-all active:scale-95"
          >
            Launch Studio Canvas
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </PageLayout>
  );
}
