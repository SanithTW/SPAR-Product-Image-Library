import React, { useEffect, useState } from 'react';
import { listAccessCodes, createAccessCode, deleteAccessCode } from '../services/api';

const DURATIONS = [
  { hours: 1, label: '1 hour' },
  { hours: 8, label: '8 hours' },
  { hours: 24, label: '1 day' },
  { hours: 72, label: '3 days' },
  { hours: 168, label: '7 days' },
  { hours: 720, label: '30 days' },
];

const formatDate = (iso) =>
  new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const isExpired = (row) => new Date(row.expires_at).getTime() <= Date.now();

/** Admin panel: create temporary access codes that let other people download images. */
export default function AccessCodesPanel() {
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState('');
  const [hours, setHours] = useState(24);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const load = async () => {
    try {
      setCodes(await listAccessCodes());
    } catch {
      setError('Could not load access codes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!label.trim()) return;
    try {
      setCreating(true);
      setError('');
      const code = await createAccessCode(label.trim(), hours);
      setCreated(code);
      setLabel('');
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create the access code.');
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async (row) => {
    const text = `SPAR Product Image Library access code: ${row.code}\nValid until ${formatDate(row.expires_at)}.\nOpen the library, press Download, and enter this code.`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(row.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      window.prompt('Copy this access code:', row.code);
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete the access code for "${row.label}"? They will no longer be able to download.`)) return;
    try {
      await deleteAccessCode(row.id);
      if (created?.id === row.id) setCreated(null);
      await load();
    } catch {
      setError('Could not delete the access code.');
    }
  };

  return (
    <div className="upload-panel access-panel">
      <div>
        <h3>Access codes</h3>
        <p>Give someone temporary access to download images. Anyone can still search and view without a code.</p>
      </div>

      <form onSubmit={handleCreate} className="access-form">
        <div className="field">
          <label htmlFor="accessLabel">Who is it for?</label>
          <input
            id="accessLabel"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Kamal – Marketing agency"
            maxLength={80}
          />
        </div>
        <div className="field">
          <label htmlFor="accessHours">Valid for</label>
          <select id="accessHours" value={hours} onChange={(e) => setHours(Number(e.target.value))}>
            {DURATIONS.map((d) => (
              <option key={d.hours} value={d.hours}>{d.label}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="login-submit" disabled={creating || !label.trim()}>
          {creating ? 'Creating…' : 'Create access code'}
        </button>
      </form>

      {error && <div className="bulk-note bulk-note-error">{error}</div>}

      {created && (
        <div className="access-created">
          <span>New code for <strong>{created.label}</strong></span>
          <code>{created.code}</code>
          <span>Valid until {formatDate(created.expires_at)}</span>
          <button type="button" className="table-btn" onClick={() => handleCopy(created)}>
            {copiedId === created.id ? 'Copied ✓' : 'Copy message'}
          </button>
        </div>
      )}

      <div className="admin-table access-table">
        <div className="table-row table-header">
          <span>Code</span>
          <span>For</span>
          <span>Expires</span>
          <span>Used</span>
          <span>Actions</span>
        </div>
        {loading ? (
          <div className="access-empty">Loading…</div>
        ) : codes.length === 0 ? (
          <div className="access-empty">No access codes yet.</div>
        ) : (
          codes.map((row) => {
            const expired = isExpired(row);
            return (
              <div key={row.id} className={`table-row ${expired ? 'access-expired' : ''}`}>
                <strong className="access-code-cell">{row.code}</strong>
                <span title={row.label}>{row.label}</span>
                <span>{expired ? 'Expired' : formatDate(row.expires_at)}</span>
                <span>{row.use_count}×</span>
                <span>
                  {!expired && (
                    <button type="button" className="table-btn" onClick={() => handleCopy(row)}>
                      {copiedId === row.id ? 'Copied ✓' : 'Copy'}
                    </button>
                  )}
                  <button type="button" className="table-btn danger" onClick={() => handleDelete(row)}>
                    Delete
                  </button>
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
