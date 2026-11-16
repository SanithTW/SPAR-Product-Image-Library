const express = require('express');
const crypto = require('crypto');
const { db } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// No 0/O or 1/I/L, so codes can be read out over the phone without mistakes.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const MAX_YEARS = 10;

// "No expiry" codes are stored with this date (the column is NOT NULL); they work until deleted.
const NEVER = '9999-12-31T23:59:59.000Z';
const isPermanent = (expiresAt) => expiresAt === NEVER;

function generateCode() {
  let raw = '';
  for (let i = 0; i < 8; i++) raw += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

/** Normalise what a user typed ("abcd efgh", "ABCD-EFGH") to the stored form. */
function normaliseCode(input) {
  const raw = String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return raw.length === 8 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : null;
}

// GET /api/access-codes  (admin) - list codes, newest first
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const result = await db.execute(
      'SELECT id, code, label, expires_at, created_at, use_count, last_used_at FROM access_codes ORDER BY id DESC'
    );
    res.json({ codes: result.rows });
  } catch (err) {
    next(err);
  }
});

/**
 * Work out the expiry from the request body. One of:
 *   { hours }          - valid for this many hours from now
 *   { expiresAt }      - valid until this date/time (ISO string)
 *   { permanent: true } - never expires; works until the code is deleted
 * Returns { expiresAt } or { error }.
 */
function resolveExpiry(body) {
  if (body.permanent === true) return { expiresAt: NEVER };

  const maxMs = Date.now() + MAX_YEARS * 365 * 24 * 3600 * 1000;
  let ms;
  if (body.expiresAt !== undefined) {
    ms = new Date(body.expiresAt).getTime();
    if (!Number.isFinite(ms)) return { error: 'Choose a valid expiry date and time.' };
  } else {
    const hours = Number(body.hours);
    if (!Number.isFinite(hours) || hours <= 0) return { error: 'Choose how long the code is valid for.' };
    ms = Date.now() + hours * 3600 * 1000;
  }
  if (ms <= Date.now() + 60 * 1000) return { error: 'The expiry time must be in the future.' };
  if (ms > maxMs) return { error: `For more than ${MAX_YEARS} years, choose "No expiry" instead.` };
  return { expiresAt: new Date(ms).toISOString() };
}

// POST /api/access-codes  (admin) - body: { label } plus { hours } | { expiresAt } | { permanent: true }
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const label = String(req.body.label || '').trim().slice(0, 80);
    if (!label) return res.status(400).json({ error: 'Enter who the code is for.' });

    const { expiresAt, error } = resolveExpiry(req.body);
    if (error) return res.status(400).json({ error });
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateCode();
      try {
        const result = await db.execute({
          sql: `INSERT INTO access_codes (code, label, expires_at) VALUES (?, ?, ?)
                RETURNING id, code, label, expires_at, created_at, use_count, last_used_at`,
          args: [code, label, expiresAt],
        });
        return res.status(201).json({ accessCode: result.rows[0] });
      } catch (err) {
        if (!/UNIQUE/i.test(err.message)) throw err; // retry only on a code collision
      }
    }
    res.status(500).json({ error: 'Could not generate a unique code. Please try again.' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/access-codes/:id  (admin) - removes the code; anyone using it loses download access at once
router.delete('/:id', authMiddleware, async (req, res, next) => {
  try {
    await db.execute({ sql: 'DELETE FROM access_codes WHERE id = ?', args: [req.params.id] });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports.normaliseCode = normaliseCode;
module.exports.isPermanent = isPermanent;
