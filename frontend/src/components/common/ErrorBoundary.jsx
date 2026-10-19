import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('FlowML ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/app/projects';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="min-h-[400px] w-full flex items-center justify-center p-6"
          style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}
        >
          <div
            className="max-w-md w-full rounded-2xl p-8 shadow-xl text-center space-y-5"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-500 mx-auto flex items-center justify-center">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold font-display" style={{ color: 'var(--color-text)' }}>Something went wrong</h2>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                An unexpected error occurred while rendering this view. Your saved data and pipeline configurations remain safe.
              </p>
            </div>

            {this.state.error && (
              <div
                className="text-xs font-mono p-3 rounded-xl text-rose-600 text-left overflow-auto max-h-32"
                style={{ background: 'rgba(254,242,242,1)', border: '1px solid rgba(254,202,202,1)' }}
              >
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={this.handleReset}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-violet-600 hover:bg-violet-700 text-white transition-all shadow-md shadow-violet-600/20 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Reload View
              </button>
              <button
                onClick={this.handleGoHome}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                }}
              >
                <Home className="w-4 h-4" />
                Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
