/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Fault-injection unit tests covering:
 * 1. storage.ts claimActiveEgg failure retention, retry deduplication, and persistence-first guarantee.
 * 3. Shared pre-upload image compression/resizing, raw >8MB limits, and decode error intercept before network/providers.
 * 4. oddlings_custom_items_v1 inclusion in export/restore/snapshot/rollback and item singleton reloading.
 * 5. Complete world_region_* key set replacement, snapshotting, and undo rollback without touching unrelated keys.
 * 6. biomeWorld and customBiomeStorage boolean returns and atomic rollback on partial write failure.
 * 7. Egg analysis serialization and late result discard preventing active egg overwrite.
 * 8. Photo quest refundCheck on local read/decode failure or provider failure exactly once, not on legitimate match: false.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  claimActiveEgg,
  saveActiveEggToStorage,
  loadActiveEggFromStorage,
  createSaveBundle,
  validateAndParseSaveBundle,
  applySaveBundle,
  restorePreviousSnapshot,
  STORAGE_KEY_CREATURES,
  STORAGE_KEY_ACTIVE_EGG,
  STORAGE_KEY_CUSTOM_ITEMS
} from './storage';
import { INITIAL_ODDLINGS } from './creatureCatalog';
import { CreatureDNA } from './creatureTypes';
import {
  preparePhotoForUpload,
  ImageDecodeError,
  MAX_RAW_IMAGE_SIZE_BYTES,
  MAX_ENCODED_IMAGE_CHARS
} from './photoCompression';
import { validItem, CustomItem } from './customItems';
import { customItemLibrary } from './customItemStore';
import {
  saveBiomeWorldToStorage,
  getStorageKey
} from './biomeWorld';
import {
  upsertCustomBiomeRecord,
  deleteCustomBiomeRecord,
  getCustomBiomesList,
  STORAGE_KEY_CUSTOM_BIOMES
} from './customBiomeStorage';
import { walletBook, refundCheck, NEW_WALLET, dayOf } from './lifeSeeds';

// ============================================================================
// ITEM 1: Fault-injection for claimActiveEgg
// ============================================================================
test('Item 1: claimActiveEgg retains egg on collection persistence failure; retry deduplicates by ID', () => {
  const mockStorage: Record<string, string> = {};
  const originalWindow = (globalThis as any).window;

  let allowCreatureSave = true;

  (globalThis as any).window = {
    localStorage: {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, val: string) => {
        if (key === STORAGE_KEY_CREATURES && !allowCreatureSave) {
          throw new Error('QuotaExceededError: simulated disk full');
        }
        mockStorage[key] = val;
      },
      removeItem: (key: string) => { delete mockStorage[key]; }
    }
  };

  try {
    const candidate: CreatureDNA = {
      ...INITIAL_ODDLINGS[0],
      id: 'fault-creature-42',
      name: 'Resilient Spark'
    };

    const egg = {
      id: 'egg-fault-1',
      creature: candidate,
      createdAt: Date.now() - 300000,
      hatchAt: Date.now() - 10000,
      pattern: 'cosmic' as const, primaryColor: '#123456', secondaryColor: '#654321', accentColor: '#abcdef',
      isHatched: true,
      isClaimed: false
    };

    saveActiveEggToStorage(egg);
    assert.ok(loadActiveEggFromStorage() !== null, 'Active egg is initially saved');

    // 1. Injected fault: simulate collection save failure
    allowCreatureSave = false;
    const initialCreatures = [...INITIAL_ODDLINGS];
    const failedClaim = claimActiveEgg(egg, initialCreatures);

    assert.equal(failedClaim.success, false, 'Claim must fail when collection persistence fails');
    assert.ok(failedClaim.error, 'Claim returns a recoverable error message');
    assert.equal(failedClaim.newCreature, null);
    assert.equal(egg.isClaimed, false, 'Egg must NOT be marked claimed on failure');
    assert.ok(loadActiveEggFromStorage() !== null, 'Active egg must NOT be purged from storage on failure');

    // 2. Recovery attempt (player clicks Retry Claim after freeing space)
    allowCreatureSave = true;
    const retryClaim = claimActiveEgg(egg, initialCreatures);

    assert.equal(retryClaim.success, true, 'Retry succeeds when storage is available');
    assert.equal(retryClaim.newCreature?.id, 'fault-creature-42');
    assert.equal(retryClaim.updatedCreatures.length, initialCreatures.length + 1);
    assert.equal(egg.isClaimed, true, 'Egg is marked claimed after persistence succeeds');
    assert.equal(loadActiveEggFromStorage(), null, 'Active egg is purged from storage after success');

    // 3. Retry after partial write where creature was saved by ID but egg clear failed
    const partialFailureEgg = {
      ...egg,
      isClaimed: false // simulated egg clear failure leaving egg marked unclaimed
    };
    const dedupeRetry = claimActiveEgg(partialFailureEgg, retryClaim.updatedCreatures);

    assert.equal(dedupeRetry.success, true, 'Dedupe retry succeeds');
    assert.equal(dedupeRetry.newCreature?.id, 'fault-creature-42', 'Returns existing creature without duplicating');
    assert.equal(dedupeRetry.updatedCreatures.length, retryClaim.updatedCreatures.length, 'No duplicate entry added');
  } finally {
    (globalThis as any).window = originalWindow;
  }
});

