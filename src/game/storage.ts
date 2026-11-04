import { normalizeHome, isWorldRegionId } from './worldRegions';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CreatureDNA, FirstRunGoals, VisualPlan, ObjectArchetype, IncubatorEgg, INCUBATION_DURATION_SECONDS } from './creatureTypes';
import { INITIAL_ODDLINGS } from './creatureCatalog';
import { 
  deriveArchetypeFromObject, 
  createDefaultVisualPlan, 
  normalizeAndCenterCompositional, 
  createCompositionalSilhouette,
  createComputerMouseSilhouette,
  isCompositionalMalformed,
  collectCreatureSemanticText,
  detectUtensilOrToolType
} from './creatureRules';
import { HabitatThemeId, BiomeWorldState, GardenTasksState, CustomBiomeRecord } from './biomeWorldTypes';
import { getStorageKey, sanitizeBiomeWorld, loadBiomeWorldFromStorage, isWorldTerrainEmpty } from './biomeWorld';
import { STORAGE_KEY_CUSTOM_BIOMES, getCustomBiomesList, saveCustomBiomesList } from './customBiomeStorage';
import { GardenAdventureState, gardenAdventure, cleanGardenAdventureState, DEFAULT_ADVENTURE_STATE, ADVENTURE_STORAGE_KEY } from './gardenAdventure';
import { Wallet, walletBook, cleanWallet, NEW_WALLET, WALLET_KEY } from './lifeSeeds';
import { DIARY_KEY, creatureVoice } from './creatureVoice';
import { ITEMS_KEY, CustomItem, validItem } from './customItems';
import { customItemLibrary } from './customItemStore';

export const STORAGE_KEY_CREATURES = 'oddlings_collection_v2';
export const STORAGE_KEY_GOALS = 'oddlings_goals_v2';
export const STORAGE_KEY_ACTIVE_EGG = 'oddlings_active_egg_v1';
export const STORAGE_KEY_GARDEN_TASKS = 'oddlings_garden_tasks_v1';
export const STORAGE_KEY_GARDEN_ADVENTURE = ADVENTURE_STORAGE_KEY;
export const STORAGE_KEY_WALLET = WALLET_KEY;
export const STORAGE_KEY_DIARY = DIARY_KEY;
export const STORAGE_KEY_CUSTOM_ITEMS = ITEMS_KEY;
export const STORAGE_KEY_PRE_RESTORE_SNAPSHOT = 'oddlings_pre_restore_snapshot_v1';
export const SAVE_FORMAT_IDENTIFIER = 'oddlings-save';
export const CURRENT_SAVE_VERSION = 1;
export const MAX_SAVE_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB safe ceiling

/**
 * Validates and sanitizes a single creature record from storage.
 * Seamlessly migrates older saves without visualPlan to object-grounded anatomy.
 * Returns null if irrecoverably malformed.
 */
