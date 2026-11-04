/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Turns the player's photo into the creature's pixel sprite: cut the object out of
 * its background, drop a hand that is holding it, shrink it to a small grid, reduce
 * it to a few colors and ring it with a dark outline. Returns null when the cut-out
 * is unreliable, so the game falls back to the drawn sprite.
 */

/** Set to false to go back to the drawn sprites everywhere. */
export const PHOTO_SPRITES_ENABLED = true;

export const MAX_SPRITE_W = 28;
export const MAX_SPRITE_H = 26;
export const PALETTE_SIZE = 8;
const WORK_SIZE = 192; // photos are processed at this size at most

// Google MediaPipe interactive segmenter: cuts out the object under a point
const MEDIAPIPE_VERSION = '0.10.14';
const MEDIAPIPE_BUNDLE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@' + MEDIAPIPE_VERSION + '/vision_bundle.mjs';
const MEDIAPIPE_WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@' + MEDIAPIPE_VERSION + '/wasm';
const MEDIAPIPE_MODEL = 'https://storage.googleapis.com/mediapipe-models/interactive_segmenter/magic_touch/float32/1/magic_touch.tflite';
const SEGMENT_TIMEOUT_MS = 15000;

export interface PhotoSprite {
  w: number;
  h: number;
  /** Row-major colors, null where the cell is empty. */
  pixels: (string | null)[];
  palette: string[];
  outline: string;
  /** Where the cute face goes, in sprite cells. */
  faceX: number;
  faceY: number;
  /** True when the art already has its own face (drawn by Muse Image), so none is added. */
  drawnFace?: boolean;
  /** Muse Image's drawing with its background removed, shown as-is instead of the traced pixels. */
  art?: string;
  /** Size of that drawing in pixels, so the game's own eyes can be placed on it. */
  artW?: number;
  artH?: number;
  /** True while Muse Image is still drawing the art: a placeholder is shown instead of a rough sprite. */
  pending?: boolean;
}

export interface PhotoSpriteOptions {
  /** Max color step between neighbouring background pixels. */
  tolerance?: number;
  /** Edge strength the background fill will not cross. */
  edge?: number;
  colors?: number;
  /** Object pixels from an AI segmenter (1 = object); replaces the color-based guess. */
  mask?: Uint8Array;
}

type Rgb = [number, number, number];
const NB: ReadonlyArray<readonly [number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Background: everything reachable from the photo border without crossing an edge. */
export function backgroundMask(data: ArrayLike<number>, w: number, h: number, tolerance = 10, edge = 30): Uint8Array {
  const at = (x: number, y: number, k: number) =>
    data[((Math.min(h - 1, Math.max(0, y)) * w) + Math.min(w - 1, Math.max(0, x))) * 4 + k];
  const grad = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let k = 0; k < 3; k++) {
        const gx = at(x + 1, y - 1, k) + 2 * at(x + 1, y, k) + at(x + 1, y + 1, k) - at(x - 1, y - 1, k) - 2 * at(x - 1, y, k) - at(x - 1, y + 1, k);
        const gy = at(x - 1, y + 1, k) + 2 * at(x, y + 1, k) + at(x + 1, y + 1, k) - at(x - 1, y - 1, k) - 2 * at(x, y - 1, k) - at(x + 1, y - 1, k);
        s += gx * gx + gy * gy;
      }
      grad[y * w + x] = Math.sqrt(s) / 4;
    }
  }
  // A hand in the lower half is left out of the background so objectMask can find it
  // and the object can be filled in behind it
  const handLike = (i: number) => i >= w * h * 0.5 && isSkin(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
  const band = Math.max(1, Math.round(w * 0.06));
  const bg = new Uint8Array(w * h);
  const queue: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const onBand = x < band || y < band || x >= w - band || y >= h - band;
      if (onBand && grad[y * w + x] < edge && !handLike(y * w + x)) {
        bg[y * w + x] = 1;
        queue.push(y * w + x);
      }
    }
  }
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head];
    const x = i % w;
    const y = (i / w) | 0;
    for (const [dx, dy] of NB) {
      const xx = x + dx;
      const yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      const j = yy * w + xx;
      if (bg[j] || handLike(j)) continue;
      const step = Math.hypot(data[i * 4] - data[j * 4], data[i * 4 + 1] - data[j * 4 + 1], data[i * 4 + 2] - data[j * 4 + 2]);
      if (step < tolerance && grad[j] < edge) {
        bg[j] = 1;
        queue.push(j);
      }
    }
  }
  // The fill stops a pixel short of strong edges; peel that thin rim of background off
  for (let pass = 0; pass < 2; pass++) {
    const peel: number[] = [];
    for (let i = 0; i < w * h; i++) {
      if (bg[i]) continue;
      const x = i % w;
      const y = (i / w) | 0;
      for (const [dx, dy] of NB) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const j = yy * w + xx;
        if (bg[j] && Math.hypot(data[i * 4] - data[j * 4], data[i * 4 + 1] - data[j * 4 + 1], data[i * 4 + 2] - data[j * 4 + 2]) < tolerance * 2) {
          peel.push(i);
          break;
        }
      }
    }
    for (const i of peel) bg[i] = 1;
  }
  return bg;
}

