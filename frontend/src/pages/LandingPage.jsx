import React, { useCallback, useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import SignOutButton from '../components/auth/SignOutButton';
import AuthDialog from '../components/auth/AuthDialog';
import SignIn from './auth/SignIn';
import SignUp from './auth/SignUp';
import {
  ArrowRight, Sparkles, Check, Star, Play, Database,
  Sliders, Brain, Award, Shield, Zap, Cloud,
  Share2, ArrowUpRight, CheckCircle2, ChevronRight,
  TrendingUp, Activity, Terminal, Lock, FileSpreadsheet, LogOut,
  BarChart3, Layers, Users, RefreshCw, Code2
} from 'lucide-react';
import Logo from '../components/common/Logo';
import FlowMLIcon from '../components/FlowMLIcon';

/* ─── Hero Mount Animation Wrapper ───────────────────────────────────────────── */
function HeroReveal({ children, delay = 0, y = 16, className = '' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─── Scroll Reveal Wrapper ──────────────────────────────────────────────────── */
function Reveal({ children, delay = 0, y = 20, className = '' }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '150px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─── TOP NAVIGATION ─────────────────────────────────────────────────────────── */
function Navbar({ onLaunch }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { label: 'Features', href: '#features' },
    { label: 'Workflow', href: '#solutions' },
    { label: 'Integrations', href: '#integrations' },
    { label: 'About', route: '/about' },
    { label: 'Docs', route: '/docs' },
  ];

  const handleLinkClick = (link) => {
    if (link.route) {
      navigate(link.route);
    } else if (link.href) {
      const el = document.querySelector(link.href);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/80 backdrop-blur-md border-b border-slate-200/80 shadow-xs py-3.5'
          : 'bg-transparent py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-2.5" title="FlowML Home">
          <FlowMLIcon size={44} />
          <Logo size="text-2xl" />
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <button
              key={link.label}
              onClick={() => handleLinkClick(link)}
              className="text-sm font-medium text-slate-600 hover:text-violet-600 transition-colors cursor-pointer"
            >
              {link.label}
            </button>
          ))}
        </nav>

        {/* Action Buttons */}
        <div className="hidden md:flex items-center gap-4">
          {user ? (
            <>
              <button
                onClick={() => navigate('/app/projects')}
                className="text-sm font-semibold text-slate-700 hover:text-slate-900 transition-colors px-3 py-2 cursor-pointer"
              >
                Dashboard
              </button>
              <SignOutButton
                redirectTo="/"
                className="px-5 py-2.5 rounded-full text-xs font-semibold bg-slate-950 hover:bg-slate-800 text-white transition-all shadow-sm hover:shadow cursor-pointer flex items-center gap-2"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </SignOutButton>
            </>
          ) : (
            <>
              <button
                onClick={() => navigate('/signin')}
                className="text-sm font-semibold text-slate-700 hover:text-slate-900 transition-colors px-3 py-2 cursor-pointer"
              >
                Sign In
              </button>
              <button
                onClick={onLaunch}
                className="px-5 py-2.5 rounded-full text-xs font-semibold bg-slate-950 hover:bg-slate-800 text-white transition-all shadow-sm hover:shadow cursor-pointer"
              >
                Get Started
              </button>
            </>
          )}
        </div>

        {/* Mobile Hamburger Toggle */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 rounded-lg text-slate-700 hover:bg-slate-100"
          aria-label="Toggle navigation menu"
        >
          <div className="w-5 h-4 flex flex-col justify-between">
            <span className={`h-0.5 w-full bg-slate-800 transition-all ${mobileMenuOpen ? 'rotate-45 translate-y-1.5' : ''}`} />
            <span className={`h-0.5 w-full bg-slate-800 transition-opacity ${mobileMenuOpen ? 'opacity-0' : ''}`} />
            <span className={`h-0.5 w-full bg-slate-800 transition-all ${mobileMenuOpen ? '-rotate-45 -translate-y-1.5' : ''}`} />
          </div>
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-b border-slate-200 px-6 py-5 shadow-xl"
          >
            <div className="flex flex-col gap-4">
              {navLinks.map((link) => (
                <button
                  key={link.label}
                  onClick={() => {
                    handleLinkClick(link);
                    setMobileMenuOpen(false);
                  }}
                  className="text-left text-sm font-semibold text-slate-700 py-1"
                >
                  {link.label}
                </button>
              ))}
              <div className="pt-4 border-t border-slate-100 flex flex-col gap-2.5">
                {user ? (
                  <>
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        navigate('/app/projects');
                      }}
                      className="w-full py-2.5 text-center text-sm font-semibold text-slate-700 bg-slate-100 rounded-xl"
                    >
                      Dashboard
                    </button>
                    <SignOutButton
                      redirectTo="/"
                      onSignedOut={() => setMobileMenuOpen(false)}
                      className="w-full py-2.5 text-center text-sm font-semibold text-white bg-slate-900 rounded-xl flex items-center justify-center gap-2"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </SignOutButton>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        navigate('/signin');
                      }}
                      className="w-full py-2.5 text-center text-sm font-semibold text-slate-700 bg-slate-100 rounded-xl"
                    >
                      Sign In
                    </button>
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onLaunch();
                      }}
                      className="w-full py-2.5 text-center text-sm font-semibold text-white bg-slate-900 rounded-xl"
                    >
                      Get Started
                    </button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