export function sanitizeCreature(data: unknown): CreatureDNA | null {
  if (!data || typeof data !== 'object') return null;
  const raw = data as Record<string, unknown>;

  if (typeof raw.id !== 'string' || typeof raw.name !== 'string') return null;

  const rawStats = (raw.stats as Record<string, unknown>) || {};
  const trust = Math.max(0, Math.min(100, typeof rawStats.trust === 'number' && !isNaN(rawStats.trust) ? rawStats.trust : 50));
  const energy = Math.max(0, Math.min(100, typeof rawStats.energy === 'number' && !isNaN(rawStats.energy) ? rawStats.energy : 80));
  const curiosity = Math.max(0, Math.min(100, typeof rawStats.curiosity === 'number' && !isNaN(rawStats.curiosity) ? rawStats.curiosity : 70));
  const generation = Math.max(1, typeof rawStats.generation === 'number' && !isNaN(rawStats.generation) ? rawStats.generation : 1);

  const rawAppearance = (raw.appearance as Record<string, unknown>) || {};
  const primaryColor = typeof rawAppearance.primaryColor === 'string' ? rawAppearance.primaryColor : '#e07a5f';
  const secondaryColor = typeof rawAppearance.secondaryColor === 'string' ? rawAppearance.secondaryColor : '#40916c';
  const accentColor = typeof rawAppearance.accentColor === 'string' ? rawAppearance.accentColor : '#ffe8d6';

  // Gather full rich semantic context (including Latin species, abilities, traits, etc.)
  const semanticText = collectCreatureSemanticText(raw);

  const rawSource = (raw.sourceObject as Record<string, unknown>) || {};
  let sourceObjectName = typeof rawSource.name === 'string' ? rawSource.name : 'Real-world Object';
  const sourceObjectMaterial = typeof rawSource.material === 'string' ? rawSource.material : 'Unknown Material';

  // Repair lost object noun in legacy saves if name is just a material or creature name
  if (
    sourceObjectName === 'Real-world Object' ||
    sourceObjectName.toLowerCase() === sourceObjectMaterial.toLowerCase() ||
    sourceObjectName.toLowerCase() === String(raw.name).toLowerCase()
  ) {
    const detected = detectUtensilOrToolType(semanticText);
    if (detected === 'computer_mouse') sourceObjectName = 'Wired Computer Mouse';
    else if (detected === 'fork') sourceObjectName = 'Dinner Fork';
    else if (detected === 'spoon') sourceObjectName = 'Soup Spoon';
    else if (detected === 'knife') sourceObjectName = 'Dinner Knife';
    else if (detected === 'tool') sourceObjectName = 'Workshop Tool';
    else if (detected === 'footwear') sourceObjectName = 'Footwear';
    else if (detected === 'keys') sourceObjectName = 'Key';
    else if (detected === 'bag') sourceObjectName = 'Bag';
  }

  const sourceObject = {
    name: sourceObjectName,
    category: typeof rawSource.category === 'string' ? rawSource.category : 'Everyday Item',
    material: sourceObjectMaterial,
    description: typeof rawSource.description === 'string' ? rawSource.description : '',
    imageCutout: typeof rawSource.imageCutout === 'string' ? rawSource.imageCutout : undefined,
    userPhotoUrl: typeof rawSource.userPhotoUrl === 'string' ? rawSource.userPhotoUrl : undefined,
    spritePhotoUrl: typeof rawSource.spritePhotoUrl === 'string' ? rawSource.spritePhotoUrl : undefined,
    selectionRegion: rawSource.selectionRegion as CreatureDNA['sourceObject']['selectionRegion']
  };

  // Migrate or validate VisualPlan
  let visualPlan: VisualPlan;
  const rawPlan = rawAppearance.visualPlan as Record<string, unknown> | undefined;
  const validArchetypes: ObjectArchetype[] = ['cup', 'cactus', 'lamp', 'headphones', 'teapot', 'honey_jar', 'pocket_watch', 'lemon', 'compositional', 'curio'];

  if (raw.id === 'oddling-thornbrew') {
    visualPlan = INITIAL_ODDLINGS[0].appearance.visualPlan!;
  } else if (raw.id === 'oddling-luxacanth') {
    visualPlan = INITIAL_ODDLINGS[1].appearance.visualPlan!;
  } else if (rawPlan && typeof rawPlan === 'object' && validArchetypes.includes(rawPlan.archetype as ObjectArchetype)) {
    const rawDefParts = (rawPlan.definingParts as Record<string, unknown>) || {};
    const rawMatSurface = (rawPlan.materialSurface as Record<string, unknown>) || {};
    const rawFace = (rawPlan.facePlacement as Record<string, unknown>) || {};
    const rawInherited = (rawPlan.inheritedFeatures as Record<string, unknown>) || undefined;
    const rawComp = (rawPlan.compositional as any) || undefined;
    let compositional = rawComp;
    let planArchetype = rawPlan.archetype as ObjectArchetype;

    // Check if semantic cues indicate computer_mouse, fork, spoon, or knife needing compositional healing
    const detected = detectUtensilOrToolType(semanticText);
    if (detected === 'computer_mouse') {
      planArchetype = 'compositional';
      if (!compositional || isCompositionalMalformed(compositional, semanticText)) {
        compositional = createComputerMouseSilhouette({ primary: primaryColor, secondary: secondaryColor, accent: accentColor });
      } else {
        compositional = normalizeAndCenterCompositional(
          compositional,
          semanticText || `${raw.name || ''} ${sourceObject.name} ${sourceObject.category} ${sourceObject.material}`,
          { primary: primaryColor, secondary: secondaryColor, accent: accentColor }
        );
      }
    } else if (planArchetype === 'compositional') {
      if (!compositional) {
        compositional = createCompositionalSilhouette(
          semanticText || sourceObject.name,
          sourceObject.category,
          sourceObject.material,
          { primary: primaryColor, secondary: secondaryColor, accent: accentColor }
        );
      } else {
        compositional = normalizeAndCenterCompositional(
          compositional,
          semanticText || `${raw.name || ''} ${sourceObject.name} ${sourceObject.category} ${sourceObject.material}`,
          { primary: primaryColor, secondary: secondaryColor, accent: accentColor }
        );
      }
    }

    visualPlan = {
      version: 1,
      archetype: planArchetype,
      compositional,
      proportions: (rawPlan.proportions as VisualPlan['proportions']) || { widthScale: 1.0, heightScale: 1.0 },
      definingParts: {
        hasHandle: Boolean(rawDefParts.hasHandle),
        handleSide: (rawDefParts.handleSide === 'left' ? 'left' : 'right'),
        hasRim: rawDefParts.hasRim !== undefined ? Boolean(rawDefParts.hasRim) : true,
        hasLid: Boolean(rawDefParts.hasLid),
        hasSpout: Boolean(rawDefParts.hasSpout),
        hasSpines: Boolean(rawDefParts.hasSpines),
        spineDensity: (rawDefParts.spineDensity as any) || 'dense',
        hasShade: Boolean(rawDefParts.hasShade),
        hasStem: Boolean(rawDefParts.hasStem),
        hasBase: Boolean(rawDefParts.hasBase),
        hasEarcups: Boolean(rawDefParts.hasEarcups),
        hasHeadband: Boolean(rawDefParts.hasHeadband),
        hasDial: Boolean(rawDefParts.hasDial),
        hasClockHands: Boolean(rawDefParts.hasClockHands),
        hasLeaves: Boolean(rawDefParts.hasLeaves),
        hasSteam: Boolean(rawDefParts.hasSteam),
        hasDrips: Boolean(rawDefParts.hasDrips),
        liquidFillColor: typeof rawDefParts.liquidFillColor === 'string' ? rawDefParts.liquidFillColor : undefined
      },
      materialSurface: {
        finish: (rawMatSurface.finish as any) || 'glazed_ceramic',
        pattern: (rawMatSurface.pattern as any) || 'solid',
        glazeColor: typeof rawMatSurface.glazeColor === 'string' ? rawMatSurface.glazeColor : primaryColor,
        highlightColor: typeof rawMatSurface.highlightColor === 'string' ? rawMatSurface.highlightColor : '#ffffff'
      },
      facePlacement: {
        surfaceRegion: (rawFace.surfaceRegion as any) || 'vessel_front',
        yOffset: typeof rawFace.yOffset === 'number' ? rawFace.yOffset : 0
      },
      inheritedFeatures: rawInherited ? {
        chassisFrom: typeof rawInherited.chassisFrom === 'string' ? rawInherited.chassisFrom : undefined,
        accentsFrom: typeof rawInherited.accentsFrom === 'string' ? rawInherited.accentsFrom : undefined,
        inheritedPartKeys: Array.isArray(rawInherited.inheritedPartKeys) ? rawInherited.inheritedPartKeys.map(String) : []
      } : undefined
    };
  } else {
    // Migration: derive archetype from sourceObject name, category & material
    const archetype = deriveArchetypeFromObject(sourceObject.name, sourceObject.category, sourceObject.material);
    const customParts: Partial<VisualPlan['definingParts']> = {};
    if (rawAppearance.hornStyle === 'spines') customParts.hasSpines = true;
    if (rawAppearance.accessory === 'steam') customParts.hasSteam = true;
    visualPlan = createDefaultVisualPlan(archetype, { primary: primaryColor, secondary: secondaryColor, accent: accentColor }, customParts);
  }

  const appearance: CreatureDNA['appearance'] = {
    visualPlan,
    bodyShape: (['round', 'blob', 'spiky', 'tall', 'boxy', 'chubby'].includes(rawAppearance.bodyShape as string)
      ? rawAppearance.bodyShape
      : 'round') as CreatureDNA['appearance']['bodyShape'],
    primaryColor,
    secondaryColor,
    accentColor,
    eyeStyle: (['wide', 'sleepy', 'beady', 'glowing', 'cyclops', 'sparkle'].includes(rawAppearance.eyeStyle as string)
      ? rawAppearance.eyeStyle
      : 'wide') as CreatureDNA['appearance']['eyeStyle'],
    hornStyle: rawAppearance.hornStyle as CreatureDNA['appearance']['hornStyle'],
    accessory: rawAppearance.accessory as CreatureDNA['appearance']['accessory'],
    pattern: (rawAppearance.pattern as CreatureDNA['appearance']['pattern']) || 'glazed',
    size: typeof rawAppearance.size === 'number' ? Math.max(0.7, Math.min(1.4, rawAppearance.size)) : 1.0
  };

  const rawAbility = (raw.specialAbility as Record<string, unknown>) || {};
  const specialAbility = {
    name: typeof rawAbility.name === 'string' ? rawAbility.name : 'Curious Spark',
    description: typeof rawAbility.description === 'string' ? rawAbility.description : 'Interacts with habitat objects.',
    powerRating: typeof rawAbility.powerRating === 'number' ? Math.max(1, Math.min(100, rawAbility.powerRating)) : 70,
    icon: typeof rawAbility.icon === 'string' ? rawAbility.icon : '✨'
  };

  const memories = Array.isArray(raw.memories)
    ? raw.memories
        .filter((m) => m && typeof m === 'object' && typeof m.text === 'string')
        .map((m) => ({
          timestamp: typeof m.timestamp === 'number' ? m.timestamp : Date.now(),
          text: String(m.text),
          type: (m.type as CreatureDNA['memories'][0]['type']) || 'pet'
        }))
        .slice(0, 25)
    : [];

  const rawLineage = raw.lineage as Record<string, unknown> | undefined;
  const lineage = rawLineage && typeof rawLineage === 'object'
    ? {
        parentAId: typeof rawLineage.parentAId === 'string' ? rawLineage.parentAId : undefined,
        parentAName: typeof rawLineage.parentAName === 'string' ? rawLineage.parentAName : undefined,
        parentBId: typeof rawLineage.parentBId === 'string' ? rawLineage.parentBId : undefined,
        parentBName: typeof rawLineage.parentBName === 'string' ? rawLineage.parentBName : undefined,
        inheritedTraits: Array.isArray(rawLineage.inheritedTraits)
          ? rawLineage.inheritedTraits.map(String)
          : []
      }
    : undefined;

  const validElements: CreatureDNA['primaryElement'][] = [
    'Ceramic', 'Botanical', 'Electric', 'Mechanical', 'Glass',
    'Textile', 'Thermal', 'Sonic', 'Chrono', 'Crystalline'
  ];

  const primaryElement = validElements.includes(raw.primaryElement as CreatureDNA['primaryElement'])
    ? (raw.primaryElement as CreatureDNA['primaryElement'])
    : 'Ceramic';

  const secondaryElement = validElements.includes(raw.secondaryElement as CreatureDNA['primaryElement'])
    ? (raw.secondaryElement as CreatureDNA['primaryElement'])
    : undefined;

  return {
    id: raw.id,
    name: raw.name,
    speciesName: typeof raw.speciesName === 'string' ? raw.speciesName : `${raw.name} Primus`,
    title: typeof raw.title === 'string' ? raw.title : 'The Wonder Dweller',
    primaryElement,
    secondaryElement,
    temperament: (raw.temperament as CreatureDNA['temperament']) || 'Curious & Chirpy',
    provenance: (raw.provenance as CreatureDNA['provenance']) || 'preset_demo',
    specialAbility,
    sourceObject,
    appearance,
    habitatPreference: (raw.habitatPreference as CreatureDNA['habitatPreference']) || 'Cozy Desk Studio',
    stats: { trust, energy, curiosity, generation },
    lineage,
    memories,
    discoveredAt: typeof raw.discoveredAt === 'number' ? raw.discoveredAt : Date.now(),
    isFavorite: Boolean(raw.isFavorite),
    biomeId: normalizeHome(typeof raw.biomeId === 'string' && raw.biomeId.trim() ? raw.biomeId : undefined),
    worldRegion: typeof raw.worldRegion === 'number' && Number.isSafeInteger(raw.worldRegion) ? raw.worldRegion : 0
  };
}

