/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The World's background scenery, drawn as real low-resolution pixel art: rounded rocky spires built from
 * stone blocks, leafy clumps draped over their ledges, mist wrapping around them, and a forest in front.
 * It is drawn once into a small image and shown scaled up with crisp pixels, like a 16-bit game background.
 */

export const BACKDROP_W = 288;
export const BACKDROP_H = 150;

interface Tones {
  outline: string;
  dark: string;
  base: string;
  light: string;
  shine: string;
}

// Far things are paler and bluer, so the scene has depth like a misty jungle
const FAR_LEAVES: Tones = { outline: '#5f8f9a', dark: '#6a9ba2', base: '#78a8aa', light: '#88b6b2', shine: '#9cc4bd' };
const FAR_STONE: Tones = { outline: '#557f90', dark: '#5f8a9a', base: '#6b96a4', light: '#7aa3ae', shine: '#8bb1b9' };
const LEAVES: Tones = { outline: '#0f2c2c', dark: '#1b4a3f', base: '#2a6a4f', light: '#3f8a5a', shine: '#68b06a' };
const NEAR_LEAVES: Tones = { outline: '#0c2420', dark: '#173f30', base: '#235a3c', light: '#367a45', shine: '#5aa35a' };
const STONE: Tones = { outline: '#16222f', dark: '#26384a', base: '#34495c', light: '#46607a', shine: '#5b7894' };
const TRUNK = { dark: '#2e1d14', base: '#4a3022', light: '#65432d' };
const MIST = { edge: 'rgba(150, 186, 206, 0.55)', body: 'rgba(176, 206, 222, 0.7)', top: 'rgba(214, 232, 242, 0.75)' };

/** A small seeded random number generator, so the same world always gets the same scenery */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Dot = (x: number, y: number, color: string) => void;
type Blob = { x: number; y: number; r: number };

/** A clump of round leaf blobs: outlines first so blobs merge into one leafy shape, then shaded fills */
function leafClump(dot: Dot, rand: () => number, blobs: Blob[], pal: Tones) {
  const inside = (dx: number, dy: number, r: number) => dx * dx + dy * dy * 1.35 <= r * r + r * 0.5;
  for (const b of blobs) {
    const R = b.r + 1;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) if (inside(dx, dy, R)) dot(b.x + dx, b.y + dy, pal.outline);
  }
  for (const b of blobs) {
    for (let dy = -b.r; dy <= b.r; dy++) {
      for (let dx = -b.r; dx <= b.r; dx++) {
        if (!inside(dx, dy, b.r)) continue;
        // Light comes from the top left
        const t = (dx * 0.45 + dy * 0.9) / b.r;
        let c = t < -0.5 ? pal.light : t > 0.3 ? pal.dark : pal.base;
        const n = rand();
        if (t < -0.35 && n < 0.18) c = pal.shine;
        else if (n < 0.08) c = pal.dark; // little leaf gaps give it texture
        dot(b.x + dx, b.y + dy, c);
      }
    }
  }
}

/** Leaves draped over a ledge: a wide clump on top and smaller blobs hanging down below it */
function drape(dot: Dot, rand: () => number, x: number, y: number, width: number, pal: Tones) {
  const blobs: Blob[] = [];
  for (let k = 0; k < width; k += 3 + Math.floor(rand() * 3)) blobs.push({ x: x + k, y: y - 1 + Math.floor(rand() * 2), r: 2 + Math.floor(rand() * 3) });
  const hangs = 1 + Math.floor(width / 7);
  for (let k = 0; k < hangs; k++) {
    const hx = x + Math.floor(rand() * width);
    blobs.push({ x: hx, y: y + 3 + Math.floor(rand() * 2), r: 2 });
    if (rand() < 0.5) blobs.push({ x: hx + (rand() < 0.5 ? -1 : 1), y: y + 6, r: 1 });
  }
  leafClump(dot, rand, blobs, pal);
}

/** A leafy tree: a short trunk and a tall clump of blobs */
function tree(dot: Dot, rand: () => number, x: number, groundY: number, size: number, pal: Tones) {
  const trunkH = Math.round(size * 0.8) + 2;
  for (let y = groundY - trunkH; y < groundY; y++) {
    dot(x - 1, y, TRUNK.light);
    dot(x, y, TRUNK.base);
    dot(x + 1, y, TRUNK.dark);
  }
  const cy = groundY - trunkH - Math.round(size * 0.4);
  leafClump(
    dot,
    rand,
    [
      { x, y: cy, r: size },
      { x: x - Math.round(size * 0.7), y: cy + Math.round(size * 0.5), r: Math.max(2, Math.round(size * 0.6)) },
      { x: x + Math.round(size * 0.75), y: cy + Math.round(size * 0.45), r: Math.max(2, Math.round(size * 0.65)) },
      { x: x + 1, y: cy - Math.round(size * 0.75), r: Math.max(2, Math.round(size * 0.6)) }
    ],
    pal
  );
}

