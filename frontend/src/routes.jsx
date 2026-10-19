import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Auth Guard
import ProtectedRoute from './components/auth/ProtectedRoute.jsx';
import AdminRoute from './components/auth/AdminRoute.jsx';

// Pages
import LandingPage from './pages/LandingPage.jsx';
import App from './App.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

import ForgotPassword from './pages/auth/ForgotPassword.jsx';
import VerifyEmail from './pages/auth/VerifyEmail.jsx';

// Dashboard Views
import DashboardLayout from './pages/dashboard/DashboardLayout.jsx';
import ProjectsView from './pages/dashboard/ProjectsView.jsx';
import DatasetsView from './pages/dashboard/DatasetsView.jsx';
import ModelsView from './pages/dashboard/ModelsView.jsx';
import RunsView from './pages/dashboard/RunsView.jsx';
import TemplatesView from './pages/dashboard/TemplatesView.jsx';
import CodeEditorView from './pages/dashboard/CodeEditorView.jsx';
import SettingsView from './pages/dashboard/SettingsView.jsx';
import CommunityHubView from './pages/dashboard/CommunityHubView.jsx';

// Info & Legal Pages
import {
  DocsPage,
  TutorialsPage,
  AboutPage,
  ContactPage,
  PrivacyPage,
  TermsPage,
  FeaturesPage,
} from './pages/info/InfoPages.jsx';

export default function AppRoutes() {
  return (
    <Routes>
      {/* ─── Public Landing & Info ────────────────────────────────────────── */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/features" element={<FeaturesPage />} />
      <Route path="/docs" element={<DocsPage />} />
      <Route path="/tutorials" element={<TutorialsPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />

      {/* ─── Authentication ────────────────────────────────────────────────── */}
      <Route path="/signin" element={<LandingPage authMode="signin" />} />
      <Route path="/signup" element={<LandingPage authMode="signup" />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/verify-email" element={<VerifyEmail />} />

      {/* ─── Canonical Redirects ───────────────────────────────────────────── */}
      <Route path="/login" element={<Navigate to="/signin" replace />} />
      <Route path="/register" element={<Navigate to="/signup" replace />} />
      <Route path="/dashboard" element={<Navigate to="/app/projects" replace />} />

      {/* ─── Protected Dashboard ───────────────────────────────────────────── */}
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/app/projects" replace />} />
        <Route path="projects" element={<ProjectsView />} />
        <Route path="projects/new" element={<ProjectsView initialCreateOpen />} />
        <Route path="datasets" element={<DatasetsView />} />
        <Route path="models" element={<ModelsView />} />
        <Route path="runs" element={<RunsView />} />
        <Route path="templates" element={<TemplatesView />} />
        <Route path="community" element={<CommunityHubView />} />
        <Route path="code" element={<CodeEditorView />} />
        <Route path="settings" element={<SettingsView />} />
      </Route>

      {/* ─── Protected Studio ──────────────────────────────────────────────── */}
      <Route
        path="/studio"
        element={
          <ProtectedRoute>
            <App />
          </ProtectedRoute>
        }
      />
      <Route
        path="/studio/:projectId"
        element={
          <ProtectedRoute>
            <App />
          </ProtectedRoute>
        }
      />

      {/* ─── Standalone admin console ──────────────────────────────────────── */}
      <Route path="/admin" element={<AdminRoute />} />

      {/* ─── Error 404 ─────────────────────────────────────────────────────── */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
