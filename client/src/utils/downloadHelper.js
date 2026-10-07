import axios from 'axios';
import { getDownloadUrl } from '../services/api';

/**
 * Downloads a product image directly to user's device
 */
export async function downloadProductImage(product) {
  try {
    const downloadUrl = getDownloadUrl(product.id);
    const response = await axios.get(downloadUrl, {
      responseType: 'blob',
    });

    const safeTitle = (product.product_name || 'product').replace(/[^a-zA-Z0-9_-]/g, '_');
    const ext = product.file_name ? product.file_name.substring(product.file_name.lastIndexOf('.')) : '.jpg';
    const filename = `SPAR_${product.dc_code}_${safeTitle}${ext}`;

    const blob = new Blob([response.data]);
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
    return true;
  } catch (error) {
    console.error('Download error:', error);
    // Fallback: direct window download via url
    window.open(getDownloadUrl(product.id), '_blank');
    return false;
  }
}
