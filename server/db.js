const { createClient } = require('@libsql/client');
const path = require('path');
require('dotenv').config();

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
} else if (isTurso && authToken) {
  // Normalize libsql:// to https:// for @libsql/client HTTP Hrana transport
  if (dbUrl.startsWith('libsql:')) {
    dbUrl = dbUrl.replace(/^libsql:/, 'https:');
  }
} else if (dbUrl.startsWith('file:') && !dbUrl.includes('/') && !dbUrl.includes('\\')) {
  const filename = dbUrl.replace('file:', '');
  const absoluteDbPath = path.resolve(__dirname, filename).replace(/\\/g, '/');
  dbUrl = `file:${absoluteDbPath}`;
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
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

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
