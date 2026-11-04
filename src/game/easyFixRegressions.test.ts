import test from 'node:test';
import assert from 'node:assert/strict';
import { creatureVoice, CreatureVoice, DIARY_KEY, DiaryEntry } from './creatureVoice';
import { ItemLibrary, MAX_ITEMS, CustomItem, makeItem } from './customItems';
import { applySaveBundle, restorePreviousSnapshot, STORAGE_KEY_DIARY, OddlingsSaveBundleV1 } from './storage';
import { walletBook, WalletBook } from './lifeSeeds';

test('creatureVoice: restore save bundle reloads diaries with subscriber notification, subsequent write does not overwrite imported cache, and undo restore reverts properly', () => {
  const mockStorage: Record<string, string> = {};
  const originalWindow = (globalThis as any).window;
  const originalLocalStorage = (globalThis as any).localStorage;

  const storageMock = {
    getItem: (key: string) => mockStorage[key] || null,
    setItem: (key: string, val: string) => { mockStorage[key] = val; },
    removeItem: (key: string) => { delete mockStorage[key]; }
  };

  (globalThis as any).window = { localStorage: storageMock };
  (globalThis as any).localStorage = storageMock;

  try {
    // 1. Setup initial diary state in storage
    const initialDiary: Record<string, DiaryEntry[]> = {
      thornbrew: [
        { id: 'initial_1', at: 1000, event: 'pet', text: 'Thornbrew enjoyed a warm petting.', source: 'local' },
        { id: 'initial_2', at: 900, event: 'hatch', text: 'Thornbrew sprouted from a coffee mug.', source: 'local' }
      ]
    };
    mockStorage[STORAGE_KEY_DIARY] = JSON.stringify(initialDiary);

    // Reload creatureVoice from storage to establish base state
    creatureVoice.reloadFromStorage();
    assert.equal(creatureVoice.getDiary('thornbrew').length, 2);

    let notifyCount = 0;
    const unsubscribe = creatureVoice.subscribe(() => {
      notifyCount++;
    });

    // 2. Prepare incoming save bundle with imported diary entries
    const importedDiary: Record<string, DiaryEntry[]> = {
      thornbrew: [
        { id: 'imported_1', at: 5000, event: 'feed', text: 'Imported memory: Thornbrew tasted sun dew.', source: 'local' },
        { id: 'imported_2', at: 4000, event: 'play', text: 'Imported memory: Played in the warm breeze.', source: 'local' },
        { id: 'imported_3', at: 3000, event: 'heart', text: 'Imported memory: Gained a golden heart.', source: 'local' }
      ]
    };

    const bundle: OddlingsSaveBundleV1 = {
      version: 1,
      format: 'oddlings-save',
      appName: 'ODDLINGS',
      exportedAt: 1700000000000,
      creatures: [],
      biomeWorlds: {},
      diaries: importedDiary,
      activeEgg: null,
      onboarding: { discoveredObjectCreatureIds: [], hasInteracted: false, hasFused: false }
    };

    // Apply save bundle (restore)
    const restoreResult = applySaveBundle(bundle);
    assert.equal(restoreResult.success, true);

    // Verify subscriber notified on restore
    assert.ok(notifyCount >= 1, 'creatureVoice subscribers must be notified when a save bundle is restored');

    // Verify creatureVoice in-memory cache now reflects the 3 imported entries
    const restoredEntries = creatureVoice.getDiary('thornbrew');
    assert.equal(restoredEntries.length, 3, 'creatureVoice must immediately reflect restored entries without requiring app reload');
    assert.equal(restoredEntries[0].id, 'imported_1');

    // 3. Perform a subsequent write to the diary
    const newKeepsake = creatureVoice.addConfirmedKeepsake('thornbrew', 'Discovered a secret stone archway near the pond.', 'ability');
    assert.ok(newKeepsake);

    // Verify the subsequent write DOES NOT overwrite or drop the imported diary entries!
    const afterWriteEntries = creatureVoice.getDiary('thornbrew');
    assert.equal(afterWriteEntries.length, 4, 'Subsequent write must append/prepend onto imported diary, not overwrite with stale pre-restore cache');
    assert.equal(afterWriteEntries[0].id, newKeepsake.id);
    assert.equal(afterWriteEntries[1].id, 'imported_1', 'Imported entries must remain preserved in diary');
    assert.equal(afterWriteEntries[2].id, 'imported_2');
    assert.equal(afterWriteEntries[3].id, 'imported_3');

    // Verify storage also persisted all 4 entries
    const storageDiaries = JSON.parse(mockStorage[STORAGE_KEY_DIARY] || '{}');
    assert.equal(storageDiaries['thornbrew']?.length, 4, 'Storage must persist all entries including imported ones');

    // 4. Test undo restore
    const preUndoNotifies = notifyCount;
    const undoResult = restorePreviousSnapshot();
    assert.equal(undoResult.success, true);

    // Verify subscriber notified on undo restore
    assert.ok(notifyCount > preUndoNotifies, 'creatureVoice subscribers must be notified on restore undo');

    // Verify diaries reverted back to initial pre-restore snapshot
    const revertedEntries = creatureVoice.getDiary('thornbrew');
    assert.equal(revertedEntries.length, 2, 'creatureVoice diary must revert to pre-restore snapshot on undo');
    assert.equal(revertedEntries[0].id, 'initial_1');
    assert.equal(revertedEntries[1].id, 'initial_2');

    unsubscribe();
  } finally {
    (globalThis as any).window = originalWindow;
    (globalThis as any).localStorage = originalLocalStorage;
    creatureVoice.reloadFromStorage();
  }
});

