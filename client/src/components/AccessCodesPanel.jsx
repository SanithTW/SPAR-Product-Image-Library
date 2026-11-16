import React, { useEffect, useState } from 'react';
import { listAccessCodes, createAccessCode, deleteAccessCode, setAccessCodeWatermark } from '../services/api';

const DURATIONS = [
  { value: '1', label: '1 hour' },
  { value: '8', label: '8 hours' },
  { value: '24', label: '1 day' },
  { value: '72', label: '3 days' },
  { value: '168', label: '7 days' },
  { value: '720', label: '30 days' },
  { value: 'custom', label: 'Custom date & time…' },
  { value: 'never', label: 'No expiry (full access)' },
];

// Must match NEVER in server/routes/accessCodes.js.
const NEVER = '9999-12-31T23:59:59.000Z';
const isPermanent = (iso) => iso === NEVER;

const formatDate = (iso) =>
  new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const formatExpiry = (iso) => (isPermanent(iso) ? 'Never' : formatDate(iso));

const isExpired = (row) => new Date(row.expires_at).getTime() <= Date.now();

const hasWatermark = (row) => Number(row.watermark ?? 1) !== 0;

/** Value for a datetime-local input, in the admin's own time zone. */
function toLocalInput(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Admin panel: create temporary access codes that let other people download images. */
export default function AccessCodesPanel() {
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState('');
  const [duration, setDuration] = useState('24');
  const [customUntil, setCustomUntil] = useState(() => toLocalInput(new Date(Date.now() + 24 * 3600 * 1000)));
  const [watermark, setWatermark] = useState(true);
  const [creating, setCreating] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
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

    let expiry;
    if (duration === 'never') {
      expiry = { permanent: true };
    } else if (duration === 'custom') {
      const until = new Date(customUntil);
      if (!customUntil || Number.isNaN(until.getTime())) {
        setError('Choose the date and time the code should stop working.');
        return;
      }
      if (until.getTime() <= Date.now()) {
        setError('The expiry time must be in the future.');
        return;
      }
      expiry = { expiresAt: until.toISOString() };
    } else {
      expiry = { hours: Number(duration) };
    }

    try {
      setCreating(true);
      setError('');
      const code = await createAccessCode(label.trim(), expiry, watermark);
      setCreated(code);
      setLabel('');
      setWatermark(true); // back to the safe default for the next code
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create the access code.');
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async (row) => {
    const validity = isPermanent(row.expires_at) ? 'No expiry.' : `Valid until ${formatDate(row.expires_at)}.`;
    const text = `SPAR Product Image Library access code: ${row.code}\n${validity}\nOpen the library, press Download, and enter this code.`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(row.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      window.prompt('Copy this access code:', row.code);
    }
  };

  const handleToggleWatermark = async (row) => {
    try {
      setTogglingId(row.id);
      setError('');
      const updated = await setAccessCodeWatermark(row.id, !hasWatermark(row));
      setCodes((list) => list.map((c) => (c.id === updated.id ? updated : c)));
      if (created?.id === updated.id) setCreated(updated);
    } catch {
      setError('Could not change the watermark setting.');
    } finally {
      setTogglingId(null);
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

      <form onSubmit={handleCreate} className={`access-form ${duration === 'custom' ? 'with-custom' : ''}`}>
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
          <select id="accessHours" value={duration} onChange={(e) => setDuration(e.target.value)}>
            {DURATIONS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
        {duration === 'custom' && (
          <div className="field">
            <label htmlFor="accessUntil">Valid until</label>
            <input
              id="accessUntil"
              type="datetime-local"
              value={customUntil}
              min={toLocalInput(new Date())}
              onChange={(e) => setCustomUntil(e.target.value)}
            />
          </div>
        )}
        <button type="submit" className="login-submit" disabled={creating || !label.trim()}>
          {creating ? 'Creating…' : 'Create access code'}
        </button>
        <label className="access-check">
          <input type="checkbox" checked={watermark} onChange={(e) => setWatermark(e.target.checked)} />
          Add SPAR logo watermark to this person's downloads
          <span>(you can change this later)</span>
        </label>
      </form>

      {error && <div className="bulk-note bulk-note-error">{error}</div>}

      {created && (
        <div className="access-created">
          <span>New code for <strong>{created.label}</strong></span>
          <code>{created.code}</code>
          <span>{isPermanent(created.expires_at) ? 'No expiry – works until you delete it' : `Valid until ${formatDate(created.expires_at)}`}</span>
          <span>· {hasWatermark(created) ? 'With watermark' : 'No watermark'}</span>
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
          <span>Watermark</span>
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
                <span>{expired ? 'Expired' : formatExpiry(row.expires_at)}</span>
                <span>
                  <button
                    type="button"
                    className={`wm-toggle ${hasWatermark(row) ? 'on' : ''}`}
                    role="switch"
                    aria-checked={hasWatermark(row)}
                    aria-label={`Watermark for ${row.label}`}
                    title={hasWatermark(row) ? 'Downloads have the SPAR logo. Click to turn off.' : 'Downloads have no logo. Click to turn on.'}
                    disabled={togglingId === row.id || expired}
                    onClick={() => handleToggleWatermark(row)}
                  >
                    <i />
                    {hasWatermark(row) ? 'On' : 'Off'}
                  </button>
                </span>
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
