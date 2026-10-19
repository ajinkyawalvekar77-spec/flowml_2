import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  listDatasets, uploadDataset, uploadDatasetFromUrl, getDatasetPreview, deleteDataset,
} from '../../services/api';
import {
  Upload, Search, Trash2, Eye, AlertCircle,
  FileSpreadsheet, CheckCircle2, Loader2, X, AlertTriangle,
  RefreshCw, Table, Sparkles, Filter, Hash, HelpCircle,
  Link2, Globe, ExternalLink,
} from 'lucide-react';
import FlowMLIcon from '../../components/FlowMLIcon';

export default function DatasetsView() {
  const { showToast } = useOutletContext();

  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  // Upload modal state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadTab, setUploadTab] = useState('link'); // 'link' | 'file'
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Link import state
  const [linkUrl, setLinkUrl] = useState('');
  const [linkCustomName, setLinkCustomName] = useState('');
  const [importingLink, setImportingLink] = useState(false);

  // Preview modal state
  const [previewDatasetId, setPreviewDatasetId] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchDatasets = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listDatasets();
      setDatasets(Array.isArray(data) ? data : []);
    } catch (err) {
      setDatasets([]);
      setError(err.message || 'Unable to load datasets. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatasets();
  }, []);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile) return;

    setUploading(true);
    setUploadProgress(20);
    try {
      await uploadDataset(uploadFile, (p) => {
        if (p.total) {
          setUploadProgress(Math.round((p.loaded * 100) / p.total));
        }
      });
      showToast(`Dataset "${uploadFile.name}" uploaded successfully!`, 'success');
      setIsUploadOpen(false);
      setUploadFile(null);
      fetchDatasets();
    } catch (_err) {
      showToast(_err.message || 'Upload failed.', 'error');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleLinkImport = async (e) => {
    e.preventDefault();
    if (!linkUrl.trim()) return;

    setImportingLink(true);
    try {
      const res = await uploadDatasetFromUrl(linkUrl.trim(), linkCustomName.trim() || null);
      showToast(
        `✓ "${res.file_name}" imported successfully (${res.rows?.toLocaleString()} rows, ${res.columns} cols)!`,
        'success'
      );
      setIsUploadOpen(false);
      setLinkUrl('');
      setLinkCustomName('');
      fetchDatasets();
    } catch (err) {
      showToast(err.message || 'Failed to import dataset from link.', 'error');
    } finally {
      setImportingLink(false);
    }
  };

  const handleOpenPreview = async (ds) => {
    setPreviewDatasetId(ds.dataset_id);
    setPreviewLoading(true);
    setPreviewData(null);
    setPreviewError(null);
    try {
      const data = await getDatasetPreview(ds.dataset_id);
      setPreviewData(data);
    } catch (e) {
      setPreviewError(e.message || 'Unable to preview this dataset.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteDataset(deleteTarget.dataset_id);
      showToast(`Dataset deleted.`, 'info');
      setDatasets((prev) => prev.filter((d) => d.dataset_id !== deleteTarget.dataset_id));
    } catch (err) {
      showToast(err.message || 'Failed to delete dataset.', 'error');
    } finally {
      setDeleteTarget(null);
    }
  };

  const filtered = datasets.filter((d) => {
    const name = d.original_name || d.file || d.dataset_id || '';
    return name.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-[-0.02em] leading-tight" style={{ color: 'var(--color-text)' }}>
            Dataset Repository
          </h1>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Upload, inspect schemas, preview tabular data, and track missing values for your machine learning models.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchDatasets}
            disabled={loading}
            className="p-2.5 rounded-xl border text-slate-400 hover:text-white transition-colors"
            style={{
              borderColor: 'var(--color-border)',
              background: 'var(--color-surface)',
            }}
            title="Refresh datasets"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setIsUploadOpen(true)}
            className="px-4 py-2.5 rounded-xl font-bold text-xs text-white flex items-center gap-2 shadow-lg transition-all active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #7C3AED, #6D28D9)',
              boxShadow: '0 4px 16px rgba(124, 58, 237, 0.35)',
            }}
          >
            <Upload className="w-4 h-4" />
            Upload Dataset
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search datasets by filename…"
            className="w-full pl-9 pr-4 py-2 rounded-xl text-xs transition-all focus:outline-none focus:ring-1 focus:ring-primary"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
            }}
          />
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>
        <div className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>
          {filtered.length} datasets available
        </div>
      </div>

      {/* Dataset List / Table */}
      {error ? (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 flex items-center justify-between gap-4">
          <span>{error}</span>
          <button onClick={fetchDatasets} className="font-semibold underline">Retry</button>
        </div>
      ) : loading ? (
        <div className="p-16 flex flex-col items-center justify-center gap-3 text-slate-400">
          <FlowMLIcon size={56} />
          <p className="text-xs font-medium">Scanning user storage for datasets…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="rounded-3xl p-12 text-center border border-dashed flex flex-col items-center justify-center max-w-xl mx-auto my-8"
          style={{
            borderColor: 'var(--color-border)',
            background: 'var(--color-surface)',
          }}
        >
          <FlowMLIcon size={56} className="mb-4" />
          <h3 className="font-display font-semibold text-base mb-1" style={{ color: 'var(--color-text)' }}>
            No datasets uploaded
          </h3>
          <p className="text-xs max-w-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
            {search ? 'No datasets match your search filter.' : 'Upload CSV, XLS, or XLSX datasets to start training scikit-learn models.'}
          </p>
          <button
            onClick={() => setIsUploadOpen(true)}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-2"
            style={{ background: 'linear-gradient(135deg, #7C3AED, #6D28D9)' }}
          >
            <Upload className="w-3.5 h-3.5" />
            Upload First Dataset
          </button>
        </div>
      ) : (
        <div
          className="rounded-2xl border overflow-hidden shadow-sm"
          style={{
            background: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
          }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b uppercase font-bold text-[10px] tracking-wider" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                <tr>
                  <th className="py-3.5 px-4">Dataset Name</th>
                  <th className="py-3.5 px-4">Rows</th>
                  <th className="py-3.5 px-4">Columns</th>
                  <th className="py-3.5 px-4">Preview Columns</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                {filtered.map((ds) => {
                  const name = ds.original_name || ds.file || ds.dataset_id;
                  const rowCount = ds.rows != null ? ds.rows.toLocaleString() : '—';
                  const colCount = ds.columns != null ? ds.columns : (ds.column_names?.length || '—');
                  const cols = ds.column_names || [];

                  return (
                    <tr
                      key={ds.dataset_id}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                            style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6' }}
                          >
                            <FileSpreadsheet className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-bold text-xs" style={{ color: 'var(--color-text)' }}>
                              {name}
                            </div>
                            <div className="text-[10px] font-mono" style={{ color: 'var(--color-text-muted)' }}>
                              ID: {ds.dataset_id.slice(0, 12)}…
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono font-medium" style={{ color: 'var(--color-text)' }}>
                        {rowCount}
                      </td>

                      <td className="py-3.5 px-4 font-mono font-medium" style={{ color: 'var(--color-text)' }}>
                        {colCount}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {cols.slice(0, 4).map((c) => (
                            <span
                              key={c}
                              className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-white/5 border border-white/10"
                              style={{ color: 'var(--color-text-muted)' }}
                            >
                              {c}
                            </span>
                          ))}
                          {cols.length > 4 && (
                            <span className="text-[9px] font-mono text-primary font-bold">
                              +{cols.length - 4} more
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenPreview(ds)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-primary hover:bg-primary/10 flex items-center gap-1 transition-colors"
                            title="Inspect Dataset"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Preview
                          </button>

                          <button
                            onClick={() => setDeleteTarget(ds)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Dataset Modal (Tabbed: Link vs File) */}
      <AnimatePresence>
        {isUploadOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg rounded-3xl p-6 shadow-2xl relative"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <Database className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-display font-semibold text-base leading-tight" style={{ color: 'var(--color-text)' }}>
                      Add Dataset
                    </h3>
                    <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                      Import directly from GitHub / Kaggle links or upload local file
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsUploadOpen(false)}
                  className="p-1 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Tab Selector */}
              <div
                className="flex p-1 rounded-2xl mb-4"
                style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
              >
                <button
                  type="button"
                  onClick={() => setUploadTab('link')}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                    uploadTab === 'link'
                      ? 'bg-primary text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Link2 className="w-3.5 h-3.5" />
                  GitHub / Kaggle Link
                </button>
                <button
                  type="button"
                  onClick={() => setUploadTab('file')}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                    uploadTab === 'file'
                      ? 'bg-primary text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  Local File Upload
                </button>
              </div>

              {/* TAB 1: Link Import */}
              {uploadTab === 'link' && (
                <form onSubmit={handleLinkImport} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--color-text)' }}>
                      Dataset Link (GitHub, Kaggle, Google Drive, or Web URL)
                    </label>
                    <div className="relative">
                      <Globe className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="url"
                        required
                        value={linkUrl}
                        onChange={(e) => setLinkUrl(e.target.value)}
                        placeholder="e.g. https://github.com/.../data.csv or https://www.kaggle.com/datasets/..."
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl text-xs font-mono border outline-none transition-all focus:border-primary"
                        style={{
                          background: 'var(--color-bg)',
                          borderColor: 'var(--color-border)',
                          color: 'var(--color-text)',
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
                      Dataset Label / File Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={linkCustomName}
                      onChange={(e) => setLinkCustomName(e.target.value)}
                      placeholder="e.g. titanic.csv"
                      className="w-full px-3 py-2 rounded-xl text-xs border outline-none transition-all focus:border-primary"
                      style={{
                        background: 'var(--color-bg)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text)',
                      }}
                    />
                  </div>

                  {/* Preset Pills */}
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">
                      Quick Sample Datasets
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setLinkUrl('https://github.com/datasciencedojo/datasets/blob/master/titanic.csv');
                          setLinkCustomName('titanic.csv');
                        }}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all hover:border-primary text-slate-300 hover:text-white"
                        style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
                      >
                        🚢 Titanic (GitHub)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setLinkUrl('https://raw.githubusercontent.com/mwaskom/seaborn-data/master/iris.csv');
                          setLinkCustomName('iris.csv');
                        }}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all hover:border-primary text-slate-300 hover:text-white"
                        style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
                      >
                        🌸 Iris (GitHub)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setLinkUrl('https://www.kaggle.com/datasets/heptapod/titanic');
                          setLinkCustomName('kaggle_titanic.csv');
                        }}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all hover:border-primary text-slate-300 hover:text-white"
                        style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
                      >
                        ⚡ Titanic (Kaggle)
                      </button>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl border text-[11px] space-y-1 text-slate-400" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}>
                    <p className="font-semibold text-slate-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-primary" /> Supported Formats
                    </p>
                    <p>• <strong>GitHub:</strong> Raw links or web view <code className="text-primary text-[10px]">/blob/</code> links</p>
                    <p>• <strong>Kaggle:</strong> Public dataset URLs (ZIP archives automatically unpacked)</p>
                    <p>• <strong>Direct URLs:</strong> Any public CSV, Excel (.xlsx/.xls), Google Drive or Dropbox link</p>
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsUploadOpen(false)}
                      disabled={importingLink}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!linkUrl.trim() || importingLink}
                      className="px-5 py-2 rounded-xl text-xs font-bold text-white shadow-lg disabled:opacity-50 flex items-center gap-2"
                      style={{ background: 'linear-gradient(135deg, #7C3AED, #6D28D9)' }}
                    >
                      {importingLink ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Downloading & Reading…
                        </>
                      ) : (
                        <>
                          <ExternalLink className="w-3.5 h-3.5" />
                          Access & Import Dataset
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 2: File Upload */}
              {uploadTab === 'file' && (
                <form onSubmit={handleUpload} className="space-y-4">
                  <div
                    className="border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors hover:border-primary/50"
                    style={{
                      borderColor: 'var(--color-border)',
                      background: 'var(--color-bg)',
                    }}
                    onClick={() => document.getElementById('dataset-file-input').click()}
                  >
                    <input
                      id="dataset-file-input"
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      className="hidden"
                      onChange={(e) => setUploadFile(e.target.files[0])}
                    />

                    <div
                      className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                      style={{ background: 'rgba(124, 58, 237, 0.1)', color: '#7C3AED' }}
                    >
                      <Upload className="w-6 h-6" />
                    </div>

                    {uploadFile ? (
                      <div>
                        <p className="font-bold text-xs text-primary mb-1">{uploadFile.name}</p>
                        <p className="text-[10px] text-slate-400">
                          {(uploadFile.size / 1024).toFixed(1)} KB • Click to change
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="font-bold text-xs mb-1" style={{ color: 'var(--color-text)' }}>
                          Choose CSV or Excel file
                        </p>
                        <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                          Drag & drop or browse from your device (.csv, .xlsx, .xls)
                        </p>
                      </div>
                    )}
                  </div>

                  {uploading && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>Uploading to storage…</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="pt-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsUploadOpen(false)}
                      disabled={uploading}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!uploadFile || uploading}
                      className="px-5 py-2 rounded-xl text-xs font-bold text-white shadow-lg disabled:opacity-50 flex items-center gap-2"
                      style={{ background: 'linear-gradient(135deg, #7C3AED, #6D28D9)' }}
                    >
                      {uploading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Upload File
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Dataset Preview Modal */}
      <AnimatePresence>
        {previewDatasetId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-4xl max-h-[90vh] rounded-3xl p-6 shadow-2xl flex flex-col relative"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
              }}
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between pb-4 border-b shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                <div>
                  <div className="flex items-center gap-2">
                    <Table className="w-5 h-5 text-primary" />
                    <h3 className="font-display font-semibold text-lg" style={{ color: 'var(--color-text)' }}>
                      {previewData?.name || 'Dataset Inspection'}
                    </h3>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                    Schema characteristics, missing count, and sample record exploration.
                  </p>
                </div>

                <button
                  onClick={() => setPreviewDatasetId(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-white/5"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto py-5 space-y-5">
                {previewLoading ? (
                  <div className="p-16 flex flex-col items-center justify-center gap-3">
                    <FlowMLIcon size={56} />
                    <p className="text-xs text-slate-400">Loading dataset statistics and preview…</p>
                  </div>
                ) : previewError ? (
                  <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center justify-between gap-4">
                    <span>{previewError}</span>
                    <button
                      onClick={() => {
                        const dataset = datasets.find((item) => item.dataset_id === previewDatasetId);
                        if (dataset) handleOpenPreview(dataset);
                      }}
                      className="font-semibold underline"
                    >
                      Retry
                    </button>
                  </div>
                ) : previewData ? (
                  <>
                    {/* Stat Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3.5 rounded-2xl border" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}>
                        <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Rows</div>
                        <div className="font-mono font-bold text-lg text-white mt-1">
                          {previewData.rows?.toLocaleString()}
                        </div>
                      </div>

                      <div className="p-3.5 rounded-2xl border" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}>
                        <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Columns</div>
                        <div className="font-mono font-bold text-lg text-primary mt-1">
                          {previewData.columns}
                        </div>
                      </div>

                      <div className="p-3.5 rounded-2xl border" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}>
                        <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Missing Values</div>
                        <div className="font-mono font-bold text-lg text-warning mt-1">
                          {previewData.total_missing ?? 0}
                        </div>
                      </div>

                      <div className="p-3.5 rounded-2xl border" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}>
                        <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Duplicate Rows</div>
                        <div className="font-mono font-bold text-lg text-emerald-400 mt-1">
                          {previewData.duplicate_count ?? 0}
                        </div>
                      </div>
                    </div>

                    {/* Column Schema Details */}
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider mb-2.5" style={{ color: 'var(--color-text-muted)' }}>
                        Column Type & Quality Summary
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {previewData.columns_info?.map((col) => (
                          <div
                            key={col.name}
                            className="p-2.5 rounded-xl border text-xs flex items-center justify-between"
                            style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
                          >
                            <span className="font-mono font-semibold truncate mr-2" style={{ color: 'var(--color-text)' }}>
                              {col.name}
                            </span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-primary border border-white/10 shrink-0">
                              {col.type}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Data Table Preview */}
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider mb-2.5" style={{ color: 'var(--color-text-muted)' }}>
                        First Sample Records ({previewData.preview_rows?.length || 0} rows)
                      </h4>
                      <div
                        className="rounded-2xl border overflow-x-auto max-h-64 shadow-inner"
                        style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
                      >
                        <table className="w-full text-left text-xs">
                          <thead className="sticky top-0 bg-slate-900 border-b text-[10px] uppercase font-bold" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                            <tr>
                              {previewData.columns_info?.map((col) => (
                                <th key={col.name} className="py-2.5 px-3 whitespace-nowrap">
                                  {col.name}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                            {previewData.preview_rows?.map((row, idx) => (
                              <tr key={idx} className="hover:bg-white/[0.03]">
                                {previewData.columns_info?.map((col) => (
                                  <td key={col.name} className="py-2 px-3 whitespace-nowrap text-slate-300">
                                    {row[col.name] != null ? String(row[col.name]) : <span className="text-slate-500 italic">null</span>}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                ) : null}
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t flex justify-end shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                <button
                  onClick={() => setPreviewDatasetId(null)}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white shadow-md"
                  style={{ background: 'linear-gradient(135deg, #7C3AED, #6D28D9)' }}
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm rounded-3xl p-6 shadow-2xl relative text-center"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
              }}
            >
              <div className="w-12 h-12 rounded-2xl mx-auto mb-4 bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="font-display font-semibold text-base mb-1" style={{ color: 'var(--color-text)' }}>
                Delete Dataset?
              </h3>
              <p className="text-xs leading-relaxed mb-6" style={{ color: 'var(--color-text-muted)' }}>
                Are you sure you want to delete <span className="font-bold text-white">"{deleteTarget.original_name || deleteTarget.file}"</span>? Any pipelines relying on this file will need a new data source.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-red-500 hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
                >
                  Delete Dataset
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