export function isSkin(r: number, g: number, b: number): boolean {
  const cb = 128 - 0.1687 * r - 0.3313 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.4187 * g - 0.0813 * b;
  return cr > 140 && cr < 180 && cb > 85 && cb < 128 && r > 95 && r - b > 30 && r > g;
}

function components(mask: Uint8Array, w: number, h: number): { px: number[]; border: boolean }[] {
  const seen = new Uint8Array(w * h);
  const out: { px: number[]; border: boolean }[] = [];
  for (let s = 0; s < w * h; s++) {
    if (!mask[s] || seen[s]) continue;
    const px = [s];
    seen[s] = 1;
    let border = false;
    for (let head = 0; head < px.length; head++) {
      const i = px[head];
      const x = i % w;
      const y = (i / w) | 0;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) border = true;
      for (const [dx, dy] of NB) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const j = yy * w + xx;
        if (mask[j] && !seen[j]) {
          seen[j] = 1;
          px.push(j);
        }
      }
    }
    out.push({ px, border });
  }
  return out;
}

function morph(mask: Uint8Array, w: number, h: number, erode: boolean): Uint8Array {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = erode ? 1 : 0;
      for (const [dx, dy] of [[0, 0], ...NB]) {
        const xx = x + dx;
        const yy = y + dy;
        const on = xx >= 0 && yy >= 0 && xx < w && yy < h ? mask[yy * w + xx] : 0;
        if (erode && !on) v = 0;
        if (!erode && on) v = 1;
      }
      out[y * w + x] = v;
    }
  }
  return out;
}

/**
 * The object's pixels: not background, minus a hand at the bottom, one solid piece.
 * Pixels removed as a hand are marked in handOut when it is given. A segmenter mask,
 * when given, decides what the object is instead of the background fill.
 */
export function objectMask(data: ArrayLike<number>, w: number, h: number, bg: Uint8Array, handOut?: Uint8Array, segmented?: Uint8Array): Uint8Array | null {
  let fg: Uint8Array = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (!segmented) fg[i] = bg[i] ? 0 : 1;
    // Skin next to the segmented object is kept for now so the hand check below finds it
    else fg[i] = segmented[i] || (!bg[i] && isSkin(data[i * 4], data[i * 4 + 1], data[i * 4 + 2])) ? 1 : 0;
  }

  // A hand holding the object: skin-colored, in the lower half, reaching the photo edge
  const skin = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    skin[i] = fg[i] && (i / w) >= h * 0.5 && isSkin(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]) ? 1 : 0;
  }
  for (const c of components(skin, w, h)) {
    if (!c.border || c.px.length <= w * h * 0.01) continue;
    for (const i of c.px) {
      fg[i] = 0;
      if (handOut) handOut[i] = 1;
    }
  }

  fg = morph(morph(fg, w, h, true), w, h, false);
  const pieces = components(fg, w, h).sort((a, b) => b.px.length - a.px.length);
  if (!pieces.length) return null;
  const keep = new Uint8Array(w * h);
  for (const i of pieces[0].px) keep[i] = 1;

  // Fill holes: anything not reachable from the border is part of the object
  const outside = new Uint8Array(w * h);
  const queue: number[] = [];
  for (let x = 0; x < w; x++) queue.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) queue.push(y * w, y * w + w - 1);
  const start = queue.filter((i) => !keep[i]);
  for (const i of start) outside[i] = 1;
  for (let head = 0; head < start.length; head++) {
    const i = start[head];
    const x = i % w;
    const y = (i / w) | 0;
    for (const [dx, dy] of NB) {
      const xx = x + dx;
      const yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      const j = yy * w + xx;
      if (!keep[j] && !outside[j]) {
        outside[j] = 1;
        start.push(j);
      }
    }
  }
  for (let i = 0; i < w * h; i++) if (!outside[i]) keep[i] = 1;

  let area = 0;
  for (let i = 0; i < w * h; i++) area += keep[i];
  const share = area / (w * h);
  return share < 0.08 || share > 0.9 ? null : keep;
}

/** Channel gains that make a near-neutral background grey (undoes a warm or blue cast). */
export function whiteBalance(data: ArrayLike<number>, w: number, h: number, bg: Uint8Array): Rgb {
  const sum = [0, 0, 0];
  let n = 0;
  for (let i = 0; i < w * h; i++) {
    if (!bg[i]) continue;
    sum[0] += data[i * 4];
    sum[1] += data[i * 4 + 1];
    sum[2] += data[i * 4 + 2];
    n++;
  }
  if (n < w * h * 0.1) return [1, 1, 1];
  const mean = sum.map((s) => s / n);
  const avg = (mean[0] + mean[1] + mean[2]) / 3;
  if (avg < 1 || (Math.max(...mean) - Math.min(...mean)) / avg >= 0.3) return [1, 1, 1]; // colorful background: leave it
  return mean.map((m) => Math.min(1.4, Math.max(0.7, avg / Math.max(1, m)))) as Rgb;
}

