const path = require('path');
const { createClient } = require('@libsql/client');
const envPath = path.resolve(__dirname, '.env');
require('dotenv').config({ path: envPath });

let rawUrl = process.env.TURSO_DATABASE_URL || 'file:spar_images.db';
const authToken = process.env.TURSO_AUTH_TOKEN ? process.env.TURSO_AUTH_TOKEN.trim() : undefined;

let dbUrl = rawUrl.trim();
let isTurso = dbUrl.startsWith('libsql:') || dbUrl.startsWith('https:');

// If Turso URL is provided without an auth token, warn and fallback to local SQLite
if (isTurso && !authToken) {
  console.warn(`\n[DB Notice] Turso database URL "${dbUrl}" is configured, but TURSO_AUTH_TOKEN is not yet set in server/.env.`);
  console.warn(`[DB Notice] Turso requires an auth token. Falling back to local SQLite until TURSO_AUTH_TOKEN is supplied.\n`);
  const absoluteDbPath = path.resolve(__dirname, 'spar_images.db').replace(/\\/g, '/');
  dbUrl = `file:${absoluteDbPath}`;
  isTurso = false;
}

const fs = require('fs');
const os = require('os');
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

if (isTurso && authToken) {
  // Normalize libsql:// to https:// for @libsql/client HTTP Hrana transport
  if (dbUrl.startsWith('libsql:')) {
    dbUrl = dbUrl.replace(/^libsql:/, 'https:');
  }
} else if (dbUrl.startsWith('file:')) {
  const filename = dbUrl.replace('file:', '').replace(/^\.\//, '');
  if (isServerless) {
    // In serverless, /var/task is read-only; use /tmp directory for writable SQLite
    const tmpDbPath = path.join(os.tmpdir(), path.basename(filename || 'spar_images.db')).replace(/\\/g, '/');
    const sourceDbPath = path.resolve(__dirname, path.basename(filename || 'spar_images.db'));
    if (fs.existsSync(sourceDbPath) && !fs.existsSync(tmpDbPath)) {
      try {
        fs.copyFileSync(sourceDbPath, tmpDbPath);
      } catch (e) {
        console.warn('[DB] Could not copy source db to /tmp:', e.message);
      }
    }
    dbUrl = `file:${tmpDbPath}`;
  } else if (!dbUrl.includes('/') && !dbUrl.includes('\\')) {
    const absoluteDbPath = path.resolve(__dirname, filename).replace(/\\/g, '/');
    dbUrl = `file:${absoluteDbPath}`;
  }
}

const clientConfig = {
  url: dbUrl,
};

if (authToken && isTurso) {
  clientConfig.authToken = authToken;
}

const db = createClient(clientConfig);

async function initDatabase() {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dc_code TEXT NOT NULL,
        product_name TEXT NOT NULL,
        image_url TEXT NOT NULL,
        public_id TEXT NOT NULL,
        file_name TEXT,
        image_data TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    try {
      await db.execute('ALTER TABLE products ADD COLUMN image_data TEXT');
    } catch (e) {
      // Column already exists, safe to ignore
    }

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_products_dc ON products(dc_code);
    `);

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_products_name ON products(product_name);
    `);

    console.log(`[DB] Database initialized successfully (Connected to: ${isTurso ? 'Turso Cloud (' + rawUrl + ')' : 'Local SQLite'})`);
  } catch (error) {
    console.error('[DB] Failed to initialize database tables:', error);
    throw error;
  }
}

module.exports = { db, initDatabase, isTurso };
