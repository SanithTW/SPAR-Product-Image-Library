import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Layers, FolderOpen, ImagePlus, Loader2, CheckCircle2, AlertCircle, X, Upload, Square,
} from 'lucide-react';
import { uploadProduct } from '../services/api';
import { parseProductFilename } from '../utils/parseProductFilename';

const MAX_SIZE = 5 * 1024 * 1024;
const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;
const CONCURRENCY = 3;

let nextRowId = 1;

/** Collect files from a drop, walking into dropped folders. */
async function filesFromDrop(dataTransfer) {
  // webkitGetAsEntry must be called synchronously, before any await.
  const entries = [...(dataTransfer.items || [])]
    .map((item) => (item.webkitGetAsEntry ? item.webkitGetAsEntry() : null))
    .filter(Boolean);
  if (entries.length === 0) return [...dataTransfer.files];

  const files = [];
  const walk = async (entry) => {
    if (entry.isFile) {
      files.push(await new Promise((resolve, reject) => entry.file(resolve, reject)));
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      let batch;
      do {
        batch = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
        for (const child of batch) await walk(child);
      } while (batch.length > 0);
    }
  };
  for (const entry of entries) await walk(entry);
  return files;
}

function rowProblem(row, existingCodes) {
  if (row.fileError) return { tone: 'error', label: row.fileError };
  if (!row.dcCode.trim()) return { tone: 'warn', label: 'Needs DC code' };
  if (!row.productName.trim()) return { tone: 'warn', label: 'Needs product name' };
  if (existingCodes.has(row.dcCode.trim()) && row.state !== 'done') {
    return { tone: 'info', label: 'DC code already in library' };
  }
  return null;
}

function isUploadable(row) {
  return (
    row.include &&
    !row.fileError &&
    row.dcCode.trim() &&
    row.productName.trim() &&
    (row.state === 'idle' || row.state === 'failed')
  );
}

