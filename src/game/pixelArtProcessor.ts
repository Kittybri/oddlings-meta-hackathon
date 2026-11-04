/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PixelArtProcessResult {
  backgroundDataUrl: string;
  thumbnailDataUrl: string;
  generationMode: 'local_quantization' | 'ai_generated';
  width: number;
  height: number;
}

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
  file?: File;
}

export const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024; // 8MB limit
export const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

/**
 * Validates uploaded photo file format and file size.
 */
export function validateImageFile(file: File): ImageValidationResult {
  if (!file) {
    return { valid: false, error: 'No image file was selected.' };
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return { valid: false, error: `Image file is too large (${sizeMb}MB). Maximum allowed size is 8MB.` };
  }

  const mime = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  const isWebp = name.endsWith('.webp') || mime === 'image/webp';
  const isJpeg = name.endsWith('.jpg') || name.endsWith('.jpeg') || mime === 'image/jpeg';
  const isPng = name.endsWith('.png') || mime === 'image/png';

  if (!isWebp && !isJpeg && !isPng) {
    return { valid: false, error: 'Unsupported format. Please upload a PNG, JPEG, or WebP photo.' };
  }

  return { valid: true, file };
}

/**
 * Curated 16-bit retro arcade & console palette (32 balanced tones).
 * Provides rich vibrant pixel game contrast while faithfully capturing real-world colors.
 */
export const RETRO_16BIT_PALETTE: Array<[number, number, number]> = [
  // Sky & Atmospheres
  [14, 165, 233],   // Sky Cyan
  [2, 132, 199],    // Deep Sky Blue
  [186, 230, 253],  // Pale Cloud Mist
  [224, 242, 254],  // Bright Sky White
  // Foliage & Greens
  [34, 197, 94],    // Vibrant Grass
  [22, 163, 74],    // Forest Green
  [20, 83, 45],     // Deep Pine Shadow
  [134, 239, 172],  // Palm Frond Highlight
  [74, 222, 128],   // Moss Green
  [63, 98, 18],     // Olive Herb
  // Warm Earths & Brick
  [180, 83, 9],     // Terracotta Brick
  [120, 53, 15],    // Dark Brick
  [217, 119, 6],    // Amber Ochre
  [245, 158, 11],   // Warm Sunlight
  [254, 240, 138],  // Lemon Pale Sun
  [146, 64, 14],    // Cedar Wood
  [69, 26, 3],      // Deep Loam
  [180, 115, 75],   // Plaster Ochre
  // Urban Masonry & Concrete
  [248, 250, 252],  // Pure Plaster White
  [203, 213, 225],  // Light Concrete
  [148, 163, 184],  // Weathered Stone
  [100, 116, 139],  // Blue Slate
  [51, 65, 85],     // Dark Slate
  [30, 41, 59],     // Midnight Iron
  [15, 23, 42],     // Deep Charcoal Shadow
  // Accent Pinks, Purples & Metals
  [244, 63, 94],    // Coral Rose
  [236, 72, 153],   // Hibiscus Pink
  [168, 85, 247],   // Twilight Violet
  [109, 40, 217],   // Deep Indigo
  [56, 189, 248],   // Turquoise Window
  [251, 191, 36],   // Glass Reflection
  [255, 255, 255]   // Pure Sparkle
];

/**
 * Finds the nearest palette color using perceptual color distance.
 */
function findNearestPaletteColor(r: number, g: number, b: number): [number, number, number] {
  let bestDist = Infinity;
  let bestColor = RETRO_16BIT_PALETTE[0];

  for (let i = 0; i < RETRO_16BIT_PALETTE.length; i++) {
    const [pr, pg, pb] = RETRO_16BIT_PALETTE[i];
    // Perceptual squared distance weights: 0.299 R, 0.587 G, 0.114 B
    const dr = r - pr;
    const dg = g - pg;
    const db = b - pb;
    const dist = dr * dr * 0.299 + dg * dg * 0.587 + db * db * 0.114;

    if (dist < bestDist) {
      bestDist = dist;
      bestColor = RETRO_16BIT_PALETTE[i];
    }
  }

  return bestColor;
}

/**
 * Loads an image file or data URL into an HTMLImageElement.
 */