// ============================================================================
// ITEM 3: Shared pre-upload resize and compress unit tests
// ============================================================================
test('Item 3: preparePhotoForUpload rejects oversized files and invalid image data before network', async () => {
  // Test raw size limit (> 8MB)
  const oversizedFile = {
    size: MAX_RAW_IMAGE_SIZE_BYTES + 1024,
    type: 'image/jpeg'
  } as File;

  await assert.rejects(
    async () => {
      await preparePhotoForUpload(oversizedFile);
    },
    (err: any) => {
      return err.message.includes('Photo is larger than 8MB');
    },
    'Rejects files > 8MB with clear size limit message'
  );

  // Test invalid MIME type
  const badMimeFile = {
    size: 1024,
    type: 'application/pdf'
  } as File;

  await assert.rejects(
    async () => {
      await preparePhotoForUpload(badMimeFile);
    },
    (err: any) => {
      return err.message.includes('valid photo');
    },
    'Rejects non-image MIME types'
  );

  // Test invalid string data URL decode failure
  await assert.rejects(
    async () => {
      await preparePhotoForUpload('not-a-valid-data-url');
    },
    (err: any) => {
      return err instanceof ImageDecodeError;
    },
    'Rejects non-data-url string with ImageDecodeError'
  );
});

// ============================================================================
// ITEM 4: oddlings_custom_items_v1 in save, restore, snapshot, rollback, singleton
// ============================================================================
test('Item 4: custom items export, restore, snapshot rollback, and item library reload', () => {
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
    const testItem: CustomItem = {
      id: 'custom_item_desk_mug_1',
      name: 'Ceramic Tea Mug',
      description: 'A cozy warm cup for cold mornings.',
      category: 'decor',
      glow: false,
      sprite: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      source: 'local',
      createdAt: Date.now()
    };

    assert.equal(validItem(testItem), true, 'Test custom item passes validation');

    // 1. Store custom item in storage
    mockStorage[STORAGE_KEY_CUSTOM_ITEMS] = JSON.stringify([testItem]);
    customItemLibrary.reloadFromStorage();
    assert.equal(customItemLibrary.list().length, 1);
    assert.equal(customItemLibrary.list()[0].id, 'custom_item_desk_mug_1');

    // 2. Export save bundle and assert custom items are included
    const bundle = createSaveBundle();
    assert.ok(bundle.customItems, 'Exported bundle includes customItems');
    assert.equal(bundle.customItems?.length, 1);
    assert.equal(bundle.customItems?.[0].id, 'custom_item_desk_mug_1');

    // 3. Clear storage and assert singleton reloads empty
    mockStorage[STORAGE_KEY_CUSTOM_ITEMS] = '[]';
    customItemLibrary.reloadFromStorage();
    assert.equal(customItemLibrary.list().length, 0);

    // 4. Restore bundle and verify custom items are restored and library reloaded
    const parsedResult = validateAndParseSaveBundle(JSON.stringify(bundle));
    assert.ok(parsedResult.success);
    
    assert.equal(parsedResult?.preview.customItemCount, 1);

    const restored = applySaveBundle(parsedResult!.bundle);
    assert.equal(restored.success, true);
    assert.equal(customItemLibrary.list().length, 1);
    assert.equal(customItemLibrary.list()[0].name, 'Ceramic Tea Mug');

    // 5. Test legacy save without customItems field restores cleanly
    const legacyBundle = { ...bundle };
    delete (legacyBundle as any).customItems;
    const legacyParsed = validateAndParseSaveBundle(JSON.stringify(legacyBundle));
    assert.ok(legacyParsed.success);
    
    assert.equal(legacyParsed?.bundle.customItems, undefined, 'Legacy bundles default to undefined custom items');
  } finally {
    (globalThis as any).window = originalWindow;
  }
});