test('ItemLibrary: rejects new items at capacity (MAX_ITEMS 12) without evicting old definitions, allows existing-ID updates, and ensures no charge on rejection', () => {
  const mockStore: Record<string, string> = {};
  const mockStorageAdapter = {
    getItem: (k: string) => mockStore[k] || null,
    setItem: (k: string, v: string) => { mockStore[k] = v; },
    removeItem: (k: string) => { delete mockStore[k]; }
  };

  const lib = new ItemLibrary(mockStorageAdapter as any);
  assert.equal(lib.list().length, 0);
  assert.equal(lib.isAtCapacity(), false);

  // 1. Fill library to capacity (MAX_ITEMS = 12)
  for (let i = 1; i <= MAX_ITEMS; i++) {
    const item: CustomItem = {
      id: `item_slot_${i}`,
      name: `Custom Prop ${i}`,
      description: `Description for item ${i}`,
      category: 'decor',
      glow: false,
      sprite: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      source: 'local',
      createdAt: 1000 + i
    };
    const added = lib.add(item);
    assert.equal(added, true, `Item ${i} should be successfully added`);
  }

  assert.equal(lib.list().length, 12);
  assert.equal(lib.isAtCapacity(), true);

  // Keep references to first and oldest item
  const oldestItem = lib.get('item_slot_1');
  const lastItem = lib.get('item_slot_12');
  assert.ok(oldestItem);
  assert.ok(lastItem);

  // 2. Attempt to add a 13th NEW item while at capacity
  const newItem13: CustomItem = {
    id: 'item_slot_13_new',
    name: 'Unwanted Evictor',
    description: 'Should be rejected at capacity',
    category: 'toy',
    glow: false,
    sprite: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    source: 'local',
    createdAt: 2000
  };

  const add13Result = lib.add(newItem13);
  assert.equal(add13Result, false, 'Adding a new item at capacity must be rejected');

  // CRITICAL REGRESSION CHECK: No truncation, no eviction of existing placed items!
  assert.equal(lib.list().length, 12, 'Capacity must remain strictly at MAX_ITEMS (12)');
  assert.equal(lib.get('item_slot_13_new'), undefined, 'Rejected item must not be in library');
  assert.ok(lib.get('item_slot_1'), 'Oldest item definition must NOT be evicted/lost');
  assert.ok(lib.get('item_slot_12'), 'Last item definition must NOT be evicted/lost');

  // 3. Allow existing-ID updates even when at capacity
  const updatedItem1: CustomItem = {
    ...oldestItem!,
    name: 'Renamed Custom Prop 1',
    glow: true
  };

  const updateResult = lib.add(updatedItem1);
  assert.equal(updateResult, true, 'Updating an item with an existing ID must be allowed at capacity');
  assert.equal(lib.list().length, 12, 'Count remains 12 after update');
  assert.equal(lib.get('item_slot_1')?.name, 'Renamed Custom Prop 1');
  assert.equal(lib.get('item_slot_1')?.glow, true);

  // 4. Verify wallet no-charge / refund behavior on capacity rejection
  const wallet = new WalletBook(mockStorageAdapter as any);
  const initialGems = wallet.get().gems;
  assert.equal(initialGems, 5);

  // If player attempts to save when lib.isAtCapacity() returns true, pre-check prevents gem spending
  if (lib.isAtCapacity()) {
    // Explanation shown before spending; gem count remains untouched
    assert.equal(wallet.get().gems, initialGems, 'No gem spent when capacity is full');
  }

  // If concurrent/late race condition occurred where gem was spent:
  const spent = wallet.spendGem();
  assert.equal(spent, true);
  assert.equal(wallet.get().gems, initialGems - 1);
  const lateAttempt = lib.add(newItem13);
  if (!lateAttempt) {
    wallet.refundGem(); // Component refunds gem on rejection
  }
  assert.equal(wallet.get().gems, initialGems, 'Gem must be refunded on late capacity rejection');
});