/* ─── HERO PIPELINE DEMO COMPONENT ───────────────────────────────────────────── */
function HeroPreviewDemo({ onLaunch }) {
  const [selectedNode, setSelectedNode] = useState('model');

  const nodes = [
    { id: 'data', name: 'Dataset Ingestion', desc: 'churn_data.csv • 7,043 rows', status: 'ready', badge: 'CSV' },
    { id: 'prep', name: 'Smart Preprocessing', desc: 'StandardScaler • One-Hot', status: 'ready', badge: '0 Nulls' },
    { id: 'automl', name: 'Auto-ML Engine', desc: '6 Models • 5-Fold CV', status: 'ready', badge: 'Auto' },
    { id: 'model', name: 'Best Model: XGBoost', desc: '98.4% Accuracy • F1: 0.96', status: 'winner', badge: 'Winner' },
  ];

  return (
    <div className="w-full max-w-6xl mx-auto mt-12 grid lg:grid-cols-12 gap-5 items-start">
      {/* Main Studio Canvas Mockup (Left 8 Cols) */}
      <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden text-left">
        {/* Browser / App Header */}
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-rose-400" />
            <div className="w-3 h-3 rounded-full bg-amber-400" />
            <div className="w-3 h-3 rounded-full bg-emerald-400" />
            <span className="ml-3 text-xs font-mono text-slate-500 font-medium">pipeline://churn_prediction_v2</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Canvas
            </span>
            <div className="flex -space-x-1.5">
              <span className="w-6 h-6 rounded-full bg-indigo-500 text-[10px] text-white font-bold flex items-center justify-center border-2 border-white">ER</span>
              <span className="w-6 h-6 rounded-full bg-violet-500 text-[10px] text-white font-bold flex items-center justify-center border-2 border-white">MV</span>
              <span className="w-6 h-6 rounded-full bg-amber-500 text-[10px] text-white font-bold flex items-center justify-center border-2 border-white">PK</span>
            </div>
          </div>
        </div>

        {/* Canvas Toolbar & Body */}
        <div className="p-6 bg-slate-50/60 min-h-[380px] flex flex-col justify-between">
          {/* Top pipeline overview banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200/80">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pipeline Execution</p>
              <h3 className="font-display font-bold text-base text-slate-900">Customer Retention Prediction</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onLaunch}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-violet-600 hover:bg-violet-700 text-white shadow-xs cursor-pointer transition-colors"
              >
                <Play className="w-3 h-3 fill-current" /> Run Pipeline
              </button>
            </div>
          </div>

          {/* Interactive Flow Nodes */}
          <div className="my-6 grid sm:grid-cols-4 gap-3 relative">
            {nodes.map((node, i) => {
              const isSelected = selectedNode === node.id;
              return (
                <div
                  key={node.id}
                  onClick={() => setSelectedNode(node.id)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer relative bg-white ${
                    isSelected
                      ? 'border-violet-600 ring-2 ring-violet-600/20 shadow-md -translate-y-0.5'
                      : 'border-slate-200/90 hover:border-slate-300 shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono font-bold text-slate-400">0{i + 1}</span>
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                        node.status === 'winner'
                          ? 'bg-violet-100 text-violet-700 font-bold'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {node.badge}
                    </span>
                  </div>
                  <h4 className="font-display font-bold text-xs text-slate-900 mb-1">{node.name}</h4>
                  <p className="text-[11px] text-slate-500 leading-tight">{node.desc}</p>
                </div>
              );
            })}
          </div>

          {/* Bottom active node parameters */}
          <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center font-bold text-xs">
                {selectedNode.toUpperCase()}
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">
                  {selectedNode === 'model' ? 'XGBoost Classifier (Evaluated)' : `${selectedNode.toUpperCase()} Node Configuration`}
                </p>
                <p className="text-[11px] text-slate-500">
                  {selectedNode === 'model'
                    ? 'Cross-entropy loss: 0.142 • AUC: 0.988 • Inference: 1.2ms'
                    : 'Auto-configured hyper-parameters ready for compilation'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="font-mono text-emerald-600 font-bold">✓ 100% Validated</span>
              <button
                onClick={onLaunch}
                className="text-violet-600 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
              >
                Inspect Details <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Tools / Inspector Card (Right 4 Cols) */}
      <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden flex flex-col justify-between text-left">
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <span className="font-display font-bold text-xs text-slate-800 uppercase tracking-wider">Model Inspector</span>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-violet-50 text-violet-700 font-semibold">Active</span>
        </div>

        <div className="p-6">
          {/* Abstract 3D Graphic Preview */}
          <div className="w-full h-40 rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-500 to-pink-400 p-4 text-white flex flex-col justify-between shadow-inner relative overflow-hidden">
            <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full bg-white/20 blur-xl pointer-events-none" />
            <div className="flex justify-between items-start z-10">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-xs">ROC-AUC: 0.984</span>
              <Activity className="w-4 h-4 text-white/90" />
            </div>
            <div className="z-10">
              <p className="text-[11px] uppercase tracking-wider text-white/80 font-mono">Performance Metric</p>
              <h4 className="font-display font-extrabold text-2xl tracking-tight">98.4% Accuracy</h4>
            </div>
          </div>

          {/* Quick Metrics Breakdown */}
          <div className="mt-5 space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-600 font-medium">Validation F1 Score</span>
                <span className="font-mono font-bold text-slate-900">0.962</span>
              </div>
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-violet-600 rounded-full" style={{ width: '96%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-600 font-medium">Precision Rate</span>
                <span className="font-mono font-bold text-slate-900">0.978</span>
              </div>
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full" style={{ width: '98%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-600 font-medium">Inference Latency</span>
                <span className="font-mono font-bold text-slate-900">1.2 ms</span>
              </div>
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: '90%' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Footer Quick Action */}
        <div className="p-4 bg-slate-50 border-t border-slate-100">
          <button
            onClick={onLaunch}
            className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            Launch in Studio <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── 3-COLUMN FEATURE CARDS (Pastel Gradient Trio) ──────────────────────────── */
function FeatureCardsTrio() {
  const cards = [
    {
      title: 'Visual Pipeline Canvas',
      desc: 'Drag, drop, and link data ingestion, preprocessing transforms, and ML models on an infinite fluid canvas.',
      gradient: 'from-[#F4F0FF] to-white',
      border: 'border-violet-100',
      badge: 'Interactive Flow',
      badgeColor: 'text-violet-700 bg-violet-100/70',
      illustration: (
        <div className="w-full h-36 rounded-2xl bg-gradient-to-r from-violet-200/50 via-purple-100/60 to-pink-100/50 p-4 flex flex-col justify-between relative overflow-hidden border border-violet-100/60">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-violet-400" />
            <span className="w-2.5 h-2.5 rounded-full bg-purple-300" />
            <span className="w-2.5 h-2.5 rounded-full bg-pink-300" />
            <span className="ml-2 text-[10px] font-mono text-slate-600 font-semibold">Graph Execution</span>
          </div>
          <div className="flex items-center justify-center gap-3 py-2">
            <div className="p-2 rounded-xl bg-white shadow-xs border border-violet-100 text-xs font-bold text-slate-800">
              CSV Ingest
            </div>
            <ArrowRight className="w-4 h-4 text-violet-500" />
            <div className="p-2 rounded-xl bg-violet-600 text-white shadow-md text-xs font-bold">
              StandardScaler
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Automated Model Selection',
      desc: 'Auto-evaluate 10+ algorithms with Bayesian hyperparameter tuning, cross-validation, and ROC benchmark curves.',
      gradient: 'from-[#FFF7ED] to-white',
      border: 'border-amber-100',
      badge: 'AutoML Engine',
      badgeColor: 'text-amber-700 bg-amber-100/70',
      illustration: (
        <div className="w-full h-36 rounded-2xl bg-gradient-to-r from-amber-100/60 via-orange-100/50 to-amber-200/40 p-4 flex flex-col justify-between relative overflow-hidden border border-amber-100/60">
          <div className="flex justify-between items-center text-[10px] font-mono font-semibold text-amber-900">
            <span>5-Fold Cross Validation</span>
            <span>AUC 0.984</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-white/90 p-1.5 rounded-lg border border-amber-200 shadow-xs">
              <p className="text-[9px] text-slate-500 font-medium">Random Forest</p>
              <p className="text-xs font-bold text-slate-800">94.2%</p>
            </div>
            <div className="bg-amber-500 text-white p-1.5 rounded-lg shadow-sm">
              <p className="text-[9px] text-amber-100 font-medium">XGBoost</p>
              <p className="text-xs font-bold">98.4%</p>
            </div>
            <div className="bg-white/90 p-1.5 rounded-lg border border-amber-200 shadow-xs">
              <p className="text-[9px] text-slate-500 font-medium">LightGBM</p>
              <p className="text-xs font-bold text-slate-800">97.1%</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Real-time Collaboration',
      desc: 'Share pipeline experiments, review ROC curves, and export serialized model weights with your entire data science team.',
      gradient: 'from-[#EFF6FF] to-white',
      border: 'border-blue-100',
      badge: 'Team Ready',
      badgeColor: 'text-blue-700 bg-blue-100/70',
      illustration: (
        <div className="w-full h-36 rounded-2xl bg-gradient-to-r from-blue-100/60 via-indigo-100/50 to-sky-100/40 p-4 flex flex-col justify-between relative overflow-hidden border border-blue-100/60">
          <div className="flex justify-between items-center text-[10px] font-semibold text-blue-900">
            <span>Team Workspace</span>
            <span className="inline-flex items-center gap-1 text-emerald-600">● 3 Online</span>
          </div>
          <div className="flex items-center justify-center -space-x-3 py-2">
            <span className="w-10 h-10 rounded-full bg-violet-600 text-white font-bold text-xs flex items-center justify-center border-2 border-white shadow-md">ER</span>
            <span className="w-10 h-10 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center border-2 border-white shadow-md">MV</span>
            <span className="w-10 h-10 rounded-full bg-pink-600 text-white font-bold text-xs flex items-center justify-center border-2 border-white shadow-md">PK</span>
            <span className="w-10 h-10 rounded-full bg-amber-500 text-white font-bold text-xs flex items-center justify-center border-2 border-white shadow-md">+4</span>
          </div>
        </div>
      ),
    },
  ];

  return (
    <section id="features" className="py-24 max-w-7xl mx-auto px-6">
      <Reveal>
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-violet-50 text-violet-600 border border-violet-200 mb-4">
            <Sparkles className="w-3 h-3" /> Core Features
          </span>
          <h2 className="font-display font-bold text-3xl sm:text-4xl text-slate-900 tracking-tight mb-4">
            The ultimate toolkit for ML engineers &amp; teams
          </h2>
          <p className="text-slate-600 text-base leading-relaxed">
            Everything you need to preprocess data, train state-of-the-art models, and deploy APIs in minutes.
          </p>
        </div>
      </Reveal>

      <div className="grid md:grid-cols-3 gap-6">
        {cards.map((card, i) => (
          <Reveal key={card.title} delay={i * 0.1}>
            <div className={`p-6 rounded-3xl bg-gradient-to-b ${card.gradient} border ${card.border} shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-full`}>
              <div>
                <div className="mb-6">{card.illustration}</div>
                <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider ${card.badgeColor}`}>
                  {card.badge}
                </span>
                <h3 className="font-display font-bold text-lg text-slate-900 mt-3 mb-2">{card.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{card.desc}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ─── SIMPLIFY YOUR WORKFLOW (Side-by-side) ──────────────────────────────────── */
function SimplifyWorkflowSection({ onLaunch }) {
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    {
      num: '01',
      title: 'Import your dataset',
      desc: 'Upload CSV, Excel, or connect databases. FlowML runs automated type inference, distribution profiling, and null detection.',
    },
    {
      num: '02',
      title: 'Configure & Automate',
      desc: 'Select your target variable. The engine automatically handles imputation, categorical encoding, and feature scaling.',
    },
    {
      num: '03',
      title: 'Benchmark & Deploy',
      desc: 'Compare accuracy, F1-scores, and ROC-AUC curves. Download production-ready Python code or 1-click FastAPI endpoints.',
    },
  ];

  return (
    <section id="solutions" className="py-24 bg-slate-50/60 border-y border-slate-200/60">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Numbered List */}
          <div className="lg:col-span-5 text-left">
            <Reveal>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-900 text-white mb-4">
                How It Works
              </span>
              <h2 className="font-display font-bold text-3xl sm:text-4xl text-slate-900 tracking-tight mb-8">
                Simplify your workflow
              </h2>
            </Reveal>

            <div className="space-y-6">
              {steps.map((step, idx) => {
                const isActive = activeStep === idx;
                return (
                  <Reveal key={step.num} delay={idx * 0.1}>
                    <div
                      onClick={() => setActiveStep(idx)}
                      className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                        isActive
                          ? 'bg-white border-violet-500 shadow-md ring-1 ring-violet-500/20'
                          : 'bg-white/60 border-slate-200/80 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <span className={`font-mono text-sm font-bold ${isActive ? 'text-violet-600' : 'text-slate-400'}`}>
                          {step.num}
                        </span>
                        <div>
                          <h4 className="font-display font-bold text-base text-slate-900 mb-1">{step.title}</h4>
                          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{step.desc}</p>
                        </div>
                      </div>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>

          {/* Right Column: High Fidelity Mockup */}
          <div className="lg:col-span-7">
            <Reveal delay={0.2}>
              <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden p-6 sm:p-8 text-left">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-rose-400" />
                    <span className="w-3 h-3 rounded-full bg-amber-400" />
                    <span className="w-3 h-3 rounded-full bg-emerald-400" />
                    <span className="text-xs font-mono text-slate-500 font-semibold ml-2">flowml://workspace/step-{activeStep + 1}</span>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-violet-50 text-violet-700">Step {activeStep + 1} of 3</span>
                </div>

                {activeStep === 0 && (
                  <div className="space-y-4">
                    <div className="p-6 rounded-2xl bg-violet-50/50 border-2 border-dashed border-violet-200 flex flex-col items-center justify-center text-center">
                      <FileSpreadsheet className="w-10 h-10 text-violet-600 mb-2" />
                      <p className="font-display font-bold text-sm text-slate-800">telco_churn_dataset.csv</p>
                      <p className="text-xs text-slate-500">7,043 rows • 21 feature columns • 0 syntax errors</p>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
                        <span className="text-[10px] text-slate-400 font-medium">Categorical</span>
                        <p className="text-sm font-bold text-slate-800">16 Columns</p>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
                        <span className="text-[10px] text-slate-400 font-medium">Numeric</span>
                        <p className="text-sm font-bold text-slate-800">4 Columns</p>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
                        <span className="text-[10px] text-slate-400 font-medium">Target</span>
                        <p className="text-sm font-bold text-violet-600">Churn</p>
                      </div>
                    </div>
                  </div>
                )}

                {activeStep === 1 && (
                  <div className="space-y-4">
                    <div className="p-5 rounded-2xl bg-indigo-50/50 border border-indigo-100">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-bold text-indigo-900">Pre-processing Pipeline</span>
                        <span className="text-[11px] font-mono text-indigo-700 bg-white px-2 py-0.5 rounded shadow-2xs font-semibold">Auto-configured</span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between p-2.5 bg-white rounded-lg text-xs font-medium border border-indigo-50">
                          <span>Missing Values Imputation</span>
                          <span className="text-emerald-600 font-semibold font-mono">Median (0 nulls remaining)</span>
                        </div>
                        <div className="flex items-center justify-between p-2.5 bg-white rounded-lg text-xs font-medium border border-indigo-50">
                          <span>Categorical Encoding</span>
                          <span className="text-emerald-600 font-semibold font-mono">One-Hot Encoding (32 features)</span>
                        </div>
                        <div className="flex items-center justify-between p-2.5 bg-white rounded-lg text-xs font-medium border border-indigo-50">
                          <span>Feature Scaling</span>
                          <span className="text-emerald-600 font-semibold font-mono">StandardScaler (µ=0, σ=1)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeStep === 2 && (
                  <div className="space-y-4">
                    <div className="p-5 rounded-2xl bg-emerald-50/50 border border-emerald-100">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-bold text-emerald-900">AutoML Leaderboard</span>
                        <span className="text-[11px] font-mono text-emerald-700 bg-white px-2 py-0.5 rounded shadow-2xs font-semibold">Ready to Export</span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between p-2.5 bg-white rounded-lg text-xs font-medium border border-emerald-50">
                          <span className="font-bold text-slate-800">1. XGBoost Classifier</span>
                          <span className="text-violet-600 font-mono font-bold">98.4% Accuracy (Top Choice)</span>
                        </div>
                        <div className="flex items-center justify-between p-2.5 bg-white rounded-lg text-xs font-medium border border-emerald-50">
                          <span className="font-bold text-slate-800">2. LightGBM</span>
                          <span className="text-slate-600 font-mono">97.1% Accuracy</span>
                        </div>
                        <div className="flex items-center justify-between p-2.5 bg-white rounded-lg text-xs font-medium border border-emerald-50">
                          <span className="font-bold text-slate-800">3. Random Forest</span>
                          <span className="text-slate-600 font-mono">94.2% Accuracy</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-500">Fast client-side compilation</span>
                  <button
                    onClick={onLaunch}
                    className="text-xs font-semibold text-violet-600 hover:text-violet-700 flex items-center gap-1 cursor-pointer"
                  >
                    Open in interactive canvas <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── ONE PLATFORM, UNLIMITED INTEGRATIONS ───────────────────────────────────── */
function IntegrationsSection({ onLaunch }) {
  const integrations = [
    { name: 'Python', color: 'bg-blue-100 text-blue-700', label: 'Python 3.11' },
    { name: 'Scikit-Learn', color: 'bg-amber-100 text-amber-700', label: 'scikit-learn' },
    { name: 'PyTorch', color: 'bg-orange-100 text-orange-700', label: 'PyTorch' },
    { name: 'XGBoost', color: 'bg-emerald-100 text-emerald-700', label: 'XGBoost' },
    { name: 'Pandas', color: 'bg-purple-100 text-purple-700', label: 'Pandas' },
    { name: 'FastAPI', color: 'bg-teal-100 text-teal-700', label: 'FastAPI' },
    { name: 'Docker', color: 'bg-sky-100 text-sky-700', label: 'Docker' },
    { name: 'Snowflake', color: 'bg-cyan-100 text-cyan-700', label: 'Snowflake' },
  ];

  return (
    <section id="integrations" className="py-24 max-w-7xl mx-auto px-6">
      <Reveal>
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-200 mb-4">
            Ecosystem
          </span>
          <h2 className="font-display font-bold text-3xl sm:text-4xl text-slate-900 tracking-tight mb-3">
            One platform, unlimited integrations
          </h2>
          <p className="text-slate-600 text-sm">
            Export production-ready code with zero vendor lock-in across every major ML framework.
          </p>
        </div>
      </Reveal>
      <div className="grid lg:grid-cols-12 gap-12 items-center">
        {/* Left Side: Integrations Hub Illustration */}
        <div className="lg:col-span-6">
          <Reveal>
            <div className="p-8 sm:p-12 rounded-3xl bg-slate-100/70 border border-slate-200/80 shadow-inner relative flex flex-col items-center justify-center">
              {/* Converging integrations grid */}
              <div className="grid grid-cols-4 gap-3 mb-8 w-full max-w-md">
                {integrations.map((item) => (
                  <div
                    key={item.name}
                    className="p-3 rounded-xl bg-white shadow-xs border border-slate-200 flex flex-col items-center justify-center text-center hover:scale-105 transition-transform"
                  >
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${item.color}`}>
                      {item.name.substring(0, 3)}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-700 mt-1">{item.name}</span>
                  </div>
                ))}
              </div>

              {/* Central flow connector */}
              <FlowMLIcon size={48} />
              <span className="text-xs font-bold text-slate-700 mt-2">FlowML Engine Core</span>
            </div>
          </Reveal>
        </div>

        {/* Right Side: Copy & Testimonial */}
        <div className="lg:col-span-6 text-left">
          <Reveal delay={0.1}>
            <p className="text-slate-600 text-base leading-relaxed mb-6">
              Export production-ready code with zero vendor lock-in. Generate clean Python scripts, Jupyter notebooks, Dockerfiles, and REST APIs ready for your CI/CD pipeline.
            </p>

            <button
              onClick={onLaunch}
              className="px-6 py-3 rounded-full text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white inline-flex items-center gap-2 transition-all shadow-sm cursor-pointer mb-8"
            >
              Explore integrations <ArrowRight className="w-3.5 h-3.5" />
            </button>

          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ─── DARK NEXT-GEN SHOWCASE (Power up your workflow with next-gen features) ─── */
function DarkNextGenSection({ onLaunch }) {
  return (
    <section className="py-24 max-w-7xl mx-auto px-6">
      <Reveal>
        <div className="bg-[#0B0F17] rounded-3xl p-8 sm:p-14 text-white shadow-2xl relative overflow-hidden text-left">
          {/* Header */}
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-violet-300 border border-white/20 mb-4">
              Advanced Capabilities
            </span>
            <h2 className="font-display font-bold text-3xl sm:text-4xl text-white tracking-tight mb-3">
              Power up your workflow with next-gen features
            </h2>
            <p className="text-slate-400 text-sm sm:text-base">
              Built from the ground up for modern data teams needing speed, transparency, and military-grade privacy.
            </p>
          </div>

          {/* Top 2 Large Dark Feature Cards */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="p-8 rounded-2xl bg-[#141A26] border border-white/10 hover:border-violet-500/50 transition-all flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-violet-500/20 text-violet-400 flex items-center justify-center mb-6">
                  <Cloud className="w-6 h-6" />
                </div>
                <h3 className="font-display font-bold text-xl text-white mb-2">Cloud-Scale Compute Engine</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Train massive ensembles without provisioning cloud VMs. FlowML optimizes memory usage and leverages worker threads directly.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-white/10 flex items-center gap-2 text-xs text-violet-400 font-mono">
                <span>✓ Auto-distributed workers</span>
              </div>
            </div>

            <div className="p-8 rounded-2xl bg-[#141A26] border border-white/10 hover:border-violet-500/50 transition-all flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-6">
                  <Shield className="w-6 h-6" />
                </div>
                <h3 className="font-display font-bold text-xl text-white mb-2">Real-Time Low Latency & Privacy</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Client-first execution guarantees your proprietary datasets stay strictly within your browser and authorized VPC.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-white/10 flex items-center gap-2 text-xs text-emerald-400 font-mono">
                <span>✓ Zero third-party telemetry</span>
              </div>
            </div>
          </div>

          {/* Bottom 3 Feature Pills */}
          <div className="grid sm:grid-cols-3 gap-5">
            <div className="p-5 rounded-xl bg-[#141A26]/60 border border-white/5">
              <Code2 className="w-5 h-5 text-violet-400 mb-2" />
              <h4 className="font-display font-bold text-sm text-white mb-1">Zero-code or Code-first</h4>
              <p className="text-xs text-slate-400">Switch between drag-and-drop and custom Python code in one click.</p>
            </div>

            <div className="p-5 rounded-xl bg-[#141A26]/60 border border-white/5">
              <Brain className="w-5 h-5 text-indigo-400 mb-2" />
              <h4 className="font-display font-bold text-sm text-white mb-1">Explainable AI (SHAP & LIME)</h4>
              <p className="text-xs text-slate-400">Interpret decision trees and understand exact feature attributions.</p>
            </div>

            <div className="p-5 rounded-xl bg-[#141A26]/60 border border-white/5">
              <Award className="w-5 h-5 text-pink-400 mb-2" />
              <h4 className="font-display font-bold text-sm text-white mb-1">1-Click Model Serialization</h4>
              <p className="text-xs text-slate-400">Export .joblib weights, ONNX runtime graphs, or Dockerized APIs.</p>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ─── SOCIAL PROOF & TESTIMONIALS ────────────────────────────────────────────── */
const TESTIMONIALS = [
  {
    initials: 'MV', color: 'bg-violet-600',
    quote: 'FlowML has completely redefined how our team prototypes models. We test hypotheses 10x faster without writing boilerplate training loops.',
    name: 'Marcus Vance', role: 'Senior AI Scientist at DataVantage', stars: 5,
  },
  {
    initials: 'RT', color: 'bg-emerald-600',
    quote: 'The visual pipeline canvas made ML accessible to our entire product team — not just data scientists. SHAP explainability charts alone are worth it.',
    name: 'Raj Thakkar', role: 'Head of Product at AnalyticsHQ', stars: 5,
  },
  {
    initials: 'EL', color: 'bg-amber-500',
    quote: 'I went from raw clinical data to a validated XGBoost model in one afternoon. The automated preprocessing handled all the null imputation seamlessly.',
    name: 'Dr. Elena Litvak', role: 'Clinical AI Researcher at MedTech Labs', stars: 5,
  },
  {
    initials: 'JK', color: 'bg-rose-500',
    quote: 'No-code AutoML with Python export? That\'s the dream. Our interns can build and iterate on models now, and we export clean code for production CI/CD.',
    name: 'James Kinsley', role: 'ML Engineering Lead at CloudForge', stars: 5,
  },
  {
    initials: 'PW', color: 'bg-sky-600',
    quote: 'Real-time ROC curves and side-by-side model leaderboards changed how we evaluate. We made model selection decisions in minutes instead of days.',
    name: 'Priya Watkins', role: 'Data Science Manager at FinAxis', stars: 5,
  },
];

function SocialProofSection() {
  return (
    <section className="py-24 bg-slate-50/40 border-y border-slate-200/80">
      <div className="max-w-7xl mx-auto px-6">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-600 border border-amber-200 mb-4">
              <Star className="w-3 h-3 fill-current" /> Testimonials
            </span>
            <h2 className="font-display font-bold text-3xl sm:text-4xl text-slate-900 tracking-tight mb-3">
              Loved by ML engineers &amp; data science teams
            </h2>
            <p className="text-slate-600 text-sm leading-relaxed">
              Join thousands of researchers, engineers, and product teams who build and ship models with FlowML.
            </p>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t, i) => (
            <Reveal key={i} delay={i * 0.08}>
              <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-violet-200 transition-all text-left flex flex-col justify-between h-full">
                <div>
                  <div className="flex items-center gap-1 text-amber-400 mb-3">
                    {[...Array(t.stars)].map((_, j) => (
                      <Star key={j} className="w-3.5 h-3.5 fill-current" />
                    ))}
                  </div>
                  <p className="text-slate-700 text-sm leading-relaxed italic mb-5">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                </div>
                <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                  <span className={`w-9 h-9 rounded-full ${t.color} text-white font-bold text-xs flex items-center justify-center shrink-0`}>{t.initials}</span>
                  <div>
                    <p className="font-display font-bold text-xs text-slate-900">{t.name}</p>
                    <p className="text-[11px] text-slate-500">{t.role}</p>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* Pricing section removed per user request */

/* ─── THE PERFECT ML SOLUTION FOR EVERY WORKFLOW ─────────────────────────────── */
function PerfectSolutionSection({ onLaunch }) {
  const checklists = [
    '100% Client-Side Processing',
    'Automated Imputation & Encoding',
    'Real-time ROC & PR Curves',
    'Instant Python Code Generation',
    'No Cloud Vendor Lock-In',
    'Production-Ready FastAPI Artifacts',
  ];

  return (
    <section className="py-24 bg-slate-50/60 border-y border-slate-200/80">
      <div className="max-w-7xl mx-auto px-6">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200 mb-4">
              Why FlowML
            </span>
            <h2 className="font-display font-bold text-3xl sm:text-4xl text-slate-900 tracking-tight mb-3">
              The perfect machine learning solution for every workflow
            </h2>
          </div>
        </Reveal>
        <div className="grid lg:grid-cols-12 gap-12 items-center">
          {/* Left Preview Card */}
          <div className="lg:col-span-5">
            <Reveal>
              <div className="bg-[#0B0F17] rounded-3xl p-6 text-white shadow-xl text-left">
                <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
                  <span className="text-xs font-mono text-slate-400">flowml-mobile-inspector</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                </div>
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 mb-4">
                  <p className="text-[10px] text-slate-400 uppercase font-mono">Top Benchmark</p>
                  <p className="font-display font-bold text-lg text-white">XGBoost Classifier</p>
                  <p className="text-xs text-emerald-400 font-mono mt-1">✓ F1: 0.962 • Accuracy: 98.4%</p>
                </div>
                <div className="space-y-2 text-xs text-slate-300">
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span>Cross Validation</span>
                    <span className="font-mono text-white">5 Folds</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span>Serialization</span>
                    <span className="font-mono text-white">model.joblib (14.2MB)</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span>Export Target</span>
                    <span className="font-mono text-violet-400">FastAPI Container</span>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>

          {/* Right Checklist */}
          <div className="lg:col-span-7 text-left">
            <Reveal delay={0.1}>
              <p className="text-slate-600 text-base leading-relaxed mb-8">
                From exploratory data analysis and feature engineering to hyperparameter tuning and model monitoring, FlowML covers your entire pipeline.
              </p>

              <div className="grid sm:grid-cols-2 gap-3.5 mb-8">
                {checklists.map((item) => (
                  <div key={item} className="flex items-center gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3" />
                    </div>
                    <span className="text-sm font-medium text-slate-700">{item}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={onLaunch}
                className="px-6 py-3 rounded-full text-xs font-semibold bg-violet-600 hover:bg-violet-700 text-white inline-flex items-center gap-2 transition-all shadow-md shadow-violet-500/20 cursor-pointer"
              >
                Start building with FlowML <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── BOTTOM CTA BANNER WITH MOCKUP ──────────────────────────────────────────── */
function BottomCtaSection({ onLaunch }) {
  const navigate = useNavigate();

  return (
    <section className="pt-24 pb-12 relative overflow-hidden bg-gradient-to-b from-white via-violet-50/50 to-violet-100/30">
      <div className="max-w-7xl mx-auto px-6 text-center">
        <Reveal>
          <div className="max-w-3xl mx-auto mb-10">
            <h2 className="font-display font-extrabold text-3xl sm:text-5xl text-slate-900 tracking-tight mb-4">
              Take your machine learning workflow to the next level
            </h2>
            <p className="text-slate-600 text-base sm:text-lg mb-8">
              Join thousands of data scientists, researchers, and developers who build, train, and deploy models with FlowML.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <button
                onClick={onLaunch}
                className="px-8 py-3.5 rounded-full text-xs font-semibold bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-500/25 transition-all cursor-pointer flex items-center gap-2"
              >
                Start Building Free <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => navigate('/docs')}
                className="px-6 py-3.5 rounded-full text-xs font-semibold bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 shadow-xs transition-all cursor-pointer"
              >
                Read Documentation
              </button>
            </div>
          </div>
        </Reveal>

        {/* Large perspective app mockup preview fading at the bottom */}
        <Reveal delay={0.2}>
          <div className="max-w-5xl mx-auto mt-12 bg-white rounded-t-3xl border-t border-x border-slate-200/90 shadow-2xl p-4 sm:p-6 pb-0 overflow-hidden">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
              <span className="text-[11px] font-mono text-slate-400 ml-2">flowml-studio://canvas</span>
            </div>
            <div className="h-64 sm:h-80 bg-gradient-to-tr from-slate-50 via-violet-50/30 to-slate-100 rounded-t-2xl p-6 flex flex-col items-center justify-center text-center">
              <div className="mb-4">
                <FlowMLIcon size={64} />
              </div>
              <h3 className="font-display font-bold text-xl text-slate-900 mb-2">FlowML Studio Canvas</h3>
              <p className="text-xs text-slate-500 max-w-md">
                Experience full visual pipeline editing with live metrics, node execution logs, and automated code generation.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ─── DARK MODERN SAAS FOOTER ────────────────────────────────────────────────── */
function Footer() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <footer className="bg-[#0A0D14] text-slate-400 py-16 px-6 text-left border-t border-slate-900">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 pb-12 border-b border-white/10">
          {/* Brand info */}
          <div className="col-span-2">
            <Link to="/" className="flex items-center gap-2.5 mb-4" title="FlowML Home">
              <FlowMLIcon size={44} />
              <span className="font-logo text-xl text-white tracking-[-0.03em]">FlowML</span>
            </Link>
            <p className="text-xs text-slate-400 max-w-xs leading-relaxed mb-6">
              The next-generation visual pipeline canvas for machine learning development, automated benchmarking, and transparent explainable AI.
            </p>
          </div>

          {/* Solutions Column */}
          <div>
            <h4 className="font-display font-bold text-xs text-white uppercase tracking-wider mb-4">Solutions</h4>
            <ul className="space-y-2.5 text-xs">
              <li><button onClick={() => navigate('/studio')} className="hover:text-white transition-colors cursor-pointer">AutoML Studio</button></li>
              <li><button onClick={() => navigate('/studio')} className="hover:text-white transition-colors cursor-pointer">Data Cleaning</button></li>
              <li><button onClick={() => navigate('/studio')} className="hover:text-white transition-colors cursor-pointer">Model Tuning</button></li>
              <li><button onClick={() => navigate('/studio')} className="hover:text-white transition-colors cursor-pointer">FastAPI Export</button></li>
            </ul>
          </div>

          {/* Product Column */}
          <div>
            <h4 className="font-display font-bold text-xs text-white uppercase tracking-wider mb-4">Product</h4>
            <ul className="space-y-2.5 text-xs">
              <li><button onClick={() => navigate('/features')} className="hover:text-white transition-colors cursor-pointer">Features</button></li>
              <li><button onClick={() => navigate('/app/projects')} className="hover:text-white transition-colors cursor-pointer">Projects</button></li>
              <li><button onClick={() => navigate('/app/templates')} className="hover:text-white transition-colors cursor-pointer">Blueprints</button></li>
              {user ? (
                <>
                  <li><button onClick={() => navigate('/app/projects')} className="hover:text-white transition-colors cursor-pointer">Dashboard</button></li>
                  <li><SignOutButton redirectTo="/" className="hover:text-white transition-colors cursor-pointer">Sign Out</SignOutButton></li>
                </>
              ) : (
                <li><button onClick={() => navigate('/signin')} className="hover:text-white transition-colors cursor-pointer">Sign In</button></li>
              )}
            </ul>
          </div>

          {/* Resources Column */}
          <div>
            <h4 className="font-display font-bold text-xs text-white uppercase tracking-wider mb-4">Resources</h4>
            <ul className="space-y-2.5 text-xs">
              <li><button onClick={() => navigate('/docs')} className="hover:text-white transition-colors cursor-pointer">Documentation</button></li>
              <li><button onClick={() => navigate('/tutorials')} className="hover:text-white transition-colors cursor-pointer">Tutorials</button></li>
              <li><button onClick={() => navigate('/privacy')} className="hover:text-white transition-colors cursor-pointer">Privacy Policy</button></li>
              <li><button onClick={() => navigate('/terms')} className="hover:text-white transition-colors cursor-pointer">Terms of Service</button></li>
            </ul>
          </div>
        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© 2026 FlowML Studio. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <button onClick={() => navigate('/privacy')} className="hover:text-white transition-colors cursor-pointer">Privacy</button>
            <span>•</span>
            <button onClick={() => navigate('/terms')} className="hover:text-white transition-colors cursor-pointer">Terms</button>
            <span>•</span>
            <button onClick={() => navigate('/contact')} className="hover:text-white transition-colors cursor-pointer">Contact</button>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ─── MAIN LANDING PAGE COMPONENT ────────────────────────────────────────────── */
export default function LandingPage({ authMode }) {
  const navigate = useNavigate();
  const launch = () => navigate('/studio');
  const closeAuthDialog = useCallback(() => navigate('/', { replace: true }), [navigate]);
  const authPage = authMode === 'signin'
    ? { label: 'Sign in to FlowML', content: <SignIn /> }
    : authMode === 'signup'
      ? { label: 'Create a FlowML account', content: <SignUp /> }
      : null;

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-violet-500 selection:text-white">
      <Navbar onLaunch={launch} />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden bg-gradient-to-b from-violet-100/40 via-purple-50/20 to-white text-center">
        {/* Soft Radial Ambient Glow */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[550px] opacity-40 pointer-events-none rounded-full blur-3xl -z-10"
          style={{ background: 'radial-gradient(circle, rgba(167, 139, 250, 0.4) 0%, rgba(245, 243, 255, 0) 70%)' }}
        />

        <div className="max-w-7xl mx-auto px-6">
          <HeroReveal>
            {/* Announcement Pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-slate-900 text-white shadow-xs mb-8 hover:bg-slate-800 transition-colors cursor-pointer">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
              <span>Experience Next-Gen AutoML Studio</span>
              <ArrowRight className="w-3.5 h-3.5 ml-0.5 text-slate-400" />
            </div>

            {/* Main Headline */}
            <h1 className="font-display font-extrabold text-4xl sm:text-6xl md:text-7xl text-slate-900 tracking-tight leading-[1.08] max-w-4xl mx-auto mb-6">
              Bring ML pipelines to life in just a few clicks.
            </h1>

            {/* Subtitle */}
            <p className="text-slate-600 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed mb-8">
              Empower your team with a no-code visual canvas and automated machine learning. From data cleaning to instant deployment, all in your browser.
            </p>

            {/* CTA Button */}
            <div className="flex flex-wrap items-center justify-center gap-4">
              <button
                onClick={launch}
                className="px-8 py-3.5 rounded-full text-xs font-semibold bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-500/25 transition-all cursor-pointer flex items-center gap-2"
              >
                Start building free <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </HeroReveal>

          {/* Interactive Hero Showcase */}
          <HeroReveal delay={0.2}>
            <HeroPreviewDemo onLaunch={launch} />
          </HeroReveal>
        </div>
      </section>

      {/* 3-Column Features Trio */}
      <FeatureCardsTrio />

      {/* Simplify Your Workflow */}
      <SimplifyWorkflowSection onLaunch={launch} />

      {/* Integrations */}
      <IntegrationsSection onLaunch={launch} />

      {/* Dark Next-Gen Features Showcase */}
      <DarkNextGenSection onLaunch={launch} />

      {/* Social Proof */}
      <SocialProofSection />

      {/* Perfect ML Solution */}
      <PerfectSolutionSection onLaunch={launch} />

      {/* Bottom CTA Banner with Mockup */}
      <BottomCtaSection onLaunch={launch} />

      {/* Dark Modern Footer */}
      <Footer />

      <AuthDialog
        open={Boolean(authPage)}
        label={authPage?.label}
        onClose={closeAuthDialog}
      >
        {authPage?.content}
      </AuthDialog>
    </div>
  );
}
