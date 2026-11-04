/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Photo-made items: a 16x16 pixel sprite plus a name and description.
 * Meta Muse Spark designs the sprite from the photo; when its grid is unusable
 * the sprite is made locally from the photo's own pixels.
 */

export const SPRITE_SIZE = 16;
export const MAX_ITEMS = 12;
export const ITEMS_KEY = 'oddlings_custom_items_v1';
export const MAX_SPRITE_DATA_URL = 60_000; // room for Meta's 128 px item drawings

export type ItemCategory = 'light' | 'seat' | 'plant' | 'toy' | 'decor';
export const ITEM_CATEGORIES: ItemCategory[] = ['light', 'seat', 'plant', 'toy', 'decor'];

export interface SpriteGrid {
  rows: string[]; // 16 strings of 16 chars: '.' transparent, '0'-'7' palette index
  palette: string[]; // 2 to 8 lowercase #rrggbb colors
}

export interface ItemDraft {
  name: string;
  description: string;
  category: ItemCategory;
  glow: boolean;
  /** Real-world height Muse Spark estimated from the photo, in cm; sets the item's size in the World */
  heightCm?: number;
}

export interface CustomItem extends ItemDraft {
  id: string;
  sprite: string; // PNG data URL
  source: 'muse-spark' | 'local';
  model?: string;
  createdAt: number;
}

const HEX = /^#[0-9a-f]{6}$/;

const clip = (s: unknown, max: number): string =>
  typeof s === 'string' ? s.replace(/[\u0000-\u001f]+/g, ' ').replace(/[<>{}]/g, '').replace(/\s+/g, ' ').trim().slice(0, max) : '';

/* ------------------------------ drafts ------------------------------ */

export function sanitizeDraft(raw: any): ItemDraft | null {
  const name = clip(raw?.name, 32);
  if (name.length < 2) return null;
  const category = ITEM_CATEGORIES.includes(raw?.category) ? (raw.category as ItemCategory) : 'decor';
  return {
    name,
    description: clip(raw?.description, 120),
    category,
    glow: raw?.glow === true,
    ...(Number.isFinite(Number(raw?.heightCm)) && Number(raw.heightCm) >= 1 && Number(raw.heightCm) <= 400 ? { heightCm: Math.round(Number(raw.heightCm)) } : {})
  };
}

/**
 * How many World tiles tall an item stands, from its real height. Cozy-game scale, gently compressed so a
 * mug (10 cm) is about 2 tiles, a plush (25 cm) about 2.5, a chair (90 cm) 4, and a door (200 cm) 5.
 * Items without a height keep the old size.
 */
export function itemTiles(heightCm?: number): number {
  if (!heightCm) return 2.5;
  return Math.max(1.2, Math.min(7, Math.round(0.9 * Math.cbrt(heightCm) * 10) / 10));
}

/* ------------------------------ sprites ------------------------------ */

/** Validates a model-drawn grid; null when it cannot be used as a sprite. */
export function parseSpriteGrid(pixels: unknown, palette: unknown): SpriteGrid | null {
  if (!Array.isArray(pixels) || pixels.length !== SPRITE_SIZE) return null;
  if (!Array.isArray(palette) || palette.length < 2 || palette.length > 8) return null;
  const pal = palette.map((p) => (typeof p === 'string' ? p.trim().toLowerCase() : ''));
  if (!pal.every((p) => HEX.test(p))) return null;

  const rows: string[] = [];
  let opaque = 0;
  const used = new Set<string>();
  for (const r of pixels) {
    if (typeof r !== 'string') return null;
    const row = r.trim().replace(/[ _]/g, '.');
    if (row.length !== SPRITE_SIZE) return null;
    for (const ch of row) {
      if (ch === '.') continue;
      const idx = ch.charCodeAt(0) - 48;
      if (idx < 0 || idx >= pal.length) return null;
      opaque++;
      used.add(ch);
    }
    rows.push(row);
  }
  const fraction = opaque / (SPRITE_SIZE * SPRITE_SIZE);
  if (fraction < 0.12 || fraction > 0.92 || used.size < 2) return null;
  return { rows, palette: pal };
}

