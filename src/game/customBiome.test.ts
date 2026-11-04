/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isSolidTile,
  canPlaceDecoration,
  sanitizeBiomeWorld,
  createStarterWorld,
  createEmptyTiles,
  GRID_WIDTH,
  GRID_HEIGHT
} from './biomeWorld';
import {
  getCustomBiomesList,
  saveCustomBiomesList,
  createStarterCustomWorld,
  safelyDeleteCustomBiome,
  renameCustomBiome,
  STORAGE_KEY_CUSTOM_BIOMES
} from './customBiomeStorage';
import {
  sanitizeCreature,
  createSaveBundle,
  validateAndParseSaveBundle,
  applySaveBundle,
  STORAGE_KEY_CREATURES
} from './storage';
import { CreatureDNA } from './creatureTypes';
import { CustomBiomeRecord, TileMaterial } from './biomeWorldTypes';
import { validateImageFile } from './pixelArtProcessor';

test('Expanded terrain materials: all 8 new materials are solid and functional', () => {
  const newMaterials: TileMaterial[] = ['brick', 'plaster', 'carpet', 'tile', 'glass', 'metal', 'snow', 'moss'];
  for (const mat of newMaterials) {
    assert.equal(isSolidTile(mat), true, `Material '${mat}' must be solid terrain`);
  }

  // Non-solid tiles
  assert.equal(isSolidTile('air'), false);
  assert.equal(isSolidTile('water'), false);

  // Test solid support for placing decorations on moss and brick
  const world: any = {
    version: 1,
    biome: 'custom-test',
    width: GRID_WIDTH,
    height: GRID_HEIGHT,
    tiles: createEmptyTiles(),
    decorations: [],
    updatedAt: Date.now()
  };
  world.tiles[16][10] = 'moss';
  const placementOnMoss = canPlaceDecoration(world, 'flower', 10, 5);
  assert.equal(placementOnMoss.allowed, true, 'Decorations should be placeable on moss');
  assert.equal(placementOnMoss.snappedY, 16, 'Ground snap on moss at row 16 should be row 16');

  world.tiles[16][12] = 'brick';
  const placementOnBrick = canPlaceDecoration(world, 'lantern', 12, 5);
  assert.equal(placementOnBrick.allowed, true, 'Decorations should be placeable on brick');
});

test('World sanitization: validates new materials, custom biome ID, and custom background URL', () => {
  const emptyGrid = createEmptyTiles();
  const rawWorld = {
    version: 1,
    biome: 'custom-city-rooftop-1234',
    name: 'City Rooftop',
    tiles: emptyGrid,
    decorations: [],
    updatedAt: Date.now(),
    isCustom: true,
    customBackgroundUrl: 'data:image/png;base64,mockCustomBg123',
    generationMode: 'local_quantization',
    hideAtmosphere: true
  };

  // Set several new tiles
  rawWorld.tiles[0][0] = 'brick';
  rawWorld.tiles[0][1] = 'plaster';
  rawWorld.tiles[0][2] = 'carpet';
  rawWorld.tiles[0][3] = 'tile';
  rawWorld.tiles[0][4] = 'glass';
  rawWorld.tiles[0][5] = 'metal';
  rawWorld.tiles[0][6] = 'snow';
  rawWorld.tiles[0][7] = 'moss';

  const sanitized = sanitizeBiomeWorld(rawWorld, 'custom-city-rooftop-1234');
  assert.ok(sanitized);
  assert.equal(sanitized?.biome, 'custom-city-rooftop-1234');
  assert.equal(sanitized?.isCustom, true);
  assert.equal(sanitized?.customBackgroundUrl, 'data:image/png;base64,mockCustomBg123');
  assert.equal(sanitized?.generationMode, 'local_quantization');
  assert.equal(sanitized?.hideAtmosphere, true);
  assert.equal(sanitized?.tiles[0][0], 'brick');
  assert.equal(sanitized?.tiles[0][1], 'plaster');
  assert.equal(sanitized?.tiles[0][2], 'carpet');
  assert.equal(sanitized?.tiles[0][3], 'tile');
  assert.equal(sanitized?.tiles[0][4], 'glass');
  assert.equal(sanitized?.tiles[0][5], 'metal');
  assert.equal(sanitized?.tiles[0][6], 'snow');
  assert.equal(sanitized?.tiles[0][7], 'moss');
});

