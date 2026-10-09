const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Check if Cloudinary is configured
const isCloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET &&
  process.env.CLOUDINARY_CLOUD_NAME.trim() !== '' &&
  process.env.CLOUDINARY_API_KEY.trim() !== '' &&
  process.env.CLOUDINARY_API_SECRET.trim() !== '' &&
  !process.env.CLOUDINARY_CLOUD_NAME.includes('...')
);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  console.log('[Storage] Cloudinary configured successfully.');
} else {
  console.log('[Storage] Cloudinary not configured or incomplete in .env. Using local storage (/uploads).');
}

// Multer memory storage (works seamlessly for Cloudinary stream or local disk write)
const storage = multer.memoryStorage();

// File filter: JPG, PNG, WEBP only
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPG, PNG, and WEBP image formats are allowed.'), false);
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB max per proposal specs
  },
  fileFilter,
});

/**
 * Upload image buffer to either Cloudinary or local disk
 */
async function saveImage(file, dcCode) {
  const originalName = file.originalname;
  const sanitizedDc = (dcCode || 'spar').replace(/[^a-zA-Z0-9_-]/g, '_');

  if (isCloudinaryConfigured) {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'spar-products',
          public_id: `${sanitizedDc}_${Date.now()}`,
          resource_type: 'image',
        },
        (error, result) => {
          if (error) {
            return reject(error);
          }
          resolve({
            image_url: result.secure_url,
            public_id: result.public_id,
            file_name: originalName,
          });
        }
      );
      uploadStream.end(file.buffer);
    });
  } else {
    // Save to local disk
    const ext = path.extname(originalName) || '.jpg';
    const filename = `${sanitizedDc}_${Date.now()}${ext}`;
    const targetPath = path.join(uploadDir, filename);

    await fs.promises.writeFile(targetPath, file.buffer);

    return {
      image_url: `/uploads/${filename}`,
      public_id: `local:${filename}`,
      file_name: originalName,
    };
  }
}

/**
 * Delete image from either Cloudinary or local disk
 */
async function deleteImage(publicId, imageUrl) {
  if (!publicId) return;

  if (publicId.startsWith('local:')) {
    const filename = publicId.replace('local:', '');
    const targetPath = path.join(uploadDir, filename);
    if (fs.existsSync(targetPath)) {
      try {
        await fs.promises.unlink(targetPath);
      } catch (err) {
        console.error(`[Storage] Failed to remove local file ${filename}:`, err.message);
      }
    }
  } else if (isCloudinaryConfigured) {
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (err) {
      console.error(`[Storage] Failed to delete Cloudinary asset ${publicId}:`, err.message);
    }
  } else if (imageUrl && imageUrl.startsWith('/uploads/')) {
    const filename = path.basename(imageUrl);
    const targetPath = path.join(uploadDir, filename);
    if (fs.existsSync(targetPath)) {
      try {
        await fs.promises.unlink(targetPath);
      } catch (err) {
        console.error(`[Storage] Failed to remove local file ${filename}:`, err.message);
      }
    }
  }
}

module.exports = {
  upload,
  saveImage,
  deleteImage,
  isCloudinaryConfigured,
  uploadDir,
};
