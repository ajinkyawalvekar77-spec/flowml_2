import axios from 'axios';
import { getCurrentIdToken, getCurrentUserId } from './firebase';

// ── Base URL ──────────────────────────────────────────────────────────────────
export const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 300_000, // 5 min — generous for large datasets / slow machines
});

// ── Attach Auth Token Interceptor ─────────────────────────────────────────────
api.interceptors.request.use(
  async (config) => {
    if (config.url?.startsWith('/api/admin/auth/login')) {
      return config;
    }

    if (config.url?.startsWith('/api/admin/')) {
      const adminToken = localStorage.getItem('flowml_admin_token');
      if (adminToken) {
        config.headers.Authorization = `Bearer ${adminToken}`;
      }
      return config;
    }

  
try {
  const token = await getCurrentIdToken();

  if (!token) {
    return Promise.reject(
      new Error('Please sign in to continue.')
    );
  }

  config.headers.Authorization = `Bearer ${token}`;
  return config;
} catch (error) {
  return Promise.reject(error);
}

  },
  (error) => Promise.reject(error)
);

// ── Normalise backend error shapes into user-friendly Error objects ───────────
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (
      err.config?.url?.startsWith('/api/admin/') &&
      !err.config.url.startsWith('/api/admin/auth/login') &&
      [401, 403].includes(err.response?.status)
    ) {
      localStorage.removeItem('flowml_admin_token');
      window.dispatchEvent(new Event('flowml-admin-session-expired'));
    }

    let msg = 'An unexpected error occurred';
    if (err.response) {
      const { status, data } = err.response;
      const detail = data?.detail;
      if (status === 401 && err.config?.url?.startsWith('/api/admin/auth/login')) {
        msg = typeof detail === 'string' ? detail : 'Invalid admin username or password.';
      } else if (status === 401) {
        msg = 'Your session has expired or authentication failed. Please sign in again.';
      } else if (status === 403) {
        msg = typeof detail === 'string' ? detail : 'Access forbidden. Administrator permissions may be required.';
      } else if (status === 413) {
        msg = typeof detail === 'string' ? detail : 'File exceeds maximum upload size (50MB).';
      } else if (status === 429) {
        msg = typeof detail === 'string' ? detail : 'Too many requests. Please wait a moment and try again.';
      } else if (typeof detail === 'object' && detail !== null) {
        const summary = detail.error || detail.message;
        msg = summary && detail.details
          ? `${summary}: ${detail.details}`
          : summary || detail.details || 'Server processed request with errors.';
      } else if (typeof detail === 'string') {
        msg = detail;
      } else if (status >= 500) {
        msg = 'The server could not complete the request. Please try again shortly.';
      } else if (data?.message) {
        msg = data.message;
      } else {
        msg = `Server request failed (Status ${status})`;
      }
    } else if (err.request) {
      msg = 'Unable to reach backend API server. Please check your network or server status.';
    } else {
      msg = err.message || msg;
    }
    const cleanError = new Error(String(msg));
    cleanError.status = err.response?.status;
    return Promise.reject(cleanError);
  }
);

// ── Core Dataset & ML Endpoints ───────────────────────────────────────────────

/** POST /api/upload — multipart file upload */
export const uploadDataset = (file, onProgress) => {
  const fd = new FormData();
  fd.append('file', file);
  return api
    .post('/api/upload', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress,
    })
    .then((r) => r.data);
};

/** POST /api/upload-url — download & access dataset from GitHub, Kaggle, or web URL */
export const uploadDatasetFromUrl = (url, fileName = null) =>
  api
    .post('/api/upload-url', { url, file_name: fileName })
    .then((r) => r.data);

/** GET /api/datasets — list caller's uploaded datasets */
export const listDatasets = () => api.get('/api/datasets').then((r) => r.data);

/** GET /api/datasets/{dataset_id}/preview — get preview rows, missing count, stats */
export const getDatasetPreview = (datasetId) =>
  api.get(`/api/datasets/${datasetId}/preview`).then((r) => r.data);

/** DELETE /api/datasets/{dataset_id} */
export const deleteDataset = (datasetId) =>
  api.delete(`/api/datasets/${datasetId}`).then((r) => r.data);

/** POST /api/analyze */
export const analyzeDataset = (datasetId) =>
  api.post('/api/analyze', { dataset_id: datasetId }).then((r) => r.data);

/**
 * POST /api/preprocess
 */
export const preprocessDataset = (datasetId, config, targetColumn = null) =>
  api
    .post('/api/preprocess', {
      dataset_id: datasetId,
      config,
      ...(targetColumn ? { target_column: targetColumn } : {}),
    })
    .then((r) => r.data);

/**
 * POST /api/train
 */
export const trainModels = (
  datasetId, targetColumn, taskType = 'classification', processedDatasetId = null,
  modelName = null, modelParameters = null, trainingOptions = {}
) =>
  api
    .post('/api/train', {
      dataset_id: datasetId,
      target_column: targetColumn,
      task_type: taskType,
      ...(processedDatasetId ? { processed_dataset_id: processedDatasetId } : {}),
      ...(modelName ? { model_name: modelName } : {}),
      ...(modelParameters ? { model_parameters: modelParameters } : {}),
      ...(trainingOptions.test_size != null ? { test_size: trainingOptions.test_size } : {}),
      ...(trainingOptions.random_state != null ? { random_state: trainingOptions.random_state } : {}),
    })
    .then((r) => r.data);