export function gridToRgba(grid: SpriteGrid): Uint8ClampedArray {
  const out = new Uint8ClampedArray(SPRITE_SIZE * SPRITE_SIZE * 4);
  grid.rows.forEach((row, y) => {
    for (let x = 0; x < SPRITE_SIZE; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      const hex = grid.palette[ch.charCodeAt(0) - 48];
      const o = (y * SPRITE_SIZE + x) * 4;
      out[o] = parseInt(hex.slice(1, 3), 16);
      out[o + 1] = parseInt(hex.slice(3, 5), 16);
      out[o + 2] = parseInt(hex.slice(5, 7), 16);
      out[o + 3] = 255;
    }
  });
  return out;
}

interface RgbaImage {
  data: ArrayLike<number>;
  width: number;
  height: number;
}

const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const toHex = (c: number[]) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

/**
 * Local fallback: turns the photo's own pixels into a sprite. Crops the center square,
 * averages it down to 16x16, removes a plain background by flood fill from the edges
 * (or keeps a rounded center when the background is busy), then limits to 6 colors.
 */
export function photoToSpriteGrid(img: RgbaImage): SpriteGrid {
  const N = SPRITE_SIZE;
  const side = Math.max(1, Math.min(img.width, img.height));
  const x0 = Math.floor((img.width - side) / 2);
  const y0 = Math.floor((img.height - side) / 2);

  // 1. Box-average each cell
  const cells: number[][] = [];
  for (let cy = 0; cy < N; cy++) {
    for (let cx = 0; cx < N; cx++) {
      const sx0 = x0 + Math.floor((cx * side) / N);
      const sx1 = x0 + Math.max(Math.floor(((cx + 1) * side) / N), Math.floor((cx * side) / N) + 1);
      const sy0 = y0 + Math.floor((cy * side) / N);
      const sy1 = y0 + Math.max(Math.floor(((cy + 1) * side) / N), Math.floor((cy * side) / N) + 1);
      let r = 0, g = 0, b = 0, n = 0;
      for (let y = sy0; y < sy1; y++) {
        for (let x = sx0; x < sx1; x++) {
          const o = (y * img.width + x) * 4;
          const a = img.data[o + 3] / 255;
          r += img.data[o] * a;
          g += img.data[o + 1] * a;
          b += img.data[o + 2] * a;
          n += a;
        }
      }
      cells.push(n > 0 ? [r / n, g / n, b / n] : [255, 255, 255]);
    }
  }

  // 2. Background removal: flood fill from the border through cells close to the border color
  const border: number[][] = [];
  for (let i = 0; i < N; i++) border.push(cells[i], cells[(N - 1) * N + i], cells[i * N], cells[i * N + N - 1]);
  const bg = [0, 1, 2].map((ch) => [...border].map((c) => c[ch]).sort((a, b) => a - b)[Math.floor(border.length / 2)]);
  const TOL = 56;
  const transparent = new Array<boolean>(N * N).fill(false);
  const stack: number[] = [];
  const push = (i: number) => {
    if (!transparent[i] && dist(cells[i], bg) <= TOL) {
      transparent[i] = true;
      stack.push(i);
    }
  };
  for (let i = 0; i < N; i++) {
    push(i);
    push((N - 1) * N + i);
    push(i * N);
    push(i * N + N - 1);
  }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % N;
    const y = Math.floor(i / N);
    if (x > 0) push(i - 1);
    if (x < N - 1) push(i + 1);
    if (y > 0) push(i - N);
    if (y < N - 1) push(i + N);
  }
  let opaque = transparent.filter((t) => !t).length;

  // Busy background (nothing or everything removed): keep a rounded center instead
  if (opaque < N * N * 0.08 || opaque > N * N * 0.92) {
    for (let i = 0; i < N * N; i++) {
      const dx = (i % N) - (N - 1) / 2;
      const dy = Math.floor(i / N) - (N - 1) / 2;
      transparent[i] = Math.hypot(dx / 7.6, dy / 7.6) > 1;
    }
    opaque = transparent.filter((t) => !t).length;
  }

  // 3. Limit to 6 colors: posterize, take the most common, snap the rest to the nearest
  const keep = cells.map((c, i) => ({ c, i })).filter(({ i }) => !transparent[i]);
  const buckets = new Map<string, { sum: number[]; n: number }>();
  for (const { c } of keep) {
    const key = c.map((v) => Math.floor(v / 48)).join(',');
    const b = buckets.get(key) || { sum: [0, 0, 0], n: 0 };
    b.sum = b.sum.map((s, k) => s + c[k]);
    b.n++;
    buckets.set(key, b);
  }
  let palette = [...buckets.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, 6)
    .map((b) => b.sum.map((s) => s / b.n));
  if (palette.length === 0) palette = [[200, 200, 200]];

  // A dark outline around the silhouette gives the pixel-art look and guarantees two colors
  const outline = String(palette.length);
  const isEdge = (x: number, y: number) =>
    x === 0 || y === 0 || x === N - 1 || y === N - 1 || transparent[y * N + x - 1] || transparent[y * N + x + 1] || transparent[(y - 1) * N + x] || transparent[(y + 1) * N + x];

  const rows: string[] = [];
  for (let y = 0; y < N; y++) {
    let row = '';
    for (let x = 0; x < N; x++) {
      const i = y * N + x;
      if (transparent[i]) {
        row += '.';
        continue;
      }
      if (isEdge(x, y)) {
        row += outline;
        continue;
      }
      let best = 0;
      let bestD = Infinity;
      palette.forEach((p, k) => {
        const d = dist(cells[i], p);
        if (d < bestD) {
          bestD = d;
          best = k;
        }
      });
      row += String(best);
    }
    rows.push(row);
  }
  return { rows, palette: [...palette.map(toHex), '#2b1b4d'] };
}

