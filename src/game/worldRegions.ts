import { BiomeWorldState } from './biomeWorldTypes';
import { createEmptyTiles, loadBiomeWorldFromStorage, getStorageKey, sanitizeBiomeWorld } from './biomeWorld';

// World uses signed region coordinates; only explored regions consume storage.
export const regionId = (x: number) => x === 0 ? 'greenhouse' : `world_region_${x}`;
export const isWorldRegionId = (id: string) => /^world_region_-?[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id.slice(13)));
export const normalizeHome = (id?: string) => !id || id === 'desk' || id === 'lab' ? 'greenhouse' : id;

export function createWorldRegion(x: number): BiomeWorldState {
  if (!Number.isSafeInteger(x)) throw new Error('Invalid World coordinate.');
  if (x === 0) return loadBiomeWorldFromStorage('greenhouse');
  const tiles = createEmptyTiles();
  // Fixed edge elevation joins adjacent regions; smooth deterministic inland hills.
  for (let col = 0; col < 48; col++) {
    const edge = Math.min(col, 47 - col);
    const row = 16 + Math.round(Math.sin((col / 47) * Math.PI * 2 + x) * Math.min(1.5, edge / 5));
    for (let y = row; y < 24; y++) tiles[y][col] = y === row ? 'grass' : y > 20 ? 'stone' : 'dirt';
  }
  return { version: 1, biome: regionId(x), width: 48, height: 24, tiles, decorations: [], updatedAt: 0 };
}

export function loadWorldRegion(x: number): BiomeWorldState {
  // The journal is the committed view until both ordinary region keys are compacted.
  const pending = pendingTransfer();
  const committed = pending?.find(w => w.biome === regionId(x));
  if (pending) { try { recoverWorldTransfer(); } catch { /* read the committed journal */ } }
  if (committed) return committed;
  if (x === 0) return loadBiomeWorldFromStorage('greenhouse');
  const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(getStorageKey(regionId(x))) : null;
  if (raw) {
    try { const world = sanitizeBiomeWorld(JSON.parse(raw), regionId(x)); if (world) return world; } catch { /* preserve corrupt data; use terrain fallback */ }
  }
  return createWorldRegion(x);
}

export function saveWorldRegion(world: BiomeWorldState): void {
  // Let the UI handle quota errors before moving away from unsaved edits.
  recoverWorldTransfer();
  localStorage.setItem(getStorageKey(world.biome), JSON.stringify(world));
}


// A write-ahead record makes both region writes recoverable after quota failures or reloads.
const TRANSFER_KEY = 'oddlings_world_transfer_v1';
export function pendingTransfer(): BiomeWorldState[] | null {
  const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(TRANSFER_KEY);
  return raw ? JSON.parse(raw) as BiomeWorldState[] : null;
}
export function recoverWorldTransfer(): void {
  const worlds = pendingTransfer();
  if (!worlds) return;
  for (const world of worlds) localStorage.setItem(getStorageKey(world.biome), JSON.stringify(world));
  localStorage.removeItem(TRANSFER_KEY);
}

export function transferWorldItem(source: BiomeWorldState, target: BiomeWorldState): void {
  recoverWorldTransfer();
  localStorage.setItem(TRANSFER_KEY, JSON.stringify([source, target]));
  // The journal write commits both regions atomically; compaction is best effort.
  try { recoverWorldTransfer(); } catch { /* future reads use the committed journal */ }
}
