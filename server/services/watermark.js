const fs = require('fs');
const path = require('path');

let sharp;
try {
  sharp = require('sharp');
} catch {
  sharp = null;
}

// Watermark look: the SPAR tree-and-wordmark logo, large and centred over the whole image.
// The PNG already has a transparent background and is drawn semi-transparent,
// so it is placed as-is without extra fading.
const LOGO_PATH = path.join(__dirname, '..', 'assets', 'spar-watermark.png');
const SIZE_RATIO = 0.6; // logo fits inside this share of the image's width and height
const MIN_SIZE = 60; // px; skip images too small to carry it

let logoSource; // undefined = not loaded yet, null = missing
const markCache = new Map(); // "w x h" box -> { data, info }

function loadLogo() {
  if (logoSource === undefined) {
    try {
      logoSource = fs.readFileSync(LOGO_PATH);
    } catch (err) {
      console.warn('[Watermark] SPAR watermark image not found, downloads will not be watermarked:', err.message);
      logoSource = null;
    }
  }
  return logoSource;
}

/** The logo scaled to fit inside a boxW x boxH box (cached per box size). */
async function getMark(boxW, boxH) {
  const key = `${boxW}x${boxH}`;
  if (markCache.has(key)) return markCache.get(key);
  const mark = await sharp(loadLogo())
    .resize({ width: boxW, height: boxH, fit: 'inside', kernel: 'lanczos3' })
    .png()
    .toBuffer({ resolveWithObject: true });
  if (markCache.size > 50) markCache.clear(); // originals come in many sizes; keep memory bounded
  markCache.set(key, mark);
  return mark;
}

/**
 * Composite the SPAR watermark onto raw pixel data, centred.
 * @param {{data: Buffer, info: {width:number, height:number, channels:number}}} image raw pixels from sharp
 * @returns a sharp instance with the watermark applied, ready for .jpeg()/.png()/.webp()
 */
async function watermarkRaw({ data, info }) {
  // Callers only use this when sharp is installed.
  const base = sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } });
  if (!loadLogo()) return base;

  const boxW = Math.round(info.width * SIZE_RATIO);
  const boxH = Math.round(info.height * SIZE_RATIO);
  if (Math.min(boxW, boxH) < MIN_SIZE) return base;

  const mark = await getMark(boxW, boxH);
  const left = Math.round((info.width - mark.info.width) / 2);
  const top = Math.round((info.height - mark.info.height) / 2);
  return base.composite([{ input: mark.data, top, left }]);
}

module.exports = { watermarkRaw, isWatermarkAvailable: () => Boolean(sharp && loadLogo()) };
