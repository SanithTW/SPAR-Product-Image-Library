-- SPAR Product Image Library Database Schema (Turso / SQLite)

CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dc_code TEXT NOT NULL,
  product_name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  public_id TEXT NOT NULL, -- Cloudinary public_id or local asset identifier
  file_name TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_dc ON products(dc_code);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(product_name);