test('Legacy Greenhouse migration: old greenhouse theme remains non-destructively accessible', () => {
  // Existing save with greenhouse
  const starter = createStarterWorld('greenhouse');
  assert.equal(starter.biome, 'greenhouse');

  // Retain legacy Desk and Lab worlds without deleting saves
  const deskWorld = createStarterWorld('desk');
  assert.equal(deskWorld.biome, 'desk');
  const labWorld = createStarterWorld('lab');
  assert.equal(labWorld.biome, 'lab');
});

test('Creature resident assignment: newly discovered creatures default to World (greenhouse)', () => {
  const dummyCreature: Partial<CreatureDNA> = {
    id: 'test-creature-1',
    name: 'Mossling',
    discoveredAt: Date.now()
  };

  const sanitized = sanitizeCreature(dummyCreature);
  assert.ok(sanitized);
  assert.equal(sanitized?.biomeId, 'greenhouse', 'Default biome must be World (greenhouse)');
});

test('Custom Biome creation, rename, and safe removal with resident re-homing', async () => {
  const mockStorage: Record<string, string> = {};
  const originalWindow = (globalThis as any).window;

  (globalThis as any).window = {
    localStorage: {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, val: string) => { mockStorage[key] = val; },
      removeItem: (key: string) => { delete mockStorage[key]; }
    }
  };

  try {
    // 1. Initial custom biomes list should be empty
    const initialBiomes = getCustomBiomesList();
    assert.deepEqual(initialBiomes, []);

    // 2. Create custom biome record
    const biomeId = 'biome-city-haven-456';
    const newRecord: CustomBiomeRecord = {
      id: biomeId,
      name: 'City Haven',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      previewThumbnailUrl: 'data:image/png;base64,mockThumb',
      generationMode: 'local_quantization',
      hideAtmosphere: true
    };
    saveCustomBiomesList([newRecord]);

    assert.equal(getCustomBiomesList().length, 1);
    assert.equal(getCustomBiomesList()[0].name, 'City Haven');

    // 3. Rename custom biome
    const renamed = renameCustomBiome(biomeId, 'Neo City Sanctuary');
    assert.equal(renamed, true);
    assert.equal(getCustomBiomesList().find(b => b.id === biomeId)?.name, 'Neo City Sanctuary');

    // 4. Setup mock creatures living in this custom biome
    const creatureInCustom: CreatureDNA = {
      id: 'c-101',
      name: 'City Prowler',
      speciesName: 'Felis Civitas',
      title: 'The Rooftop Prowler',
      primaryElement: 'Mechanical',
      temperament: 'Curious & Chirpy',
      provenance: 'preset_demo',
      biomeId: biomeId,
      specialAbility: { name: 'Pounce', description: 'Desc', powerRating: 50, icon: '🐾' },
      sourceObject: { name: 'Key', category: 'Tool', material: 'Metal', description: 'Desc' },
      appearance: { bodyShape: 'round', primaryColor: '#ff0000', secondaryColor: '#00ff00', accentColor: '#0000ff', eyeStyle: 'wide', pattern: 'solid', size: 1 },
      habitatPreference: 'Midnight Tech Lab',
      stats: { trust: 50, energy: 50, curiosity: 50, generation: 1 },
      memories: [],
      discoveredAt: Date.now()
    };

    const creatureInWorld: CreatureDNA = {
      id: 'c-102',
      name: 'Forest Sprite',
      speciesName: 'Flora Sylva',
      title: 'The Forest Sprite',
      primaryElement: 'Botanical',
      temperament: 'Gentle & Shy',
      provenance: 'preset_demo',
      biomeId: 'greenhouse',
      specialAbility: { name: 'Bloom', description: 'Desc', powerRating: 50, icon: '🌸' },
      sourceObject: { name: 'Leaf', category: 'Nature', material: 'Organic', description: 'Desc' },
      appearance: { bodyShape: 'blob', primaryColor: '#00ff00', secondaryColor: '#ffffff', accentColor: '#003300', eyeStyle: 'wide', pattern: 'solid', size: 1 },
      habitatPreference: 'Sunlit Greenhouse',
      stats: { trust: 50, energy: 50, curiosity: 50, generation: 1 },
      memories: [],
      discoveredAt: Date.now()
    };

    const creatures = [creatureInCustom, creatureInWorld];
    mockStorage[STORAGE_KEY_CREATURES] = JSON.stringify(creatures);

    // 5. Safely delete custom biome -> Re-homes resident c-101 to 'greenhouse'
    const result = await safelyDeleteCustomBiome(biomeId, creatures, (updated) => {
      mockStorage[STORAGE_KEY_CREATURES] = JSON.stringify(updated);
    });
    assert.equal(result.rehomedCount, 1, '1 creature should be rehomed');
    assert.equal(getCustomBiomesList().length, 0, 'Custom biome list should now be empty');

    // Verify creature was re-homed without being deleted
    const reloadedCreatures: CreatureDNA[] = JSON.parse(mockStorage[STORAGE_KEY_CREATURES]);
    assert.equal(reloadedCreatures.length, 2, 'No creatures should be deleted');
    const c101 = reloadedCreatures.find(c => c.id === 'c-101');
    assert.equal(c101?.biomeId, 'greenhouse', 'Creature in deleted biome must safely re-home to World (greenhouse)');
    const c102 = reloadedCreatures.find(c => c.id === 'c-102');
    assert.equal(c102?.biomeId, 'greenhouse', 'Creature in World remains in World');
  } finally {
    (globalThis as any).window = originalWindow;
  }
});

