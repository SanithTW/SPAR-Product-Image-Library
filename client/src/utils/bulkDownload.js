import JSZip from 'jszip';
import { getDownloadUrl, getImageUrl } from '../services/api';

const CONCURRENCY = 6;

/** Split pasted text (Excel column, comma list, spaces…) into unique DC codes, keeping order. */
export function parseDcCodes(text) {
  const seen = new Set();
  const codes = [];
  for (const raw of text.split(/[\s,;|]+/)) {
    const code = raw.trim();
    if (code && !seen.has(code)) {
      seen.add(code);
      codes.push(code);
    }
  }
  return codes;
}

/** Strip characters Windows doesn't allow in file names. */
function safeFileName(name) {
  return name
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '')
    .slice(0, 150) || 'product';
}

function extensionFor(product, format, contentType) {
  if (format !== 'original') return '.jpg';
  const fromName = (product.file_name || '').match(/\.[a-z0-9]+$/i);
  if (fromName) return fromName[0].toLowerCase();
  if (contentType?.includes('png')) return '.png';
  if (contentType?.includes('webp')) return '.webp';
  return '.jpg';
}

function imageUrlFor(product, format) {
  if (format === 'original') return getImageUrl(product.image_url);
  return getDownloadUrl(product.id, { size: 1080, fit: format === 'contain' ? 'contain' : 'cover' });
}

async function fetchImage(url, signal) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { blob: await res.blob(), contentType: res.headers.get('content-type') };
    } catch (err) {
      if (signal?.aborted) throw err;
      lastError = err;
    }
  }
  throw lastError;
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Fetch every product image and save them as one ZIP.
 * Files are named like the source images: "3010145 Fogg Body Spray Delicious 120ML.jpg".
 *
 * @param {object[]} products
 * @param {object} opts
 *   format: 'cover' (1080 crop) | 'contain' (1080 with white padding) | 'original'
 *   zipName: file name for the ZIP
 *   notes: { [fileName]: string } extra text files to include (e.g. missing codes)
 *   onProgress: ({ phase, done, total }) => void
 *   signal: AbortSignal to cancel
 * @returns {{ saved: number, failed: {product, error}[] }}
 */
export async function downloadProductsZip(products, { format = 'cover', zipName, notes = {}, onProgress, signal } = {}) {
  const zip = new JSZip();
  const usedNames = new Set();
  const failed = [];
  let done = 0;
  let next = 0;

  const uniqueName = (base, ext) => {
    let name = `${base}${ext}`;
    for (let n = 2; usedNames.has(name.toLowerCase()); n++) name = `${base} (${n})${ext}`;
    usedNames.add(name.toLowerCase());
    return name;
  };

  onProgress?.({ phase: 'fetching', done: 0, total: products.length });

  const worker = async () => {
    while (next < products.length) {
      if (signal?.aborted) return;
      const product = products[next++];
      try {
        const { blob, contentType } = await fetchImage(imageUrlFor(product, format), signal);
        const base = safeFileName([product.dc_code, product.product_name].filter(Boolean).join(' '));
        zip.file(uniqueName(base, extensionFor(product, format, contentType)), blob);
      } catch (err) {
        if (signal?.aborted) return;
        failed.push({ product, error: err.message || 'Download failed' });
      }
      done++;
      onProgress?.({ phase: 'fetching', done, total: products.length });
    }
  };

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, products.length) }, worker));
  if (signal?.aborted) throw new DOMException('Download cancelled', 'AbortError');

  if (failed.length) {
    notes['failed-downloads.txt'] = failed
      .map(({ product, error }) => `${product.dc_code || '(no DC code)'}\t${product.product_name}\t${error}`)
      .join('\r\n');
  }
  for (const [name, text] of Object.entries(notes)) zip.file(name, text);

  onProgress?.({ phase: 'zipping', done, total: products.length });
  // JPEGs are already compressed, so STORE is much faster and barely bigger.
  const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
  saveBlob(blob, zipName);

  return { saved: products.length - failed.length, failed };
}
