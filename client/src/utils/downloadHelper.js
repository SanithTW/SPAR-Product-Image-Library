import axios from 'axios';
import { getDownloadUrl, getImageUrl } from '../services/api';

/**
 * Triggers a client-side file download for a blob or data URL
 */
function triggerDownload(url, filename) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => {
    try {
      window.URL.revokeObjectURL(url);
    } catch {
      // Ignored
    }
  }, 1500);
}

/**
 * Client-side HTML5 Canvas fallback to crop and resize image to 1080x1080
 */
function cropAndDownloadViaCanvas(product, size = 1080, fit = 'contain', filename) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const targetDim = typeof size === 'number' ? size : 1080;
        const canvas = document.createElement('canvas');
        canvas.width = targetDim;
        canvas.height = targetDim;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          throw new Error('Canvas 2D context not available');
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Clean white background (standard for product photography)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, targetDim, targetDim);

        const nw = img.naturalWidth;
        const nh = img.naturalHeight;

        if (fit === 'contain') {
          // Proportionally scale to fit inside targetDim with white margins
          const scale = Math.min(targetDim / nw, targetDim / nh);
          const dw = nw * scale;
          const dh = nh * scale;
          const dx = (targetDim - dw) / 2;
          const dy = (targetDim - dh) / 2;
          ctx.drawImage(img, dx, dy, dw, dh);
        } else {
          // Smart center-crop to 1:1 square
          let sx = 0, sy = 0, sw = nw, sh = nh;
          if (nw > nh) {
            sw = nh;
            sh = nh;
            sx = (nw - sw) / 2;
          } else {
            sw = nw;
            sh = nw;
            sy = (nh - sh) / 2;
          }
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetDim, targetDim);
        }

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Canvas toBlob failed'));
              return;
            }
            const blobUrl = window.URL.createObjectURL(blob);
            triggerDownload(blobUrl, filename);
            resolve(true);
          },
          'image/jpeg',
          0.93
        );
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = (err) => reject(new Error('Failed to load image for canvas cropping: ' + err));
    img.src = getImageUrl(product.image_url);
  });
}

/**
 * Downloads a product image nicely cropped and resized to 1080x1080 (or custom size/fit).
 * 
 * @param {object} product - Product record
 * @param {object} [options] - Options:
 *    - size: 1080 | 'original' (default: 1080)
 *    - fit: 'contain' (full fit with white padding, default) | 'cover' (center square crop)
 */
export async function downloadProductImage(product, options = {}) {
  const size = options.size !== undefined ? options.size : 1080;
  const fit = options.fit || 'contain';

  const safeTitle = (product.product_name || 'product').replace(/[^a-zA-Z0-9_-]/g, '_');
  const originalExt = product.file_name ? product.file_name.substring(product.file_name.lastIndexOf('.')) : '.jpg';
  const sizeSuffix = size === 'original' ? 'original' : `${size}x${size}`;
  const filename = size === 'original' 
    ? `SPAR_${product.dc_code}_${safeTitle}_original${originalExt}`
    : `SPAR_${product.dc_code}_${safeTitle}_${sizeSuffix}.jpg`;

  try {
    const downloadUrl = getDownloadUrl(product.id, { size, fit });
    const response = await axios.get(downloadUrl, {
      responseType: 'blob',
    });

    const blob = new Blob([response.data], {
      type: response.headers['content-type'] || 'image/jpeg',
    });
    const blobUrl = window.URL.createObjectURL(blob);
    triggerDownload(blobUrl, filename);
    return true;
  } catch (error) {
    console.warn('[Download] Direct server route encountered an issue, trying client canvas fallback:', error);
    try {
      await cropAndDownloadViaCanvas(product, size, fit, filename);
      return true;
    } catch (canvasErr) {
      console.error('[Download] Canvas cropper fallback also failed, falling back to direct window open:', canvasErr);
      window.open(getDownloadUrl(product.id, { size, fit }), '_blank');
      return false;
    }
  }
}
