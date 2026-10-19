import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, ArrowLeft, HelpCircle } from 'lucide-react';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-center items-center px-6 selection:bg-violet-500 selection:text-white">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-violet-50 border border-violet-100 text-violet-600 shadow-sm">
          <HelpCircle className="w-10 h-10" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-widest text-violet-600">404 Error</span>
          <h1 className="text-3xl font-extrabold font-display text-slate-900 tracking-tight">
            Page Not Found
          </h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            The page you requested could not be found. It may have been moved, renamed, or is temporarily unavailable.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={() => navigate('/app/projects')}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-violet-600 hover:bg-violet-700 text-white transition-all shadow-md shadow-violet-600/20 active:scale-95 cursor-pointer"
          >
            <Home className="w-4 h-4" />
            Go to Projects
          </button>
          <button
            onClick={() => navigate(-1)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm bg-white hover:bg-slate-100 text-slate-700 transition-all border border-slate-200 active:scale-95 shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}
