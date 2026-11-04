/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BiomeWorldState, CustomBiomeRecord, HabitatThemeId } from './biomeWorldTypes';
import { CreatureDNA } from './creatureTypes';
import { 
  createEmptyTiles, 
  DEFAULT_GROUND_ROW, 
  getStorageKey, 
  GRID_HEIGHT, 
  GRID_WIDTH, 
  sanitizeBiomeWorld, 
  saveBiomeWorldToStorage 
} from './biomeWorld';

export const STORAGE_KEY_CUSTOM_BIOMES = 'oddlings_custom_biomes_v1';
const IDB_NAME = 'oddlings_biome_assets_db';
const IDB_VERSION = 1;
const IDB_STORE = 'biome_backgrounds';

// In-memory cache for fast synchronous access & test runner fallback
const memoryAssetCache = new Map<string, { backgroundDataUrl: string; originalPhotoDataUrl?: string }>();

/**
 * Opens or initializes the IndexedDB store for high-resolution pixel art backgrounds.
 */
function openAssetsDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(IDB_NAME, IDB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE, { keyPath: 'biomeId' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = (err) => {
        console.warn('Failed to open IndexedDB for biome assets:', err);
        resolve(null);
      };
    } catch (err) {
      console.warn('IndexedDB unavailable:', err);
      resolve(null);
    }
  });
}

/**
 * Loads the list of registered custom biomes from local storage.
 */
export function getCustomBiomesList(): CustomBiomeRecord[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_CUSTOM_BIOMES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((b) => b && typeof b.id === 'string' && typeof b.name === 'string')
      .map((b) => ({
        id: String(b.id),
        name: String(b.name).slice(0, 32),
        createdAt: typeof b.createdAt === 'number' ? b.createdAt : Date.now(),
        updatedAt: typeof b.updatedAt === 'number' ? b.updatedAt : Date.now(),
        generationMode: b.generationMode === 'ai_generated' ? 'ai_generated' : 'local_quantization',
        previewThumbnailUrl: typeof b.previewThumbnailUrl === 'string' ? b.previewThumbnailUrl : undefined,
        hideAtmosphere: b.hideAtmosphere !== false
      }));
  } catch (err) {
    console.warn('Failed to parse custom biomes manifest:', err);
    return [];
  }
}

/**
 * Saves the custom biomes manifest to local storage.
 */
export function saveCustomBiomesList(records: CustomBiomeRecord[]): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;

  try {
    window.localStorage.setItem(STORAGE_KEY_CUSTOM_BIOMES, JSON.stringify(records));
    return true;
  } catch (err) {
    console.warn('Failed to save custom biomes list to localStorage:', err);
    return false;
  }
}

/**
 * Saves a custom biome record, appending or updating an existing record.
 * Returns true on success, false if localStorage write fails.
 */
export function upsertCustomBiomeRecord(record: CustomBiomeRecord): boolean {
  const current = getCustomBiomesList();
  const index = current.findIndex((b) => b.id === record.id);
  if (index >= 0) {
    current[index] = { ...current[index], ...record, updatedAt: Date.now() };
  } else {
    current.push(record);
  }
  return saveCustomBiomesList(current);
}

/**
 * Removes a custom biome record from the manifest.
 */
export function deleteCustomBiomeRecord(biomeId: string): boolean {
  const current = getCustomBiomesList();
  const filtered = current.filter((b) => b.id !== biomeId);
  return saveCustomBiomesList(filtered);
}

/**
 * Removes background image assets from IndexedDB and memory cache.
 */
export async function deleteCustomBiomeBackground(biomeId: string): Promise<boolean> {
  memoryAssetCache.delete(biomeId);
  const db = await openAssetsDB();
  if (!db) return true;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(biomeId);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

/**
 * Saves background image assets into IndexedDB (and in-memory cache) with quota handling.
 */
export async function saveCustomBiomeBackground(
  biomeId: string,
  backgroundDataUrl: string,
  originalPhotoDataUrl?: string
): Promise<boolean> {
  // Always update memory cache
  memoryAssetCache.set(biomeId, { backgroundDataUrl, originalPhotoDataUrl });

  const db = await openAssetsDB();
  if (!db) {
    return true; // Memory cache active
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.put({
        biomeId,
        backgroundDataUrl,
        originalPhotoDataUrl,
        savedAt: Date.now()
      });

      tx.oncomplete = () => resolve(true);
      tx.onerror = (err) => {
        console.warn('IndexedDB write error for biome background:', err);
        resolve(false);
      };
    } catch (err) {
      console.warn('Transaction error for biome background:', err);
      resolve(false);
    }
  });
}

/**
 * Loads background image assets from IndexedDB or memory cache.
 */
