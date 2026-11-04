/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GardenAdventureBook,
  cleanGardenAdventureState,
  deriveCreatureReveal,
  DEFAULT_ADVENTURE_STATE,
  ADVENTURE_STORAGE_KEY
} from './gardenAdventure';
import { INITIAL_ODDLINGS } from './creatureCatalog';
import { createStarterWorld, addDecoration, removeDecoration } from './biomeWorld';
import { BiomeWorldState, DecorationInstance } from './biomeWorldTypes';
import { activateCreatureAbility } from './creatureRules';
import { WalletBook, NEW_WALLET } from './lifeSeeds';

class MockStorage {
  private data: Record<string, string> = {};
  getItem(key: string): string | null {
    return this.data[key] ?? null;
  }
  setItem(key: string, value: string): void {
    this.data[key] = value;
  }
  removeItem(key: string): void {
    delete this.data[key];
  }
  clear(): void {
    this.data = {};
  }
}

test('1. Complete adventure end-to-end with free starter residents', () => {
  const mockStore = new MockStorage();
  const advBook = new GardenAdventureBook(mockStore, new WalletBook(mockStore));
  const thornbrew = JSON.parse(JSON.stringify(INITIAL_ODDLINGS[0])); // Thornbrew (water)
  const luxacanth = JSON.parse(JSON.stringify(INITIAL_ODDLINGS[1])); // Luxacanth (restore)
  thornbrew.biomeId = 'greenhouse';
  luxacanth.biomeId = 'greenhouse';

  let world: BiomeWorldState = { ...createStarterWorld('greenhouse'), decorations: [] as DecorationInstance[] };
  const creatures = [thornbrew, luxacanth];

  // Step 1: Accept adventure (no seed in garden yet)
  const accepted = advBook.accept('greenhouse', world);
  assert.equal(accepted.step, 'accepted');
  assert.equal(accepted.biomeId, 'greenhouse');

  // Step 2: Plant seed
  world = addDecoration(world, 'seed', 15, 12);
  const seed = world.decorations.find((d) => d.type === 'seed')!;
  assert.ok(seed);
  const linked = advBook.linkSeed(seed.id, 'greenhouse');
  assert.equal(linked.step, 'seed_planted');
  assert.equal(linked.seedId, seed.id);

  // Step 3: Starter resident Thornbrew waters seed
  const now = 100000;
  const waterResult = activateCreatureAbility(thornbrew, creatures, world, now, 0);
  assert.equal(waterResult.ok, true);
  assert.equal(waterResult.readyAt, now + 15000);
  assert.equal(waterResult.world.decorations.find((d) => d.id === seed.id)?.wateredAt, now);

  const waterAdv = advBook.recordWatering({ casterId: thornbrew.id }, waterResult.world);
  assert.equal(waterAdv.ok, true);
  assert.equal(waterAdv.state.step, 'watered');
  assert.equal(waterAdv.state.wateredBy, thornbrew.id);

  // Step 4: Second starter resident Luxacanth encourages the sprout
  const encourageAdv = advBook.recordEncouragement(luxacanth.id, waterResult.world);
  assert.equal(encourageAdv.ok, true);
  assert.equal(encourageAdv.state.step, 'bloomed');
  assert.equal(encourageAdv.state.encouragedBy, luxacanth.id);
  assert.equal(encourageAdv.updatedWorld.decorations.find((d) => d.id === seed.id)?.growthStage, 3);

  // Step 5: Claim reward
  const claim = advBook.claimReward(creatures, 'Greenhouse Garden');
  assert.equal(claim.ok, true);
  assert.ok(claim.rewards);
  assert.equal(claim.rewards?.seeds, 1);
  assert.equal(claim.rewards?.gems, 1);
  assert.equal(claim.rewards?.sparkles, 20);

  const completedState = advBook.get();
  assert.equal(completedState.step, 'completed');
  assert.equal(completedState.rewardClaimed, true);
  assert.ok(completedState.completedAt! > 0);

  // Keepsake memory added to participants
  const updatedThornbrew = claim.updatedCreatures?.find((c) => c.id === thornbrew.id);
  assert.ok(updatedThornbrew?.memories[0].text.includes('First Garden Bloom'));
});

