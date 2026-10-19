import React, { useState } from 'react';
import { AlertCircle, Download, Loader2, Plus, Trash2, Upload } from 'lucide-react';
import { predictRows, runPredictions, uploadDataset } from '../../services/api';
import EvaluationMetrics from './EvaluationMetrics';

const csvCell = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;

function downloadPredictions(result) {
  const rows = result.input_rows ?? [];
  const classes = [...new Set((result.probabilities ?? []).flatMap((row) => Object.keys(row)))];
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const headers = [...columns, 'prediction', ...classes.map((label) => `probability_${label}`)];
  const csv = [
    headers.map(csvCell).join(','),
    ...rows.map((row, index) => [
      ...columns.map((column) => row[column]),
      result.predictions[index],
      ...classes.map((label) => result.probabilities?.[index]?.[label] ?? ''),
    ].map(csvCell).join(',')),
  ].join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = Object.assign(document.createElement('a'), { href: url, download: 'flowml_predictions.csv' });
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ModelTestPanel({ trainResult, targetColumn }) {
  const schema = trainResult?.input_schema ?? {};
  const features = trainResult?.input_features ?? Object.keys(schema);
  const [rows, setRows] = useState([Object.fromEntries(features.map((feature) => [feature, '']))]);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const setFeature = (rowIndex, feature, value) => {
    setResult(null);
    setError('');
    setRows((current) => current.map((row, index) =>
      index === rowIndex ? { ...row, [feature]: value } : row
    ));
  };

  const addRow = () => {
    setResult(null);
    setError('');
    setRows((current) => [...current, Object.fromEntries(features.map((feature) => [feature, '']))]);
  };

  const removeRow = (rowIndex) => {
    setResult(null);
    setError('');
    setRows((current) => current.filter((_, index) => index !== rowIndex));
  };

  const runManualTest = async () => {
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const converted = rows.map((row, rowIndex) => Object.fromEntries(features.map((feature) => {
        const value = row[feature];
        if (value === '' || value == null) {
          throw new Error(`Enter a value for "${feature}" in row ${rowIndex + 1}.`);
        }
        if (schema[feature] === 'number') {
          const number = Number(value);
          if (!Number.isFinite(number)) throw new Error(`"${feature}" must be numeric in row ${rowIndex + 1}.`);
          return [feature, number];
        }
        return [feature, value];
      })));
      setResult(await predictRows(trainResult.model_id, converted, targetColumn));
    } catch (err) {
      setError(err.message || 'Prediction could not be completed.');
    } finally {
      setBusy(false);
    }
  };

  const runCsvTest = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const uploaded = await uploadDataset(file);
      setResult(await runPredictions(uploaded.dataset_id, targetColumn, trainResult.model_id));
    } catch (err) {
      setError(err.message || 'CSV prediction could not be completed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h3 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>Test with New Data</h3>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Predictions use {trainResult?.best_model} and its saved fitted preprocessing.
          Provide exactly the trained feature columns.
        </p>
      </header>

      {!features.length ? (
        <p className="text-sm text-red-500">This model does not expose an input feature schema, so it cannot be tested safely.</p>
      ) : (
        <>
          <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <div className="flex items-center justify-between gap-3">
              <h4 className="font-semibold" style={{ color: 'var(--color-text)' }}>Enter feature values</h4>
              <button type="button" onClick={addRow} disabled={busy}
                className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                style={{ background: '#7C3AED' }}>
                <Plus className="w-3.5 h-3.5" /> Add row
              </button>
            </div>
            <div className="space-y-4 max-h-80 overflow-auto pr-1">
              {rows.map((row, rowIndex) => (
                <div key={rowIndex} className="rounded-xl p-3" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-semibold" style={{ color: 'var(--color-text)' }}>Input row {rowIndex + 1}</span>
                    {rows.length > 1 && (
                      <button type="button" onClick={() => removeRow(rowIndex)}
                        aria-label={`Remove row ${rowIndex + 1}`} className="text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {features.map((feature) => (
                      <label key={feature} className="text-xs space-y-1">
                        <span style={{ color: 'var(--color-text-muted)' }}>{feature}{schema[feature] === 'number' ? ' (number)' : ''}</span>
                        <input
                          type={schema[feature] === 'number' ? 'number' : 'text'}
                          step={schema[feature] === 'number' ? 'any' : undefined}
                          value={row[feature] ?? ''}
                          onChange={(event) => setFeature(rowIndex, feature, event.target.value)}
                          className="w-full rounded-lg px-3 py-2 focus:outline-none"
                          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <button type="button" onClick={runManualTest} disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              style={{ background: '#7C3AED' }}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Predict manual rows
            </button>
          </div>

          <div className="rounded-2xl p-5 space-y-3" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <h4 className="font-semibold" style={{ color: 'var(--color-text)' }}>Upload a CSV</h4>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Labeled CSV files are evaluated separately; files without "{targetColumn}" show predictions only.
            </p>
            <label className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold cursor-pointer"
              style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Choose CSV
              <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={runCsvTest} disabled={busy} />
            </label>
          </div>
        </>
      )}

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl p-3 text-sm text-red-500"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <EvaluationMetrics evaluation={result.evaluation} taskType={trainResult.task_type}
            title={result.evaluation ? 'New labeled test-data evaluation' : result.evaluation_message} />
          <div className="flex items-center justify-between">
            <h4 className="font-semibold" style={{ color: 'var(--color-text)' }}>Predictions ({result.predictions.length} rows)</h4>
            <button type="button" onClick={() => downloadPredictions(result)}
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-white"
              style={{ background: '#16a34a' }}>
              <Download className="w-3.5 h-3.5" /> Download CSV
            </button>
          </div>
          <div className="overflow-auto rounded-xl max-h-96" style={{ border: '1px solid var(--color-border)' }}>
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0" style={{ background: 'var(--color-surface)', color: 'var(--color-text-muted)' }}>
                <tr>
                  {Object.keys(result.input_rows?.[0] ?? {}).map((column) => <th key={column} className="px-3 py-2">{column}</th>)}
                  <th className="px-3 py-2">Prediction</th>
                  {result.probabilities?.length > 0 && <th className="px-3 py-2">Probabilities</th>}
                </tr>
              </thead>
              <tbody>
                {result.predictions.map((prediction, index) => (
                  <tr key={index} style={{ borderTop: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
                    {Object.values(result.input_rows?.[index] ?? {}).map((value, columnIndex) => (
                      <td key={columnIndex} className="px-3 py-2">{String(value ?? '')}</td>
                    ))}
                    <td className="px-3 py-2 font-semibold">{String(prediction)}</td>
                    {result.probabilities?.length > 0 && (
                      <td className="px-3 py-2 font-mono">
                        {Object.entries(result.probabilities[index]).map(([label, value]) => `${label}: ${(value * 100).toFixed(1)}%`).join(' · ')}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