/**
 * Loads creature collection with corruption resilience.
 */
export function loadCreaturesFromStorage(): CreatureDNA[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return INITIAL_ODDLINGS;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_CREATURES);
    if (!raw) return INITIAL_ODDLINGS;

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return INITIAL_ODDLINGS;
    }

    const sanitized = parsed
      .map(sanitizeCreature)
      .filter((c): c is CreatureDNA => c !== null);

    return sanitized.length > 0 ? sanitized : INITIAL_ODDLINGS;
  } catch (err) {
    console.warn('Failed to parse saved creatures, falling back to initial catalog:', err);
    return INITIAL_ODDLINGS;
  }
}

export const INITIAL_SEED_IDS = ['oddling-thornbrew', 'oddling-luxacanth'];
export const STORAGE_KEY_ONBOARDING = 'oddlings_onboarding_actions_v1';

export interface PlayerOnboardingActions {
  discoveredObjectCreatureIds: string[];
  hasInteracted: boolean;
  hasFused: boolean;
  hasCustomizedBiome?: boolean;
}

/**
 * Saves creature collection safely.
 */
export function saveCreaturesToStorage(creatures: CreatureDNA[]): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    window.localStorage.setItem(STORAGE_KEY_CREATURES, JSON.stringify(creatures));
    return true;
  } catch (err) {
    console.warn('Failed to save creatures to storage:', err);
    return false;
  }
}

/**
 * Loads or migrates persisted player onboarding actions safely without deleting creatures.
 * On a fresh save, all goals evaluate to false (0/4).
 */
export function loadOnboardingActions(creatures?: CreatureDNA[]): PlayerOnboardingActions {
  if (typeof window === 'undefined' || !window.localStorage) {
    return {
      discoveredObjectCreatureIds: [],
      hasInteracted: false,
      hasFused: false,
      hasCustomizedBiome: false
    };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_ONBOARDING);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const storedIds = Array.isArray(parsed.discoveredObjectCreatureIds)
          ? parsed.discoveredObjectCreatureIds.map(String)
          : [];
        const currentCreatures = creatures || loadCreaturesFromStorage();
        const creatureDiscoveries = currentCreatures
          .filter((c) => !INITIAL_SEED_IDS.includes(c.id) && !c.id.startsWith('hybrid_') && !c.lineage && c.stats.generation === 1)
          .map((c) => c.id);
        const mergedDiscoveries = Array.from(new Set([...storedIds, ...creatureDiscoveries]));

        return {
          discoveredObjectCreatureIds: mergedDiscoveries,
          hasInteracted: Boolean(parsed.hasInteracted),
          hasFused: Boolean(parsed.hasFused),
          hasCustomizedBiome: Boolean(parsed.hasCustomizedBiome)
        };
      }
    }
  } catch (err) {
    console.warn('Failed to parse onboarding actions:', err);
  }

  // Safe migration for existing saves: derive legitimate player actions on existing creatures
  const currentCreatures = creatures || loadCreaturesFromStorage();

  // 1. Legitimate player object discoveries: NOT seed creatures and NOT fusions (generation === 1 and no lineage)
  const playerDiscoveries = currentCreatures
    .filter((c) => !INITIAL_SEED_IDS.includes(c.id) && !c.id.startsWith('hybrid_') && !c.lineage && c.stats.generation === 1)
    .map((c) => c.id);

  // 2. Legitimate player fusion: any hybrid created by player (not an initial seed creature)
  const playerFused = currentCreatures.some(
    (c) => !INITIAL_SEED_IDS.includes(c.id) && (c.id.startsWith('hybrid_') || (c.lineage && c.stats.generation >= 2))
  );

  // 3. Legitimate interaction: non-seed creature with care memories or seed creature with user-added memories
  const playerInteracted = currentCreatures.some((c) => {
    if (!INITIAL_SEED_IDS.includes(c.id)) {
      return c.memories.some((m) => m.type === 'pet' || m.type === 'feed' || m.type === 'nap' || m.type === 'play');
    }
    return c.memories.length > 2;
  });

  const migrated: PlayerOnboardingActions = {
    discoveredObjectCreatureIds: playerDiscoveries,
    hasInteracted: playerInteracted,
    hasFused: playerFused
  };

  saveOnboardingActions(migrated);
  return migrated;
}

/**
 * Saves onboarding actions to local storage.
 */
export function saveOnboardingActions(actions: PlayerOnboardingActions): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    window.localStorage.setItem(STORAGE_KEY_ONBOARDING, JSON.stringify(actions));
    return true;
  } catch (err) {
    console.warn('Failed to save onboarding actions:', err);
    return false;
  }
}