export function loadImageElement(source: string | File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to decode image data. Please ensure it is a valid photo.'));

    if (typeof source === 'string') {
      img.src = source;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          img.src = String(e.target.result);
        } else {
          reject(new Error('Failed to read image file.'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read image file from disk.'));
      reader.readAsDataURL(source);
    }
  });
}

/**
 * Converts a photo to authentic 16-bit pixel art using local canvas downsampling and color quantization.
 * 100% offline, privacy-preserving, and fast without external model calls.
 */
export async function convertToLocalPixelArt(
  imageSource: string | File,
  targetWidth = 160,
  targetHeight = 90,
  brightness = 1
): Promise<PixelArtProcessResult> {
  const img = await loadImageElement(imageSource);

  // 1. Offscreen canvas for low-resolution quantization grid
  const lowResCanvas = document.createElement('canvas');
  lowResCanvas.width = targetWidth;
  lowResCanvas.height = targetHeight;
  const lowResCtx = lowResCanvas.getContext('2d', { willReadFrequently: true });
  if (!lowResCtx) throw new Error('Could not initialize canvas context.');

  // Render downsampled photo preserving aspect ratio and center cropping
  lowResCtx.imageSmoothingEnabled = true;
  lowResCtx.imageSmoothingQuality = 'medium';

  // Compute cover dimensions
  const imgAspect = img.naturalWidth / img.naturalHeight;
  const targetAspect = targetWidth / targetHeight;
  let sx = 0;
  let sy = 0;
  let sw = img.naturalWidth;
  let sh = img.naturalHeight;

  if (imgAspect > targetAspect) {
    // Image is wider than target: crop sides
    sw = img.naturalHeight * targetAspect;
    sx = (img.naturalWidth - sw) / 2;
  } else {
    // Image is taller than target: crop top/bottom
    sh = img.naturalWidth / targetAspect;
    sy = (img.naturalHeight - sh) / 2;
  }

  lowResCtx.drawImage(img, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);

  // 2. Color Palette Quantization
  const imgData = lowResCtx.getImageData(0, 0, targetWidth, targetHeight);
  const data = imgData.data;

  for (let i = 0; i < data.length; i += 4) {
    const level = Math.max(.6, Math.min(1.4, brightness));
    const r = Math.min(255, data[i] * level);
    const g = Math.min(255, data[i + 1] * level);
    const b = Math.min(255, data[i + 2] * level);
    const a = data[i + 3];

    if (a < 128) {
      data[i + 3] = 0;
      continue;
    }

    const [qr, qg, qb] = findNearestPaletteColor(r, g, b);
    data[i] = qr;
    data[i + 1] = qg;
    data[i + 2] = qb;
    data[i + 3] = 255;
  }

  lowResCtx.putImageData(imgData, 0, 0);

  // 3. Render final crisp upscale canvas with nearest-neighbor interpolation
  const finalWidth = 640;
  const finalHeight = 360;
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = finalWidth;
  finalCanvas.height = finalHeight;
  const finalCtx = finalCanvas.getContext('2d');
  if (!finalCtx) throw new Error('Failed to create render canvas.');

  finalCtx.imageSmoothingEnabled = false;
  finalCtx.drawImage(lowResCanvas, 0, 0, targetWidth, targetHeight, 0, 0, finalWidth, finalHeight);

  const backgroundDataUrl = finalCanvas.toDataURL('image/png');

  // 4. Lightweight thumbnail for dropdowns & switcher (64x36)
  const thumbCanvas = document.createElement('canvas');
  thumbCanvas.width = 64;
  thumbCanvas.height = 36;
  const thumbCtx = thumbCanvas.getContext('2d');
  if (thumbCtx) {
    thumbCtx.imageSmoothingEnabled = false;
    thumbCtx.drawImage(lowResCanvas, 0, 0, targetWidth, targetHeight, 0, 0, 64, 36);
  }
  const thumbnailDataUrl = thumbCanvas.toDataURL('image/webp', 0.8) || thumbCanvas.toDataURL('image/png');

  return {
    backgroundDataUrl,
    thumbnailDataUrl,
    generationMode: 'local_quantization',
    width: finalWidth,
    height: finalHeight
  };
}

/**
 * Creates the sample "outside.webp" test photo showing city buildings, palms, and blue sky.
 * Generates an authentic crisp scene with high aesthetic quality for quick prototyping.
 */
