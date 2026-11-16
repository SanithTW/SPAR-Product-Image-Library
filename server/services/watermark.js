const fs = require('fs');
const path = require('path');

let sharp;
try {
  sharp = require('sharp');
} catch {
  sharp = null;
}

// Watermark look: SPAR logo in the bottom-right corner.
const LOGO_PATH = path.join(__dirname, '..', 'assets', 'spar-logo.png');
const WIDTH_RATIO = 0.18; // logo width as a share of the image width
const MIN_LOGO_WIDTH = 90; // px, so it stays legible on small images
const MARGIN_RATIO = 0.03; // gap from the image edges, as a share of the image width
const OPACITY = 0.85;

let logoSource; // undefined = not loaded yet, null = missing
const markCache = new Map(); // logo width -> { data, info }

function loadLogo() {
  if (logoSource === undefined) {
    try {
      logoSource = fs.readFileSync(LOGO_PATH);
    } catch (err) {
      console.warn('[Watermark] SPAR logo not found, downloads will not be watermarked:', err.message);
      logoSource = null;
    }
  }
  return logoSource;
}

/** The logo resized to `width` with OPACITY applied, as a PNG buffer (cached per width). */
async function getMark(width) {
  if (markCache.has(width)) return markCache.get(width);
  const mark = await sharp(loadLogo())
    .resize({ width })
    .ensureAlpha()
    // Multiply the logo's own alpha by OPACITY.
    .composite([
      {
        input: Buffer.from([255, 255, 255, Math.round(255 * OPACITY)]),
        raw: { width: 1, height: 1, channels: 4 },
        tile: true,
        blend: 'dest-in',
      },
    ])
    .png()
    .toBuffer({ resolveWithObject: true });
  markCache.set(width, mark);
  return mark;
}

/**
 * Composite the SPAR logo onto raw pixel data.
 * @param {{data: Buffer, info: {width:number, height:number, channels:number}}} image raw pixels from sharp
 * @returns a sharp instance with the watermark applied, ready for .jpeg()/.png()/.webp()
 */
async function watermarkRaw({ data, info }) {
  // Callers only use this when sharp is installed.
  const base = sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } });
  if (!loadLogo()) return base;

  const margin = Math.round(info.width * MARGIN_RATIO);
  const width = Math.min(
    Math.max(MIN_LOGO_WIDTH, Math.round(info.width * WIDTH_RATIO)),
    info.width - 2 * margin
  );
  if (width < 20) return base; // image too small to carry a readable watermark

  const mark = await getMark(width);
  const top = info.height - mark.info.height - margin;
  const left = info.width - mark.info.width - margin;
  if (top < 0 || left < 0) return base;

  return base.composite([{ input: mark.data, top, left }]);
}

module.exports = { watermarkRaw, isWatermarkAvailable: () => Boolean(sharp && loadLogo()) };