/**
 * Loads garden tasks progression from local storage.
 */
export function loadGardenTasksFromStorage(): GardenTasksState {
  const defaultTasks: GardenTasksState = {
    plantedSeed: false,
    grownFlower: false,
    oddlingEnjoyedPond: false,
    rewardClaimed: false
  };

  if (typeof window === 'undefined' || !window.localStorage) {
    return defaultTasks;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_GARDEN_TASKS);
    if (!raw) return defaultTasks;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return defaultTasks;
    return {
      plantedSeed: Boolean(parsed.plantedSeed),
      grownFlower: Boolean(parsed.grownFlower),
      oddlingEnjoyedPond: Boolean(parsed.oddlingEnjoyedPond),
      rewardClaimed: Boolean(parsed.rewardClaimed)
    };
  } catch {
    return defaultTasks;
  }
}

/**
 * Saves garden tasks progression to local storage.
 */
export function saveGardenTasksToStorage(tasks: GardenTasksState): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    window.localStorage.setItem(STORAGE_KEY_GARDEN_TASKS, JSON.stringify(tasks));
    return true;
  } catch (err) {
    console.warn('Failed to save garden tasks:', err);
    return false;
  }
}

/**
 * Calculates current progress on the first-run goal checklist based on actual player actions.
 * Seed creatures NEVER count toward any of the three goals.
 */
export function computeFirstRunGoals(
  target: CreatureDNA[] | PlayerOnboardingActions
): FirstRunGoals {
  if (Array.isArray(target)) {
    const discoveries = target.filter(
      (c) => !INITIAL_SEED_IDS.includes(c.id) && !c.id.startsWith('hybrid_') && !c.lineage && c.stats.generation === 1
    );
    const hasFused = target.some(
      (c) => !INITIAL_SEED_IDS.includes(c.id) && (c.id.startsWith('hybrid_') || (c.lineage && c.stats.generation >= 2))
    );
    const hasInteracted = target.some((c) => {
      if (!INITIAL_SEED_IDS.includes(c.id)) {
        return c.memories.some((m) => m.type === 'pet' || m.type === 'feed' || m.type === 'nap' || m.type === 'play');
      }
      return c.memories.length > 2;
    });

    return {
      discoveredTwo: discoveries.length >= 2,
      caredForOddling: hasInteracted,
      fusedSpecies: hasFused,
      builtBiomeHome: false
    };
  }

  return {
    discoveredTwo: (target.discoveredObjectCreatureIds || []).length >= 2,
    caredForOddling: Boolean(target.hasInteracted),
    fusedSpecies: Boolean(target.hasFused),
    builtBiomeHome: Boolean(target.hasCustomizedBiome)
  };
}

/**
 * Validates and sanitizes a saved IncubatorEgg object.
 * Returns null if irrecoverably corrupt or missing vital fields.
 */
export function sanitizeEgg(data: unknown): IncubatorEgg | null {
  if (!data || typeof data !== 'object') return null;
  const raw = data as Record<string, unknown>;

  if (typeof raw.id !== 'string' || !raw.id.trim()) return null;

  const creature = sanitizeCreature(raw.creature);
  if (!creature) return null;

  const now = Date.now();
  const createdAt = typeof raw.createdAt === 'number' && !isNaN(raw.createdAt) ? raw.createdAt : now;
  const standardDurationMs = INCUBATION_DURATION_SECONDS * 1000;
  const hatchAt = typeof raw.hatchAt === 'number' && !isNaN(raw.hatchAt) && raw.hatchAt >= createdAt
    ? raw.hatchAt
    : createdAt + standardDurationMs;

  const validPatterns = ['stripes', 'spots', 'zigzag', 'cosmic', 'cracked'];
  const pattern = validPatterns.includes(raw.pattern as string)
    ? (raw.pattern as IncubatorEgg['pattern'])
    : 'stripes';

  const primaryColor = typeof raw.primaryColor === 'string' && raw.primaryColor.startsWith('#')
    ? raw.primaryColor
    : creature.appearance.primaryColor;
  const secondaryColor = typeof raw.secondaryColor === 'string' && raw.secondaryColor.startsWith('#')
    ? raw.secondaryColor
    : creature.appearance.secondaryColor;
  const accentColor = typeof raw.accentColor === 'string' && raw.accentColor.startsWith('#')
    ? raw.accentColor
    : creature.appearance.accentColor;

  const photoThumbnail = typeof raw.photoThumbnail === 'string' ? raw.photoThumbnail : undefined;

  return {
    id: raw.id,
    creature,
    photoThumbnail,
    primaryColor,
    secondaryColor,
    accentColor,
    pattern,
    createdAt,
    hatchAt,
    isHatched: Boolean(raw.isHatched),
    isClaimed: Boolean(raw.isClaimed)
  };
}

/**
 * Loads the currently incubating or ready egg from storage.
 * Returns null if no active egg or if already claimed.
 */
export function loadActiveEggFromStorage(): IncubatorEgg | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_ACTIVE_EGG);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const sanitized = sanitizeEgg(parsed);
    if (!sanitized) {
      window.localStorage.removeItem(STORAGE_KEY_ACTIVE_EGG);
      return null;
    }

    if (sanitized.isClaimed) {
      window.localStorage.removeItem(STORAGE_KEY_ACTIVE_EGG);
      return null;
    }

    return sanitized;
  } catch (err) {
    console.warn('Failed to load active egg from storage, resetting egg slot:', err);
    try {
      window.localStorage.removeItem(STORAGE_KEY_ACTIVE_EGG);
    } catch {}
    return null;
  }
}

/**
 * Saves the active incubator egg. If egg is null or claimed, cleans up storage.
 * Handles localStorage quota limits by stripping heavyweight image cutouts safely.
 */
export function saveActiveEggToStorage(egg: IncubatorEgg | null): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;

  if (!egg || egg.isClaimed) {
    try {
      window.localStorage.removeItem(STORAGE_KEY_ACTIVE_EGG);
      return true;
    } catch {
      return false;
    }
  }

  try {
    window.localStorage.setItem(STORAGE_KEY_ACTIVE_EGG, JSON.stringify(egg));
    return true;
  } catch (err) {
    console.warn('Quota warning while saving egg, retrying with lightweight thumbnail payload:', err);
    try {
      // Strip base64 thumbnail to preserve crucial egg DNA under quota pressure
      const lightweightEgg: IncubatorEgg = {
        ...egg,
        photoThumbnail: undefined,
        creature: {
          ...egg.creature,
          sourceObject: {
            ...egg.creature.sourceObject,
            userPhotoUrl: undefined,
            imageCutout: undefined
          }
        }
      };
      window.localStorage.setItem(STORAGE_KEY_ACTIVE_EGG, JSON.stringify(lightweightEgg));
      return true;
    } catch (fallbackErr) {
      console.error('Failed to save egg even with minimal payload:', fallbackErr);
      return false;
    }
  }
}

/**
 * Clears the active incubator egg safely from storage.
 */
export function clearActiveEggFromStorage(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY_ACTIVE_EGG);
  } catch {}
}

