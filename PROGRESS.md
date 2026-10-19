# FlowML Development Progress

## Phase 1: Backend Engine and Contracts ✓
- [x] 1.1 `backend/auth.py` - get_current_user (Firebase verify + DEV_AUTH bypass, default DEV_AUTH="0")
- [x] 1.2 `backend/services/store.py` - StoreBackend interface + LocalDiskStore (per-uid paths, path-traversal guard)
- [x] 1.3 Rewrite `routes/upload.py` - uses uid, store.py, returns dataset_id; added GET /api/datasets, GET /preview, DELETE
- [x] 1.4 Rewrite `routes/analyze.py` - uid-scoped dataset lookup
- [x] 1.5 Rewrite `routes/preprocess.py` - per-uid datasets + preprocessors artifacts
- [x] 1.6 Rewrite `routes/train.py` - per-uid model_id, artifacts via store.py, Windows-safe temp handling; added GET /api/models, DELETE
- [x] 1.7 Rewrite `routes/predict.py` - predict_with_store() resolves both dataset and model by uid
- [x] 1.8 Rewrite `routes/visualize.py` - per-uid artifact resolution; added actual_vs_predicted + model_comparison
- [x] 1.9 Update `app.py` - removed global ensure_dir calls; registered runs router
- [x] 2.1-2.4 Executor Rebuild - graph validation, status tracking, SHA-256 output caching, per-run logs/metrics
- [x] 3.1-3.3 Job Queue - InProcessQueue with concurrency limits and runs router
- [x] 4.1-4.6 ML Completeness - data nodes (removeDuplicates, selectColumns, splitData), model nodes (knn, svm, kmeans, aiDecision), explainableAi, report
- [x] 5.1-5.5 All 42 backend pytest tests pass

---

## Phase 2: Frontend Product ✓

### 1. Auth & API Client
- [x] `frontend/src/services/firebase.js`: Firebase Auth SDK initialization with real Firebase + automatic `DEV_AUTH` mock fallback (stores session in localStorage, issues dev bearer tokens, simulates full auth flow when keys are absent).
- [x] `frontend/src/context/AuthContext.jsx`: Full React auth context providing `user`, `signIn`, `signUp`, `signOut`, `resetPassword`, `resendVerification`, `getIdToken`, `isDevMode`.
- [x] `frontend/src/services/api.js`: Centralized Axios client attaching `Authorization: Bearer <token>` on all requests. CRUD endpoints for datasets, models, runs, pipelines, and project helpers.
- [x] `frontend/src/components/auth/ProtectedRoute.jsx`: Protected route guard redirecting unauthenticated users to `/signin`.
- [x] Auth screens:
  - `SignIn.jsx`: Email/password login, local-mode information, link to reset password & sign up.
  - `SignUp.jsx`: Name, email, password, confirm password, terms check, instant dev login.
  - `ForgotPassword.jsx`: Email recovery trigger & reset dispatch.
  - `VerifyEmail.jsx`: Email verification prompt, resend trigger, continue to workspace.

### 2. Dashboard (`/app` Layout with Persistent Sidebar)
- [x] `DashboardLayout.jsx`: Responsive layout with navigation sidebar (Projects, Datasets, Models, Runs, Templates, Settings), live backend API health badge, user profile card, sign out.
- [x] `ProjectsView.jsx`: Project CRUD, template badges, duplicate project, rename, delete modal with confirmation, one-click "Open in Studio".
- [x] `DatasetsView.jsx`: Dataset table, upload modal with file selector, preview modal (schema, rows, columns, nulls, duplicates), delete.
- [x] `ModelsView.jsx`: Trained model catalog, task type, algorithm version, evaluation metrics badges (Accuracy, F1, R²), delete.
- [x] `RunsView.jsx`: Run execution table, live status polling (`queued`, `running`, `completed`, `failed`, `stopped`), run logs modal, metrics inspect, stop run button, rerun action.
- [x] `TemplatesView.jsx`: classification and regression templates preload their bundled sample datasets and open in Studio; clustering is disabled until the Studio runner supports real K-Means execution.
- [x] `SettingsView.jsx`: Account settings, UID copy tool, Firebase config diagnostic table, dev auth switch.
- [x] Common UI: `Toast.jsx` for alerts and feedback, animated loading skeletons, empty state illustrations.

