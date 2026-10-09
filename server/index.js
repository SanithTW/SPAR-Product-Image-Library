const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

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

// Ensure database and admin setup before handling requests
let dbInitPromise = null;
async function ensureDbInit() {
  if (!dbInitPromise) {
    dbInitPromise = (async () => {
      await initDatabase();
      await createAdmin();
    })().catch((err) => {
      console.error('[DB Init Error]:', err);
      dbInitPromise = null;
      throw err;
    });
  }
  return dbInitPromise;
}

// Database initialization middleware for serverless invocations
app.use(async (req, res, next) => {
  try {
    await ensureDbInit();
    next();
  } catch (err) {
    next(err);
  }
});

// Create API router for endpoints
const apiRouter = express.Router();

// Root informational endpoint
apiRouter.get('/', (req, res) => {
  return res.json({
    name: 'SPAR Product Image Library API',
    status: 'online',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      products: '/api/products',
      auth: '/api/auth/login',
    },
  });
});

// Health check endpoint
apiRouter.get('/health', async (req, res) => {
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

// Mount routes on apiRouter
apiRouter.use('/auth', authRoutes);
apiRouter.use('/products', productRoutes);

// Mount router on both '/api' and '/' (for flexible hosting on Vercel and local dev)
app.use('/api', apiRouter);
app.use('/', apiRouter);

// Generic error handler
app.use((err, req, res, next) => {
  console.error('[Server Error]:', err);
  res.status(err.status || 500).json({
    error: err.message || 'An unexpected internal server error occurred.',
  });
});

// Bootstrap database, ensure default admin, and start HTTP listener for standalone runs
async function startServer() {
  try {
    await ensureDbInit();

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

if (require.main === module) {
  startServer();
}

module.exports = app;
