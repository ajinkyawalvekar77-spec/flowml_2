import React from 'react';
import { Shield, Cpu } from 'lucide-react';
import PythonEditor from '../../components/code/PythonEditor';

export default function CodeEditorView() {
  const sandboxEnabled = import.meta.env.VITE_ENABLE_PYTHON_SANDBOX !== 'false';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-violet-500/10 text-violet-600 border border-violet-200">
              Interactive Lab
            </span>
            {sandboxEnabled && (
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Shield className="w-3 h-3 text-emerald-500" /> Isolated Worker Sandbox
              </span>
            )}
          </div>
          <h2 className="font-display text-2xl font-bold tracking-tight" style={{ color: 'var(--color-text)' }}>
            Python Studio
          </h2>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Write, execute, and benchmark custom transformation logic and scikit-learn models in a protected sandbox.
          </p>
        </div>

        {/* Security badge */}
        <div
          className="flex items-center gap-2 p-2.5 rounded-xl text-xs font-semibold"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-muted)',
          }}
        >
          <Cpu className="w-4 h-4 text-violet-500" />
          <span>Limits: 1.0 CPU · 256 MB RAM · No Network</span>
        </div>
      </div>

      {sandboxEnabled ? (
        <PythonEditor showHistoryTab={true} />
      ) : (
        <div
          role="status"
          className="rounded-2xl border border-violet-200 bg-white p-6 text-sm text-slate-600"
        >
          Python execution is disabled. Not available in this setup. Enable the isolated sandbox in both the frontend
          and backend environment to use Python Studio.
        </div>
      )}
    </div>
  );
}