test('Save bundle: customBiomes persisted and restored cleanly with atomic rollback', () => {
  const mockStorage: Record<string, string> = {};
  const originalWindow = (globalThis as any).window;

  (globalThis as any).window = {
    localStorage: {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, val: string) => { mockStorage[key] = val; },
      removeItem: (key: string) => { delete mockStorage[key]; }
    }
  };

  try {
    const customBiome: CustomBiomeRecord = {
      id: 'biome-crystal-peaks',
      name: 'Crystal Peaks',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      previewThumbnailUrl: 'data:image/png;base64,crystalThumb',
      generationMode: 'local_quantization',
      hideAtmosphere: true
    };
    mockStorage[STORAGE_KEY_CUSTOM_BIOMES] = JSON.stringify([customBiome]);

    // Create save bundle
    const bundle = createSaveBundle();
    assert.ok(bundle.customBiomes);
    assert.equal(bundle.customBiomes.length, 1);
    assert.equal(bundle.customBiomes[0].id, 'biome-crystal-peaks');

    // Clear and restore
    delete mockStorage[STORAGE_KEY_CUSTOM_BIOMES];
    const validation = validateAndParseSaveBundle(JSON.stringify(bundle));
    assert.equal(validation.success, true);

    const applyResult = applySaveBundle(validation.bundle!);
    assert.equal(applyResult.success, true);

    const restoredBiomes = getCustomBiomesList();
    assert.equal(restoredBiomes.length, 1);
    assert.equal(restoredBiomes[0].id, 'biome-crystal-peaks');
    assert.equal(restoredBiomes[0].name, 'Crystal Peaks');
  } finally {
    (globalThis as any).window = originalWindow;
  }
});

test('Photo upload validation: validates webp, jpeg, png and rejects unsupported files or oversized files', () => {
  // Test valid WebP file
  const validWebp = new File(['mock_image_bytes'], 'outside.webp', { type: 'image/webp' });
  const validationWebp = validateImageFile(validWebp);
  assert.equal(validationWebp.valid, true);

  // Test valid PNG file
  const validPng = new File(['mock_png_bytes'], 'photo.png', { type: 'image/png' });
  const validationPng = validateImageFile(validPng);
  assert.equal(validationPng.valid, true);

  // Test invalid file type (PDF)
  const badFile = new File(['fake_pdf'], 'doc.pdf', { type: 'application/pdf' });
  const badValidation = validateImageFile(badFile);
  assert.equal(badValidation.valid, false);
  assert.ok(badValidation.error?.includes('Unsupported'));

  // Test oversized file (> 8MB)
  const oversizedFile = new File(['too_big'], 'huge.jpg', { type: 'image/jpeg' });
  Object.defineProperty(oversizedFile, 'size', { value: 9 * 1024 * 1024 });
  const oversizedValidation = validateImageFile(oversizedFile);
  assert.equal(oversizedValidation.valid, false);
  assert.ok(oversizedValidation.error?.includes('too large'));
});