/**
 * Fills the part of the object a hand was covering by mirroring the visible side
 * (most objects are close to left-right symmetric). Marks the filled pixels in keep
 * and returns, for every pixel, the pixel whose color it should take.
 */
export function fillBehindHand(keep: Uint8Array, hand: Uint8Array, w: number, h: number): Int32Array {
  const source = new Int32Array(w * h);
  for (let i = 0; i < w * h; i++) source[i] = i;

  // Mirror axis from rows the hand does not touch, so it follows the uncovered object
  const handRow = new Uint8Array(h);
  for (let i = 0; i < w * h; i++) if (hand[i]) handRow[(i / w) | 0] = 1;
  let sum = 0, n = 0, allSum = 0, allN = 0;
  for (let i = 0; i < w * h; i++) {
    if (!keep[i]) continue;
    allSum += i % w;
    allN++;
    if (!handRow[(i / w) | 0]) {
      sum += i % w;
      n++;
    }
  }
  if (!allN) return source;
  const axis = n > allN * 0.2 ? sum / n : allSum / allN;

  // Only fill rows the object spans, never down the arm past the object
  let top = h, bottom = -1;
  for (let i = 0; i < w * h; i++) {
    if (!keep[i]) continue;
    const y = (i / w) | 0;
    if (y < top) top = y;
    if (y > bottom) bottom = y;
  }
  for (let i = 0; i < w * h; i++) {
    if (!hand[i] || keep[i]) continue;
    const y = (i / w) | 0;
    if (y < top || y > bottom) continue;
    const mx = Math.round(2 * axis - (i % w));
    if (mx < 0 || mx >= w) continue;
    const m = y * w + mx;
    if (keep[m] && !hand[m]) {
      keep[i] = 1;
      source[i] = m;
    }
  }
  return source;
}

const dist2 = (a: Rgb, b: Rgb) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

/** k-means palette, seeded from far-apart colors so small features (eyes, bands) survive. */
export function palette(points: Rgb[], k: number): Rgb[] {
  if (!points.length) return [];
  const centers: Rgb[] = [[...points[(points.length / 2) | 0]] as Rgb];
  const stride = Math.max(1, Math.floor(points.length / 2000));
  while (centers.length < Math.min(k, points.length)) {
    let best: Rgb | null = null;
    let bestD = -1;
    for (let p = 0; p < points.length; p += stride) {
      const d = Math.min(...centers.map((c) => dist2(points[p], c)));
      if (d > bestD) {
        bestD = d;
        best = points[p];
      }
    }
    if (!best || bestD <= 0) break;
    centers.push([...best] as Rgb);
  }
  for (let it = 0; it < 8; it++) {
    const sums = centers.map(() => [0, 0, 0, 0]);
    for (const p of points) {
      const s = sums[nearest(centers, p)];
      s[0] += p[0];
      s[1] += p[1];
      s[2] += p[2];
      s[3]++;
    }
    sums.forEach((s, i) => {
      if (s[3]) centers[i] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]];
    });
  }
  return centers;
}

export function nearest(centers: Rgb[], p: Rgb): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < centers.length; i++) {
    const d = dist2(p, centers[i]);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

export const toHex = (c: Rgb): string =>
  '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');

const luma = (c: Rgb) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];

