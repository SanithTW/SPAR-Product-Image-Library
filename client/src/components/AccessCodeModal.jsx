import React, { useState } from 'react';

/** Asks a visitor for the temporary access code an admin gave them. */
export default function AccessCodeModal({ message, onRedeem, onDone, onCancel }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    try {
      setChecking(true);
      setError('');
      await onRedeem(code);
      onDone();
    } catch (err) {
      setError(
        err.response?.data?.error ||
          (err.response ? 'Could not check the code. Please try again.' : 'Cannot reach the server. Check your connection.')
      );
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="modal access-modal" onClick={onCancel}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onCancel} title="Close">×</button>
        <h2>Enter access code</h2>
        <p>Downloading images needs an access code. Ask a SPAR admin for one.</p>

        {message && <div className="bulk-note bulk-note-warn">{message}</div>}
        {error && <div className="bulk-note bulk-note-error">{error}</div>}

        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="accessCode">Access code</label>
            <input
              id="accessCode"
              className="access-code-input"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="XXXX-XXXX"
              autoComplete="off"
              autoFocus
              maxLength={20}
            />
          </div>
          <button type="submit" className="login-submit" disabled={checking || !code.trim()}>
            {checking ? 'Checking…' : 'Unlock downloads'}
          </button>
        </form>
      </div>
    </div>
  );
}