test('2. Reload and resume persistence from saved storage', () => {
  const mockStore = new MockStorage();
  const advBook = new GardenAdventureBook(mockStore, new WalletBook(mockStore));
  advBook.accept('greenhouse');
  advBook.linkSeed('seed-abc-123', 'greenhouse');

  const serialized = mockStore.getItem(ADVENTURE_STORAGE_KEY);
  assert.ok(serialized);

  // Create a new instance reading from the same storage
  const reloadedBook = new GardenAdventureBook(mockStore, new WalletBook(mockStore));
  const reloaded = reloadedBook.get();
  assert.equal(reloaded.id, 'adventure-first-garden-v1');
  assert.equal(reloaded.step, 'seed_planted');
  assert.equal(reloaded.seedId, 'seed-abc-123');
  assert.equal(reloaded.biomeId, 'greenhouse');
});

test('3. Invalid target consumes no cooldown or adventure progress', () => {
  const emptyWorld: BiomeWorldState = { ...createStarterWorld('greenhouse'), decorations: [] as DecorationInstance[] };
  const thornbrew = JSON.parse(JSON.stringify(INITIAL_ODDLINGS[0]));
  thornbrew.biomeId = 'greenhouse';
  const creatures = [thornbrew];
  const now = 200000;
  const readyAt = 0;

  // Thornbrew tries to water with no seeds present
  const res = activateCreatureAbility(thornbrew, creatures, emptyWorld, now, readyAt);
  assert.equal(res.ok, false);
  assert.equal(res.readyAt, 0); // Cooldown NOT consumed!
  assert.ok(res.message.includes('Plant a seed'));

  // Adventure watering rejected
  const mockStore = new MockStorage();
  const advBook = new GardenAdventureBook(mockStore, new WalletBook(mockStore));
  advBook.accept('greenhouse');
  const advRes = advBook.recordWatering({ casterId: thornbrew.id }, emptyWorld);
  assert.equal(advRes.ok, false);
  assert.equal(advBook.get().step, 'accepted'); // Does not advance!
});

test('4. Removed target seed handling and seamless replacement', () => {
  const mockStore = new MockStorage();
  const advBook = new GardenAdventureBook(mockStore, new WalletBook(mockStore));

  let world: BiomeWorldState = { ...createStarterWorld('greenhouse'), decorations: [] as DecorationInstance[] };
  world = addDecoration(world, 'seed', 10, 12);
  const seed1 = world.decorations.find((d) => d.type === 'seed')!;

  advBook.accept('greenhouse', world);
  assert.equal(advBook.get().seedId, seed1.id);
  assert.equal(advBook.get().step, 'seed_planted');

  // Player removes seed1 in editor (world now has 0 seeds)
  world = removeDecoration(world, seed1.id);
  const checkAfterRemoval = advBook.verifyTarget(world);
  assert.equal(checkAfterRemoval.valid, false);

  // Player plants replacement seed
  world = addDecoration(world, 'seed', 22, 12);
  const seed2 = world.decorations.find((d) => d.type === 'seed')!;
  advBook.linkSeed(seed2.id, 'greenhouse');

  const checkReplacement = advBook.verifyTarget(world);
  assert.equal(checkReplacement.valid, true);
  assert.equal(checkReplacement.activeSeed?.id, seed2.id);
  assert.equal(advBook.get().step, 'seed_planted');
});

test('5. Moved resident cannot use ability or advance adventure in wrong biome', () => {
  const world = createStarterWorld('greenhouse');
  const thornbrew = JSON.parse(JSON.stringify(INITIAL_ODDLINGS[0]));
  thornbrew.biomeId = 'desk'; // Different biome!
  const creatures = [thornbrew];
  const now = 300000;

  const res = activateCreatureAbility(thornbrew, creatures, world, now, 0);
  assert.equal(res.ok, false);
  assert.equal(res.readyAt, 0); // 0 cooldown consumed
  assert.ok(res.message.includes('Move this Oddling here'));

  const mockStore = new MockStorage();
  const advBook = new GardenAdventureBook(mockStore, new WalletBook(mockStore));
  advBook.accept('greenhouse');
  const advRes = advBook.recordWatering({ casterId: thornbrew.id }, world);
  assert.equal(advRes.ok, false);
});