export interface ClaimEggResult {
  updatedCreatures: CreatureDNA[];
  newCreature: CreatureDNA | null;
  success: boolean;
  error?: string;
}

/**
 * Deduplicated claim function: exactly-once claim guarantee.
 * Adds creature to player's active collection and purges the egg record ONLY after collection persistence succeeds.
 * If collection save fails, retains egg in storage and returns a recoverable error so the incubator can show a retry button.
 * If a prior save succeeded but clearing the egg failed, retry deduplicates by creature ID, purges the egg, and succeeds.
 */
export function claimActiveEgg(
  egg: IncubatorEgg,
  currentCreatures: CreatureDNA[]
): ClaimEggResult {
  // If already marked claimed, ensure egg slot is clear and return success
  if (egg.isClaimed) {
    clearActiveEggFromStorage();
    return { updatedCreatures: currentCreatures, newCreature: null, success: true };
  }

  // Deduplication check: if creature ID already exists in collection
  // (e.g. earlier saveCreaturesToStorage succeeded, but egg clear failed, and player clicked retry)
  const existing = currentCreatures.find((c) => c.id === egg.creature.id);
  if (existing) {
    egg.isClaimed = true;
    clearActiveEggFromStorage();
    return { updatedCreatures: currentCreatures, newCreature: existing, success: true };
  }

  // Prepare claimed creature
  const claimedCreature: CreatureDNA = {
    ...egg.creature,
    discoveredAt: Date.now(),
    biomeId: egg.creature.biomeId || 'greenhouse'
  };

  const updatedCreatures = [claimedCreature, ...currentCreatures];
  const saveSuccess = saveCreaturesToStorage(updatedCreatures);

  if (!saveSuccess) {
    // CRITICAL: DO NOT clear egg and DO NOT set egg.isClaimed = true when collection save fails!
    return {
      updatedCreatures: currentCreatures,
      newCreature: null,
      success: false,
      error: 'Failed to save creature to your collection. Storage may be full.'
    };
  }

  // ONLY clear active egg AFTER collection persistence succeeds
  egg.isClaimed = true;
  clearActiveEggFromStorage();

  return { updatedCreatures, newCreature: claimedCreature, success: true };
}

// ============================================================================
// PORTABLE SAVE & RESTORE PIPELINE
// ============================================================================

export function sanitizeDiaries(raw: unknown): Record<string, any[]> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const result: Record<string, any[]> = {};
  for (const [id, entries] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof id === 'string' && Array.isArray(entries)) {
      result[id] = entries.filter((e) => e && typeof e === 'object' && typeof e.text === 'string').slice(0, 50);
    }
  }
  return result;
}

export interface OddlingsSaveBundleV1 {
  version: 1;
  format: 'oddlings-save';
  appName: 'ODDLINGS';
  exportedAt: number;
  creatures: CreatureDNA[];
  biomeWorlds: Partial<Record<HabitatThemeId, BiomeWorldState>>;
  customBiomes?: CustomBiomeRecord[];
  customItems?: CustomItem[];
  activeEgg: IncubatorEgg | null;
  onboarding: PlayerOnboardingActions;
  gardenTasks?: GardenTasksState;
  gardenAdventure?: GardenAdventureState;
  wallet?: Wallet;
  diaries?: Record<string, any[]>;
  preferences?: {
    habitatTheme?: HabitatThemeId;
    isMuted?: boolean;
  };
}

export interface SaveBundlePreview {
  creatureCount: number;
  creatureNames: string[];
  biomeCount: number;
  biomesList: string[];
  customItemCount?: number;
  hasActiveEgg: boolean;
  eggStatus: 'none' | 'ready' | 'incubating';
  eggTimeRemainingFormatted?: string;
  completedGoalsCount: number;
  exportedAtFormatted: string;
  adventureStep?: string;
  walletSummary?: string;
  adventureRewardClaimed?: boolean;
  diaryCount?: number;
  /** Parts an older save file does not contain; restoring keeps the defaults for those */
  missingParts?: string[];
}

export interface PreRestoreSnapshot {
  timestamp: number;
  data: Record<string, string | null>;
}

/**
 * Creates an exportable portable save bundle from explicit game storage keys only.
 * NEVER inspects or reads server secrets, credentials, or unrelated keys.
 */
export function createSaveBundle(options?: {
  creatures?: CreatureDNA[];
  customBiomes?: CustomBiomeRecord[];
  customItems?: CustomItem[];
  activeEgg?: IncubatorEgg | null;
  onboarding?: PlayerOnboardingActions;
  gardenTasks?: GardenTasksState;
  gardenAdventure?: GardenAdventureState;
  wallet?: Wallet;
  diaries?: Record<string, any[]>;
  habitatTheme?: HabitatThemeId;
  isMuted?: boolean;
}): OddlingsSaveBundleV1 {
  const creatures = options?.creatures || loadCreaturesFromStorage();
  const activeEgg = options?.activeEgg !== undefined ? options.activeEgg : loadActiveEggFromStorage();
  const onboarding = options?.onboarding || loadOnboardingActions(creatures);
  const customBiomes = options?.customBiomes || getCustomBiomesList();
  const customItems = options?.customItems !== undefined ? options.customItems : customItemLibrary.list();

  // Collect edited biome worlds (standard themes + custom biomes)
  const biomeWorlds: Partial<Record<HabitatThemeId, BiomeWorldState>> = {};
  const themes: HabitatThemeId[] = ['greenhouse', 'desk', 'lab'];
  if (typeof window !== 'undefined') {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i) || '';
      const id = key.slice(getStorageKey('').length);
      if (key.startsWith(getStorageKey('')) && isWorldRegionId(id)) themes.push(id);
    }
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    for (const theme of themes) {
      const raw = window.localStorage.getItem(getStorageKey(theme));
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          const sanitized = sanitizeBiomeWorld(parsed, theme);
          if (sanitized) {
            biomeWorlds[theme] = sanitized;
          }
        } catch {}
      } else if (theme === 'greenhouse' || theme === 'desk' || theme === 'lab') {
        // Guarantee greenhouse and standard themes are never missing or blank in save
        const defaultWorld = loadBiomeWorldFromStorage(theme);
        if (defaultWorld) {
          biomeWorlds[theme] = defaultWorld;
        }
      }
    }

    // Collect custom biome world layouts
    for (const cb of customBiomes) {
      const raw = window.localStorage.getItem(getStorageKey(cb.id));
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          const sanitized = sanitizeBiomeWorld(parsed, cb.id);
          if (sanitized) {
            biomeWorlds[cb.id] = sanitized;
          }
        } catch {}
      }
    }
  }

  // Load adventure state
  const gardenAdventureState: GardenAdventureState = options?.gardenAdventure || gardenAdventure.get();
  // Load wallet
  const walletState: Wallet = options?.wallet || walletBook.get();
  // Load diaries
  let diariesState: Record<string, any[]> = options?.diaries || {};
  if (typeof window !== 'undefined' && window.localStorage && !options?.diaries) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY_DIARY);
      if (raw) {
        diariesState = sanitizeDiaries(JSON.parse(raw));
      }
    } catch {}
  }

  return {
    version: 1,
    format: SAVE_FORMAT_IDENTIFIER,
    appName: 'ODDLINGS',
    exportedAt: Date.now(),
    creatures,
    biomeWorlds,
    customBiomes,
    customItems,
    activeEgg,
    onboarding,
    gardenTasks: options?.gardenTasks || loadGardenTasksFromStorage(),
    gardenAdventure: gardenAdventureState,
    wallet: walletState,
    diaries: diariesState,
    preferences: {
      habitatTheme: normalizeHome(options?.habitatTheme),
      isMuted: Boolean(options?.isMuted)
    }
  };
}

