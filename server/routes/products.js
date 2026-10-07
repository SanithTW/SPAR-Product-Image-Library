const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { db } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { upload, saveImage, deleteImage, uploadDir } = require('../services/storage');

const router = express.Router();

/**
 * GET /api/products?q=
 * Search products by DC code or product name (partial matches work).
 * If no search query, returns all products ordered by creation date.
 */
router.get('/', async (req, res) => {
  try {
    const q = req.query.q ? req.query.q.trim() : '';

    let querySql;
    let queryArgs = [];

    if (q) {
      const searchPattern = `%${q}%`;
      querySql = `
        SELECT id, dc_code, product_name, image_url, public_id, file_name, created_at
        FROM products
        WHERE dc_code LIKE ? OR product_name LIKE ?
        ORDER BY created_at DESC
      `;
      queryArgs = [searchPattern, searchPattern];
    } else {
      querySql = `
        SELECT id, dc_code, product_name, image_url, public_id, file_name, created_at
        FROM products
        ORDER BY created_at DESC
      `;
    }

    const result = await db.execute({
      sql: querySql,
      args: queryArgs,
    });

    return res.json({
      count: result.rows.length,
      products: result.rows,
    });
  } catch (err) {
    console.error('[Products] Fetch error:', err);
    return res.status(500).json({ error: 'Failed to fetch products.' });
  }
});

/**
 * GET /api/products/:id
 * Get single product by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.execute({
      sql: 'SELECT id, dc_code, product_name, image_url, public_id, file_name, created_at FROM products WHERE id = ? LIMIT 1',
      args: [id],
    });

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    return res.json({ product: result.rows[0] });
  } catch (err) {
    console.error('[Products] Get by id error:', err);
    return res.status(500).json({ error: 'Failed to get product details.' });
  }
});

/**
 * GET /api/products/:id/download
 * Sends image as a forced file download with clean filename
 */
router.get('/:id/download', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.execute({
      sql: 'SELECT id, dc_code, product_name, image_url, public_id, file_name FROM products WHERE id = ? LIMIT 1',
      args: [id],
    });

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const product = result.rows[0];
    const originalExt = path.extname(product.file_name || product.image_url) || '.jpg';
    const safeTitle = (product.product_name || 'product').replace(/[^a-zA-Z0-9_-]/g, '_');
    const downloadFilename = `SPAR_${product.dc_code}_${safeTitle}${originalExt}`;

    // If image is stored locally in /uploads
    if (product.image_url.startsWith('/uploads/')) {
      const filename = path.basename(product.image_url);
      const filePath = path.join(uploadDir, filename);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Image file does not exist on server.' });
      }

      return res.download(filePath, downloadFilename);
    }

    // Remote Cloudinary or external image URL: Stream and force attachment download
    const urlObj = new URL(product.image_url);
    const client = urlObj.protocol === 'https:' ? https : http;

    client.get(product.image_url, (streamRes) => {
      if (streamRes.statusCode >= 400) {
        return res.status(streamRes.statusCode).json({ error: 'Failed to retrieve remote image.' });
      }

      res.setHeader('Content-Disposition', `attachment; filename="${downloadFilename}"`);
      res.setHeader('Content-Type', streamRes.headers['content-type'] || 'image/jpeg');
      streamRes.pipe(res);
    }).on('error', (err) => {
      console.error('[Download] Remote stream error:', err);
      return res.status(500).json({ error: 'Failed to download image file.' });
    });

  } catch (err) {
    console.error('[Products] Download error:', err);
    return res.status(500).json({ error: 'Failed to process download request.' });
  }
});

/**
 * POST /api/products (Protected)
 * Admin uploads an image with DC code and product name
 */