/**
 * A rounded rocky spire built from stone blocks: wide at the bottom, narrowing to a domed top, with leaves
 * draped over its ledges and a tree on top. Far spires are paler and simpler.
 */
function spire(dot: Dot, rand: () => number, cx: number, top: number, halfTop: number, halfBase: number, far: boolean) {
  const stone = far ? FAR_STONE : STONE;
  const leaves = far ? FAR_LEAVES : LEAVES;
  const bottom = BACKDROP_H;
  const p1 = rand() * 6;
  const p2 = rand() * 6;
  const halfAt = (y: number) => {
    const t = Math.max(0, (y - top) / (bottom - top));
    // Domed top: the first rows round off like a hill
    const dome = y - top < halfTop ? Math.sqrt(Math.max(0, 1 - Math.pow(1 - (y - top) / halfTop, 2))) : 1;
    return (halfTop + (halfBase - halfTop) * Math.pow(t, 0.45)) * dome;
  };
  const leftAt = (y: number) => Math.round(cx - halfAt(y) + 1.3 * Math.sin(y / 6 + p1));
  const rightAt = (y: number) => Math.round(cx + halfAt(y) + 1.3 * Math.sin(y / 7 + p2));

  // Stone blocks: rows 4-5 pixels tall, each row offset like a rough wall, each block a slightly different tone
  let rowTop = top;
  while (rowTop < bottom) {
    const rowH = 4 + Math.floor(rand() * 2);
    let bx = cx - halfBase - 4 - Math.floor(rand() * 6);
    while (bx < cx + halfBase + 4) {
      const bw = 5 + Math.floor(rand() * 6);
      const tone = rand();
      for (let y = rowTop; y < Math.min(bottom, rowTop + rowH); y++) {
        const L = leftAt(y);
        const R = rightAt(y);
        for (let x = bx; x < bx + bw; x++) {
          if (x < L || x > R) continue;
          const u = (x - L) / Math.max(1, R - L);
          let c: string;
          if (x === L || x === R || y === rowTop || x === bx) c = stone.outline; // mortar and silhouette
          else if (y === rowTop + 1 && x < bx + bw - 1) c = u < 0.55 ? stone.shine : stone.light; // lit top edge of a block
          else if (x === bx + bw - 1 || y === rowTop + rowH - 1) c = stone.dark;
          else c = tone < 0.25 ? stone.dark : tone > 0.8 ? stone.light : stone.base;
          // The right side of the spire is in shade
          if (u > 0.68 && c !== stone.outline && (x + y) % 2 === 0) c = stone.dark;
          if (u > 0.82 && c !== stone.outline) c = stone.dark;
          dot(x, y, c);
        }
      }
      bx += bw;
    }
    rowTop += rowH;
  }

  // Leaves on the domed top, then draped over ledges all the way down
  const topHalf = Math.max(4, halfTop);
  const crown: Blob[] = [];
  for (let k = -topHalf; k <= topHalf; k += 3) crown.push({ x: cx + k, y: top + 2 + Math.abs(k) / 3 + Math.floor(rand() * 2), r: 3 + Math.floor(rand() * 2) });
  leafClump(dot, rand, crown, leaves);
  for (let y = top + 10 + Math.floor(rand() * 5); y < bottom - 6; y += (far ? 14 : 9) + Math.floor(rand() * 7)) {
    const L = leftAt(y);
    const R = rightAt(y);
    const w = R - L;
    // Mostly on the sides, hanging over the edge, sometimes across the middle
    if (rand() < 0.75) drape(dot, rand, L - 3, y, Math.max(6, Math.round(w * (0.25 + rand() * 0.25))), leaves);
    if (rand() < 0.7) drape(dot, rand, R - Math.round(w * (0.2 + rand() * 0.2)), y + 3, Math.max(6, Math.round(w * 0.3)), leaves);
    if (!far && rand() < 0.3) drape(dot, rand, L + Math.round(w * 0.35), y + 5, Math.round(w * 0.3), leaves);
  }
  if (!far) tree(dot, rand, cx + Math.round((rand() - 0.5) * halfTop), top + 1, 4 + Math.floor(rand() * 2), leaves);
}