/**
 * Validates and safely parses an uploaded save file string.
 * Enforces size limits, rejects prototype pollution, and validates all entities.
 * Returns preview stats or error details without mutating any game state.
 */
/** How many diary pages a save holds, whatever shape its diary record takes. */
function countDiaryEntries(diaries: unknown): number {
  if (Array.isArray(diaries)) return diaries.length;
  if (!diaries || typeof diaries !== 'object') return 0;
  return Object.values(diaries as Record<string, unknown>).reduce<number>((n, entries) => n + (Array.isArray(entries) ? entries.length : 1), 0);
}

export function validateAndParseSaveBundle(jsonString: string): {
  success: true;
  bundle: OddlingsSaveBundleV1;
  preview: SaveBundlePreview;
} | {
  success: false;
  error: string;
} {
  if (typeof jsonString !== 'string') {
    return { success: false, error: 'Save data must be a valid JSON text string.' };
  }

  // File size cap: 10MB
  if (jsonString.length > MAX_SAVE_FILE_SIZE_BYTES) {
    return { success: false, error: 'Save file exceeds the 10MB maximum size limit.' };
  }

  let parsed: any;
  try {
    // Reviver prevents prototype pollution (__proto__, constructor, prototype)
    parsed = JSON.parse(jsonString, (key, value) => {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        return undefined;
      }
      return value;
    });
  } catch (err: any) {
    return { success: false, error: `Malformed JSON file: ${err?.message || 'Syntax error'}` };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { success: false, error: 'Invalid save structure: root must be a JSON object.' };
  }

  // Version check
  if (parsed.version !== CURRENT_SAVE_VERSION) {
    return { success: false, error: `Unsupported save version (found ${parsed.version}, expected ${CURRENT_SAVE_VERSION}).` };
  }

  if (parsed.format !== SAVE_FORMAT_IDENTIFIER && parsed.appName !== 'ODDLINGS') {
    return { success: false, error: 'File is not a recognized ODDLINGS save bundle.' };
  }

  if (!Array.isArray(parsed.creatures)) {
    return { success: false, error: 'Invalid save structure: missing "creatures" collection array.' };
  }

  // Validate and sanitize creatures, deduplicating IDs
  const seenIds = new Set<string>();
  const validatedCreatures: CreatureDNA[] = [];
  for (const rawC of parsed.creatures) {
    const sanitized = sanitizeCreature(rawC);
    if (sanitized && !seenIds.has(sanitized.id)) {
      seenIds.add(sanitized.id);
      validatedCreatures.push(sanitized);
    }
  }

  if (validatedCreatures.length === 0) {
    return { success: false, error: 'Save contains no valid or recoverable creatures.' };
  }

  // Validate active egg (if present)
  let validatedEgg: IncubatorEgg | null = null;
  if (parsed.activeEgg && typeof parsed.activeEgg === 'object') {
    validatedEgg = sanitizeEgg(parsed.activeEgg);
    // Preserves original hatchAt; if hatchAt is in past, it's ready to hatch
  }

  // Validate custom biomes list (if present)
  let validatedCustomBiomes: CustomBiomeRecord[] | undefined = undefined;
  if (Array.isArray(parsed.customBiomes)) {
    validatedCustomBiomes = parsed.customBiomes
      .filter((b: any) => b && typeof b.id === 'string' && typeof b.name === 'string')
      .map((b: any) => ({
        id: String(b.id).slice(0, 48),
        name: String(b.name).slice(0, 32),
        createdAt: typeof b.createdAt === 'number' ? b.createdAt : Date.now(),
        updatedAt: typeof b.updatedAt === 'number' ? b.updatedAt : Date.now(),
        generationMode: b.generationMode === 'ai_generated' ? 'ai_generated' : 'local_quantization',
        previewThumbnailUrl: typeof b.previewThumbnailUrl === 'string' && b.previewThumbnailUrl.length < 500000 ? b.previewThumbnailUrl : undefined,
        hideAtmosphere: b.hideAtmosphere !== false
      }));
  }

  // Validate custom items (if present; older bundles without this field restore compatibly)
  let validatedCustomItems: CustomItem[] | undefined = undefined;
  if (Array.isArray(parsed.customItems)) {
    validatedCustomItems = parsed.customItems.filter(validItem).slice(0, 12);
  }

  // Validate biome worlds (standard themes + custom biomes)
  const validThemes: string[] = ['desk', 'greenhouse', 'lab'];
  if (validatedCustomBiomes) {
    for (const cb of validatedCustomBiomes) {
      if (!validThemes.includes(cb.id)) validThemes.push(cb.id);
    }
  }
  const validatedBiomes: Partial<Record<HabitatThemeId, BiomeWorldState>> = {};
  if (parsed.biomeWorlds && typeof parsed.biomeWorlds === 'object') {
    for (const [t, w] of Object.entries(parsed.biomeWorlds)) {
      if (w && (validThemes.includes(t) || t.startsWith('custom_') || isWorldRegionId(t))) {
        const sanitized = sanitizeBiomeWorld(w, t);
        if (sanitized) {
          validatedBiomes[t] = sanitized;
        }
      }
    }
  }

  // Validate onboarding
  const rawOnb = parsed.onboarding || {};
  const validatedOnboarding: PlayerOnboardingActions = {
    discoveredObjectCreatureIds: Array.isArray(rawOnb.discoveredObjectCreatureIds)
      ? Array.from(new Set(rawOnb.discoveredObjectCreatureIds.map(String)))
      : [],
    hasInteracted: Boolean(rawOnb.hasInteracted),
    hasFused: Boolean(rawOnb.hasFused),
    hasCustomizedBiome: Boolean(rawOnb.hasCustomizedBiome)
  };

    // Validate garden tasks (if present)
  let validatedGardenTasks: GardenTasksState | undefined = undefined;
  if (parsed.gardenTasks && typeof parsed.gardenTasks === 'object') {
    validatedGardenTasks = {
      plantedSeed: Boolean(parsed.gardenTasks.plantedSeed),
      grownFlower: Boolean(parsed.gardenTasks.grownFlower),
      oddlingEnjoyedPond: Boolean(parsed.gardenTasks.oddlingEnjoyedPond),
      rewardClaimed: Boolean(parsed.gardenTasks.rewardClaimed)
    };
  }

  // Validate garden adventure (fallback to DEFAULT_ADVENTURE_STATE for older saves)
  const validatedGardenAdventure = cleanGardenAdventureState(parsed.gardenAdventure);

  // Validate wallet (fallback to NEW_WALLET for older saves)
  const validatedWallet = cleanWallet(parsed.wallet);

  // Validate creature diaries (fallback to empty dict)
  const validatedDiaries = sanitizeDiaries(parsed.diaries);

  const rawPref = parsed.preferences || {};
  const validatedBundle: OddlingsSaveBundleV1 = {
    version: 1,
    format: SAVE_FORMAT_IDENTIFIER,
    appName: 'ODDLINGS',
    exportedAt: typeof parsed.exportedAt === 'number' ? parsed.exportedAt : Date.now(),
    creatures: validatedCreatures,
    biomeWorlds: validatedBiomes,
    customBiomes: validatedCustomBiomes,
    customItems: validatedCustomItems,
    activeEgg: validatedEgg,
    onboarding: validatedOnboarding,
    gardenTasks: validatedGardenTasks,
    gardenAdventure: validatedGardenAdventure,
    wallet: validatedWallet,
    diaries: validatedDiaries,
    preferences: {
      habitatTheme: validThemes.includes(rawPref.habitatTheme) ? normalizeHome(rawPref.habitatTheme) : 'greenhouse',
      isMuted: Boolean(rawPref.isMuted)
    }
  };

  // Build user-friendly preview
  const now = Date.now();
  let eggStatus: SaveBundlePreview['eggStatus'] = 'none';
  let eggTimeRemainingFormatted: string | undefined = undefined;

  if (validatedEgg) {
    if (validatedEgg.hatchAt <= now || validatedEgg.isHatched) {
      eggStatus = 'ready';
      eggTimeRemainingFormatted = 'Ready to Hatch!';
    } else {
      eggStatus = 'incubating';
      const remainingSec = Math.ceil((validatedEgg.hatchAt - now) / 1000);
      const m = Math.floor(remainingSec / 60);
      const s = remainingSec % 60;
      eggTimeRemainingFormatted = `${m}m ${s}s remaining`;
    }
  }

  const goals = computeFirstRunGoals(validatedOnboarding);
  const completedGoalsCount =
    (goals.discoveredTwo ? 1 : 0) +
    (goals.caredForOddling ? 1 : 0) +
    (goals.fusedSpecies ? 1 : 0) +
    (goals.builtBiomeHome ? 1 : 0);

  const preview: SaveBundlePreview = {
    creatureCount: validatedCreatures.length,
    creatureNames: validatedCreatures.slice(0, 5).map((c) => c.name),
    biomeCount: Object.keys(validatedBiomes).length,
    biomesList: Object.keys(validatedBiomes),
    customItemCount: validatedCustomItems ? validatedCustomItems.length : undefined,
    hasActiveEgg: Boolean(validatedEgg),
    eggStatus,
    eggTimeRemainingFormatted,
    completedGoalsCount,
    exportedAtFormatted: new Date(validatedBundle.exportedAt).toLocaleString(),
    adventureStep: validatedGardenAdventure.step,
    walletSummary: `${validatedWallet.seeds} seeds, ${validatedWallet.gems} gems, ${validatedWallet.sparkles} coins`,
    adventureRewardClaimed: validatedGardenAdventure.rewardClaimed,
    diaryCount: countDiaryEntries(validatedDiaries),
    missingParts: [
      parsed.wallet ? '' : 'Life Seeds, Craft Gems and Sparkle Coins',
      parsed.gardenAdventure ? '' : 'Garden Adventure progress',
      parsed.diaries ? '' : 'diary pages'
    ].filter(Boolean)
  };

  return {
    success: true,
    bundle: validatedBundle,
    preview
  };
}