test('6. Duplicate contribution by same resident is rejected (requires second resident)', () => {
  const mockStore = new MockStorage();
  const advBook = new GardenAdventureBook(mockStore, new WalletBook(mockStore));
  const thornbrew = JSON.parse(JSON.stringify(INITIAL_ODDLINGS[0]));
  const luxacanth = JSON.parse(JSON.stringify(INITIAL_ODDLINGS[1]));
  thornbrew.biomeId = 'greenhouse';
  luxacanth.biomeId = 'greenhouse';

  let world: BiomeWorldState = { ...createStarterWorld('greenhouse'), decorations: [] as DecorationInstance[] };
  world = addDecoration(world, 'seed', 15, 12);

  advBook.accept('greenhouse', world);
  advBook.recordWatering({ casterId: thornbrew.id }, world);
  assert.equal(advBook.get().step, 'watered');

  // Thornbrew tries to also do the encouragement step
  const sameResidentEncourage = advBook.recordEncouragement(thornbrew.id, world);
  assert.equal(sameResidentEncourage.ok, false);
  assert.ok(sameResidentEncourage.message.includes('second distinct resident'));
  assert.equal(advBook.get().step, 'watered'); // Still waiting for second resident!

  // Second resident Luxacanth succeeds
  const secondResidentEncourage = advBook.recordEncouragement(luxacanth.id, world);
  assert.equal(secondResidentEncourage.ok, true);
  assert.equal(advBook.get().step, 'bloomed');
});

test('7. Idempotent reward claim prevents repeated claim and duplicate currency award', () => {
  const mockStore = new MockStorage();
  const advBook = new GardenAdventureBook(mockStore, new WalletBook(mockStore));
  const thornbrew = JSON.parse(JSON.stringify(INITIAL_ODDLINGS[0]));
  const luxacanth = JSON.parse(JSON.stringify(INITIAL_ODDLINGS[1]));
  thornbrew.biomeId = 'greenhouse';
  luxacanth.biomeId = 'greenhouse';

  let world: BiomeWorldState = { ...createStarterWorld('greenhouse'), decorations: [] as DecorationInstance[] };
  world = addDecoration(world, 'seed', 15, 12);

  advBook.accept('greenhouse', world);
  advBook.recordWatering({ casterId: thornbrew.id }, world);
  advBook.recordEncouragement(luxacanth.id, world);
  assert.equal(advBook.get().step, 'bloomed');

  // First claim
  const claim1 = advBook.claimReward([thornbrew, luxacanth]);
  assert.equal(claim1.ok, true);
  assert.equal(advBook.get().rewardClaimed, true);

  // Second claim attempt (e.g. repeated click or duplicate event)
  const claim2 = advBook.claimReward([thornbrew, luxacanth]);
  assert.equal(claim2.ok, false);
  assert.ok(claim2.message.includes('already claimed'));
  assert.equal(claim2.rewards, undefined);
});

test('8. Rain satisfies watering step once without terrain tile damage and cannot complete bloom alone', () => {
  const mockStore = new MockStorage();
  const advBook = new GardenAdventureBook(mockStore, new WalletBook(mockStore));

  let world: BiomeWorldState = { ...createStarterWorld('greenhouse'), decorations: [] as DecorationInstance[] };
  world = addDecoration(world, 'seed', 15, 12);
  const originalTiles = JSON.stringify(world.tiles);

  advBook.accept('greenhouse', world);
  const rainWatering = advBook.recordWatering({ isRain: true }, world);
  assert.equal(rainWatering.ok, true);
  assert.equal(rainWatering.state.step, 'watered');
  assert.equal(rainWatering.state.wateredBy, 'rain');

  // Verify terrain tiles remain completely intact (no terrain damage)
  assert.equal(JSON.stringify(world.tiles), originalTiles);

  // Rain cannot complete encouragement / bloom step on its own
  const rainEncouragement = advBook.recordEncouragement('rain', world);
  assert.equal(rainEncouragement.ok, false);
  assert.equal(advBook.get().step, 'watered');
});