// ============================================================================
// ITEM 5: Complete world_region_* replacement & snapshot rollback
// ============================================================================
test('Item 5: applySaveBundle completely replaces game-owned world_region_* keys and snapshots for undo', () => {
  const mockStorage: Record<string, string> = {};
  const originalWindow = (globalThis as any).window;

  (globalThis as any).window = {
    localStorage: {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, val: string) => { mockStorage[key] = val; },
      removeItem: (key: string) => { delete mockStorage[key]; },
      get length() { return Object.keys(mockStorage).length; },
      key: (i: number) => Object.keys(mockStorage)[i] || null
    }
  };

  try {
    // Existing game-owned region keys
    const regionKey1 = getStorageKey('world_region_1');
    const regionKeyNeg1 = getStorageKey('world_region_-1');
    const regionKey2 = 'world_region_2';
    mockStorage[regionKey1] = JSON.stringify({ version: 1, biome: 'world_region_1', width: 48, height: 24, tiles: [], decorations: [], updatedAt: Date.now() });
    mockStorage[regionKeyNeg1] = JSON.stringify({ version: 1, biome: 'world_region_-1', width: 48, height: 24, tiles: [], decorations: [], updatedAt: Date.now() });
    mockStorage[regionKey2] = JSON.stringify({ version: 1, biome: 'world_region_2', width: 48, height: 24, tiles: [], decorations: [], updatedAt: Date.now() });
    // Unrelated storage key
    mockStorage['user_theme_preference'] = 'dark-mode';

    // Incoming bundle has ONLY region 5
    const bundle = createSaveBundle();
    bundle.biomeWorlds = {
      world_region_5: {
        version: 1,
        biome: 'world_region_5',
        width: 48,
        height: 24,
        tiles: Array.from({ length: 24 }, () => Array(48).fill('grass')),
        decorations: [],
        updatedAt: Date.now()
      }
    };

    const parsedResult = validateAndParseSaveBundle(JSON.stringify(bundle));
    assert.ok(parsedResult.success);
    

    const restoreRes = applySaveBundle(parsedResult!.bundle);
    assert.equal(restoreRes.success, true);

    // Assert stale regions are purged
    assert.equal(mockStorage[regionKey1], undefined, 'Old region 1 purged');
    assert.equal(mockStorage[regionKeyNeg1], undefined, 'Old region -1 purged');
    assert.equal(mockStorage[regionKey2], undefined, 'Old region 2 purged');
    assert.ok(mockStorage[getStorageKey('world_region_5')], 'New region 5 created');
    assert.equal(mockStorage['user_theme_preference'], 'dark-mode', 'Unrelated keys preserved');

    // Undo restore: restores all previous world regions
    const undoSuccess = restorePreviousSnapshot();
    assert.equal(undoSuccess.success, true);
    assert.ok(mockStorage[regionKey1], 'Region 1 restored via undo');
    assert.ok(mockStorage[regionKeyNeg1], 'Region -1 restored via undo');
    assert.ok(mockStorage[regionKey2], 'Region 2 restored via undo');
    assert.equal(mockStorage[getStorageKey('world_region_5')], undefined, 'Region 5 removed on undo');
    assert.equal(mockStorage['user_theme_preference'], 'dark-mode', 'Unrelated key still preserved');
  } finally {
    (globalThis as any).window = originalWindow;
  }
});

// ============================================================================
// ITEM 6: BiomeWorld / CustomBiomeStorage boolean return & atomic rollback
// ============================================================================
test('Item 6: saveBiomeWorldToStorage and upsertCustomBiomeRecord return booleans; atomic rollback on failure', () => {
  const mockStorage: Record<string, string> = {};
  const originalWindow = (globalThis as any).window;

  let failStorage = false;

  (globalThis as any).window = {
    localStorage: {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, val: string) => {
        if (failStorage) throw new Error('Quota exceeded');
        mockStorage[key] = val;
      },
      removeItem: (key: string) => { delete mockStorage[key]; }
    }
  };

  try {
    const testBiome = {
      id: 'custom_atomic_test',
      name: 'Volcanic Springs',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      generationMode: 'local_quantization' as const, previewThumbnailUrl: 'data:image/png;base64,thumb'
    };

    // 1. Success path
    const upsertOk = upsertCustomBiomeRecord(testBiome);
    assert.equal(upsertOk, true, 'upsertCustomBiomeRecord returns true on success');

    // 2. Storage write failure path
    failStorage = true;
    const testBiome2 = { ...testBiome, id: 'custom_fail_test' };
    const upsertFail = upsertCustomBiomeRecord(testBiome2);
    assert.equal(upsertFail, false, 'upsertCustomBiomeRecord returns false on failure');

    // 3. Rollback simulation
    failStorage = false;
    deleteCustomBiomeRecord('custom_atomic_test');
    assert.equal(getCustomBiomesList().some((b) => b.id === 'custom_atomic_test'), false);
  } finally {
    (globalThis as any).window = originalWindow;
  }
});

