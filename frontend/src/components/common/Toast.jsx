import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

const TOAST_ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const TOAST_COLORS = {
  success: { border: '#22c55e40', bg: 'rgba(34, 197, 94, 0.12)', text: '#22c55e', glow: 'rgba(34, 197, 94, 0.25)' },
  error:   { border: '#ef444440', bg: 'rgba(239, 68, 68, 0.12)', text: '#ef4444', glow: 'rgba(239, 68, 68, 0.25)' },
  info:    { border: '#7C3AED40', bg: 'rgba(124, 58, 237, 0.12)', text: '#7C3AED', glow: 'rgba(124, 58, 237, 0.25)' },
  warning: { border: '#f59e0b40', bg: 'rgba(245, 158, 11, 0.12)', text: '#f59e0b', glow: 'rgba(245, 158, 11, 0.25)' },
};

export default function Toast({ toast, onClose }) {
  if (!toast) return null;
  const type = toast.type || 'info';
  const Icon = TOAST_ICONS[type] || Info;
  const colors = TOAST_COLORS[type] || TOAST_COLORS.info;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -15, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        className="fixed top-6 right-6 z-[100] max-w-md w-full shadow-2xl rounded-2xl p-4 flex items-start gap-3 backdrop-blur-xl pointer-events-auto"
        style={{
          background: 'var(--color-surface)',
          border: `1.5px solid ${colors.border}`,
          boxShadow: `0 12px 36px rgba(0,0,0,0.35), 0 0 20px ${colors.glow}`,
        }}
      >
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: colors.bg, color: colors.text }}
        >
          <Icon className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0 pr-1">
          {toast.title && (
            <h4 className="text-xs font-bold uppercase tracking-wider mb-0.5" style={{ color: colors.text }}>
              {toast.title}
            </h4>
          )}
          <p className="text-sm font-medium leading-relaxed" style={{ color: 'var(--color-text)' }}>
            {toast.msg || toast.message || (typeof toast === 'string' ? toast : '')}
          </p>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
