import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Play, Save, Download, Terminal,
  Loader2, CheckCircle2, AlertCircle, Zap,
  GitBranch, LayoutGrid, Settings, Bell,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import Logo from '../common/Logo';
import FlowMLIcon from '../FlowMLIcon';

/* ─── Brand logo mark ────────────────────────────────────────────────────────── */
const BrandMark = () => (
  <Link to="/" className="flex items-center gap-3 select-none" title="Go to Home">
    <FlowMLIcon size={44} />
    <div>
      <Logo size="text-2xl" />
      <div className="text-[9px] font-sans font-semibold uppercase tracking-widest text-[#6B6585]">
        Studio
      </div>
    </div>
  </Link>
);

/* ─── Run Pipeline button ─────────────────────────────────────────────────────── */
const RunBtn = ({ isRunning, pipelineStatus, onRunPipeline }) => {
  const cfg = {
    idle:    { label: 'Run Pipeline',    Icon: Play,          grad: 'linear-gradient(135deg,#7C3AED,#6D28D9)', glow: 'rgba(124,58,237,0.35)' },
    running: { label: 'Running…',        Icon: Loader2,       grad: 'linear-gradient(135deg,#7C3AED,#6D28D9)', glow: 'rgba(124,58,237,0.2)' },
    success: { label: 'Run Again',       Icon: CheckCircle2,  grad: 'linear-gradient(135deg,#22c55e,#16a34a)', glow: 'rgba(34,197,94,0.4)'  },
    error:   { label: 'Retry Pipeline',  Icon: AlertCircle,   grad: 'linear-gradient(135deg,#ef4444,#dc2626)', glow: 'rgba(239,68,68,0.4)'  },
  };

  const state = isRunning ? 'running' : (pipelineStatus ?? 'idle');
  const { label, Icon, grad, glow } = cfg[state] ?? cfg.idle;

  return (
    <motion.button
      whileHover={!isRunning ? { scale: 1.04 } : {}}
      whileTap={!isRunning ? { scale: 0.96 } : {}}
      onClick={isRunning ? undefined : onRunPipeline}
      disabled={isRunning}
      id="run-pipeline-btn"
      className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-bold transition-all shadow-md cursor-pointer"
      style={{
        background:  grad,
        boxShadow:   `0 4px 18px ${glow}`,
        cursor:      isRunning ? 'not-allowed' : 'pointer',
        opacity:     isRunning ? 0.8 : 1,
      }}
    >
      <Icon className={`w-4 h-4 ${isRunning ? 'animate-spin' : ''}`} />
      {label}
    </motion.button>
  );
};

/* ─── Icon button ─────────────────────────────────────────────────────────────── */
const IconBtn = ({ icon: Icon, label, onClick, active, badge, id }) => (
  <motion.button
    id={id}
    whileHover={{ scale: 1.08 }}
    whileTap={{ scale: 0.92 }}
    onClick={onClick}
    title={label}
    className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer"
    style={{
      background: active ? 'rgba(124,58,237,0.12)' : 'transparent',
      border:     active ? '1px solid rgba(124,58,237,0.3)' : '1px solid transparent',
      color:      active ? '#7C3AED' : 'var(--color-text-muted)',
    }}
    onMouseEnter={(e) => {
      if (!active) {
        e.currentTarget.style.background = '#f1f5f9';
        e.currentTarget.style.color = '#0f172a';
      }
    }}
    onMouseLeave={(e) => {
      if (!active) {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.color = 'var(--color-text-muted)';
      }
    }}
  >
    <Icon className="w-4 h-4" />
    {badge != null && (
      <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white text-[8px] font-bold flex items-center justify-center"
        style={{ background: '#ef4444' }}>
        {badge}
      </span>
    )}
  </motion.button>
);

/* ─── Divider ─────────────────────────────────────────────────────────────────── */
const Div = () => (
  <div className="w-px h-5 mx-1" style={{ background: 'var(--color-border)' }} />
);

/* ─── Navbar ──────────────────────────────────────────────────────────────────── */
const Navbar = ({
  toggleConsole, isConsoleOpen, onRunPipeline, isRunning, pipelineStatus, onSave, onExport,
}) => {
  const [showNotif, setShowNotif] = useState(false);

  const NOTIFS = [
    { icon: CheckCircle2, text: 'Backend connected', color: '#22c55e', time: 'now' },
    { icon: Zap,          text: 'FlowML Studio ready', color: '#7C3AED', time: '1m ago' },
  ];

  return (
    <nav
      className="h-14 flex items-center justify-between px-5 z-50 sticky top-0 shrink-0"
      style={{
        background:   'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Left: brand */}
      <BrandMark />

      {/* Center: status breadcrumb */}
      <div
        className="hidden md:flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-semibold"
        style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
      >
        <GitBranch className="w-3 h-3" />
        <span>Pipeline Builder</span>
        <span style={{ color: 'var(--color-border)' }}>/</span>
        <span className="text-primary">Canvas</span>
        {pipelineStatus === 'success' && (
          <>
            <span style={{ color: 'var(--color-border)' }}>/</span>
            <span className="text-success flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Complete</span>
          </>
        )}
        {pipelineStatus === 'error' && (
          <>
            <span style={{ color: 'var(--color-border)' }}>/</span>
            <span className="text-danger flex items-center gap-1"><AlertCircle className="w-3 h-3" />Error</span>
          </>
        )}
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-1.5">
        <RunBtn isRunning={isRunning} pipelineStatus={pipelineStatus} onRunPipeline={onRunPipeline} />

        <Div />

        <IconBtn icon={Save}       label="Save Workflow"   onClick={onSave}       id="save-btn"     />
        <IconBtn icon={Download}   label="Export JSON"     onClick={onExport}     id="export-btn"   />
        <IconBtn icon={LayoutGrid} label="Canvas View"     onClick={() => {}}     id="layout-btn"   />
        <IconBtn icon={Terminal}   label="Toggle Console"  onClick={toggleConsole} active={isConsoleOpen} id="console-toggle-btn" />

        <Div />

        {/* Notifications */}
        <div className="relative">
          <IconBtn icon={Bell} label="Notifications" badge={NOTIFS.length} onClick={() => setShowNotif((v) => !v)} />
          <AnimatePresence>
            {showNotif && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                className="absolute right-0 top-12 w-64 rounded-2xl shadow-2xl overflow-hidden z-[999]"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
              >
                <div className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>
                  Notifications
                </div>
                {NOTIFS.map((n, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <n.icon className="w-4 h-4 mt-0.5 shrink-0" style={{ color: n.color }} />
                    <div>
                      <p className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>{n.text}</p>
                      <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{n.time}</p>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <IconBtn icon={Settings} label="Settings" onClick={() => {}} id="settings-btn" />
      </div>
    </nav>
  );
};

export default Navbar;