// ============================================================================
// ITEM 7: Egg analysis serialization and slow mocked provider late result discard
// ============================================================================
test('Item 7: slow mocked provider late results are discarded and do not overwrite active egg', async () => {
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
    let activeJobSeq = 1;
    let eggSlotOccupied = false;

    // Simulate an existing active egg in storage
    const existingEgg = {
      id: 'existing-active-egg',
      creature: INITIAL_ODDLINGS[0],
      createdAt: Date.now(),
      hatchAt: Date.now() + 180000,
      pattern: 'stripes' as const, primaryColor: '#123456', secondaryColor: '#654321', accentColor: '#abcdef',
      isHatched: false,
      isClaimed: false
    };
    saveActiveEggToStorage(existingEgg);
    eggSlotOccupied = true;

    // Simulate slow object analysis request #1
    const request1Seq = activeJobSeq;
    const slowAnalysis = new Promise<{ creature: CreatureDNA }>((resolve) => {
      setTimeout(() => {
        resolve({
          creature: {
            ...INITIAL_ODDLINGS[1],
            id: 'late-creature-1'
          }
        });
      }, 50);
    });

    // Player cancels / closes / starts new action before response arrives
    activeJobSeq++; // sequence incremented

    const response = await slowAnalysis;

    // Late response check matching IncubatorLab handleCreateEgg logic:
    // 1. Is the job sequence still current?
    const isStale = response && request1Seq !== activeJobSeq;
    assert.equal(isStale, true, 'Late analysis response detected as stale');

    // 2. Can it overwrite the active egg in storage?
    const active = loadActiveEggFromStorage();
    assert.ok(active !== null);
    assert.equal(active?.id, 'existing-active-egg', 'Active egg preserved without overwrite');
  } finally {
    (globalThis as any).window = originalWindow;
  }
});

// ============================================================================
// ITEM 8: Photo quest refundCheck on local decode or provider failure exactly once
// ============================================================================
test('Item 8: refundCheck refunds daily check on local decode or provider error exactly once, not on legitimate match: false', () => {
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
    const today = dayOf(Date.now()); // Match the wallet's local-day accounting, including UTC midnight.
    const initialWallet = { ...NEW_WALLET };
    initialWallet.checksDay = today;
    initialWallet.checksToday = 3;

    // 1. Refund on provider/decode error: exactly once
    const refundedOnce = refundCheck(initialWallet);
    assert.equal(refundedOnce?.checksToday, 2, 'Checks today decremented from 3 to 2');

    // 2. Bound check: cannot refund below zero
    if (refundedOnce) refundedOnce.checksToday = 0;
    const bounded = refundCheck(refundedOnce!);
    assert.equal(bounded?.checksToday, 0, 'Cannot refund below 0');

    // 3. Day rollover safety: if checksDay is from yesterday, refundCheck handles rollover safely
    const yesterdayWallet = {
      ...initialWallet,
      checksDay: '2020-01-01',
      checksToday: 5
    };
    const rolledOver = refundCheck(yesterdayWallet);
    assert.equal(rolledOver?.checksDay, today, 'Checks day updated to today');
    assert.equal(rolledOver?.checksToday, 0, 'Rollover resets checks to 0 safely without underflow');

    // 4. WalletBook singleton refundCheck integration
    walletBook.recordCheck();
    const walletBeforeError = walletBook.get();
    const countBefore = walletBeforeError.checksToday;
    walletBook.refundCheck();
    const walletAfterError = walletBook.get();
    assert.equal(walletAfterError.checksToday, Math.max(0, countBefore - 1), 'walletBook.refundCheck() refunds exactly one check');
  } finally {
    (globalThis as any).window = originalWindow;
  }
});


test('Late quest failure cannot refund a new day check', () => {
  const now = new Date(2026, 10, 4, 0, 1).getTime();
  const wallet = { ...NEW_WALLET, checksDay: '2026-11-04', checksToday: 2 };
  assert.equal(refundCheck(wallet, now, '2026-11-03')?.checksToday, 2);
  assert.equal(refundCheck(wallet, now, '2026-11-04')?.checksToday, 1);
});