export function generateSampleCityPalmsDataUrl(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 360;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Sky Gradient: bright turquoise daylight
  const skyGrad = ctx.createLinearGradient(0, 0, 0, 360);
  skyGrad.addColorStop(0, '#0284c7');
  skyGrad.addColorStop(0.45, '#38bdf8');
  skyGrad.addColorStop(0.85, '#bae6fd');
  skyGrad.addColorStop(1, '#fef08a');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, 640, 360);

  // Distant warm sun halo
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.beginPath();
  ctx.arc(480, 110, 42, 0, Math.PI * 2);
  ctx.fill();

  // Distant city skyscrapers skyline (cool blue-grey silhouettes)
  const buildings = [
    { x: 30, y: 140, w: 55, h: 220, color: '#64748b' },
    { x: 95, y: 110, w: 60, h: 250, color: '#475569' },
    { x: 165, y: 160, w: 70, h: 200, color: '#64748b' },
    { x: 245, y: 130, w: 50, h: 230, color: '#334155' },
    { x: 305, y: 95, w: 80, h: 265, color: '#475569' },
    { x: 395, y: 150, w: 65, h: 210, color: '#64748b' },
    { x: 470, y: 120, w: 75, h: 240, color: '#334155' },
    { x: 555, y: 135, w: 65, h: 225, color: '#475569' }
  ];

  buildings.forEach((b) => {
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);

    // Glowing grid windows
    ctx.fillStyle = 'rgba(254, 240, 138, 0.45)';
    for (let wy = b.y + 12; wy < 320; wy += 14) {
      for (let wx = b.x + 8; wx < b.x + b.w - 8; wx += 12) {
        if ((wx + wy) % 5 !== 0) {
          ctx.fillRect(wx, wy, 5, 7);
        }
      }
    }
  });

  // Midground terrace and balustrade
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 310, 640, 50);
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(0, 306, 640, 6);

  // Foreground Tropical Palm Trees (left and right palms framing the city)
  const drawPalm = (baseX: number, curveDir: number, scale = 1.0) => {
    // Slender curved trunk
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 14 * scale;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(baseX, 360);
    ctx.quadraticCurveTo(baseX + curveDir * 35, 230, baseX + curveDir * 50, 120);
    ctx.stroke();

    // Palm Crown Center
    const crownX = baseX + curveDir * 50;
    const crownY = 120;

    // Palm Fronds sweeping outwards
    const fronds = [
      { angle: -0.8, length: 90 * scale },
      { angle: -0.4, length: 110 * scale },
      { angle: 0.1, length: 105 * scale },
      { angle: 0.6, length: 100 * scale },
      { angle: 1.1, length: 85 * scale },
      { angle: -1.2, length: 80 * scale }
    ];

    fronds.forEach((f) => {
      const tipX = crownX + Math.cos(f.angle) * f.length;
      const tipY = crownY + Math.sin(f.angle) * f.length * 0.7;

      ctx.strokeStyle = '#15803d';
      ctx.lineWidth = 6 * scale;
      ctx.beginPath();
      ctx.moveTo(crownX, crownY);
      ctx.quadraticCurveTo((crownX + tipX) / 2, crownY - 20, tipX, tipY);
      ctx.stroke();

      // Frond leaves fringe
      ctx.fillStyle = '#22c55e';
      for (let t = 0.2; t <= 1.0; t += 0.1) {
        const lx = crownX + (tipX - crownX) * t;
        const ly = crownY + (tipY - crownY) * t;
        ctx.beginPath();
        ctx.arc(lx, ly, 8 * scale, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  };

  drawPalm(70, 1, 1.1);
  drawPalm(560, -1, 1.15);

  return canvas.toDataURL('image/png');
}

/**
 * Checks server-side pixelate status.
 */
export async function checkServerPixelateStatus(): Promise<{
  configured: boolean;
  provider: string;
  message: string;
}> {
  try {
    const res = await fetch('/api/pixelate/status');
    if (!res.ok) {
      return { configured: false, provider: 'none', message: 'Server endpoint returned error.' };
    }
    return await res.json();
  } catch {
    return { configured: false, provider: 'none', message: 'Server unavailable. Using offline local mode.' };
  }
}
