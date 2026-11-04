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
  if (x === 0) return loadBiomeWorldFromStorage('greenhouse');
  const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(getStorageKey(regionId(x))) : null;
  if (raw) {
    try { const world = sanitizeBiomeWorld(JSON.parse(raw), regionId(x)); if (world) return world; } catch { /* preserve corrupt data; use terrain fallback */ }
  }
  return createWorldRegion(x);
}

export function saveWorldRegion(world: BiomeWorldState): void {
  // Let the UI handle quota errors before moving away from unsaved edits.
  localStorage.setItem(getStorageKey(world.biome), JSON.stringify(world));
}
