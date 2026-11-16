const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../db');
const { authMiddleware, JWT_SECRET } = require('../middleware/auth');
const { normaliseCode, isPermanent } = require('./accessCodes');

const router = express.Router();

// POST /api/auth/access-code - exchange a temporary access code for a download-only token
router.post('/access-code', async (req, res) => {
  try {
    const code = normaliseCode(req.body.code);
    const invalid = () => res.status(401).json({ error: 'That access code is not valid or has expired.' });
    if (!code) return invalid();

    const result = await db.execute({
      sql: 'SELECT id, label, expires_at, watermark FROM access_codes WHERE code = ? LIMIT 1',
      args: [code],
    });
    const row = result.rows[0];
    if (!row) return invalid();

    const secondsLeft = Math.floor((new Date(row.expires_at).getTime() - Date.now()) / 1000);
    if (secondsLeft <= 0) return invalid();

    await db.execute({
      sql: 'UPDATE access_codes SET use_count = use_count + 1, last_used_at = ? WHERE id = ?',
      args: [new Date().toISOString(), row.id],
    });

    // A "no expiry" code gets a token with no expiry; it still stops working once the code is deleted,
    // because every download re-checks the code in the database.
    const permanent = isPermanent(row.expires_at);
    const token = jwt.sign(
      { role: 'guest', codeId: row.id, label: row.label },
      JWT_SECRET,
      permanent ? {} : { expiresIn: secondsLeft }
    );
    return res.json({
      token,
      label: row.label,
      expiresAt: row.expires_at,
      permanent,
      watermark: Number(row.watermark) !== 0,
    });
  } catch (err) {
    console.error('[Auth] Access code error:', err);
    return res.status(500).json({ error: 'Internal server error checking access code.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const result = await db.execute({
      sql: 'SELECT id, username, password_hash FROM admins WHERE username = ? LIMIT 1',
      args: [username.trim()],
    });

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const admin = result.rows[0];
    const isMatch = await bcrypt.compare(password, admin.password_hash);

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // Sign JWT token valid for 1 day (24 hours) as per proposal
    const token = jwt.sign(
      { id: admin.id, username: admin.username },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    return res.json({
      message: 'Login successful',
      token,
      user: {
        id: admin.id,
        username: admin.username,
      },
    });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    return res.status(500).json({ error: 'Internal server error during login.' });
  }
});

// GET /api/auth/me - Verify current token
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const result = await db.execute({
      sql: 'SELECT id, username, created_at FROM admins WHERE id = ? LIMIT 1',
      args: [req.user.id],
    });

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Admin user not found.' });
    }

    return res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('[Auth] Me check error:', err);
    return res.status(500).json({ error: 'Internal server error checking session.' });
  }
});

module.exports = router;