router.post('/', authMiddleware, (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File size exceeds limit. Maximum allowed size is 5MB.' });
      }
      return res.status(400).json({ error: err.message || 'File upload error.' });
    }
    next();
  });
}, async (req, res) => {
  try {
    const { dc_code, product_name } = req.body;

    if (!dc_code || !dc_code.trim()) {
      return res.status(400).json({ error: 'DC code is required.' });
    }
    if (!product_name || !product_name.trim()) {
      return res.status(400).json({ error: 'Product name is required.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Product image file is required.' });
    }

    const saved = await saveImage(req.file, dc_code.trim());

    const insertResult = await db.execute({
      sql: `
        INSERT INTO products (dc_code, product_name, image_url, public_id, file_name)
        VALUES (?, ?, ?, ?, ?)
        RETURNING id, dc_code, product_name, image_url, public_id, file_name, created_at
      `,
      args: [
        dc_code.trim(),
        product_name.trim(),
        saved.image_url,
        saved.public_id,
        saved.file_name,
      ],
    });

    const newProduct = insertResult.rows[0];

    return res.status(201).json({
      message: 'Product image uploaded successfully.',
      product: newProduct,
    });
  } catch (err) {
    console.error('[Products] Upload error:', err);
    return res.status(500).json({ error: 'Failed to create product entry.' });
  }
});

/**
 * PUT /api/products/:id (Protected)
 * Admin edits DC code, name, or replaces image
 */
router.put('/:id', authMiddleware, (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File size exceeds limit. Maximum allowed size is 5MB.' });
      }
      return res.status(400).json({ error: err.message || 'File upload error.' });
    }
    next();
  });
}, async (req, res) => {
  try {
    const { id } = req.params;
    const { dc_code, product_name } = req.body;

    const existingResult = await db.execute({
      sql: 'SELECT id, dc_code, product_name, image_url, public_id, file_name FROM products WHERE id = ? LIMIT 1',
      args: [id],
    });

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const current = existingResult.rows[0];
    const newDcCode = (dc_code && dc_code.trim()) ? dc_code.trim() : current.dc_code;
    const newProductName = (product_name && product_name.trim()) ? product_name.trim() : current.product_name;

    let newImageUrl = current.image_url;
    let newPublicId = current.public_id;
    let newFileName = current.file_name;

    // If a replacement image was uploaded
    if (req.file) {
      const saved = await saveImage(req.file, newDcCode);

      // Delete old image asset
      await deleteImage(current.public_id, current.image_url);

      newImageUrl = saved.image_url;
      newPublicId = saved.public_id;
      newFileName = saved.file_name;
    }

    await db.execute({
      sql: `
        UPDATE products
        SET dc_code = ?, product_name = ?, image_url = ?, public_id = ?, file_name = ?
        WHERE id = ?
      `,
      args: [newDcCode, newProductName, newImageUrl, newPublicId, newFileName, id],
    });

    const updatedResult = await db.execute({
      sql: 'SELECT id, dc_code, product_name, image_url, public_id, file_name, created_at FROM products WHERE id = ? LIMIT 1',
      args: [id],
    });

    return res.json({
      message: 'Product updated successfully.',
      product: updatedResult.rows[0],
    });
  } catch (err) {
    console.error('[Products] Update error:', err);
    return res.status(500).json({ error: 'Failed to update product.' });
  }
});

/**
 * DELETE /api/products/:id (Protected)
 * Admin deletes product and its image file
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const existingResult = await db.execute({
      sql: 'SELECT id, dc_code, product_name, image_url, public_id, file_name FROM products WHERE id = ? LIMIT 1',
      args: [id],
    });

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const current = existingResult.rows[0];

    // Delete image asset from Cloudinary or local uploads
    await deleteImage(current.public_id, current.image_url);

    // Delete from database
    await db.execute({
      sql: 'DELETE FROM products WHERE id = ?',
      args: [id],
    });

    return res.json({
      message: 'Product and image deleted successfully.',
      id: current.id,
    });
  } catch (err) {
    console.error('[Products] Delete error:', err);
    return res.status(500).json({ error: 'Failed to delete product.' });
  }
});

module.exports = router;