/** Soft pixel clouds of mist that wrap around the spires */
function mist(dot: Dot, rand: () => number, y: number, from: number, to: number) {
  // Each puff is a wide low base with a couple of round bumps on top, painted once per pixel so it stays even
  const puffs: { x: number; y: number; rx: number; ry: number }[] = [];
  for (let x = from; x < to; x += 12 + Math.floor(rand() * 10)) {
    const cy = y + Math.floor(rand() * 4);
    const rx = 9 + Math.floor(rand() * 6);
    puffs.push({ x, y: cy, rx, ry: 4 });
    puffs.push({ x: x - Math.round(rx * 0.35), y: cy - 3, rx: 5 + Math.floor(rand() * 2), ry: 4 });
    puffs.push({ x: x + Math.round(rx * 0.3), y: cy - 4, rx: 4 + Math.floor(rand() * 3), ry: 4 });
  }
  const seen = new Set<string>();
  for (const p of puffs) {
    for (let dy = -p.ry; dy <= p.ry; dy++) {
      for (let dx = -p.rx; dx <= p.rx; dx++) {
        const d = (dx * dx) / (p.rx * p.rx) + (dy * dy) / (p.ry * p.ry);
        const key = p.x + dx + ',' + (p.y + dy);
        if (d > 1 || seen.has(key)) continue;
        seen.add(key);
        const c = d > 0.8 ? ((p.x + dx + p.y + dy) % 2 === 0 ? MIST.edge : '') : dy < -p.ry / 3 ? MIST.top : MIST.body;
        if (c) dot(p.x + dx, p.y + dy, c);
      }
    }
  }
}

/** The forest along the bottom, in front of the spires */
function nearForest(dot: Dot, rand: () => number) {
  const top = BACKDROP_H - 30;
  const back: Blob[] = [];
  for (let x = -4; x < BACKDROP_W + 6; x += 7 + Math.floor(rand() * 4)) back.push({ x, y: top + 6 + Math.floor(rand() * 6), r: 6 + Math.floor(rand() * 4) });
  leafClump(dot, rand, back, LEAVES);
  const front: Blob[] = [];
  for (let x = -2; x < BACKDROP_W + 6; x += 9 + Math.floor(rand() * 5)) front.push({ x, y: top + 16 + Math.floor(rand() * 5), r: 7 + Math.floor(rand() * 4) });
  leafClump(dot, rand, front, NEAR_LEAVES);
  for (let x = 0; x < BACKDROP_W; x++) for (let y = BACKDROP_H - 6; y < BACKDROP_H; y++) dot(x, y, NEAR_LEAVES.outline);
}

/** Paints the whole scene with the given pixel function (exported so tests can draw it without a canvas) */
export function paintPixelBackdrop(dot: Dot, seed = 7) {
  const rand = seeded(seed);
  // Far, pale spires and their mist
  spire(dot, rand, 120, 44, 7, 16, true);
  spire(dot, rand, 156, 58, 6, 14, true);
  spire(dot, rand, 262, 50, 6, 13, true);
  mist(dot, rand, 92, 96, 180);
  // Big spires in front
  spire(dot, rand, 34, 26, 12, 30, false);
  spire(dot, rand, 84, 52, 7, 17, false);
  spire(dot, rand, 200, 18, 13, 32, false);
  spire(dot, rand, 252, 44, 9, 22, false);
  mist(dot, rand, 74, -6, 70);
  mist(dot, rand, 66, 172, 236);
  mist(dot, rand, 98, 228, BACKDROP_W + 8);
  nearForest(dot, rand);
}

const cache = new Map<number, string>();

/** The scenery as an image URL, drawn once per seed; empty where there is no canvas (tests, old browsers) */
export function pixelBackdropUrl(seed = 7): string {
  const hit = cache.get(seed);
  if (hit !== undefined) return hit;
  let url = '';
  try {
    const canvas = typeof document === 'undefined' ? null : document.createElement('canvas');
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      canvas.width = BACKDROP_W;
      canvas.height = BACKDROP_H;
      paintPixelBackdrop((x, y, color) => {
        if (x < 0 || y < 0 || x >= BACKDROP_W || y >= BACKDROP_H) return;
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
      }, seed);
      url = canvas.toDataURL('image/png');
    }
  } catch {
    url = '';
  }
  cache.set(seed, url);
  return url;
}