export default function BulkUploadSection({ existingProducts, onComplete }) {
  const [rows, setRows] = useState([]);
  const [running, setRunning] = useState(false);
  const [issuesOnly, setIssuesOnly] = useState(false);
  const [notice, setNotice] = useState(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [stopping, setStopping] = useState(false);
  const filesInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const stopRef = useRef(false);
  const rowsRef = useRef(rows);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  const existingCodes = useMemo(
    () => new Set(existingProducts.map((p) => String(p.dc_code).trim())),
    [existingProducts]
  );

  // React doesn't pass webkitdirectory through reliably; set it directly.
  useEffect(() => {
    folderInputRef.current?.setAttribute('webkitdirectory', '');
  }, []);

  // Free thumbnail memory when the section unmounts.
  useEffect(() => () => rowsRef.current.forEach((r) => r.previewUrl && URL.revokeObjectURL(r.previewUrl)), []);

  const addFiles = (fileList) => {
    const all = [...fileList];
    const images = all.filter((f) => IMAGE_EXT.test(f.name));
    const ignored = all.length - images.length;

    setRows((current) => {
      const seen = new Set(current.map((r) => `${r.file.name}|${r.file.size}`));
      const added = [];
      for (const file of images) {
        const key = `${file.name}|${file.size}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const parsed = parseProductFilename(file.name);
        const fileError = file.size > MAX_SIZE ? 'Larger than 5 MB' : null;
        added.push({
          id: nextRowId++,
          file,
          previewUrl: URL.createObjectURL(file),
          dcCode: parsed.dcCode,
          productName: parsed.productName,
          fileError,
          // Codes already in the library are left unticked so re-running a folder adds no duplicates.
          include: !fileError && !existingCodes.has(parsed.dcCode),
          state: 'idle', // idle | uploading | done | failed
          error: null,
        });
      }
      return [...current, ...added];
    });

    setNotice(ignored > 0 ? `${ignored} non-image file(s) were ignored.` : null);
  };

  const updateRow = (id, patch) =>
    setRows((current) => current.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const removeRows = (predicate) =>
    setRows((current) => {
      current.filter(predicate).forEach((r) => URL.revokeObjectURL(r.previewUrl));
      return current.filter((r) => !predicate(r));
    });

  const handleDrop = async (e) => {
    e.preventDefault();
    if (running) return;
    addFiles(await filesFromDrop(e.dataTransfer));
  };

  const handleInputChange = (e) => {
    addFiles(e.target.files);
    e.target.value = '';
  };

  const startUpload = async () => {
    const queue = rows.filter(isUploadable);
    if (queue.length === 0) return;

    stopRef.current = false;
    setStopping(false);
    setProgress({ done: 0, total: queue.length });
    setRunning(true);
    setNotice(null);
    let next = 0;
    let uploaded = 0;
    let failed = 0;

    const worker = async () => {
      while (next < queue.length && !stopRef.current) {
        const row = queue[next++];
        updateRow(row.id, { state: 'uploading', error: null });
        try {
          const formData = new FormData();
          formData.append('dc_code', row.dcCode.trim());
          formData.append('product_name', row.productName.trim());
          formData.append('image', row.file);
          await uploadProduct(formData);
          uploaded++;
          updateRow(row.id, { state: 'done' });
        } catch (err) {
          failed++;
          updateRow(row.id, {
            state: 'failed',
            error: err.response?.data?.error || err.message || 'Upload failed',
          });
          if (err.response?.status === 401) {
            stopRef.current = true;
            setNotice('Your admin session expired. Log in again, then press Upload to retry the rest.');
          }
        }
        setProgress((p) => ({ ...p, done: p.done + 1 }));
      }
    };

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
    setRunning(false);
    setStopping(false);
    onComplete?.({ uploaded, failed, stopped: stopRef.current });
  };

  const counts = useMemo(() => {
    const c = { total: rows.length, ready: 0, attention: 0, existing: 0, done: 0, failed: 0 };
    for (const r of rows) {
      if (r.state === 'done') c.done++;
      else if (r.state === 'failed') c.failed++;
      if (isUploadable(r)) c.ready++;
      const problem = rowProblem(r, existingCodes);
      if (problem?.tone === 'info') c.existing++;
      else if (problem) c.attention++;
    }
    return c;
  }, [rows, existingCodes]);

  const visibleRows = issuesOnly
    ? rows.filter((r) => r.state === 'failed' || rowProblem(r, existingCodes))
    : rows;

  return (
    <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm">
      <div className="flex items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Bulk Upload</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Name files like <span className="font-mono">3010145 Fogg Body Spray Delicious 120ML.jpg</span> — the
              number becomes the DC code and the rest the product name.
            </p>
          </div>
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className={`border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 rounded-2xl p-6 flex flex-col items-center justify-center text-center transition-colors bg-slate-50/50 dark:bg-slate-800/30 ${running ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          Drag & drop a folder or many images here
        </p>
        <p className="text-xs text-slate-400 mt-1 mb-4">JPG, PNG, WEBP up to 5MB each</p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => folderInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-sm"
          >
            <FolderOpen className="w-4 h-4" /> Choose Folder
          </button>
          <button
            type="button"
            onClick={() => filesInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold"
          >
            <ImagePlus className="w-4 h-4" /> Choose Images
          </button>
        </div>
        <input ref={folderInputRef} type="file" multiple onChange={handleInputChange} className="hidden" />
        <input
          ref={filesInputRef}
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.webp"
          onChange={handleInputChange}
          className="hidden"
        />
      </div>

      {notice && (
        <div className="mt-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs flex items-center justify-between gap-3">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {rows.length > 0 && (
        <div className="mt-6 space-y-4">
          {/* Summary + actions */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">{counts.total} files</span>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">{counts.ready} ready</span>
              {counts.attention > 0 && <span className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">{counts.attention} need attention</span>}
              {counts.existing > 0 && <span className="px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300">{counts.existing} already in library</span>}
              {counts.done > 0 && <span className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white">{counts.done} uploaded</span>}
              {counts.failed > 0 && <span className="px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300">{counts.failed} failed</span>}
              <label className="flex items-center gap-1.5 ml-1 text-slate-500 dark:text-slate-400 font-medium cursor-pointer">
                <input type="checkbox" checked={issuesOnly} onChange={(e) => setIssuesOnly(e.target.checked)} />
                Show only rows with issues
              </label>
            </div>

            <div className="flex items-center gap-2">
              {!running && counts.done > 0 && (
                <button
                  type="button"
                  onClick={() => removeRows((r) => r.state === 'done')}
                  className="px-3 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Clear uploaded
                </button>
              )}
              {!running && (
                <button
                  type="button"
                  onClick={() => removeRows(() => true)}
                  className="px-3 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Clear all
                </button>
              )}
              {running ? (
                <button
                  type="button"
                  onClick={() => { stopRef.current = true; setStopping(true); }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-800 text-white font-bold text-sm"
                >
                  <Square className="w-4 h-4" /> Stop
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startUpload}
                  disabled={counts.ready === 0}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-700/20 disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" /> Upload {counts.ready} {counts.ready === 1 ? 'Image' : 'Images'}
                </button>
              )}
            </div>
          </div>

          {running && (
            <div>
              <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                <span className="flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading… {stopping && '(stopping after current files)'}</span>
                <span>{progress.done} / {progress.total}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-600 transition-all"
                  style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {/* Review table */}
          <div className="overflow-auto max-h-[520px] rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-3 w-10" title="Include in upload">✓</th>
                  <th className="py-2.5 px-3">Image</th>
                  <th className="py-2.5 px-3">DC Code</th>
                  <th className="py-2.5 px-3">Product Name</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {visibleRows.map((row) => {
                  const problem = rowProblem(row, existingCodes);
                  const locked = running || row.state === 'done' || row.state === 'uploading';
                  return (
                    <tr key={row.id} className={row.state === 'done' ? 'opacity-60' : ''}>
                      <td className="py-2 px-3">
                        <input
                          type="checkbox"
                          checked={row.include}
                          disabled={locked || !!row.fileError}
                          onChange={(e) => updateRow(row.id, { include: e.target.checked })}
                        />
                      </td>
                      <td className="py-2 px-3">
                        <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-0.5 overflow-hidden">
                          <img src={row.previewUrl} alt="" loading="lazy" className="w-full h-full object-contain" />
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={row.dcCode}
                          disabled={locked}
                          placeholder="DC code"
                          onChange={(e) => updateRow(row.id, { dcCode: e.target.value })}
                          className={`w-28 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border text-slate-900 dark:text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 ${!row.dcCode.trim() ? 'border-amber-400' : 'border-slate-200 dark:border-slate-700'}`}
                        />
                      </td>
                      <td className="py-2 px-3 min-w-[260px]">
                        <input
                          type="text"
                          value={row.productName}
                          disabled={locked}
                          onChange={(e) => updateRow(row.id, { productName: e.target.value })}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-[360px]" title={row.file.name}>{row.file.name}</p>
                      </td>
                      <td className="py-2 px-3 text-xs whitespace-nowrap">
                        <RowStatus row={row} problem={problem} />
                      </td>
                      <td className="py-2 px-3">
                        {!locked && (
                          <button
                            type="button"
                            onClick={() => removeRows((r) => r.id === row.id)}
                            title="Remove from list"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function RowStatus({ row, problem }) {
  if (row.state === 'uploading') {
    return <span className="flex items-center gap-1.5 text-slate-500"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading</span>;
  }
  if (row.state === 'done') {
    return <span className="flex items-center gap-1.5 text-emerald-600 font-semibold"><CheckCircle2 className="w-3.5 h-3.5" /> Uploaded</span>;
  }
  if (row.state === 'failed') {
    return (
      <span className="flex items-center gap-1.5 text-red-600 font-semibold" title={row.error}>
        <AlertCircle className="w-3.5 h-3.5" /> Failed: <span className="font-normal truncate max-w-[180px]">{row.error}</span>
      </span>
    );
  }
  if (problem) {
    const tone = {
      error: 'text-red-600',
      warn: 'text-amber-600',
      info: 'text-sky-600',
    }[problem.tone];
    return <span className={`font-semibold ${tone}`}>{problem.label}{problem.tone === 'info' && !row.include ? ' — skipped' : ''}</span>;
  }
  if (!row.include) return <span className="text-slate-400">Skipped</span>;
  return <span className="text-emerald-700 dark:text-emerald-400 font-semibold">Ready</span>;
}