/** The whole conversion on raw RGBA pixels (as from canvas getImageData). */
export function photoSpriteFromRgba(data: ArrayLike<number>, w: number, h: number, options: PhotoSpriteOptions = {}): PhotoSprite | null {
  if (w < 8 || h < 8 || data.length < w * h * 4) return null;
  const bg = backgroundMask(data, w, h, options.tolerance ?? 10, options.edge ?? 30);
  const hand = new Uint8Array(w * h);
  const mask = options.mask && options.mask.length === w * h ? options.mask : undefined;
  const keep = objectMask(data, w, h, bg, hand, mask);
  if (!keep) return null;
  const source = fillBehindHand(keep, hand, w, h);

  const gain = whiteBalance(data, w, h, bg);
  const color = (i: number): Rgb => {
    const s = source[i];
    return [0, 1, 2].map((k) => Math.max(0, Math.min(255, (data[s * 4 + k] * gain[k] - 128) * 1.1 + 128))) as Rgb;
  };

  const points: Rgb[] = [];
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let i = 0; i < w * h; i++) {
    if (!keep[i]) continue;
    points.push(color(i));
    const x = i % w;
    const y = (i / w) | 0;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  const centers = palette(points, options.colors ?? PALETTE_SIZE);
  if (!centers.length) return null;

  // Each sprite cell takes the most common palette color of the photo pixels inside it
  const bw = x1 - x0 + 1;
  const bh = y1 - y0 + 1;
  const scale = Math.max(bw / MAX_SPRITE_W, bh / MAX_SPRITE_H, 1);
  const gw = Math.max(1, Math.round(bw / scale));
  const gh = Math.max(1, Math.round(bh / scale));
  const cells: number[] = [];
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      const votes = new Array(centers.length).fill(0);
      let total = 0;
      let inside = 0;
      const ya = Math.floor(y0 + gy * scale), yb = Math.min(h, Math.max(ya + 1, Math.floor(y0 + (gy + 1) * scale)));
      const xa = Math.floor(x0 + gx * scale), xb = Math.min(w, Math.max(xa + 1, Math.floor(x0 + (gx + 1) * scale)));
      for (let y = ya; y < yb; y++) {
        for (let x = xa; x < xb; x++) {
          total++;
          const i = y * w + x;
          if (!keep[i]) continue;
          inside++;
          votes[nearest(centers, color(i))]++;
        }
      }
      cells.push(inside > total * 0.45 ? votes.indexOf(Math.max(...votes)) : -1);
    }
  }

  const colors = centers.map(toHex);
  const darkest = centers.reduce((a, b) => (luma(b) < luma(a) ? b : a));
  const outline = toHex(darkest.map((v) => v * 0.5) as Rgb);
  const cellAt = (x: number, y: number) => (x < 0 || y < 0 || x >= gw || y >= gh ? -1 : cells[y * gw + x]);
  const pixels = cells.map((c, i) => {
    if (c >= 0) return colors[c];
    const x = i % gw;
    const y = (i / gw) | 0;
    return NB.some(([dx, dy]) => cellAt(x + dx, y + dy) >= 0) ? outline : null;
  });

  // Face: centered on the object's widest mass, a little above the middle
  let sumX = 0, n = 0;
  cells.forEach((c, i) => {
    if (c >= 0) {
      sumX += i % gw;
      n++;
    }
  });
  if (!n) return null;
  return {
    w: gw,
    h: gh,
    pixels,
    palette: colors,
    outline,
    faceX: Math.round(sumX / n),
    faceY: Math.round(gh * 0.45)
  };
}

/** Middle of the color-based object guess: where the segmenter is told to look. */
export function objectCenter(data: ArrayLike<number>, w: number, h: number): { x: number; y: number } {
  const keep = objectMask(data, w, h, backgroundMask(data, w, h));
  if (!keep) return { x: w / 2, y: h * 0.45 };
  let sx = 0, sy = 0, n = 0;
  for (let i = 0; i < w * h; i++) {
    if (!keep[i]) continue;
    sx += i % w;
    sy += (i / w) | 0;
    n++;
  }
  return n ? { x: sx / n, y: sy / n } : { x: w / 2, y: h * 0.45 };
}

// ---- Muse Spark art direction ----------------------------------------------------

/** Letters used to show Muse Spark which palette color each sprite cell uses. */
export const SPRITE_LETTERS = 'abcdefgh';

/** Muse Spark's review, stored by color and position so it still fits if the sprite is redone. */
export interface SpriteDirection {
  recolor: [string, string][]; // [traced color, true color]
  remove: string[]; // traced colors that are not part of the object (hand, background)
  face?: { fx: number; fy: number }; // face center as a fraction of the sprite size
}

const HEX = /^#[0-9a-f]{6}$/i;
const hexRgb = (c: string): Rgb => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) as Rgb;

/** The sprite as text: one letter per palette color, # for outline, . for empty. */
export function spriteRows(s: PhotoSprite): string[] {
  const rows: string[] = [];
  for (let y = 0; y < s.h; y++) {
    let row = '';
    for (let x = 0; x < s.w; x++) {
      const p = s.pixels[y * s.w + x];
      if (!p) row += '.';
      else if (p === s.outline) row += '#';
      else row += SPRITE_LETTERS[s.palette.indexOf(p)] || '.';
    }
    rows.push(row);
  }
  return rows;
}

/** Checks a Muse Spark reply (colors and removals by letter, face by cell) against the sprite. */
export function parseDirection(raw: any, s: PhotoSprite): SpriteDirection | null {
  if (!raw || typeof raw !== 'object') return null;
  const letters = SPRITE_LETTERS.slice(0, s.palette.length);
  const recolor: [string, string][] = [];
  if (raw.colors && typeof raw.colors === 'object') {
    for (const [letter, hex] of Object.entries(raw.colors)) {
      const i = letters.indexOf(String(letter).toLowerCase());
      if (i >= 0 && typeof hex === 'string' && HEX.test(hex.trim())) recolor.push([s.palette[i], hex.trim().toLowerCase()]);
    }
  }
  // Removals are not taken from the review: judged from a color summary they hit real
  // parts of the object, and the segmenter already drops hands and background
  const remove: string[] = [];
  let face: SpriteDirection['face'];
  const fx = Number(raw.face?.x);
  const fy = Number(raw.face?.y);
  if (Number.isFinite(fx) && Number.isFinite(fy) && fx >= 0 && fy >= 0 && fx < s.w && fy < s.h) {
    face = { fx: (Math.round(fx) + 0.5) / s.w, fy: (Math.round(fy) + 0.5) / s.h };
  }
  if (!recolor.length && !remove.length && !face) return null;
  return { recolor, remove, face };
}

