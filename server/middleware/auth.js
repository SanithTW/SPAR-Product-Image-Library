const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const JWT_SECRET = process.env.JWT_SECRET || 'spar_product_library_secure_jwt_secret_key_2026_xyz';

function readToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
  } catch {
    return null;
  }
}

/** Admin-only routes. Tokens issued for access codes (role 'guest') are rejected. */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No authentication token provided.' });
  }

  const decoded = readToken(req);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token. Please log in again.' });
  }
  if (decoded.role === 'guest') {
    return res.status(403).json({ error: 'Admin login required.' });
  }

  req.user = decoded;
  next();
}

/**
 * Download routes: allowed for admins, or for holders of an access code that
 * still exists and has not expired. The code is re-checked on every request so
 * deleting it (or changing its watermark setting) in the admin workspace takes
 * effect immediately.
 * Sets req.watermark: whether this download should carry the SPAR watermark.
 */
function downloadAuth(req, res, next) {
  const decoded = readToken(req);
  const deny = () =>
    res.status(401).json({ error: 'An access code is required to download images.', code: 'ACCESS_REQUIRED' });

  if (!decoded) return deny();
  if (decoded.role !== 'guest') {
    req.user = decoded;
    req.watermark = true;
    return next();
  }

  // Lazy require avoids a circular import at startup.
  const { db } = require('../db');
  db.execute({
    sql: 'SELECT id, expires_at, watermark FROM access_codes WHERE id = ? LIMIT 1',
    args: [decoded.codeId],
  })
    .then((result) => {
      const row = result.rows[0];
      if (!row || new Date(row.expires_at).getTime() <= Date.now()) return deny();
      req.user = decoded;
      req.watermark = Number(row.watermark) !== 0;
      next();
    })
    .catch(next);
}

module.exports = { authMiddleware, downloadAuth, JWT_SECRET };
