/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * First Garden Adventure: A persistent, connected, optional adventure.
 * Flow:
 * 1. Accepted -> seed selected / planted in garden.
 * 2. Watered -> by starter resident Thornbrew (water ability) or natural rain.
 * 3. Encouraged -> by a second distinct resident like starter Luxacanth (restore ability).
 *    (TWO distinct actual residents required; rain contributes once only to watering).
 * 4. Bloomed -> flower bursts into radiant bloom.
 * 5. Reward Claimed -> atomic, idempotent reward (+1 Life Seed, +1 Craft Gem, +20 Sparkle Coins),
 *    friendship heart boost, and confirmed factual diary keepsake without model request.
 */

import { CreatureDNA } from './creatureTypes';
import { BiomeWorldState, DecorationInstance } from './biomeWorldTypes';
import { getAbilityEffect } from './creatureRules';
import { walletBook, WalletBook } from './lifeSeeds';
import { creatureVoice } from './creatureVoice';
import { clampTrust } from './gifts';

export const ADVENTURE_STORAGE_KEY = 'oddlings_garden_adventure_v1';
export const STABLE_ADVENTURE_ID = 'adventure-first-garden-v1';

export type AdventureStep =
  | 'not_started'
  | 'accepted'
  | 'seed_planted'
  | 'watered'
  | 'encouraged'
  | 'bloomed'
  | 'completed';

export interface GardenAdventureState {
  id: string;
  step: AdventureStep;
  biomeId: string;
  seedId: string | null;
  wateredBy: string | null; // creature id or 'rain'
  encouragedBy: string | null; // creature id of second resident
  contributors: string[]; // unique resident creature IDs who contributed
  rewardClaimed: boolean;
  acceptedAt?: number;
  completedAt?: number;
}

export const DEFAULT_ADVENTURE_STATE: GardenAdventureState = {
  id: STABLE_ADVENTURE_ID,
  step: 'not_started',
  biomeId: 'greenhouse',
  seedId: null,
  wateredBy: null,
  encouragedBy: null,
  contributors: [],
  rewardClaimed: false
};

const VALID_STEPS: AdventureStep[] = [
  'not_started',
  'accepted',
  'seed_planted',
  'watered',
  'encouraged',
  'bloomed',
  'completed'
];

export function cleanGardenAdventureState(raw: any): GardenAdventureState {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_ADVENTURE_STATE };
  }
  const step = VALID_STEPS.includes(raw.step) ? (raw.step as AdventureStep) : 'not_started';
  const rawBiome = typeof raw.biomeId === 'string' && raw.biomeId.trim() ? raw.biomeId.trim() : 'greenhouse';
  const biomeId = rawBiome === 'desk' || rawBiome === 'lab' ? 'greenhouse' : rawBiome;
  const seedId = typeof raw.seedId === 'string' && raw.seedId.trim() ? raw.seedId.trim() : null;
  const wateredBy = typeof raw.wateredBy === 'string' && raw.wateredBy.trim() ? raw.wateredBy.trim() : null;
  const encouragedBy = typeof raw.encouragedBy === 'string' && raw.encouragedBy.trim() ? raw.encouragedBy.trim() : null;
  const rewardClaimed = Boolean(raw.rewardClaimed);
  const acceptedAt = typeof raw.acceptedAt === 'number' && Number.isFinite(raw.acceptedAt) ? raw.acceptedAt : undefined;
  const completedAt = typeof raw.completedAt === 'number' && Number.isFinite(raw.completedAt) ? raw.completedAt : undefined;

  let contributors: string[] = [];
  if (Array.isArray(raw.contributors)) {
    contributors = Array.from(new Set(raw.contributors.map(String).filter((s: string) => s.trim().length > 0)));
  } else {
    if (wateredBy && wateredBy !== 'rain') contributors.push(wateredBy);
    if (encouragedBy && !contributors.includes(encouragedBy)) contributors.push(encouragedBy);
  }

  return {
    id: STABLE_ADVENTURE_ID,
    step,
    biomeId,
    seedId,
    wateredBy,
    encouragedBy,
    contributors,
    rewardClaimed,
    acceptedAt,
    completedAt
  };
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const safeBrowserStore = (): StorageLike | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};

/**
 * Concise original photo -> validated inherited trait -> actual game-effect reveal.
 * Derived directly from final accepted creature DNA without extra model requests.
 */
export interface CreatureTraitReveal {
  creatureId: string;
  name: string;
  photoUrl: string | null;
  objectName: string;
  material: string;
  inheritedTrait: string;
  effectKind: 'water' | 'restore' | 'inspire';
  effectLabel: string;
  effectDescription: string;
  isStarter: boolean;
  isFallback: boolean;
}