/** GET /api/models — list caller's trained models */
export const listModels = () => api.get('/api/models').then((r) => r.data);

/** DELETE /api/models/{model_id} */
export const deleteModel = (modelId) =>
  api.delete(`/api/models/${modelId}`).then((r) => r.data);

/**
 * POST /api/predict
 */
export const runPredictions = (datasetId, targetColumn = null, modelId = null) =>
  api
    .post('/api/predict', {
      dataset_id: datasetId,
      model_id: modelId,
      ...(targetColumn ? { target_column: targetColumn } : {}),
    })
    .then((r) => r.data);

/** POST /api/predict — infer directly from manually entered feature rows */
export const predictRows = (modelId, rows, targetColumn = null) =>
  api
    .post('/api/predict', {
      model_id: modelId,
      rows,
      ...(targetColumn ? { target_column: targetColumn } : {}),
    })
    .then((r) => r.data);

/** GET /api/download-model?model_id={model_id} */
export const downloadModelArtifact = (modelId) =>
  api.get('/api/download-model', {
    params: { model_id: modelId },
    responseType: 'blob',
  }).then((r) => r.data);

/** POST /api/visualizations */
export const getVisualizations = (datasetId, modelId) =>
  api.post('/api/visualizations', { dataset_id: datasetId, model_id: modelId }).then((r) => r.data);

/** POST /api/pipeline — synchronous pipeline execution */
export const runPipeline = (nodes, edges) =>
  api.post('/api/pipeline', { nodes, edges }).then((r) => r.data);

// ── Background Runs Endpoints ─────────────────────────────────────────────────

/** POST /api/runs — async job queue pipeline run */
export const submitRun = (nodes, edges, workflowMeta = null) =>
  api.post('/api/runs', { nodes, edges, workflow: workflowMeta }).then((r) => r.data);

/** GET /api/runs — list all runs for caller */
export const listRuns = () => api.get('/api/runs').then((r) => r.data);

/** GET /api/runs/{run_id} — get run status, result, logs */
export const getRun = (runId) => api.get(`/api/runs/${runId}`).then((r) => r.data);

/** POST /api/runs/{run_id}/stop — request stop */
export const stopRun = (runId) => api.post(`/api/runs/${runId}/stop`).then((r) => r.data);

/** GET /api/health */
export const checkHealth = () => api.get('/api/health').then((r) => r.data);

/** SSE endpoint URL for real-time logs */
export const LOG_SSE_URL = `${BASE_URL}/api/logs`;

// ── Projects Storage Helpers (Stored per-user in localStorage) ────────────────
const PROJECTS_KEY = 'flowml_user_projects_v2';
const projectsKey = () => `${PROJECTS_KEY}:${getCurrentUserId() || 'anonymous'}`;
export const workflowStorageKey = (projectId) =>
  `flowml_workflow_${getCurrentUserId() || 'anonymous'}_${projectId}`;