export function isGameOwnedWorldRegionKey(key: string): boolean {
  if (key.startsWith('world_region_')) return true;
  const prefix = getStorageKey('');
  if (key.startsWith(prefix)) {
    const id = key.slice(prefix.length);
    if (isWorldRegionId(id) || id.startsWith('world_region_')) return true;
  }
  return false;
}

/**
 * Atomically replaces current game storage with validated bundle.
 * Takes a pre-restore snapshot first. If quota limit is hit, cleanly rolls back to previous game state.
 */
export function applySaveBundle(bundle: OddlingsSaveBundleV1): { success: true } | { success: false; error: string } {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { success: false, error: 'Local storage is not supported in this environment.' };
  }

  // 1. Snapshot current state before applying any writes
  const currentSnapshotData: Record<string, string | null> = {
    [STORAGE_KEY_CREATURES]: window.localStorage.getItem(STORAGE_KEY_CREATURES),
    [STORAGE_KEY_ONBOARDING]: window.localStorage.getItem(STORAGE_KEY_ONBOARDING),
    [STORAGE_KEY_ACTIVE_EGG]: window.localStorage.getItem(STORAGE_KEY_ACTIVE_EGG),
    [STORAGE_KEY_GARDEN_TASKS]: window.localStorage.getItem(STORAGE_KEY_GARDEN_TASKS),
    [STORAGE_KEY_GARDEN_ADVENTURE]: window.localStorage.getItem(STORAGE_KEY_GARDEN_ADVENTURE),
    [STORAGE_KEY_WALLET]: window.localStorage.getItem(STORAGE_KEY_WALLET),
    [STORAGE_KEY_DIARY]: window.localStorage.getItem(STORAGE_KEY_DIARY),
    [STORAGE_KEY_CUSTOM_BIOMES]: window.localStorage.getItem(STORAGE_KEY_CUSTOM_BIOMES),
    [STORAGE_KEY_CUSTOM_ITEMS]: window.localStorage.getItem(STORAGE_KEY_CUSTOM_ITEMS),
    [getStorageKey('desk')]: window.localStorage.getItem(getStorageKey('desk')),
    [getStorageKey('greenhouse')]: window.localStorage.getItem(getStorageKey('greenhouse')),
    [getStorageKey('lab')]: window.localStorage.getItem(getStorageKey('lab'))
  };

  // Also snapshot any existing custom biome worlds
  const existingCustomBiomes = getCustomBiomesList();
  for (const cb of existingCustomBiomes) {
    currentSnapshotData[getStorageKey(cb.id)] = window.localStorage.getItem(getStorageKey(cb.id));
  }

  // Snapshot COMPLETE existing game-owned world_region_* key set currently in storage
  const existingWorldRegionKeys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key && isGameOwnedWorldRegionKey(key)) {
      existingWorldRegionKeys.push(key);
      currentSnapshotData[key] = window.localStorage.getItem(key);
    }
  }

  // Snapshot every incoming region too, including keys that do not yet exist
  const incomingWorlds = bundle.biomeWorlds || {};
  for (const id of Object.keys(incomingWorlds)) {
    currentSnapshotData[getStorageKey(id)] = window.localStorage.getItem(getStorageKey(id));
  }
  const preRestoreSnapshot: PreRestoreSnapshot = {
    timestamp: Date.now(),
    data: currentSnapshotData
  };

  try {
    // Save previous snapshot first
    window.localStorage.setItem(STORAGE_KEY_PRE_RESTORE_SNAPSHOT, JSON.stringify(preRestoreSnapshot));

    // Write creatures
    window.localStorage.setItem(STORAGE_KEY_CREATURES, JSON.stringify(bundle.creatures));

    // Write onboarding
    window.localStorage.setItem(STORAGE_KEY_ONBOARDING, JSON.stringify(bundle.onboarding));

    // Write active egg
    if (bundle.activeEgg) {
      window.localStorage.setItem(STORAGE_KEY_ACTIVE_EGG, JSON.stringify(bundle.activeEgg));
    } else {
      window.localStorage.removeItem(STORAGE_KEY_ACTIVE_EGG);
    }

    // Write garden tasks
    if (bundle.gardenTasks) {
      window.localStorage.setItem(STORAGE_KEY_GARDEN_TASKS, JSON.stringify(bundle.gardenTasks));
    }

    // Write garden adventure
    if (bundle.gardenAdventure) {
      window.localStorage.setItem(STORAGE_KEY_GARDEN_ADVENTURE, JSON.stringify(bundle.gardenAdventure));
    }

    // Write wallet
    if (bundle.wallet) {
      window.localStorage.setItem(STORAGE_KEY_WALLET, JSON.stringify(bundle.wallet));
    }

    // Write diaries
    if (bundle.diaries) {
      window.localStorage.setItem(STORAGE_KEY_DIARY, JSON.stringify(bundle.diaries));
    }

    // Write custom biomes manifest
    if (bundle.customBiomes) {
      window.localStorage.setItem(STORAGE_KEY_CUSTOM_BIOMES, JSON.stringify(bundle.customBiomes));
    }

    // Write custom items (if included in bundle; legacy bundles without field restore compatibly)
    if (bundle.customItems !== undefined) {
      window.localStorage.setItem(STORAGE_KEY_CUSTOM_ITEMS, JSON.stringify(bundle.customItems));
    }

    // Replace the COMPLETE game-owned world_region_* key set:
    // Any existing world_region_* key not in incoming bundle is removed without touching unrelated keys.
    const incomingRegionKeys = new Set<string>();
    for (const theme of Object.keys(incomingWorlds)) {
      if (isWorldRegionId(theme) || theme.startsWith('world_region_')) {
        incomingRegionKeys.add(theme);
        incomingRegionKeys.add(getStorageKey(theme));
      }
    }
    for (const key of existingWorldRegionKeys) {
      if (!incomingRegionKeys.has(key)) {
        window.localStorage.removeItem(key);
      }
    }

    // Write biome worlds (standard themes + custom biomes + world regions)
    for (const [theme, world] of Object.entries(incomingWorlds)) {
      if (world) {
        window.localStorage.setItem(getStorageKey(theme), JSON.stringify(world));
      } else {
        window.localStorage.removeItem(getStorageKey(theme));
      }
    }

    // Idempotent safety migration: if greenhouse has no saved decorations and desk had custom decorations,
    // ensure greenhouse has at least default starter world or desk props migrated
    const greenhouseWorld = incomingWorlds['greenhouse'];
    const deskWorld = incomingWorlds['desk'];
    if (!greenhouseWorld || (greenhouseWorld.decorations.length === 0 && deskWorld && deskWorld.decorations.length > 0)) {
      const targetWorld = (deskWorld && deskWorld.decorations.length > 0)
        ? { ...deskWorld, biome: 'greenhouse', updatedAt: Date.now() }
        : loadBiomeWorldFromStorage('greenhouse');
      if (targetWorld) {
        window.localStorage.setItem(getStorageKey('greenhouse'), JSON.stringify(targetWorld));
      }
    }

    // Idempotently migrate adventure target if it referenced desk or lab
    if (bundle.gardenAdventure && (bundle.gardenAdventure.biomeId === 'desk' || bundle.gardenAdventure.biomeId === 'lab')) {
      const migratedAdventure = { ...bundle.gardenAdventure, biomeId: 'greenhouse' };
      window.localStorage.setItem(STORAGE_KEY_GARDEN_ADVENTURE, JSON.stringify(migratedAdventure));
    }

    // Reload creature voice diaries and custom items from storage so in-memory singletons stay in sync
    try {
      customItemLibrary.reloadFromStorage();
    } catch {}
    try {
      creatureVoice.reloadFromStorage();
    } catch {}

    return { success: true };
  } catch (err: any) {
    console.error('Storage quota or write error during restore; initiating atomic rollback:', err);

    // Rollback all affected keys to original state
    for (const [key, val] of Object.entries(currentSnapshotData)) {
      try {
        if (val !== null) {
          window.localStorage.setItem(key, val);
        } else {
          window.localStorage.removeItem(key);
        }
      } catch (rollbackErr) {
        console.error(`Rollback failed for key ${key}:`, rollbackErr);
      }
    }

    try {
      customItemLibrary.reloadFromStorage();
    } catch {}
    try {
      creatureVoice.reloadFromStorage();
    } catch {}

    return {
      success: false,
      error: 'Storage quota exceeded while writing restored data. Your previous game was safely preserved without changes.'
    };
  }
}