export function deriveCreatureReveal(creature: CreatureDNA): CreatureTraitReveal {
  const effect = getAbilityEffect(creature);
  const inheritedTrait =
    (Array.isArray(creature.lineage?.inheritedTraits) && creature.lineage.inheritedTraits[0]) ||
    (Array.isArray(creature.memories) &&
      creature.memories.find((m) => typeof m?.text === 'string' && m.text.startsWith('Inherent trait:'))?.text.replace('Inherent trait:', '').trim()) ||
    creature.specialAbility.description ||
    'Cozy companion essence';

  const photoUrl = creature.sourceObject?.userPhotoUrl || creature.sourceObject?.spritePhotoUrl || null;
  const objectName = creature.sourceObject?.name || creature.name;
  const material = creature.sourceObject?.material || 'Handcrafted';
  const isStarter = creature.id === 'oddling-thornbrew' || creature.id === 'oddling-luxacanth';
  const isFallback = effect.kind === 'inspire' && !/inspire|cheer|trust/.test(creature.specialAbility.name.toLowerCase());

  return {
    creatureId: creature.id,
    name: creature.name,
    photoUrl,
    objectName,
    material,
    inheritedTrait,
    effectKind: effect.kind,
    effectLabel: effect.label,
    effectDescription: effect.description,
    isStarter,
    isFallback
  };
}

export class GardenAdventureBook {
  private listeners = new Set<() => void>();
  private store: StorageLike | null;

  /** The wallet that pays the reward; tests pass their own */
  private wallet: Pick<WalletBook, 'claimOnce'>;

  constructor(store: StorageLike | null = safeBrowserStore(), wallet: Pick<WalletBook, 'claimOnce'> = walletBook) {
    this.store = store;
    this.wallet = wallet;
  }

  get(): GardenAdventureState {
    try {
      const raw = this.store?.getItem(ADVENTURE_STORAGE_KEY);
      if (!raw) return { ...DEFAULT_ADVENTURE_STATE };
      return cleanGardenAdventureState(JSON.parse(raw));
    } catch {
      return { ...DEFAULT_ADVENTURE_STATE };
    }
  }