### 3. Studio Upgrades (`Workflow.jsx`, `App.jsx`, Inspector & Nodes)
- [x] **History & Saving**: Undo/Redo stack (with keyboard shortcuts `Ctrl+Z`, `Ctrl+Y`), Stop button, debounced autosave + manual save button, workflow title & description editing.
- [x] **Pre-run DAG Validation**: Graph cycle detection, isolated nodes check, source node requirement check, visual red error badges and tooltip banners on offending nodes.
- [x] **Live Node Execution Badges**: Status badges (`Pending`, `Running`, `Completed`, `Failed`) overlaid dynamically during pipeline execution.
- [x] **10 New Palette Nodes & Inspectors**:
  - `removeDuplicates`: Column subsets, keep strategy.
  - `selectColumns`: Include/exclude column selection.
  - `splitData`: Test size ratio, random seed, stratification flag.
  - `logisticRegression`: C regularization, penalty, solver.
  - `knn`: Number of neighbors, metric distance, weight function.
  - `svm`: Kernel (rbf/linear/poly), C regularization, gamma.
  - `kmeans`: n_clusters, init method, max iterations.
  - `aiDecision`: Target column, task type, metric optimization target.
  - `explainableAi`: Model selector, top-N feature count, baseline sample count.
  - `report`: Report title, leaderboard inclusion, metric charts inclusion.
- [x] **Results Overlay Upgrades**:
  - Actual vs. Predicted comparison tab.
  - Model Leaderboard comparison tab.
  - Explainability & SHAP feature importance tab.
  - HTML Report download button & viewer.

### 4. Landing Page Completion & Routing
- [x] Header Navigation: `Home`, `Features`, `Documentation`, `Tutorials`, `About`, `Contact`.
- [x] Action Buttons: `Sign In` (`/signin`), `Get Started` / `Sign Up` (`/signup`), `Studio` (`/studio`).
- [x] Legal & Info Pages:
  - `frontend/src/pages/info/InfoPages.jsx`: Dedicated pages for `/docs`, `/tutorials`, `/about`, `/contact`, `/privacy`, `/terms`.
- [x] Responsive layout across desktop, tablet, and mobile.
- [x] Full router integration in `main.jsx` with `AuthProvider`.
- [x] Build validation: `npm run build` completed cleanly without errors.

---

## Phase 3: Python Execution, Admin, Security, Docs, Testing ✓

### 1. Python Code Editor (Frontend)
- [x] `frontend/src/components/code/PythonEditor.jsx`: Full-featured in-browser code editor with line numbers, code snippets dropdown (Feature Engineering, Missing Data, Model, Plot), dataset binding dropdown, execution status pill, duration timer, copy script button, stop/run actions.
- [x] Multi-tab output console: Standard Output terminal with syntax highlighting, traceback / error viewer, Matplotlib plot gallery (auto-rendered base64 PNGs), and transformed dataset table view.
- [x] Execution history modal: Lists previous code runs with timestamps, status, duration, and 1-click reload into editor.
- [x] `frontend/src/pages/dashboard/CodeEditorView.jsx`: Standalone Python Studio integrated into the app dashboard navigation (`/app/code`).

### 2. Isolated Execution Sandbox (Backend - TOP PRIORITY)
- [x] `docker/Dockerfile.worker`: Hardened Docker worker container with non-root user `flowml:1000`, `--network none`, `--read-only` root fs, 64MB memory tmpfs `/tmp`, 256MB memory limit, 1.0 CPU quota, and 64 PIDs limit.
- [x] `backend/services/sandbox_runner.py`: Dedicated standalone sandbox script executing in an isolated process/container; captures stdout, stderr, execution duration, tracebacks, matplotlib figures as base64 PNGs, and transformed DataFrames.
- [x] `backend/services/code_executor.py`: AST static verification blocking forbidden modules (`socket`, `requests`, `urllib`, `subprocess`, host secret reads) + SubprocessSandboxRunner fallback with stripped environment, per-run sandbox directory, active memory watchdog (>256MB kill), and watchdog timeout.
- [x] Endpoints: `POST /api/code/run`, `POST /api/code/runs/{run_id}/stop`, `GET /api/code/history`.
- [x] `customPython` DAG Node:
  - Registered in `backend/services/pipeline_executor.py` (`NODE_OUTPUT_TYPE`, `REQUIRES_DATAFRAME`, `DATAFRAME_PRODUCERS`, `PROCESS_TYPES`).
  - Studio integration: Custom node palette item in `Sidebar.jsx`, visual node in `CustomNodes.jsx`, and parameter inspector with starter snippets & test runner in `PipelinePanel.jsx`.

