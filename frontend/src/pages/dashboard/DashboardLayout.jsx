import React, { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Toast from '../../components/common/Toast';
import Logo from '../../components/common/Logo';
import FlowMLIcon from '../../components/FlowMLIcon';
import SignOutButton from '../../components/auth/SignOutButton';
import {
  FolderKanban, Database, Layers, PlayCircle, LayoutTemplate,
  Settings, LogOut, Sparkles, ExternalLink,
  ChevronRight, Activity, Bell, Search, Terminal, Code, Share2,
} from 'lucide-react';

export default function DashboardLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success', title = '') => {
    setToast({ msg, type, title });
    setTimeout(() => setToast(null), 4000);
  };

  const navItems = [
    { to: '/app/projects', label: 'Projects', icon: FolderKanban },
    { to: '/app/datasets', label: 'Datasets', icon: Database },
    { to: '/app/models', label: 'Models', icon: Layers },
    { to: '/app/runs', label: 'Run History', icon: PlayCircle },
    { to: '/app/community', label: 'Community Hub', icon: Share2 },
    { to: '/app/code', label: 'Python Studio', icon: Code },
    { to: '/app/templates', label: 'Templates', icon: LayoutTemplate },
  ];

  return (
    <div className="h-screen flex overflow-hidden text-slate-800 font-sans bg-slate-50">
      {/* Toast notification */}
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Sidebar */}
      <aside
        className="w-64 h-screen border-r flex flex-col shrink-0 select-none z-20 overflow-hidden"
        style={{
          background: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
        }}
      >
        {/* Brand */}
        <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: 'var(--color-border)' }}>
          <Link to="/" className="flex items-center gap-2.5" title="Go to Home">
            <FlowMLIcon size={44} />
            <div>
              <Logo size="text-xl" />
              <div className="text-[10px] font-mono tracking-wider text-slate-400">
                Studio Workspace
              </div>
            </div>
          </Link>

        </div>

        {/* Studio Launch Quick Action */}
        <div className="p-4">
          <button
            onClick={() => navigate('/studio')}
            className="w-full py-2.5 px-3 rounded-xl font-bold text-xs text-white flex items-center justify-center gap-2 shadow-md shadow-violet-600/25 bg-violet-600 hover:bg-violet-700 transition-all active:scale-[0.98] group cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform" />
            Open Canvas Studio
            <ExternalLink className="w-3 h-3 ml-auto opacity-70" />
          </button>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 min-h-0 px-3 py-2 space-y-1 overflow-hidden">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  active
                    ? 'bg-violet-50 text-violet-700 border border-violet-200/80 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-violet-600' : 'text-slate-400'}`} />
                <span>{item.label}</span>
                {active && <ChevronRight className="w-3.5 h-3.5 ml-auto text-violet-600" />}
              </NavLink>
            );
          })}
        </nav>

        {/* User Card & Sign Out */}
        <div className="p-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <div className="p-3 rounded-2xl flex items-center gap-3 bg-slate-100/70 border border-slate-200/60">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-sm bg-violet-600"
            >
              {(user?.displayName || user?.email || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold truncate leading-tight text-slate-900">
                {user?.displayName || 'FlowML Engineer'}
              </div>
              <div className="text-[10px] truncate text-slate-500">
                {user?.email || 'dev@flowml.studio'}
              </div>
            </div>
            <SignOutButton
              title="Sign Out"
              aria-label="Sign Out"
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="text-[10px] font-semibold">Sign Out</span>
            </SignOutButton>
          </div>
          <NavLink
            to="/app/settings"
            className={`mt-2 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
              location.pathname.startsWith('/app/settings')
                ? 'bg-violet-50 text-violet-700'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Settings className={`w-3.5 h-3.5 ${
              location.pathname.startsWith('/app/settings') ? 'text-violet-600' : 'text-slate-400'
            }`} />
            Account Settings
            {location.pathname.startsWith('/app/settings') && (
              <ChevronRight className="w-3.5 h-3.5 ml-auto text-violet-600" />
            )}
          </NavLink>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 h-screen min-h-0 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header
          className="h-16 border-b px-8 flex items-center justify-between shrink-0 z-10"
          style={{
            background: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
          }}
        >
          <div className="flex items-center gap-4">
            <h2 className="font-display text-base font-bold tracking-tight" style={{ color: 'var(--color-text)' }}>
              {location.pathname.startsWith('/app/settings')
                ? 'Account Settings'
                : navItems.find((n) => location.pathname.startsWith(n.to))?.label || 'Dashboard'}
            </h2>
          </div>

        </header>

        {/* Routed Sub-view */}
        <main className="flex-1 min-h-0 overflow-y-auto p-8" style={{ background: 'var(--color-bg)' }}>
          <Outlet context={{ showToast }} />
        </main>
      </div>
    </div>
  );
}