/* ------------------------------ library ------------------------------ */

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function safeStorage(): StorageLike | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function validItem(x: any): x is CustomItem {
  return (
    x &&
    typeof x.id === 'string' &&
    typeof x.sprite === 'string' &&
    x.sprite.startsWith('data:image/png;base64,') &&
    x.sprite.length <= MAX_SPRITE_DATA_URL &&
    (x.source === 'muse-spark' || x.source === 'local') &&
    sanitizeDraft(x) !== null
  );
}

export function makeItem(draft: ItemDraft, sprite: string, source: CustomItem['source'], model?: string, now = Date.now()): CustomItem {
  return {
    ...draft,
    id: `item_${now}_${Math.floor(Math.random() * 100000)}`,
    sprite,
    source,
    model: source === 'muse-spark' ? model : undefined,
    createdAt: now
  };
}

export class ItemLibrary {
  private items: CustomItem[] = [];
  private listeners = new Set<() => void>();

  constructor(private store: StorageLike | null = safeStorage()) {
    this.reloadFromStorage();
  }

  reloadFromStorage(): void {
    try {
      this.store = safeStorage();
      const raw = this.store?.getItem(ITEMS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) this.items = parsed.filter(validItem).slice(0, MAX_ITEMS);
      else this.items = [];
    } catch {
      this.items = [];
    }
    this.listeners.forEach((fn) => fn());
  }

  list(): CustomItem[] {
    return this.items;
  }

  get(id: string): CustomItem | undefined {
    return this.items.find((i) => i.id === id);
  }

  isAtCapacity(): boolean {
    return this.items.length >= MAX_ITEMS;
  }

  add(item: CustomItem): boolean {
    if (!validItem(item)) return false;
    const existingIndex = this.items.findIndex((i) => i.id === item.id);
    if (existingIndex < 0 && this.items.length >= MAX_ITEMS) {
      return false; // Reject new items when at capacity without deleting old definitions
    }
    if (existingIndex >= 0) {
      this.items = this.items.map((i) => (i.id === item.id ? item : i));
    } else {
      this.items = [item, ...this.items];
    }
    this.persist();
    return true;
  }

  remove(id: string): void {
    this.items = this.items.filter((i) => i.id !== id);
    this.persist();
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private persist() {
    try {
      this.store?.setItem(ITEMS_KEY, JSON.stringify(this.items));
    } catch {
      /* private mode or full storage: items just won't persist */
    }
    this.items = [...this.items];
    this.listeners.forEach((fn) => fn());
  }
}