export function getProjects() {
  try {
    const raw = localStorage.getItem(projectsKey());
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveProject(project) {
  const projects = getProjects();
  const existingIdx = projects.findIndex((p) => p.id === project.id);
  const now = new Date().toISOString();
  if (existingIdx >= 0) {
    projects[existingIdx] = {
      ...projects[existingIdx],
      ...project,
      lastModified: now,
    };
  } else {
    projects.unshift({
      ...project,
      created: now,
      lastModified: now,
    });
  }
  localStorage.setItem(projectsKey(), JSON.stringify(projects));
  return project;
}

export function deleteProject(id) {
  localStorage.removeItem(workflowStorageKey(id));
  const projects = getProjects().filter((p) => p.id !== id);
  localStorage.setItem(projectsKey(), JSON.stringify(projects));
  return true;
}

export function duplicateProject(id) {
  const projects = getProjects();
  const found = projects.find((p) => p.id === id);
  if (!found) return null;
  const newId = `proj-${Date.now()}`;
  const copy = {
    ...found,
    id: newId,
    name: `${found.name} (Copy)`,
    created: new Date().toISOString(),
    lastModified: new Date().toISOString(),
  };
  projects.unshift(copy);
  localStorage.setItem(projectsKey(), JSON.stringify(projects));

  // Also duplicate workflow canvas data if saved
  const wfData = localStorage.getItem(workflowStorageKey(id));
  if (wfData) {
    localStorage.setItem(workflowStorageKey(newId), wfData);
  }
  return copy;
}

/* ─── PHASE 3: Python Execution Endpoints ───────────────────────────────────── */

/** POST /api/code/run — execute isolated Python script */
export const runPythonCode = (code, inputDatasetId = null, timeout = 15) =>
  api
    .post('/api/code/run', {
      code,
      input_dataset_id: inputDatasetId,
      timeout,
    })
    .then((r) => r.data);

/** POST /api/code/runs/{run_id}/stop — abort running Python worker */
export const stopPythonCode = (runId) =>
  api.post(`/api/code/runs/${runId}/stop`).then((r) => r.data);

/** GET /api/code/history — get caller's script run history */
export const getCodeHistory = () =>
  api.get('/api/code/history').then((r) => r.data);

/* ─── PHASE 3: Admin & Security Endpoints ───────────────────────────────────── */

/** POST /api/admin/auth/login */
export const adminLogin = (username, password) =>
  api.post('/api/admin/auth/login', { username, password }).then((r) => r.data);

/** GET /api/admin/users */
export const adminListUsers = () =>
  api.get('/api/admin/users').then((r) => r.data);

/** POST /api/admin/users/{uid}/status */
export const adminSetUserStatus = (uid, active) =>
  api.post(`/api/admin/users/${uid}/status`, { active }).then((r) => r.data);

/** GET /api/admin/jobs */
export const adminListJobs = () =>
  api.get('/api/admin/jobs').then((r) => r.data);

/** GET /api/admin/system */
export const adminGetSystemMetrics = () =>
  api.get('/api/admin/system').then((r) => r.data);

/** GET /api/admin/limits */
export const adminGetLimits = () =>
  api.get('/api/admin/limits').then((r) => r.data);

/** POST /api/admin/limits */
export const adminUpdateLimits = (limits) =>
  api.post('/api/admin/limits', limits).then((r) => r.data);

/** GET /api/admin/audit-logs */
export const adminGetAuditLogs = (limit = 50) =>
  api.get('/api/admin/audit-logs', { params: { limit } }).then((r) => r.data);

/** DELETE /api/account — GDPR data wipe */
export const deleteUserAccount = () =>
  api.delete('/api/account').then((r) => r.data);

/* ─── Community Pipeline Hub Endpoints ───────────────────────────────────────── */

/** GET /api/community/pipelines */
export const listCommunityPipelines = (params = {}) =>
  api.get('/api/community/pipelines', { params }).then((r) => r.data);

/** GET /api/community/pipelines/{pipeline_id} */
export const getCommunityPipeline = (pipelineId) =>
  api.get(`/api/community/pipelines/${pipelineId}`).then((r) => r.data);

/** POST /api/community/pipelines */
export const publishCommunityPipeline = (pipelineData) =>
  api.post('/api/community/pipelines', pipelineData).then((r) => r.data);

/** POST /api/community/pipelines/{pipeline_id}/fork */
export const forkCommunityPipeline = (pipelineId, targetDatasetId = null, datasetName = null) =>
  api.post(`/api/community/pipelines/${pipelineId}/fork`, {
    target_dataset_id: targetDatasetId,
    dataset_name: datasetName,
  }).then((r) => r.data);

/** POST /api/community/pipelines/{pipeline_id}/star */
export const starCommunityPipeline = (pipelineId) =>
  api.post(`/api/community/pipelines/${pipelineId}/star`).then((r) => r.data);

/** DELETE /api/community/pipelines/{pipeline_id} */
export const deleteCommunityPipeline = (pipelineId) =>
  api.delete(`/api/community/pipelines/${pipelineId}`).then((r) => r.data);

/** Export URL for pipeline */
export const exportCommunityPipelineUrl = (pipelineId) =>
  `${BASE_URL}/api/community/pipelines/${pipelineId}/export`;

/** POST /api/community/pipelines/import */
export const importCommunityPipeline = (pipelineData) =>
  api.post('/api/community/pipelines/import', pipelineData).then((r) => r.data);

/* ─── Email & Verification Endpoints (flowmlstudio@gmail.com) ─────────────────── */

/** POST /api/auth/send-verification — Dispatches verification link from flowmlstudio@gmail.com */
export const sendVerificationEmail = (email, userId = null, appUrl = window.location.origin) =>
  api.post('/api/auth/send-verification', {
    email,
    user_id: userId,
    app_url: appUrl,
  }).then((r) => r.data);

/** POST /api/auth/verify-token — Verifies account using token */
export const verifyEmailToken = (token) =>
  api.post('/api/auth/verify-token', { token }).then((r) => r.data);

/** POST /api/auth/send-password-reset — Sends password reset link from flowmlstudio@gmail.com */
export const sendPasswordResetEmail = (email, appUrl = window.location.origin) =>
  api.post('/api/auth/send-password-reset', {
    email,
    app_url: appUrl,
  }).then((r) => r.data);

/** POST /api/auth/send-project-update — Sends pipeline/training updates from flowmlstudio@gmail.com */
export const sendProjectUpdateEmail = ({ email, projectName, updateType = 'Pipeline Run', details = {} }) =>
  api.post('/api/auth/send-project-update', {
    email,
    project_name: projectName,
    update_type: updateType,
    details,
  }).then((r) => r.data);

/** GET /api/auth/email-service — Returns sender flowmlstudio@gmail.com and service status */
export const getEmailServiceStatus = () =>
  api.get('/api/auth/email-service').then((r) => r.data);

export default api;