/**
 * Restores the previous pre-restore snapshot if available, rolling back the last restore action.
 */
export function restorePreviousSnapshot(): { success: true; restoredBundle: OddlingsSaveBundleV1 } | { success: false; error: string } {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { success: false, error: 'Local storage not available.' };
  }

  const raw = window.localStorage.getItem(STORAGE_KEY_PRE_RESTORE_SNAPSHOT);
  if (!raw) {
    return { success: false, error: 'No previous save snapshot found to undo.' };
  }

  try {
    const parsed: PreRestoreSnapshot = JSON.parse(raw);
    if (!parsed || !parsed.data || typeof parsed.data !== 'object') {
      return { success: false, error: 'Previous snapshot record was corrupted.' };
    }

    // Revert all keys
    for (const [key, val] of Object.entries(parsed.data)) {
      if (val !== null) {
        window.localStorage.setItem(key, val);
      } else {
        window.localStorage.removeItem(key);
      }
    }

    // Remove pre-restore snapshot once undone
    window.localStorage.removeItem(STORAGE_KEY_PRE_RESTORE_SNAPSHOT);

    // Reload custom items and creature voice singletons from storage on restore undo
    try {
      customItemLibrary.reloadFromStorage();
    } catch {}
    try {
      creatureVoice.reloadFromStorage();
    } catch {}

    // Re-create bundle from the restored state
    const restoredBundle = createSaveBundle();
    return { success: true, restoredBundle };
  } catch (err: any) {
    return { success: false, error: `Failed to undo restore: ${err?.message || 'Unknown error'}` };
  }
}

export function hasPreRestoreSnapshot(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  return Boolean(window.localStorage.getItem(STORAGE_KEY_PRE_RESTORE_SNAPSHOT));
}

export function getPreRestoreSnapshotTimestamp(): number | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_PRE_RESTORE_SNAPSHOT);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed.timestamp === 'number' ? parsed.timestamp : null;
  } catch {
    return null;
  }
}

export function downloadSaveBundle(bundle: OddlingsSaveBundleV1, filenameOverride?: string): void {
  if (typeof window === 'undefined') return;
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = filenameOverride || `oddlings-save-${dateStr}.json`;
  const jsonContent = JSON.stringify(bundle, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