export async function loadCustomBiomeBackground(
  biomeId: string
): Promise<{ backgroundDataUrl?: string; originalPhotoDataUrl?: string } | null> {
  // Check memory cache first
  if (memoryAssetCache.has(biomeId)) {
    return memoryAssetCache.get(biomeId)!;
  }

  const db = await openAssetsDB();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(biomeId);

      req.onsuccess = () => {
        const result = req.result;
        if (result && result.backgroundDataUrl) {
          memoryAssetCache.set(biomeId, {
            backgroundDataUrl: result.backgroundDataUrl,
            originalPhotoDataUrl: result.originalPhotoDataUrl
          });
          resolve({
            backgroundDataUrl: result.backgroundDataUrl,
            originalPhotoDataUrl: result.originalPhotoDataUrl
          });
        } else {
          resolve(null);
        }
      };

      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Creates an initial starting world layout for a newly created custom biome.
 * Uses solid ground (wood, tile, or stone) so creatures and decorations stay firmly grounded immediately.
 */
export function createStarterCustomWorld(
  biomeId: string,
  name: string,
  backgroundUrl?: string,
  generationMode: 'local_quantization' | 'ai_generated' = 'local_quantization'
): BiomeWorldState {
  const tiles = createEmptyTiles();

  // Foundation: flat ground platform across the lower third (rows 17..23)
  for (let x = 0; x < GRID_WIDTH; x++) {
    for (let y = 17; y < GRID_HEIGHT; y++) {
      if (y === 17) {
        tiles[y][x] = 'tile'; // Architectural paver ground
      } else if (y === 18) {
        tiles[y][x] = 'brick';
      } else {
        tiles[y][x] = 'stone';
      }
    }
  }

  // Raised wooden terrace planter on the right
  for (let x = 32; x <= 42; x++) {
    tiles[14][x] = 'wood';
    tiles[15][x] = 'dirt';
    tiles[16][x] = 'stone';
  }

  return {
    version: 1,
    biome: biomeId,
    name,
    isCustom: true,
    customBackgroundUrl: backgroundUrl,
    generationMode,
    hideAtmosphere: true,
    width: GRID_WIDTH,
    height: GRID_HEIGHT,
    tiles,
    decorations: [
      { id: `decor-${Date.now()}-1`, type: 'lantern', gridX: 8, gridY: 17 },
      { id: `decor-${Date.now()}-2`, type: 'shelter', gridX: 18, gridY: 17 },
      { id: `decor-${Date.now()}-3`, type: 'shrub', gridX: 34, gridY: 14 },
      { id: `decor-${Date.now()}-4`, type: 'flower', gridX: 38, gridY: 14 }
    ],
    updatedAt: Date.now()
  };
}

/**
 * Renames a custom biome.
 */
export function renameCustomBiome(biomeId: string, newName: string): boolean {
  const trimmed = newName.trim().slice(0, 32);
  if (!trimmed) return false;

  const current = getCustomBiomesList();
  const target = current.find((b) => b.id === biomeId);
  if (!target) return false;

  target.name = trimmed;
  target.updatedAt = Date.now();
  saveCustomBiomesList(current);

  // Update in world state storage if present
  try {
    const rawWorld = window.localStorage.getItem(getStorageKey(biomeId));
    if (rawWorld) {
      const parsed = JSON.parse(rawWorld);
      parsed.name = trimmed;
      parsed.updatedAt = Date.now();
      window.localStorage.setItem(getStorageKey(biomeId), JSON.stringify(parsed));
    }
  } catch {}

  return true;
}

/**
 * Safely removes a custom biome:
 * 1. Re-homes all residents in this biome to 'greenhouse' ("World") without deleting creatures.
 * 2. Purges the biome world and asset records.
 */
export async function safelyDeleteCustomBiome(
  biomeId: string,
  creatures: CreatureDNA[],
  onUpdateCreatures: (updated: CreatureDNA[]) => void
): Promise<{ rehomedCount: number }> {
  // 1. Re-home residents to 'greenhouse' (World)
  let rehomedCount = 0;
  const updatedCreatures = creatures.map((c) => {
    if (c.biomeId === biomeId) {
      rehomedCount++;
      return {
        ...c,
        biomeId: 'greenhouse',
        memories: [
          {
            timestamp: Date.now(),
            text: `Safely returned home to World from a relocated sanctuary.`,
            type: 'nap' as const
          },
          ...(Array.isArray(c.memories) ? c.memories : [])
        ].slice(0, 25)
      };
    }
    return c;
  });

  if (rehomedCount > 0) {
    onUpdateCreatures(updatedCreatures);
  }

  // 2. Remove from manifest
  const current = getCustomBiomesList();
  const filtered = current.filter((b) => b.id !== biomeId);
  saveCustomBiomesList(filtered);

  // 3. Remove world storage
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(getStorageKey(biomeId));
    } catch {}
  }

  // 4. Remove asset from memory cache and IndexedDB
  memoryAssetCache.delete(biomeId);
  const db = await openAssetsDB();
  if (db) {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(biomeId);
    } catch {}
  }

  return { rehomedCount };
}