### 3. Admin & Governance
- [x] Admin Role Check (`backend/auth.py`): Verifies `admin: true` custom claim or `ADMIN_UIDS` env var. Blocks deactivated users with 403 Forbidden.
- [x] Admin endpoints (`backend/routes/admin.py`):
  - `GET /api/admin/users`: List users, registration date, dataset/model count, active/inactive status.
  - `POST /api/admin/users/{uid}/status`: Activate or deactivate user accounts.
  - `GET /api/admin/jobs`: Running, queued, completed, and failed jobs across all users.
  - `GET /api/admin/system`: Real-time CPU, RAM, and disk storage metrics.
  - `GET/POST /api/admin/limits`: Configurable quotas (timeout, memory, max upload MB, user dataset quota).
  - `GET /api/admin/audit-logs`: Security events and audit trail (`storage/audit_events.jsonl`).
- [x] Admin UI (`frontend/src/pages/dashboard/AdminView.jsx`): Security operations dashboard with metrics gauges, user management table, running jobs monitor, limits configuration form, and audit log viewer. Accessible via sidebar at `/app/admin`.

### 4. Security Hardening
- [x] File upload size validation (`MAX_UPLOAD_SIZE_MB`, returns 413 Payload Too Large).
- [x] Rate limiting service (`backend/services/rate_limiter.py`, sliding window, returns 429 Too Many Requests).
- [x] Audit logger (`backend/services/audit.py`, records auth, deactivation, and security alerts).
- [x] Global secure exception handler (`backend/app.py`, suppresses internal stack traces in client responses).
- [x] Account and data deletion endpoint (`DELETE /api/account` and `DELETE /api/account/data` in `backend/routes/account.py`, wipes all user-scoped storage).

### 5. Docs and Interactive Learning
- [x] In-app documentation (`/docs` in `frontend/src/pages/info/InfoPages.jsx`):
  - Complete directory for all 14 visual DAG nodes (inputs, outputs, parameters, when to use).
  - Mathematical metrics glossary (Accuracy, Precision, Recall, F1, ROC-AUC, R², MSE, RMSE, MAE, Silhouette, Inertia).
  - Execution sandbox limits (CPU 1.0, 256MB RAM, 15-60s timeout, read-only root, no network).
  - Supported Python libraries (`numpy`, `pandas`, `scikit-learn`, `matplotlib`, standard library).
  - Security and architecture FAQs.
- [x] Interactive tutorials (`/tutorials` in `frontend/src/pages/info/InfoPages.jsx`):
  - 2 sample datasets (`titanic.csv` for classification and `housing.csv` for regression) in `frontend/public/samples/` with 1-click download & Studio load.
  - 4-step visual modeling walkthrough framework.
  - 3 tested Python starter snippets with 1-click "Copy Script" and "Open in Studio" integration.

### 6. Testing & Quality Assurance
- [x] 60/60 tests passing across all test suites:
  - `test_code_execution.py`: AST static verification, timeout enforcement, memory limit enforcement, stdout capture, plot capture, customPython DAG node.
  - `test_isolation.py`: Subprocess/Docker isolation, environment sanitization, sandbox temp isolation.
  - `test_security.py`: File size 413 limit, rate limiting 429, secure error masking, GDPR account & data wipe.
  - `test_admin.py`: Role guard, user management, metrics, limit updates, audit log queries.
  - `test_multi_user.py`: 3 and 5 simulated concurrent users with dataset privacy, account isolation, failing code, and crash recovery.
---

## Phase 4: Fix Errors, Clean Routing, Redesign UI ✓

### 1. Error Audit and Fixes ✓
- [x] **Frontend ESLint & Build**: Resolved all 53 errors across components, views, and layout. `npm run lint` yields 0 errors, `npm run build` generates production bundle in 900ms.
- [x] **Backend Pytest & Modernized API Tests**:
  - `backend/pytest.ini` configured with `testpaths = tests` to isolate unit/integration test discovery.
  - All 60/60 pytest tests pass cleanly in 47s.
  - `test_api.py` upgraded for Phase 1-4 authenticated architecture; runs complete end-to-end flow (upload -> analyze -> preprocess -> train -> visualizations -> predict) with 100% success.