/** Applies Muse Spark's review: truer colors, stray parts removed, face moved. */
export function applyDirection(s: PhotoSprite, d: SpriteDirection): PhotoSprite {
  const near = (a: string, b: string) => HEX.test(a) && HEX.test(b) && dist2(hexRgb(a), hexRgb(b)) < 40 * 40;
  const removeIdx = new Set<number>();
  s.palette.forEach((c, i) => {
    if (d.remove.some((r) => near(r, c))) removeIdx.add(i);
  });
  let idx = s.pixels.map((p) => (p && p !== s.outline ? s.palette.indexOf(p) : -1));
  const filled = idx.filter((i) => i >= 0).length;
  const dropped = idx.filter((i) => removeIdx.has(i)).length;
  // Never let a review delete most of the creature
  if (dropped && dropped <= filled * 0.4) idx = idx.map((i) => (removeIdx.has(i) ? -1 : i));

  const palette = s.palette.map((c) => {
    const hit = d.recolor.find(([from]) => near(from, c));
    return hit ? hit[1] : c;
  });

  // Crop to what is left
  let x0 = s.w, y0 = s.h, x1 = -1, y1 = -1;
  idx.forEach((i, k) => {
    if (i < 0) return;
    const x = k % s.w;
    const y = (k / s.w) | 0;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  });
  if (x1 < 0) return s;
  x0 = Math.max(0, x0 - 1);
  y0 = Math.max(0, y0 - 1);
  x1 = Math.min(s.w - 1, x1 + 1);
  y1 = Math.min(s.h - 1, y1 + 1);
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const cells: number[] = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) cells.push(idx[y * s.w + x]);

  const used = [...new Set(cells.filter((i) => i >= 0))].map((i) => hexRgb(palette[i]));
  const darkest = used.length ? used.reduce((a, b) => (luma(b) < luma(a) ? b : a)) : hexRgb(s.outline);
  const outline = toHex(darkest.map((v) => v * 0.5) as Rgb);
  const cellAt = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? -1 : cells[y * w + x]);
  const pixels = cells.map((c, k) => {
    if (c >= 0) return palette[c];
    const x = k % w;
    const y = (k / w) | 0;
    return NB.some(([dx, dy]) => cellAt(x + dx, y + dy) >= 0) ? outline : null;
  });

  let faceX = s.faceX - x0;
  let faceY = s.faceY - y0;
  if (d.face) {
    const fx = Math.floor(d.face.fx * s.w) - x0;
    const fy = Math.floor(d.face.fy * s.h) - y0;
    if (cellAt(fx, fy) >= 0) {
      faceX = fx;
      faceY = fy;
    }
  }
  faceX = Math.max(2, Math.min(w - 3, faceX));
  faceY = Math.max(1, Math.min(h - 4, faceY));
  return { w, h, pixels, palette: [...new Set(cells.filter((i) => i >= 0))].map((i) => palette[i]), outline, faceX, faceY };
}

// ---- Loading in the browser ------------------------------------------------------

const DIRECTION_KEY = 'oddlings_sprite_direction_v2';
const MAX_DIRECTIONS = 60;

/** Short stable key for a photo data URL. */
export function photoKey(url: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < url.length; i++) {
    hash ^= url.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16) + ':' + url.length;
}