  save(state: GardenAdventureState): boolean {
    const cleaned = cleanGardenAdventureState(state);
    try {
      this.store?.setItem(ADVENTURE_STORAGE_KEY, JSON.stringify(cleaned));
      this.emit();
      return true;
    } catch {
      this.emit();
      return false;
    }
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit(): void {
    this.listeners.forEach((fn) => fn());
  }

  /**
   * Accepts the First Garden Adventure in the current active biome.
   * If a seed is already planted in the biome, links to it immediately.
   */
  accept(biomeId: string, world?: BiomeWorldState): GardenAdventureState {
    const current = this.get();
    if (current.step !== 'not_started') return current;

    const existingSeed = world?.decorations.find((d) => d.type === 'seed');
    const next: GardenAdventureState = {
      ...current,
      id: STABLE_ADVENTURE_ID,
      step: existingSeed ? 'seed_planted' : 'accepted',
      biomeId,
      seedId: existingSeed ? existingSeed.id : null,
      contributors: [],
      acceptedAt: Date.now()
    };
    this.save(next);
    return next;
  }

  /**
   * Links or replaces the target seed decoration.
   * Called when a seed is placed in the active biome or when replacing a removed seed.
   * If replacing a seed that was removed while at 'watered', checks if replacement seed is watered.
   */
  linkSeed(seedId: string, biomeId: string, isWatered = false): GardenAdventureState {
    const current = this.get();
    if (current.step === 'not_started' || current.step === 'completed') return current;

    let nextStep: AdventureStep = current.step;
    let nextWateredBy = current.wateredBy;
    let nextContributors = current.contributors;

    if (current.step === 'accepted') {
      nextStep = 'seed_planted';
    } else if (current.step === 'watered' && !isWatered) {
      // The previous watered target was destroyed; the fresh new seed needs watering
      nextStep = 'seed_planted';
      nextWateredBy = null;
      nextContributors = [];
    }

    const next: GardenAdventureState = {
      ...current,
      biomeId,
      seedId,
      step: nextStep,
      wateredBy: nextWateredBy,
      contributors: nextContributors
    };
    this.save(next);
    return next;
  }

  /**
   * Verifies the target seed in the world.
   * Handles target replacement when a seed was removed or moved in editor mode.
   */
  verifyTarget(world: BiomeWorldState): { valid: boolean; activeSeed: DecorationInstance | null; status?: 'valid' | 'replaced' | 'missing'; reason?: string } {
    const current = this.get();
    if (current.step === 'not_started') {
      return { valid: false, activeSeed: null, status: 'missing', reason: 'Adventure not yet started' };
    }
    if (world.biome !== current.biomeId) {
      return { valid: false, activeSeed: null, status: 'missing', reason: `Adventure is set for biome '${current.biomeId}'` };
    }

    if (current.seedId) {
      const match = world.decorations.find((d) => d.id === current.seedId && d.type === 'seed');
      if (match) {
        return { valid: true, activeSeed: match, status: 'valid' };
      }
    }

    // Target seed was removed or missing: auto-discover an alternate seed in the same biome
    const alternateSeed = world.decorations.find((d) => d.type === 'seed');
    if (alternateSeed) {
      const isWatered = Boolean(alternateSeed.wateredAt);
      const step: AdventureStep = current.step === 'watered' && !isWatered ? 'seed_planted' : current.step;
      const wateredBy = step === 'seed_planted' ? null : current.wateredBy;
      const contributors = step === 'seed_planted' ? [] : current.contributors;

      const next = {
        ...current,
        seedId: alternateSeed.id,
        step,
        wateredBy,
        contributors
      };
      this.save(next);
      return { valid: true, activeSeed: alternateSeed, status: 'replaced' };
    }

    return { valid: false, activeSeed: null, status: 'missing', reason: 'No seeds currently planted in this garden' };
  }

  /**
   * Connects real ability outcome or rain to the watering step.
   * Invalid targets consume no adventure progress.
   */
  recordWatering(
    source: { casterId: string } | { isRain: boolean },
    world: BiomeWorldState
  ): { ok: boolean; message: string; state: GardenAdventureState } {
    const current = this.get();
    if (current.step !== 'seed_planted') {
      return { ok: false, message: 'Adventure is not waiting for watering.', state: current };
    }
    if (world.biome !== current.biomeId) {
      return { ok: false, message: `Switch to ${current.biomeId} garden first.`, state: current };
    }

    const { valid, activeSeed } = this.verifyTarget(world);
    if (!valid || !activeSeed) {
      return { ok: false, message: 'Please plant a seed in this biome first.', state: current };
    }

    const isRain = 'isRain' in source && source.isRain;
    const wateredBy = isRain ? 'rain' : (source as { casterId: string }).casterId;
    const contributors = isRain ? [] : [wateredBy];

    const next: GardenAdventureState = {
      ...current,
      step: 'watered',
      wateredBy,
      contributors
    };
    this.save(next);
    return { ok: true, message: `Garden seed watered by ${isRain ? 'gentle rain' : 'resident'}!`, state: next };
  }

  /**
   * Connects encouragement by a second distinct resident to bloom the plant.
   * TWO distinct actual residents required; rain contributes once only to watering.
   */
  recordEncouragement(
    casterId: string,
    world: BiomeWorldState
  ): { ok: boolean; message: string; state: GardenAdventureState; updatedWorld: BiomeWorldState } {
    const current = this.get();
    if (casterId === 'rain' || !casterId) {
      return {
        ok: false,
        message: 'A living resident must encourage the sprout, not weather!',
        state: current,
        updatedWorld: world
      };
    }

    if (current.step !== 'watered' && current.step !== 'encouraged') {
      return { ok: false, message: 'Seed must be watered before encouragement.', state: current, updatedWorld: world };
    }
    if (world.biome !== current.biomeId) {
      return { ok: false, message: `Switch to ${current.biomeId} garden first.`, state: current, updatedWorld: world };
    }

    const { valid, activeSeed } = this.verifyTarget(world);
    if (!valid || !activeSeed) {
      return { ok: false, message: 'Target seed not found in this garden.', state: current, updatedWorld: world };
    }

    // Must be a distinct resident (cannot repeat the same resident who already contributed)
    if (current.contributors.includes(casterId)) {
      return {
        ok: false,
        message: 'A second distinct resident needs to encourage the sprout to complete the bloom!',
        state: current,
        updatedWorld: world
      };
    }

    const nextContributors = [...current.contributors, casterId];

    // If rain watered it and this is the first resident:
    if (current.wateredBy === 'rain' && nextContributors.length < 2) {
      const next: GardenAdventureState = {
        ...current,
        step: 'encouraged',
        encouragedBy: casterId,
        contributors: nextContributors
      };
      this.save(next);
      return {
        ok: true,
        message: 'Sprout nurtured by resident! A second resident is now needed to complete the bloom.',
        state: next,
        updatedWorld: world
      };
    }

    // Two distinct residents have now contributed! Bloom the seed in the world
    const updatedDecorations = world.decorations.map((d) =>
      d.id === activeSeed.id ? { ...d, growthStage: 3 as const, wateredAt: Date.now() } : d
    );
    const updatedWorld: BiomeWorldState = {
      ...world,
      decorations: updatedDecorations,
      updatedAt: Date.now()
    };

    const next: GardenAdventureState = {
      ...current,
      step: 'bloomed',
      encouragedBy: casterId,
      contributors: nextContributors
    };
    this.save(next);

    return {
      ok: true,
      message: 'The sprout was encouraged by a second resident and burst into full bloom! 🌸',
      state: next,
      updatedWorld
    };
  }

  /**
   * Claims the adventure reward atomically and idempotently.
   * Prevents duplicate events, repeated claims, simultaneous tabs, and storage crashes.
   */
  claimReward(
    creatures: CreatureDNA[],
    biomeTitle = 'Garden'
  ): {
    ok: boolean;
    message: string;
    rewards?: { seeds: number; gems: number; sparkles: number };
    updatedCreatures?: CreatureDNA[];
  } {
    // Re-read directly from storage to catch concurrent tab claim
    const freshRaw = this.store?.getItem(ADVENTURE_STORAGE_KEY);
    const current = freshRaw ? cleanGardenAdventureState(JSON.parse(freshRaw)) : this.get();

    if (current.rewardClaimed) {
      return { ok: false, message: 'Garden Adventure reward was already claimed!' };
    }
    if (current.step !== 'bloomed') {
      return { ok: false, message: 'The seed must bloom before claiming the reward.' };
    }

    // 1. Pay first. The currency and a receipt for this adventure are saved together in the wallet,
    //    so the reward is either fully paid and recorded or not paid at all.
    const grant = this.wallet.claimOnce(STABLE_ADVENTURE_ID, 1, 1, 20);
    if (grant === 'failed') {
      return { ok: false, message: 'Could not save your reward, so nothing was claimed. Please try again.' };
    }

    // 2. Then mark the adventure complete. If this save fails, the receipt means the next claim
    //    finishes it without paying again.
    const now = Date.now();
    const next: GardenAdventureState = {
      ...current,
      step: 'completed',
      rewardClaimed: true,
      completedAt: now
    };
    const serialized = JSON.stringify(cleanGardenAdventureState(next));
    try {
      this.store?.setItem(ADVENTURE_STORAGE_KEY, serialized);
      if (this.store && this.store.getItem(ADVENTURE_STORAGE_KEY) !== serialized) throw new Error('not saved');
    } catch {
      return { ok: false, message: 'Your reward is safe in your wallet. Claim again to finish the adventure.' };
    }

    this.emit();

    // A claim that only finished an interrupted one pays nothing new
    const rewards = grant === 'granted' ? { seeds: 1, gems: 1, sparkles: 20 } : { seeds: 0, gems: 0, sparkles: 0 };

    // Identify the two contributing residents for factual keepsake diary & memory
    const contribIds = current.contributors.length > 0
      ? current.contributors
      : [current.wateredBy, current.encouragedBy].filter((id): id is string => Boolean(id) && id !== 'rain');

    const contributingCreatures = creatures.filter((c) => contribIds.includes(c.id));
    const targetResidents = contributingCreatures.length > 0 ? contributingCreatures : creatures.slice(0, 2);

    const names = targetResidents.map((c) => c.name).join(' & ') || 'residents';
    const factMemory = `First Garden Bloom in ${biomeTitle}: nurtured with ${names}!`;

    const updatedCreatures = creatures.map((c) => {
      const isContrib = targetResidents.some((k) => k.id === c.id);
      if (!isContrib) return c;

      // Record confirmed factual diary keepsake without model call
      try {
        creatureVoice.addConfirmedKeepsake?.(c.id, factMemory, 'ability');
      } catch {
        // Safe fallback
      }

      return {
        ...c,
        stats: {
          ...c.stats,
          trust: clampTrust(c.stats.trust, 15)
        },
        memories: [
          { timestamp: now, text: factMemory, type: 'play' as const },
          ...c.memories.slice(0, 15)
        ]
      };
    });

    return {
      ok: true,
      message: grant === 'granted'
        ? 'Claimed First Garden Celebration! +1 Life Seed, +1 Craft Gem, +20 Sparkle Coins.'
        : 'First Garden Celebration complete! Your reward was already in your wallet.',
      rewards,
      updatedCreatures
    };
  }

  /**
   * Resets adventure to initial state (for testing or new cycle).
   */
  reset(): void {
    this.save({ ...DEFAULT_ADVENTURE_STATE });
  }
}

export const gardenAdventure = new GardenAdventureBook();