- [x] **Windows File Locking (WinError 32)**: Fixed `tempfile.NamedTemporaryFile` process locking in `routes/preprocess.py` and `routes/upload.py` by using Windows-safe named paths and `os.replace`.
- [x] **Error Boundaries & Consistent Error Interceptor**:
  - Created `ErrorBoundary.jsx` with recovery UI and wrapped application in `main.jsx`.
  - Upgraded Axios response interceptor in `services/api.js` to normalize status codes (401, 403, 413, 429, 500) into user-friendly messages with no raw stack traces.
- [x] **Windows Path Traversal Resolution**: Fixed `LocalDiskStore._safe_path` using `.resolve()` and `.relative_to()` to prevent false-positive traversal rejections from 8.3 short-name aliases and drive case differences.

### 2. Routing Cleanup ✓
- [x] Single router source of truth in [routes.jsx](file:///c:/Users/vishw/Desktop/Projects/FlowML/Source%20Code/frontend/src/routes.jsx):
  - Public: `/`, `/features`, `/docs`, `/tutorials`, `/about`, `/contact`, `/privacy`, `/terms`.
  - Auth: `/signin`, `/signup`, `/forgot-password`, `/verify-email`.
  - App Dashboard: `/app/projects`, `/app/projects/new`, `/app/datasets`, `/app/models`, `/app/runs`, `/app/templates`, `/app/code`, `/app/admin`, `/app/settings`.
  - Studio: `/studio`, `/studio/:projectId`.
  - Canonical redirects: `/login` → `/signin`, `/register` → `/signup`, `/dashboard` → `/app/projects`.
  - Removed duplicate `/app` route collision.
  - 404 Catch-all route to [NotFoundPage.jsx](file:///c:/Users/vishw/Desktop/Projects/FlowML/Source%20Code/frontend/src/pages/NotFoundPage.jsx).

### 3. Light Theme Redesign & Button Verification ✓
- [x] **Global Light Theme Enforcement**:
  - Stripped all hardcoded dark hex backgrounds (`#080c14`, `#0e1422`, `#0a0f1c`) across [LandingPage.jsx](file:///c:/Users/vishw/Desktop/Projects/FlowML/Source%20Code/frontend/src/pages/LandingPage.jsx), [InfoPages.jsx](file:///c:/Users/vishw/Desktop/Projects/FlowML/Source%20Code/frontend/src/pages/info/InfoPages.jsx), [AdminView.jsx](file:///c:/Users/vishw/Desktop/Projects/FlowML/Source%20Code/frontend/src/pages/dashboard/AdminView.jsx), and [ResultsOverlay.jsx](file:///c:/Users/vishw/Desktop/Projects/FlowML/Source%20Code/frontend/src/components/layout/ResultsOverlay.jsx).
  - Consistent modern palette: light slate background (`#f8fafc`), pure white card surfaces (`#ffffff`), subtle borders (`#e2e8f0`), indigo/violet brand accents (`#4f46e5`), and slate-900 typography.
  - No dark mode toggle; entire product strictly runs in clean light mode.
- [x] **Button Clicks & Interactive Feedback**:
  - Wired and verified all navigation links, tabs, CTAs, test run simulation triggers, download triggers, and modal actions with active/hover feedback.

### 4. Typography System & Unified Violet Light UI ✓
- [x] **Typography Foundation**:
  - Google Fonts integrated in `index.html`: Plus Jakarta Sans (600, 700, 800), Inter (400, 500, 600), JetBrains Mono (400, 500).
  - Extended font families in `tailwind.config.js` (`display`, `sans`, `mono`).
  - Created reusable live-text `Logo.jsx` with bold wordmark typography.
- [x] **Landing Page SaaS Migration**:
  - Rebuilt `LandingPage.jsx` matching target SaaS aesthetic: violet ambient glows, dual-mockup hero showcase, pastel trio feature cards, interactive stepper, integrations hub, dark next-gen feature block, and flexible pricing.
- [x] **Project-Wide Theme Unification**:
  - Unified color system to FlowML Violet (`#7C3AED` / `violet-600`) and pure light surfaces across `DashboardLayout`, all dashboard views (`ProjectsView`, `DatasetsView`, `ModelsView`, `RunsView`, `TemplatesView`, `CodeEditorView`, `AdminView`, `SettingsView`), Info & Docs pages, Studio canvas, and Auth views.
  - Production build passes with 0 errors.

---

## Brand Icon ✓
- [x] Added `frontend/src/components/FlowMLIcon.jsx` (animated inner chain only; no hover/click/float effects).
- [x] Added `frontend/public/flowml-icon.svg` and wired `index.html` favicon to `/flowml-icon.svg`.
- [x] Navbar, app shell, auth pages, landing hero/footer, loaders, and empty states use the new icon; old Cpu-in-box logo marks removed.
- [x] FlowML wordmark uses the approved Plus Jakarta Sans / Inter / JetBrains Mono font system; headings stay Plus Jakarta Sans.
- [x] Brand wordmark uses Plus Jakarta Sans; navbar/auth icon sizes bumped; landing hero no longer shows the centered icon above the heading.

---

## Current Local Audit Follow-up

This section supersedes earlier completion claims for any flow not reverified in this audit. See the root `AUDIT.md` for the finding-by-finding disposition and continuation checklist.

### Completed in this follow-up
- [x] Studio callback initialization and lint blockers fixed; frontend lint and production build pass.
- [x] Studio API helpers aligned to the existing backend dataset/model ID contracts.
- [x] Python execution and history now use the request-scoped storage dependency, avoiding a global-store mismatch in isolated/concurrent runs.
- [x] DEV_AUTH no longer creates an automatic demo session; local project/workflow data is user-scoped.
- [x] Dataset/model/run dashboards no longer populate fake demo entries after empty or failed API responses; retryable errors and true empty states are shown.
- [x] Python Studio is enabled by default and can be disabled with `ENABLE_PYTHON_SANDBOX=false` and `VITE_ENABLE_PYTHON_SANDBOX=false`.
- [x] CORS is environment-configurable, logs require authenticated per-user streams, upload size is checked while streaming, and auth error details are sanitized.
- [x] `/app/admin` is part of the protected dashboard route tree and its navigation item is available.
- [x] Windows setup documentation and backend/frontend `.env.example` files added; real `.env` or Firebase credentials were not created or edited.
- [x] Legacy Sora/Audiowide font references removed; unused Sora package removed.
- [x] Added a skippable three-step onboarding tour and first-workflow action for a user's empty project list.
- [x] Browser route sweep: public/auth routes rendered; protected routes redirected to sign-in; zero console errors, page errors, and failed requests observed. `/api/health` returned running.
- [x] Fresh local DEV_AUTH signup/verification, onboarding, housing upload, Studio training/results, and real model listing verified. The graph had no Prediction node, so no prediction output appeared; the execution did not create a Run History record.
- [x] Classification/regression templates now use bundled Titanic/housing samples and create an uploaded dataset before opening Studio; both include a Prediction node. Clustering is disabled rather than claiming to execute correctly.
- [x] Frontend lint and production build pass after template updates; build retains the existing large-chunk advisory.
- [x] Removed dashboard API health/auth-provider badges and the Dr. Sarah Chen / VectorScale testimonial. The File/Edit/View/Insert/Runtime/Tools/Help strip was not found in FlowML source, so no unrelated editor/window chrome was changed.

### Still to verify or complete
- [x] Backend direct dependencies installed; full pytest suite passes 61/61 and standalone `test_api.py` upload-to-predict flow passes.
- [ ] Connect Studio execution to Run History and complete a graph with a Prediction node; verify predicted output and metric values.
- [ ] Browser-verify classification/regression template predictions; implement actual K-Means execution and verify it plus ML edge cases/metric alignment.
- [ ] Exercise account deletion, all loading/empty/error/confirmation states, node availability, and Studio autosave/undo/stop/shortcuts.
- [ ] Review npm advisories without applying broad dependency upgrades; obtain teammate review of placeholder legal copy and Firebase configuration.

### Verification caveat
The backend suite writes local runtime files and changed tracked files under `backend/models/saved_models/` during test runs. Runtime data is now ignored by `.gitignore`; tracked model-file changes are intentionally left untouched pending explicit review because destructive git/shell cleanup was prohibited.