function loadDirections(): Record<string, SpriteDirection> {
  try {
    const raw = JSON.parse(localStorage.getItem(DIRECTION_KEY) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

function saveDirection(key: string, d: SpriteDirection): void {
  try {
    const all = loadDirections();
    delete all[key];
    all[key] = d;
    const keys = Object.keys(all);
    for (const k of keys.slice(0, Math.max(0, keys.length - MAX_DIRECTIONS))) delete all[k];
    localStorage.setItem(DIRECTION_KEY, JSON.stringify(all));
  } catch {
    // storage full or blocked: the review is simply asked for again next time
  }
}

let segmenterJob: Promise<any | null> | null = null;

function getSegmenter(): Promise<any | null> {
  if (!segmenterJob) {
    segmenterJob = (async () => {
      try {
        const vision: any = await import(/* @vite-ignore */ MEDIAPIPE_BUNDLE);
        const files = await vision.FilesetResolver.forVisionTasks(MEDIAPIPE_WASM);
        return await vision.InteractiveSegmenter.createFromOptions(files, {
          baseOptions: { modelAssetPath: MEDIAPIPE_MODEL },
          outputCategoryMask: true,
          outputConfidenceMasks: false
        });
      } catch {
        return null; // offline or blocked: the color-based cut-out is used instead
      }
    })();
  }
  return segmenterJob;
}

/** AI cut-out of the object under a point; null if the segmenter is unavailable or unsure. */
async function segmentObject(canvas: HTMLCanvasElement, point: { x: number; y: number }): Promise<Uint8Array | null> {
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), SEGMENT_TIMEOUT_MS));
  const segmenter = await Promise.race([getSegmenter(), timeout]);
  if (!segmenter) return null;
  const w = canvas.width;
  const h = canvas.height;
  return new Promise((resolve) => {
    try {
      segmenter.segment(canvas, { keypoint: { x: point.x / w, y: point.y / h } }, (result: any) => {
        const m = result?.categoryMask;
        if (!m || m.width !== w || m.height !== h) return resolve(null);
        const values: Uint8Array = m.getAsUint8Array();
        const objectValue = values[Math.round(point.y) * w + Math.round(point.x)];
        const out = new Uint8Array(w * h);
        let area = 0;
        for (let i = 0; i < w * h; i++) {
          out[i] = values[i] === objectValue ? 1 : 0;
          area += out[i];
        }
        const share = area / (w * h);
        resolve(share > 0.05 && share < 0.95 ? out : null);
      });
    } catch {
      resolve(null);
    }
  });
}

/** Traces a sprite from an image; the AI segmenter is only needed for real photos. */
async function convertPhoto(url: string, segment = true): Promise<PhotoSprite | null> {
  const img = new Image();
  const loaded = await new Promise<boolean>((resolve) => {
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
  if (!loaded) return null;
  try {
    const s = Math.min(1, WORK_SIZE / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * s));
    const h = Math.max(1, Math.round(img.height * s));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    const mask = segment ? await segmentObject(canvas, objectCenter(data, w, h)) : null;
    return (mask && photoSpriteFromRgba(data, w, h, { mask })) || photoSpriteFromRgba(data, w, h);
  } catch {
    return null;
  }
}

const JOB_POLL_MS = 2500;
const JOB_WAIT_MS = 120000;

/** Starts a server job and waits for its result; null if it fails or is unavailable. */
export async function runServerJob(path: string, body: unknown): Promise<any | null> {
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const failure = await res.json().catch(() => null);
      throw new Error(failure?.error || 'Our Oddlings are busy. Please try again later.');
    }
    const jobId = (await res.json())?.jobId;
    if (typeof jobId !== 'string') return null;
    const deadline = Date.now() + JOB_WAIT_MS;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, JOB_POLL_MS));
      const poll = await fetch(path + '/' + encodeURIComponent(jobId));
      if (!poll.ok) throw new Error('This request was interrupted. Please try again.');
      const job = await poll.json().catch(() => null);
      if (job?.status === 'done') return job.result ?? null;
      if (job?.status !== 'pending') throw new Error(job?.error || 'This request was interrupted. Please try again.');
    }
    throw new Error('This request took too long. Please try again.');
  } catch (error) {
    // Optional automatic creature art keeps the local sprite; paid flows surface the retry error.
    if (path === '/api/meta/fusion-art' || (body as any)?.kind === 'item') throw error;
    return null;
  }
}

/** Asks Muse Spark to review the traced sprite's colors and face position. */
async function requestDirection(url: string, sprite: PhotoSprite, objectName: string): Promise<SpriteDirection | null> {
  const result = await runServerJob('/api/baseten/sprite', { imageBase64: url, rows: spriteRows(sprite), palette: sprite.palette, objectName });
  return result ? parseDirection(result, sprite) : null;
}

const ART_KEY = 'oddlings_creature_art_v4';
const MAX_ART = 30;
const ART_CACHE_SIZE = 192; // the art is saved small: the sprite is at most 28 pixels wide