test('9. Trait reveal derives directly from accepted DNA with no invented claims or extra requests', () => {
  const thornbrew = JSON.parse(JSON.stringify(INITIAL_ODDLINGS[0]));
  const reveal = deriveCreatureReveal(thornbrew);
  assert.equal(reveal.name, 'Thornbrew');
  assert.ok(reveal.objectName.includes('Coffee Mug'));
  assert.ok(reveal.material.includes('Glazed Stoneware'));
  assert.equal(reveal.effectKind, 'water');
  assert.ok(reveal.effectLabel.includes('Water seeds'));
  assert.equal(reveal.isStarter, true);
});

test('10. Generation failure refunds reserved resources and retains state for retry', () => {
  const walletStore = new MockStorage();
  const testWallet = new WalletBook(walletStore);
  const initialSeeds = testWallet.get().seeds;

  // Simulate reservation
  const spent = testWallet.spendSeed();
  assert.equal(spent, true);
  assert.equal(testWallet.get().seeds, initialSeeds - 1);

  // On simulated API failure, refund is called
  testWallet.refundSeed();
  assert.equal(testWallet.get().seeds, initialSeeds);

  // Same for craft gems
  const initialGems = testWallet.get().gems;
  testWallet.spendGem();
  assert.equal(testWallet.get().gems, initialGems - 1);
  testWallet.refundGem();
  assert.equal(testWallet.get().gems, initialGems);
});

test('11. When watered by rain, TWO distinct actual residents are strictly required before blooming', () => {
  const mockStore = new MockStorage();
  const advBook = new GardenAdventureBook(mockStore, new WalletBook(mockStore));
  const thornbrew = JSON.parse(JSON.stringify(INITIAL_ODDLINGS[0]));
  const luxacanth = JSON.parse(JSON.stringify(INITIAL_ODDLINGS[1]));
  thornbrew.biomeId = 'greenhouse';
  luxacanth.biomeId = 'greenhouse';

  let world: BiomeWorldState = { ...createStarterWorld('greenhouse'), decorations: [] as DecorationInstance[] };
  world = addDecoration(world, 'seed', 15, 12);

  advBook.accept('greenhouse', world);
  // Rain waters seed
  const rainWater = advBook.recordWatering({ isRain: true }, world);
  assert.equal(rainWater.ok, true);
  assert.equal(rainWater.state.step, 'watered');
  assert.equal(rainWater.state.wateredBy, 'rain');
  assert.deepEqual(rainWater.state.contributors, []);

  // First resident nurtures
  const res1 = advBook.recordEncouragement(thornbrew.id, world);
  assert.equal(res1.ok, true);
  assert.equal(advBook.get().step, 'encouraged');
  assert.deepEqual(advBook.get().contributors, [thornbrew.id]);

  // First resident tries again -> rejected
  const res1Again = advBook.recordEncouragement(thornbrew.id, world);
  assert.equal(res1Again.ok, false);
  assert.equal(advBook.get().step, 'encouraged');

  // Second distinct resident nurtures -> blooms!
  const res2 = advBook.recordEncouragement(luxacanth.id, world);
  assert.equal(res2.ok, true);
  assert.equal(advBook.get().step, 'bloomed');
  assert.deepEqual(advBook.get().contributors, [thornbrew.id, luxacanth.id]);
});

