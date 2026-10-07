const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { db, initDatabase } = require('./db');
const { createAdmin } = require('./createAdmin');
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const { uploadDir, isCloudinaryConfigured } = require('./services/storage');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend requests
app.use(cors());

// Parse JSON and urlencoded payloads
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve local uploaded images statically
app.use('/uploads', express.static(uploadDir));

// Health check endpoint (Proposal Step 3: Test with /api/health that runs SELECT 1)
app.get('/api/health', async (req, res) => {
  try {
    const result = await db.execute('SELECT 1 as alive');
    return res.json({
      status: 'ok',
      database: 'connected',
      dbType: process.env.TURSO_DATABASE_URL?.startsWith('libsql:') ? 'Turso Cloud' : 'Local SQLite',
      storage: isCloudinaryConfigured ? 'Cloudinary' : 'Local Disk (/uploads)',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Health] DB query failed:', error);
    return res.status(500).json({
      status: 'error',
      database: 'disconnected',
      error: error.message,
    });
  }
});

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);

// Generic error handler
app.use((err, req, res, next) => {
  console.error('[Server Error]:', err);
  res.status(err.status || 500).json({
    error: err.message || 'An unexpected internal server error occurred.',
  });
});

// Bootstrap database, ensure default admin, and start HTTP listener
async function startServer() {
  try {
    await initDatabase();

    // Ensure default admin exists
    await createAdmin();

    app.listen(PORT, () => {
      console.log(`\n======================================================`);
      console.log(` SPAR Product Image Library API running on port ${PORT}`);
      console.log(` Database: ${process.env.TURSO_DATABASE_URL?.startsWith('libsql:') ? 'Turso Cloud' : 'Local SQLite (spar_images.db)'}`);
      console.log(` Image Storage: ${isCloudinaryConfigured ? 'Cloudinary' : 'Local Disk (server/uploads)'}`);
      console.log(` Health endpoint: http://localhost:${PORT}/api/health`);
      console.log(` Products API:   http://localhost:${PORT}/api/products`);
      console.log(` Auth API:       http://localhost:${PORT}/api/auth/login`);
      console.log(`======================================================\n`);
    });
  } catch (error) {
    console.error('[Server] Fatal startup error:', error);
    process.exit(1);
  }
}

startServer();
