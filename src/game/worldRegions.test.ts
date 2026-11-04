import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorldRegion, loadWorldRegion, saveWorldRegion, isWorldRegionId, normalizeHome, regionId } from './worldRegions';
import { getStorageKey, paintTiles, BiomeHistoryManager } from './biomeWorld';
import { createSaveBundle, validateAndParseSaveBundle, applySaveBundle, sanitizeCreature } from './storage';
import { INITIAL_ODDLINGS } from './creatureCatalog';

function storage() {
  const data = new Map<string, string>();
  const store = { get length() { return data.size; }, key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (k: string) => data.get(k) ?? null, setItem: (k: string,v: string) => { data.set(k,v); }, removeItem: (k: string) => { data.delete(k); }, clear: () => data.clear() };
  Object.defineProperty(globalThis, 'localStorage', { value: store, configurable: true });
  Object.defineProperty(globalThis, 'window', { value: { localStorage: store }, configurable: true });
  return store;
}

test('World generates distinct deterministic terrain at signed coordinates without a fixed map edge', () => {
  storage();
  for (const x of [-100000, -2, -1, 1, 2, 100000]) {
    const a = createWorldRegion(x), b = createWorldRegion(x);
    assert.equal(a.biome, regionId(x));
    assert.deepEqual(a.tiles, b.tiles);
    assert.equal(a.tiles[16][0], 'grass'); assert.equal(a.tiles[16][47], 'grass');
    assert.equal(a.tiles.length, 24); assert.equal(a.tiles[0].length, 48);
  }
  assert.notDeepEqual(createWorldRegion(1).tiles, createWorldRegion(2).tiles);
  assert.ok(isWorldRegionId('world_region_-12'));
  for (const bad of ['world_region_0', 'world_region_1x', '__proto__', 'world_region_9007199254740992']) assert.equal(isWorldRegionId(bad), false);
});

test('World edits remain isolated across east and west regions with undo and reload', () => {
  storage();
  const east = createWorldRegion(1), west = createWorldRegion(-1);
  const history = new BiomeHistoryManager(); history.pushSnapshot(east);
  const edited = paintTiles(east, 10, 8, 'brick', 1);
  assert.equal(history.undo(edited)?.tiles[8][10], 'air');
  assert.equal(history.redo(east)?.tiles[8][10], 'brick');
  saveWorldRegion(edited); saveWorldRegion(west);
  assert.equal(loadWorldRegion(1).tiles[8][10], 'brick');
  assert.equal(loadWorldRegion(-1).tiles[8][10], 'air');
});

test('World export/import preserves regions and resident positions; legacy residents return home', () => {
  const store = storage();
  store.setItem(getStorageKey('desk'), 'legacy terrain is retained');
  const resident = sanitizeCreature({ ...INITIAL_ODDLINGS[0], biomeId: 'lab', worldRegion: -2 })!;
  assert.equal(resident.biomeId, 'greenhouse'); assert.equal(normalizeHome('desk'), 'greenhouse');
  saveWorldRegion(paintTiles(createWorldRegion(-2), 4, 8, 'glass', 1));
  const bundle = createSaveBundle({ creatures: [resident] });
  const parsed = validateAndParseSaveBundle(JSON.stringify(bundle));
  assert.equal(parsed.success, true);
  if (!parsed.success) return;
  const region = parsed.bundle.biomeWorlds['world_region_-2'];
  assert.equal(region?.tiles[8][4], 'glass');
  assert.equal(parsed.bundle.creatures[0].worldRegion, -2);
  store.removeItem(getStorageKey('world_region_-2'));
  assert.equal(applySaveBundle(parsed.bundle).success, true);
  assert.equal(loadWorldRegion(-2).tiles[8][4], 'glass');
  assert.equal(store.getItem(getStorageKey('desk')), 'legacy terrain is retained');
});