function loadArt(): Record<string, string> {
  try {
    const raw = JSON.parse(localStorage.getItem(ART_KEY) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

// The finished cut-out (background removed) is saved too, so a creature appears as its art the moment it
// is shown, without waiting for the drawing to be processed again
const CUTOUT_KEY = ART_KEY + '_cutout3'; // v2: holes such as a mug handle's are cut out too
type Cutout = { art: string; artW: number; artH: number };

function loadCutouts(): Record<string, Cutout> {
  try {
    const raw = JSON.parse(localStorage.getItem(CUTOUT_KEY) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

function saveCutout(key: string, cut: Cutout): void {
  try {
    const all = loadCutouts();
    delete all[key];
    all[key] = cut;
    const keys = Object.keys(all);
    for (const k of keys.slice(0, Math.max(0, keys.length - MAX_ART))) delete all[k];
    localStorage.setItem(CUTOUT_KEY, JSON.stringify(all));
  } catch {
    // storage full: the cut-out is simply made again next time
  }
}

const artSprite = (cut: Cutout): PhotoSprite => ({ w: 1, h: 1, pixels: [null], palette: [], outline: '#000000', faceX: 0, faceY: 0, ...cut });
const PENDING_SPRITE: PhotoSprite = { w: 1, h: 1, pixels: [null], palette: [], outline: '#000000', faceX: 0, faceY: 0, pending: true };

// Whether Muse Image can draw right now (its key is set), asked once per page
let museImageReady: Promise<boolean> | null = null;
const canDrawArt = () =>
  (museImageReady ??= fetch('/api/meta/status')
    .then((r) => r.json())
    .then((s) => !!s?.museImage)
    .catch(() => false));

function saveArt(key: string, art: string): void {
  try {
    const all = loadArt();
    delete all[key];
    all[key] = art;
    const keys = Object.keys(all);
    for (const k of keys.slice(0, Math.max(0, keys.length - MAX_ART))) delete all[k];
    localStorage.setItem(ART_KEY, JSON.stringify(all));
  } catch {
    // storage full: the art is simply drawn again next time
  }
}

/** Shrinks generated art to a small PNG for saving. */
async function shrinkArt(url: string): Promise<string | null> {
  const img = new Image();
  const ok = await new Promise<boolean>((resolve) => {
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
  if (!ok) return null;
  const s = Math.min(1, ART_CACHE_SIZE / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.width * s));
  canvas.height = Math.max(1, Math.round(img.height * s));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}

/**
 * Muse Image's art with its plain background made see-through and the empty edges cropped,
 * so the drawing can stand in the world on its own.
 */
async function cutOutArt(url: string): Promise<{ art: string; artW: number; artH: number } | null> {
  const img = new Image();
  const ok = await new Promise<boolean>((resolve) => {
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
  if (!ok || !img.width || !img.height) return null;
  const w = img.width;
  const h = img.height;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, w, h);
  const d = data.data;
  // The background is whatever color the corners are (white by the prompt); fill it from the edges
  const br = d[0], bg = d[1], bb = d[2];
  const isBg = (i: number) => Math.hypot(d[i] - br, d[i + 1] - bg, d[i + 2] - bb) < 48;
  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const p = stack.pop()!;
    if (seen[p] || !isBg(p * 4)) continue;
    seen[p] = 1;
    d[p * 4 + 3] = 0;
    const x = p % w;
    if (x > 0) stack.push(p - 1);
    if (x < w - 1) stack.push(p + 1);
    if (p >= w) stack.push(p - w);
    if (p < w * (h - 1)) stack.push(p + w);
  }
  // Background showing through a hole (inside a mug handle, between legs) is not reached from the edges.
  // A patch of the exact background color that is ringed almost entirely by the dark outline is such a hole;
  // white parts of the object itself sit next to its own colors, so they stay.
  const isHole = (i: number) => d[i + 3] !== 0 && Math.hypot(d[i] - br, d[i + 1] - bg, d[i + 2] - bb) < 24;
  const isInk = (i: number) => d[i + 3] !== 0 && d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11 < 110;
  const region = new Uint8Array(w * h);
  for (let start = 0; start < w * h; start++) {
    if (region[start] || !isHole(start * 4)) continue;
    const cells: number[] = [];
    let edge = 0, ink = 0;
    const todo = [start];
    region[start] = 1;
    while (todo.length) {
      const p = todo.pop()!;
      cells.push(p);
      const x = p % w;
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w]) {
        if (q < 0 || q >= w * h || region[q]) continue;
        if (isHole(q * 4)) { region[q] = 1; todo.push(q); }
        else if (d[q * 4 + 3] !== 0) { edge++; if (isInk(q * 4)) ink++; }
      }
    }
    if (cells.length >= 4 && cells.length < w * h * 0.15 && edge > 0 && ink / edge >= 0.85) {
      for (const p of cells) d[p * 4 + 3] = 0;
    }
  }
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] === 0) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  ctx.putImageData(data, 0, 0);
  const out = document.createElement('canvas');
  out.width = maxX - minX + 1;
  out.height = maxY - minY + 1;
  const octx = out.getContext('2d');
  if (!octx) return null;
  octx.drawImage(canvas, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
  return { art: out.toDataURL('image/png'), artW: out.width, artH: out.height };
}

/** Meta Muse Image redraws the photo as a creature in the game's house style. */
async function requestArt(url: string, objectName: string, colors: string[] = []): Promise<string | null> {
  const result = await runServerJob('/api/meta/creature-art', { imageBase64: url, objectName, colors });
  const image = typeof result?.image === 'string' && result.image.startsWith('data:image/') ? result.image : null;
  return image ? shrinkArt(image) : null;
}

/**
 * Fusion Lab: Muse Image draws one hybrid from both parents' pictures. The drawing is saved as the hybrid's own
 * art (keyed by the returned picture), so the hybrid shows it at once and it is never drawn again.
 */
export async function drawFusionArt(params: { imageA: string; imageB: string; nameA: string; nameB: string; hybridName: string; traits?: string[] }): Promise<string | null> {
  const result = await runServerJob('/api/meta/fusion-art', params);
  const image = typeof result?.image === 'string' && result.image.startsWith('data:image/') ? result.image : null;
  const art = image ? await shrinkArt(image) : null;
  if (art) saveArt(photoKey(art), art);
  return art;
}

/**
 * Photo items: Muse Image redraws the photo as a placeable pixel item. The background is cut away and the result
 * is placed bottom-centered on a 128 px square so it stores compactly and sits on the ground like other props.
 */
export async function drawItemArt(photo: string, objectName: string, colors: string[] = []): Promise<string | null> {
  const result = await runServerJob('/api/meta/creature-art', { imageBase64: photo, objectName, colors, kind: 'item' });
  const image = typeof result?.image === 'string' && result.image.startsWith('data:image/') ? result.image : null;
  const shrunk = image ? await shrinkArt(image) : null;
  const cut = shrunk ? await cutOutArt(shrunk) : null;
  if (!cut) return null;
  const img = new Image();
  const ok = await new Promise<boolean>((resolve) => {
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = cut.art;
  });
  if (!ok) return null;
  const SIDE = 128;
  const s = Math.min(SIDE / cut.artW, SIDE / cut.artH);
  const w = Math.max(1, Math.round(cut.artW * s));
  const h = Math.max(1, Math.round(cut.artH * s));
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIDE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, Math.floor((SIDE - w) / 2), SIDE - h, w, h);
  return canvas.toDataURL('image/png');
}

type Listener = (sprite: PhotoSprite | null) => void;
const latest = new Map<string, PhotoSprite | null>();
const listeners = new Map<string, Set<Listener>>();
const started = new Set<string>();

function publish(url: string, sprite: PhotoSprite | null): void {
  latest.set(url, sprite);
  listeners.get(url)?.forEach((l) => l(sprite));
}

async function build(url: string, objectName: string): Promise<void> {
  const key = photoKey(url);
  // A finished cut-out was already shown by peekPhotoSprite; nothing else to do
  if (loadCutouts()[key]) return;
  // Muse Image art saved earlier: cut it out once and keep that too
  const savedArt = loadArt()[key];
  if (savedArt) {
    const cut = await cutOutArt(savedArt);
    if (cut) {
      saveCutout(key, cut);
      return publish(url, artSprite(cut));
    }
  }

  // While Muse Image draws, show a soft placeholder rather than a rough traced sprite that then changes
  const drawing = url.startsWith('data:') && (await canDrawArt());
  const base = await convertPhoto(url);
  publish(url, drawing ? PENDING_SPRITE : base);
  if (drawing) {
    // The traced sprite's palette is the photo's main colors, so Muse Image is told to use them
    const art = await requestArt(url, objectName, base?.palette || []);
    const cut = art ? await cutOutArt(art) : null;
    if (art && cut) {
      saveArt(key, art);
      saveCutout(key, cut);
      return publish(url, artSprite(cut));
    }
    // Muse Image failed: fall back to the traced sprite
    publish(url, base);
  }
  if (!url.startsWith('data:')) return;

  // No Muse Image (no key or it failed): Muse Spark reviews the traced sprite instead
  if (!base) return;
  let direction: SpriteDirection | null = loadDirections()[key] || null;
  if (!direction) {
    direction = await requestDirection(url, base, objectName);
    if (direction) saveDirection(key, direction);
  }
  if (direction) publish(url, applyDirection(base, direction));
}

/** The latest sprite for a photo, or undefined while it is still being made. */
export function peekPhotoSprite(url: string | undefined | null): PhotoSprite | null | undefined {
  if (!PHOTO_SPRITES_ENABLED || !url) return null;
  if (!latest.has(url) && typeof localStorage !== 'undefined') {
    // A creature with saved art shows it on its very first frame
    const cut = loadCutouts()[photoKey(url)];
    // A photo without art yet starts as the placeholder, so it never flashes a generic creature first
    if (cut) latest.set(url, artSprite(cut));
    else if (url.startsWith('data:')) latest.set(url, PENDING_SPRITE);
  }
  return latest.get(url);
}

/**
 * Calls back with the photo's sprite: first the traced version, then Muse Spark's
 * reviewed version. Each photo is converted and reviewed once (reviews are saved).
 */
export function watchPhotoSprite(url: string | undefined | null, objectName: string, onSprite: Listener): () => void {
  if (!PHOTO_SPRITES_ENABLED || !url || typeof document === 'undefined') {
    onSprite(null);
    return () => {};
  }
  let set = listeners.get(url);
  if (!set) listeners.set(url, (set = new Set()));
  set.add(onSprite);
  if (latest.has(url)) onSprite(latest.get(url) ?? null);
  if (!started.has(url)) {
    started.add(url);
    void build(url, objectName);
  }
  return () => {
    set?.delete(onSprite);
  };
}