test('12. An adventure save that fails after payment keeps the reward and finishes on retry without paying twice', () => {
  let failWrite = false;
  const failingStore = {
    data: {} as Record<string, string>,
    getItem(key: string) { return this.data[key] ?? null; },
    setItem(key: string, value: string) {
      if (failWrite) throw new Error('QuotaExceededError');
      this.data[key] = value;
    },
    removeItem(key: string) { delete this.data[key]; },
    clear() { this.data = {}; }
  };
  const wallet = new WalletBook(new MockStorage());
  const advBook = new GardenAdventureBook(failingStore, wallet);
  const thornbrew = JSON.parse(JSON.stringify(INITIAL_ODDLINGS[0]));
  const luxacanth = JSON.parse(JSON.stringify(INITIAL_ODDLINGS[1]));
  thornbrew.biomeId = 'greenhouse';
  luxacanth.biomeId = 'greenhouse';

  let world: BiomeWorldState = { ...createStarterWorld('greenhouse'), decorations: [] as DecorationInstance[] };
  world = addDecoration(world, 'seed', 15, 12);
  advBook.accept('greenhouse', world);
  advBook.recordWatering({ casterId: thornbrew.id }, world);
  advBook.recordEncouragement(luxacanth.id, world);
  assert.equal(advBook.get().step, 'bloomed');
  const before = wallet.get().sparkles;

  // The wallet pays, then the adventure save crashes
  failWrite = true;
  const first = advBook.claimReward([thornbrew, luxacanth]);
  assert.equal(first.ok, false);
  assert.match(first.message, /safe in your wallet/);
  assert.equal(wallet.get().sparkles, before + 20, 'paid once');
  assert.ok(wallet.hasReceipt('adventure-first-garden-v1'));
  assert.equal(advBook.get().step, 'bloomed', 'not marked complete yet');

  // Claiming again finishes it and pays nothing more
  failWrite = false;
  const second = advBook.claimReward([thornbrew, luxacanth]);
  assert.equal(second.ok, true);
  assert.deepEqual(second.rewards, { seeds: 0, gems: 0, sparkles: 0 });
  assert.equal(wallet.get().sparkles, before + 20, 'still paid only once');
  assert.equal(advBook.get().step, 'completed');
  assert.equal(advBook.get().rewardClaimed, true);
});

test('12b. A wallet save that fails pays nothing and leaves the adventure ready to claim', () => {
  const brokenWallet = new WalletBook({ getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); } });
  const advBook = new GardenAdventureBook(new MockStorage(), brokenWallet);
  const thornbrew = JSON.parse(JSON.stringify(INITIAL_ODDLINGS[0]));
  const luxacanth = JSON.parse(JSON.stringify(INITIAL_ODDLINGS[1]));
  thornbrew.biomeId = 'greenhouse';
  luxacanth.biomeId = 'greenhouse';
  let world: BiomeWorldState = { ...createStarterWorld('greenhouse'), decorations: [] as DecorationInstance[] };
  world = addDecoration(world, 'seed', 15, 12);
  advBook.accept('greenhouse', world);
  advBook.recordWatering({ casterId: thornbrew.id }, world);
  advBook.recordEncouragement(luxacanth.id, world);

  const result = advBook.claimReward([thornbrew, luxacanth]);
  assert.equal(result.ok, false);
  assert.equal(result.rewards, undefined);
  assert.equal(advBook.get().step, 'bloomed');
  assert.equal(advBook.get().rewardClaimed, false);
});

test('13. Target seed replacement with unwatered seed reverts stage to seed_planted', () => {
  const mockStore = new MockStorage();
  const advBook = new GardenAdventureBook(mockStore, new WalletBook(mockStore));
  const thornbrew = JSON.parse(JSON.stringify(INITIAL_ODDLINGS[0]));
  thornbrew.biomeId = 'greenhouse';

  let world: BiomeWorldState = { ...createStarterWorld('greenhouse'), decorations: [] as DecorationInstance[] };
  world = addDecoration(world, 'seed', 15, 12);
  const originalSeedId = world.decorations.find((d) => d.type === 'seed')!.id;

  advBook.accept('greenhouse', world);
  advBook.recordWatering({ casterId: thornbrew.id }, world);
  assert.equal(advBook.get().step, 'watered');

  // Delete original seed and plant a fresh unwatered seed
  world = removeDecoration(world, originalSeedId);
  world = addDecoration(world, 'seed', 20, 12);
  const newSeedId = world.decorations.find((d) => d.type === 'seed')!.id;

  // Verifying target should detect the replacement and revert from 'watered' back to 'seed_planted'
  const verification = advBook.verifyTarget(world);
  assert.equal(verification.status, 'replaced');
  assert.equal(advBook.get().step, 'seed_planted');
  assert.equal(advBook.get().seedId, newSeedId);
  assert.equal(advBook.get().wateredBy, null);
});
