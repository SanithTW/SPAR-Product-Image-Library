import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getProducts } from '../services/api';
import { downloadProductsZip, parseDcCodes } from '../utils/bulkDownload';

const FORMATS = [
  { key: 'cover', label: '1080 × 1080 crop' },
  { key: 'contain', label: '1080 × 1080 fit' },
  { key: 'original', label: 'Original' },
];

const today = () => new Date().toISOString().slice(0, 10);

export default function BulkDownloadModal({ onClose }) {
  const [mode, setMode] = useState('codes'); // 'codes' | 'all'
  const [format, setFormat] = useState('contain');
  const [codesText, setCodesText] = useState('');
  const [allProducts, setAllProducts] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  const abortRef = useRef(null);
  const running = progress !== null;

  useEffect(() => {
    getProducts()
      .then((data) => setAllProducts(data.products || []))
      .catch(() => setLoadError('Could not load the product list. Check your connection and try again.'));
  }, []);

  // Cancel any running download if the window is closed.
  useEffect(() => () => abortRef.current?.abort(), []);

  const byCode = useMemo(() => {
    const map = new Map();
    for (const p of allProducts || []) {
      const code = String(p.dc_code || '').trim();
      if (!code) continue;
      if (!map.has(code)) map.set(code, []);
      map.get(code).push(p);
    }
    return map;
  }, [allProducts]);

  const codes = useMemo(() => parseDcCodes(codesText), [codesText]);
  const found = codes.filter((c) => byCode.has(c));
  const missing = codes.filter((c) => !byCode.has(c));
  const codeProducts = found.flatMap((c) => byCode.get(c));

  const selected = mode === 'all' ? allProducts || [] : codeProducts;

  const start = async () => {
    if (!selected.length) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setResult(null);
    setProgress({ phase: 'fetching', done: 0, total: selected.length });

    const zipName =
      mode === 'all'
        ? `SPAR_Image_Library_All_${today()}.zip`
        : `SPAR_Images_${found.length}_DC_codes_${today()}.zip`;
    const notes = mode === 'codes' && missing.length ? { 'dc-codes-not-found.txt': missing.join('\r\n') } : {};

    try {
      const { saved, failed } = await downloadProductsZip(selected, {
        format,
        zipName,
        notes,
        signal: controller.signal,
        onProgress: setProgress,
      });
      setResult({ ok: true, saved, failed: failed.length, zipName });
    } catch (err) {
      setResult(err.name === 'AbortError' ? { cancelled: true } : { ok: false, message: err.message });
    } finally {
      setProgress(null);
      abortRef.current = null;
    }
  };

  const pct = progress ? Math.round((progress.done / Math.max(progress.total, 1)) * 100) : 0;

  return (
    <div className="modal" onClick={running ? undefined : onClose}>
      <div className="modal-card bulk-download-card" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose} title="Close" disabled={running}>×</button>
        <h2>Bulk download</h2>
        <p>Download many product images as one ZIP file.</p>

        <div className="preview-mode-tabs">
          <button
            type="button"
            className={`preview-tab-btn ${mode === 'codes' ? 'active' : ''}`}
            onClick={() => setMode('codes')}
            disabled={running}
          >
            By DC codes
          </button>
          <button
            type="button"
            className={`preview-tab-btn ${mode === 'all' ? 'active' : ''}`}
            onClick={() => setMode('all')}
            disabled={running}
          >
            Full library
          </button>
        </div>

        {loadError && <div className="bulk-note bulk-note-error">{loadError}</div>}

        {mode === 'codes' ? (
          <div className="field">
            <label htmlFor="bulkCodes">DC codes</label>
            <textarea
              id="bulkCodes"
              className="bulk-codes"
              value={codesText}
              onChange={(e) => setCodesText(e.target.value)}
              placeholder={'Paste DC codes — one per line, or copied straight from an Excel column.\n3010145\n3010142\n3001449'}
              disabled={running}
              rows={7}
            />
            {codes.length > 0 && allProducts && (
              <div className="bulk-summary">
                <span><strong>{codes.length}</strong> codes entered</span>
                <span className="ok"><strong>{found.length}</strong> found ({codeProducts.length} images)</span>
                {missing.length > 0 && <span className="warn"><strong>{missing.length}</strong> not found</span>}
              </div>
            )}
            {missing.length > 0 && allProducts && (
              <details className="bulk-missing">
                <summary>Show codes not found</summary>
                <div>{missing.join(', ')}</div>
              </details>
            )}
          </div>
        ) : (
          <div className="bulk-note">
            {allProducts
              ? <>All <strong>{allProducts.length}</strong> product images will be downloaded. This can take a few minutes and the ZIP may be a few hundred MB.</>
              : 'Loading product list…'}
          </div>
        )}

        <div className="field">
          <label>Image format</label>
          <div className="preview-mode-tabs" style={{ marginBottom: 0 }}>
            {FORMATS.map((f) => (
              <button
                key={f.key}
                type="button"
                className={`preview-tab-btn ${format === f.key ? 'active' : ''}`}
                onClick={() => setFormat(f.key)}
                disabled={running}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {progress && (
          <div className="bulk-progress">
            <div className="bulk-progress-label">
              <span>{progress.phase === 'zipping' ? 'Creating ZIP file…' : `Downloading images… ${progress.done} / ${progress.total}`}</span>
              <span>{pct}%</span>
            </div>
            <div className="bulk-progress-track"><div style={{ width: `${pct}%` }} /></div>
          </div>
        )}

        {result?.ok && (
          <div className={`bulk-note ${result.failed ? 'bulk-note-warn' : 'bulk-note-ok'}`}>
            Saved <strong>{result.saved}</strong> images to <strong>{result.zipName}</strong>.
            {result.failed > 0 && <> {result.failed} could not be downloaded — they are listed in failed-downloads.txt inside the ZIP.</>}
          </div>
        )}
        {result?.cancelled && <div className="bulk-note">Download cancelled.</div>}
        {result && !result.ok && !result.cancelled && (
          <div className="bulk-note bulk-note-error">Download failed: {result.message}</div>
        )}

        {running ? (
          <button type="button" className="login-submit bulk-cancel" onClick={() => abortRef.current?.abort()}>
            Cancel
          </button>
        ) : (
          <button type="button" className="login-submit" onClick={start} disabled={!selected.length}>
            {selected.length ? `Download ${selected.length} images (ZIP)` : mode === 'codes' ? 'Enter DC codes to download' : 'Loading…'}
          </button>
        )}
      </div>
    </div>
  );
}
