const express = require('express');
const crypto = require('crypto');
const { db } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// No 0/O or 1/I/L, so codes can be read out over the phone without mistakes.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const MAX_DAYS = 90;

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

// POST /api/access-codes  (admin) - body: { label, hours }
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const label = String(req.body.label || '').trim().slice(0, 80);
    const hours = Number(req.body.hours);
    if (!label) return res.status(400).json({ error: 'Enter who the code is for.' });
    if (!Number.isFinite(hours) || hours <= 0 || hours > MAX_DAYS * 24) {
      return res.status(400).json({ error: `Duration must be between 1 hour and ${MAX_DAYS} days.` });
    }

    const expiresAt = new Date(Date.now() + hours * 3600 * 1000).toISOString();
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
