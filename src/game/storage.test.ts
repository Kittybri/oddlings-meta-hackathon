/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  sanitizeCreature,
  loadCreaturesFromStorage,
  saveCreaturesToStorage, 
  computeFirstRunGoals, 
  loadOnboardingActions,
  sanitizeEgg,
  claimActiveEgg,
  saveActiveEggToStorage,
  loadActiveEggFromStorage,
  createSaveBundle,
  validateAndParseSaveBundle,
  applySaveBundle,
  restorePreviousSnapshot,
  hasPreRestoreSnapshot,
  loadGardenTasksFromStorage,
  saveGardenTasksToStorage,
  OddlingsSaveBundleV1,
  STORAGE_KEY_CREATURES,
  STORAGE_KEY_ONBOARDING,
  STORAGE_KEY_ACTIVE_EGG,
  STORAGE_KEY_GARDEN_TASKS,
  STORAGE_KEY_PRE_RESTORE_SNAPSHOT,
  STORAGE_KEY_GARDEN_ADVENTURE
} from './storage';
import { generateCreatureFromObject, createCompositionalSilhouette } from './creatureRules';
import { CreatureDNA, SegmentedObject, IncubatorEgg } from './creatureTypes';
import { INITIAL_ODDLINGS } from './creatureCatalog';
import { createStarterWorld, getStorageKey, createEmptyTiles } from './biomeWorld';

test('sanitizeCreature handles corrupt data gracefully', () => {
  assert.equal(sanitizeCreature(null), null);
  assert.equal(sanitizeCreature(undefined), null);
  assert.equal(sanitizeCreature('string'), null);
  assert.equal(sanitizeCreature({}), null); // missing id and name

  const corruptStats = {
    id: 'corrupt-1',
    name: 'Glitchy',
    stats: { trust: 'invalid', energy: 9999, curiosity: -50 }
  };
  const sanitized = sanitizeCreature(corruptStats);
  assert.ok(sanitized !== null);
  assert.equal(sanitized?.name, 'Glitchy');
  // Trust clamped to default 50 when NaN/invalid
  assert.equal(sanitized?.stats.trust, 50);
  // Energy clamped to 100 max
  assert.equal(sanitized?.stats.energy, 100);
  // Curiosity clamped to 0 min
  assert.equal(sanitized?.stats.curiosity, 0);
  // Memories array is created safely
  assert.ok(Array.isArray(sanitized?.memories));
});

test('computeFirstRunGoals tracks player progression correctly', () => {
  const oneCreature: CreatureDNA[] = [
    {
      id: 'c1',
      name: 'Solo',
      speciesName: 'Solo Primus',
      title: 'Solo Spirit',
      primaryElement: 'Ceramic',
      temperament: 'Sleepy & Warm',
      provenance: 'preset_demo',
      specialAbility: { name: 'Spark', description: 'Desc', powerRating: 50, icon: '✨' },
      sourceObject: { name: 'Mug', category: 'Drink', material: 'Clay', description: 'Desc' },
      appearance: { bodyShape: 'round', primaryColor: '#000', secondaryColor: '#111', accentColor: '#222', eyeStyle: 'wide', pattern: 'glazed', size: 1 },
      habitatPreference: 'Cozy Desk Studio',
      stats: { trust: 40, energy: 50, curiosity: 50, generation: 1 },
      memories: [],
      discoveredAt: Date.now()
    }
  ];

  let goals = computeFirstRunGoals(oneCreature);
  assert.equal(goals.discoveredTwo, false);
  assert.equal(goals.caredForOddling, false);
  assert.equal(goals.fusedSpecies, false);
  assert.equal(goals.builtBiomeHome, false);

  // Add second creature
  const twoCreatures = [
    ...oneCreature,
    {
      ...oneCreature[0],
      id: 'c2',
      name: 'Duo'
    }
  ];
  goals = computeFirstRunGoals(twoCreatures);
  assert.equal(goals.discoveredTwo, true);
  assert.equal(goals.caredForOddling, false);
  assert.equal(goals.builtBiomeHome, false);

  // Pet the creature
  twoCreatures[0].stats.trust = 75;
  twoCreatures[0].memories.push({ timestamp: Date.now(), text: 'Petted warmly', type: 'pet' });
  goals = computeFirstRunGoals(twoCreatures);
  assert.equal(goals.caredForOddling, true);
  assert.equal(goals.builtBiomeHome, false);

  // Fuse to create Gen 2
  const fusedCreatures = [
    ...twoCreatures,
    {
      ...twoCreatures[0],
      id: 'c3',
      name: 'Hybridling',
      stats: { trust: 60, energy: 90, curiosity: 80, generation: 2 },
      lineage: { parentAId: 'c1', parentBId: 'c2', inheritedTraits: ['Spines', 'Glaze'] }
    }
  ];
  goals = computeFirstRunGoals(fusedCreatures);
  assert.equal(goals.fusedSpecies, true);
  assert.equal(goals.builtBiomeHome, false);
});

test('generateCreatureFromObject with user upload manual mode assigns correct provenance and retains photo', () => {
  const manualObject: SegmentedObject = {
    id: 'user-bag',
    name: 'Blue Backpack',
    category: 'Luggage',
    material: 'Canvas Fabric',
    defaultElement: 'Textile',
    description: 'Player everyday backpack with brass zipper',
    center: [50, 50],
    maskPolygon: [[10, 10], [90, 10], [90, 90], [10, 90]],
    colorPalette: {
      primary: '#1d3557',
      secondary: '#457b9d',
      accent: '#e63946'
    },
    icon: '🎒'
  };

  const fakeDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  const creature = generateCreatureFromObject(manualObject, {
    provenance: 'user_upload_manual',
    userPhotoUrl: fakeDataUrl,
    selectionRegion: { x: 20, y: 20, width: 60, height: 60 }
  });

  assert.equal(creature.provenance, 'user_upload_manual');
  assert.equal(creature.sourceObject.userPhotoUrl, fakeDataUrl);
  assert.equal(creature.sourceObject.selectionRegion?.width, 60);
  assert.ok(creature.memories[0].text.includes('Manual Region Selection'));
});

test('regression: fresh save with INITIAL_ODDLINGS starts at 0/4 goals and progresses individually', () => {
  // 1. Fresh save with only initial catalog
  const freshGoals = computeFirstRunGoals(INITIAL_ODDLINGS);
  assert.equal(freshGoals.discoveredTwo, false, 'Initial seed creatures must not satisfy discoveredTwo');
  assert.equal(freshGoals.caredForOddling, false, 'Initial seed creatures must not satisfy caredForOddling');
  assert.equal(freshGoals.fusedSpecies, false, 'Initial seed creatures must not satisfy fusedSpecies');
  assert.equal(freshGoals.builtBiomeHome, false, 'Initial seed creatures must not satisfy builtBiomeHome');

  // Verify loadOnboardingActions on initial catalog yields 0/4
  const freshActions = loadOnboardingActions(INITIAL_ODDLINGS);
  const actionsGoals = computeFirstRunGoals(freshActions);
  assert.equal(actionsGoals.discoveredTwo, false);
  assert.equal(actionsGoals.caredForOddling, false);
  assert.equal(actionsGoals.fusedSpecies, false);
  assert.equal(actionsGoals.builtBiomeHome, false);

  // 2. Discovering 1 new player object -> still 0/4
  freshActions.discoveredObjectCreatureIds.push('player_obj_1');
  let step1Goals = computeFirstRunGoals(freshActions);
  assert.equal(step1Goals.discoveredTwo, false);
  assert.equal(step1Goals.caredForOddling, false);
  assert.equal(step1Goals.fusedSpecies, false);
  assert.equal(step1Goals.builtBiomeHome, false);

  // 3. Discovering 2nd new player object -> 1/4 (discoveredTwo is now true)
  freshActions.discoveredObjectCreatureIds.push('player_obj_2');
  let step2Goals = computeFirstRunGoals(freshActions);
  assert.equal(step2Goals.discoveredTwo, true);
  assert.equal(step2Goals.caredForOddling, false);
  assert.equal(step2Goals.fusedSpecies, false);
  assert.equal(step2Goals.builtBiomeHome, false);

  // 4. Caring for an Oddling (feed/pet/play/rest) -> 2/4 (caredForOddling is now true)
  freshActions.hasInteracted = true;
  let step3Goals = computeFirstRunGoals(freshActions);
  assert.equal(step3Goals.discoveredTwo, true);
  assert.equal(step3Goals.caredForOddling, true);
  assert.equal(step3Goals.fusedSpecies, false);
  assert.equal(step3Goals.builtBiomeHome, false);

  // 5. Completing a player fusion -> 3/4 (fusedSpecies is now true)
  freshActions.hasFused = true;
  let step4Goals = computeFirstRunGoals(freshActions);
  assert.equal(step4Goals.discoveredTwo, true);
  assert.equal(step4Goals.caredForOddling, true);
  assert.equal(step4Goals.fusedSpecies, true);
  assert.equal(step4Goals.builtBiomeHome, false);

  // 6. Customizing and saving biome home -> 4/4 (builtBiomeHome is now true)
  freshActions.hasCustomizedBiome = true;
  let step5Goals = computeFirstRunGoals(freshActions);
  assert.equal(step5Goals.discoveredTwo, true);
  assert.equal(step5Goals.caredForOddling, true);
  assert.equal(step5Goals.fusedSpecies, true);
  assert.equal(step5Goals.builtBiomeHome, true);
});

test('sanitizeCreature migrates legacy creature without visualPlan into structured object archetype', () => {
  const legacyCupCreature = {
    id: 'legacy-mug-123',
    name: 'Espresso Imp',
    speciesName: 'Caffea Spiritus',
    title: 'The Steaming Vessel',
    primaryElement: 'Ceramic',
    temperament: 'Chirpy & Warm',
    provenance: 'preset_demo',
    specialAbility: {
      name: 'Scald Shield',
      description: 'Hot barrier',
      powerRating: 75,
      icon: '☕'
    },
    sourceObject: {
      name: 'Coffee Mug',
      category: 'Drinkware',
      material: 'Glazed Ceramic',
      description: 'A morning coffee mug'
    },
    appearance: {
      bodyShape: 'round',
      primaryColor: '#8d0801',
      secondaryColor: '#f4a261',
      accentColor: '#ffffff',
      eyeStyle: 'sparkle',
      hornStyle: 'spines',
      accessory: 'steam',
      pattern: 'glazed',
      size: 1.0
      // NOTE: visualPlan is intentionally omitted (simulating older game save)
    },
    habitatPreference: 'Cozy Desk Studio',
    stats: { trust: 65, energy: 75, curiosity: 85, generation: 1 },
    memories: [{ timestamp: 123456, text: 'Discovered in mug', type: 'pet' }]
  };

  const migrated = sanitizeCreature(legacyCupCreature);
  assert.ok(migrated !== null);
  assert.ok(migrated?.appearance.visualPlan, 'Must have migrated and attached a VisualPlan');
  assert.equal(migrated?.appearance.visualPlan?.version, 1);
  assert.equal(migrated?.appearance.visualPlan?.archetype, 'cup', 'Derives cup archetype from Coffee Mug');
  assert.equal(migrated?.appearance.visualPlan?.definingParts.hasHandle, true, 'Cup must have handle');
  assert.equal(migrated?.appearance.visualPlan?.definingParts.hasRim, true, 'Cup must have open rim');
  assert.equal(migrated?.appearance.visualPlan?.definingParts.hasSteam, true, 'Steam accessory migrated into defining parts');
  assert.equal(migrated?.stats.trust, 65, 'Stats are preserved without loss');
  assert.equal(migrated?.name, 'Espresso Imp', 'Name preserved');
});

test('sanitizeEgg validates and normalizes valid egg structures while rejecting corrupt ones', () => {
  assert.equal(sanitizeEgg(null), null);
  assert.equal(sanitizeEgg(undefined), null);
  assert.equal(sanitizeEgg({}), null); // missing creature
  assert.equal(sanitizeEgg({ id: 'egg-1', creature: null }), null);

  const validCreature = INITIAL_ODDLINGS[0];
  const now = Date.now();
  const rawEgg = {
    id: 'egg-12345',
    creature: validCreature,
    createdAt: now,
    hatchAt: now + 180000,
    primaryColor: '#ff0000',
    secondaryColor: '#00ff00',
    accentColor: '#0000ff',
    pattern: 'cosmic',
    isHatched: false,
    isClaimed: false
  };

  const sanitized = sanitizeEgg(rawEgg);
  assert.ok(sanitized !== null);
  assert.equal(sanitized?.id, 'egg-12345');
  assert.equal(sanitized?.hatchAt, now + 180000);
  assert.equal(sanitized?.pattern, 'cosmic');
  assert.equal(sanitized?.isHatched, false);
  assert.equal(sanitized?.isClaimed, false);
});

test('claimActiveEgg enforces exactly-once claim guarantee and prevents duplicates', () => {
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
    const baseCreature = INITIAL_ODDLINGS[0];
    const newCreatureCandidate: CreatureDNA = {
      ...baseCreature,
      id: 'hatched-mon-99',
      name: 'Snips',
      speciesName: 'Scissorium Snipus'
    };

    const egg = sanitizeEgg({
      id: 'egg-snips-1',
      creature: newCreatureCandidate,
      createdAt: Date.now() - 200000, // already expired / ready
      hatchAt: Date.now() - 20000,
      pattern: 'stripes',
      isHatched: true,
      isClaimed: false
    });
    assert.ok(egg !== null);

    const initialList = [...INITIAL_ODDLINGS];
    assert.equal(initialList.length, 2);

    // 1. First claim: successfully claims creature
    const firstClaim = claimActiveEgg(egg, initialList);
    assert.ok(firstClaim.newCreature !== null);
    assert.equal(firstClaim.newCreature?.id, 'hatched-mon-99');
    assert.equal(firstClaim.updatedCreatures.length, 3);
    assert.equal(firstClaim.success, true);
    assert.equal(egg.isClaimed, true);

    // 2. Duplicate claim attempt with same egg: returns null, no dup
    const secondClaim = claimActiveEgg(egg, firstClaim.updatedCreatures);
    assert.equal(secondClaim.newCreature, null, 'Must return null for already-claimed egg');
    assert.equal(secondClaim.updatedCreatures.length, 3, 'Collection size unchanged');

    // 3. Claiming another egg containing the same creature ID: dedupes cleanly
    const dupEgg = sanitizeEgg({
      id: 'egg-snips-2',
      creature: newCreatureCandidate,
      createdAt: Date.now() - 190000,
      hatchAt: Date.now() - 10000,
      isClaimed: false
    });
    assert.ok(dupEgg !== null);

    const thirdClaim = claimActiveEgg(dupEgg, firstClaim.updatedCreatures);
    assert.equal(thirdClaim.newCreature?.id, 'hatched-mon-99', 'Must deduplicate based on existing creature ID');
    assert.equal(thirdClaim.updatedCreatures.length, 3);
    assert.equal(thirdClaim.success, true);
  } finally {
    (globalThis as any).window = originalWindow;
  }
});

test('createCompositionalSilhouette generates bounded recognizable silhouettes for arbitrary everyday objects', () => {
  // 1. Footwear
  const shoe = createCompositionalSilhouette('Running Sneaker', 'Footwear', 'Mesh & Rubber');
  assert.equal(shoe.category, 'footwear');
  assert.ok(shoe.featureAccents.some((f: any) => f.type === 'sole'));
  assert.ok(shoe.featureAccents.some((f: any) => f.type === 'laces'));

  // 2. Scissors / Cutting Tool
  const scissors = createCompositionalSilhouette('Office Scissors', 'Cutting Tool', 'Steel');
  assert.equal(scissors.category, 'tool');
  assert.ok(scissors.featureAccents.some((f: any) => f.type === 'blade'));

  // 3. Keys
  const keys = createCompositionalSilhouette('House Key', 'Hardware', 'Brass');
  assert.equal(keys.category, 'keys');
  assert.ok(keys.featureAccents.some((f: any) => f.type === 'teeth'));

  // 4. Backpack
  const backpack = createCompositionalSilhouette('School Backpack', 'Bag', 'Nylon Canvas');
  assert.equal(backpack.category, 'bag');
  assert.ok(backpack.featureAccents.some((f: any) => f.type === 'strap'));

  // 5. Eyeglasses
  const glasses = createCompositionalSilhouette('Reading Glasses', 'Eyewear', 'Acetate & Glass');
  assert.equal(glasses.category, 'eyewear');
  assert.ok(glasses.featureAccents.some((f: any) => f.type === 'lens'));

  // 6. Generic unseen everyday item
  const mystery = createCompositionalSilhouette('Weird Gizmo', 'Unknown', 'Plastic');
  assert.ok(mystery.bodyBlocks.length > 0);
  // Verify all coordinates stay bounded within 0..36
  for (const block of mystery.bodyBlocks) {
    assert.ok(block.x >= 0 && block.x + block.w <= 36);
    assert.ok(block.y >= 0 && block.y + block.h <= 36);
  }
});

test('incubator timer boundaries calculate exact countdown and ready states across simulated reloads', () => {
  const baseCreature = INITIAL_ODDLINGS[0];
  const createdAt = 1700000000000;
  const hatchAt = createdAt + 180000; // exact 180 seconds

  const egg = sanitizeEgg({
    id: 'timer-egg-1',
    creature: baseCreature,
    createdAt,
    hatchAt,
    pattern: 'spots',
    isHatched: false,
    isClaimed: false
  });
  assert.ok(egg !== null);

  // 1. Just created (now = createdAt)
  const remainingAtStart = Math.max(0, egg.hatchAt - createdAt);
  assert.equal(remainingAtStart, 180000, 'Exact 180s remaining at creation');

  // 2. Mid-way reload (60s elapsed)
  const nowMid = createdAt + 60000;
  const remainingMid = Math.max(0, egg.hatchAt - nowMid);
  assert.equal(remainingMid, 120000, 'Exact 120s remaining after 60s');

  // 3. Exact boundary (180s elapsed)
  const nowExact = createdAt + 180000;
  const remainingExact = Math.max(0, egg.hatchAt - nowExact);
  assert.equal(remainingExact, 0, 'Ready to hatch at exact completion');

  // 4. Overdue return (user returns next day)
  const nowLate = createdAt + 86400000;
  const remainingLate = Math.max(0, egg.hatchAt - nowLate);
  assert.equal(remainingLate, 0, 'Ready to hatch on later reload');
});

test('storage gracefully handles corrupted egg data without throwing or crashing', () => {
  // Mock window.localStorage in node test environment
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
    // 1. Corrupted JSON string
    mockStorage['oddlings_active_egg_v1'] = '{bad-json-malformed...';
    const loadedCorrupt = loadActiveEggFromStorage();
    assert.equal(loadedCorrupt, null, 'Must return null for corrupted JSON without crashing');

    // 2. Corrupted object (missing vital creature)
    mockStorage['oddlings_active_egg_v1'] = JSON.stringify({ id: 'bad-egg', creature: null });
    const loadedMissing = loadActiveEggFromStorage();
    assert.equal(loadedMissing, null, 'Must return null for egg with missing creature');

    // 3. Valid egg save & reload
    const validEgg = sanitizeEgg({
      id: 'egg-test-valid',
      creature: INITIAL_ODDLINGS[1],
      createdAt: Date.now(),
      hatchAt: Date.now() + 180000,
      pattern: 'zigzag',
      isHatched: false,
      isClaimed: false
    });
    const saved = saveActiveEggToStorage(validEgg);
    assert.equal(saved, true);

    const reloaded = loadActiveEggFromStorage();
    assert.ok(reloaded !== null);
    assert.equal(reloaded?.id, 'egg-test-valid');
    assert.equal(reloaded?.pattern, 'zigzag');

    // 4. Quota exceeded fallback: mock setItem throwing on large payload
    let callCount = 0;
    (globalThis as any).window.localStorage.setItem = (key: string, val: string) => {
      callCount++;
      if (callCount === 1) {
        throw new Error('QuotaExceededError');
      }
      mockStorage[key] = val;
    };

    const eggWithThumb = {
      ...validEgg!,
      photoThumbnail: 'a'.repeat(500000)
    };

    const quotaSaved = saveActiveEggToStorage(eggWithThumb);
    assert.equal(quotaSaved, true, 'Quota fallback stripped thumbnail and saved safely');
  } finally {
    (globalThis as any).window = originalWindow;
  }
});

test('claimActiveEgg adds creature to collection once and prevents duplicate claims', () => {
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
    const liveVerifiedKeyCreature: CreatureDNA = {
      id: 'oddling-clackkey-test',
      name: 'Clackkey',
      speciesName: 'Clavis Aurentia',
      title: 'The Tiny Gatekeeper',
      primaryElement: 'Mechanical',
      temperament: 'Curious & Chirpy',
      provenance: 'ai_extracted',
      provenanceDetails: {
        provider: 'baseten',
        model: 'meta-models/muse-spark-open-1026',
        isLive: true,
        timestamp: Date.now(),
        sourceDescription: 'Incubated from live-verified brass key'
      },
      specialAbility: {
        name: 'Master Unlock',
        description: 'Turns with a perfect click to reveal hidden spaces.',
        powerRating: 80,
        icon: '🔑'
      },
      sourceObject: {
        name: 'Clackkey',
        category: 'keys',
        material: 'Polished Brass',
        description: 'Born from a well-worn brass key.'
      },
      appearance: {
        bodyShape: 'boxy',
        primaryColor: '#d97706',
        secondaryColor: '#fde047',
        accentColor: '#b45309',
        eyeStyle: 'wide',
        pattern: 'glazed',
        size: 1.0,
        visualPlan: {
          version: 1,
          archetype: 'compositional',
          compositional: {
            category: 'keys',
            aspectRatio: 'elongated_h',
            bodyBlocks: [{ x: 8, y: 14, w: 20, h: 8, role: 'primary' }],
            featureAccents: [{ type: 'teeth', x: 20, y: 22, width: 6, height: 6, fillRole: 'accent' }],
            faceX: 14,
            faceY: 17
          },
          definingParts: {
            hasHandle: false,
            hasRim: false,
            hasSpout: false,
            hasSpines: false,
            hasShade: false,
            hasStem: false,
            hasEarcups: false,
            hasHeadband: false,
            hasDial: false,
            hasSteam: false
          },
          materialSurface: {
            finish: 'polished_brass',
            pattern: 'solid'
          },
          facePlacement: {
            surfaceRegion: 'body_center',
            yOffset: 0
          }
        }
      },
      habitatPreference: 'Cozy Desk Studio',
      stats: { trust: 40, energy: 90, curiosity: 80, generation: 1 },
      memories: [],
      discoveredAt: Date.now()
    };

    const egg: any = {
      id: 'egg-clackkey-1',
      creature: liveVerifiedKeyCreature,
      pattern: 'zigzag',
      createdAt: Date.now(),
      hatchAt: Date.now() + 180000,
      isHatched: true,
      isClaimed: false
    };

    saveActiveEggToStorage(egg);
    assert.ok(mockStorage['oddlings_active_egg_v1'], 'Active egg must be stored');

    // First claim
    const initialCollection = [...INITIAL_ODDLINGS];
    const firstClaimResult = claimActiveEgg(egg, initialCollection);
    assert.ok(firstClaimResult.newCreature !== null, 'First claim should return the new creature');
    assert.equal(firstClaimResult.newCreature?.name, 'Clackkey');
    assert.equal(firstClaimResult.updatedCreatures.length, initialCollection.length + 1);
    assert.equal(mockStorage['oddlings_active_egg_v1'], undefined, 'Active egg must be purged from storage after claim');

    // Second claim attempt with the same egg
    const secondClaimResult = claimActiveEgg(egg, firstClaimResult.updatedCreatures);
    assert.equal(secondClaimResult.newCreature, null, 'Second claim must return null (deduplicated)');
    assert.equal(secondClaimResult.updatedCreatures.length, firstClaimResult.updatedCreatures.length, 'Collection length must not increase');
  } finally {
    (globalThis as any).window = originalWindow;
  }
});

test('existing malformed saved Tinefang heals deterministically on load without losing identity', () => {
  // Saved Tinefang record matching the exact playtest save with malformed skinny visual plan
  const savedTinefangRecord = {
    id: 'oddling-tinefang-playtest-save',
    name: 'Tinefang',
    speciesName: 'Furca Argentea',
    title: 'Silver-Pronged Piercer',
    primaryElement: 'Mechanical',
    temperament: 'Stubborn & Spiky',
    provenance: 'ai_extracted',
    specialAbility: {
      name: 'Four-Prong Pierce',
      description: 'Pierces through obstacles with four prongs.',
      powerRating: 85,
      icon: '🍴'
    },
    sourceObject: {
      name: 'Dinner Fork',
      category: 'Utensil',
      material: 'Sterling Silver',
      description: 'A classic silver dinner fork with 4 prongs.'
    },
    appearance: {
      bodyShape: 'tall',
      primaryColor: '#e2e8f0',
      secondaryColor: '#94a3b8',
      accentColor: '#38bdf8',
      eyeStyle: 'wide',
      visualPlan: {
        version: 1,
        archetype: 'compositional',
        // Malformed skinny single-pixel line produced by prior model coordinate clamping
        compositional: {
          category: 'utensil',
          aspectRatio: 'tall',
          bodyBlocks: [{ x: 33, y: 4, w: 1, h: 28, role: 'primary' }],
          featureAccents: [],
          faceX: 18,
          faceY: 17
        },
        definingParts: {},
        materialSurface: { finish: 'polished_brass', pattern: 'solid' },
        facePlacement: { surfaceRegion: 'body_center', yOffset: 0 }
      }
    },
    stats: { trust: 45, energy: 90, curiosity: 85, generation: 1 },
    memories: [{ timestamp: 1234567, text: 'Hatched from four-prong silver fork', type: 'awaken' }]
  };

  const healedCreature = sanitizeCreature(savedTinefangRecord);
  assert.ok(healedCreature !== null, 'Sanitization must succeed');
  assert.equal(healedCreature?.name, 'Tinefang', 'Identity preserved');
  assert.equal(healedCreature?.speciesName, 'Furca Argentea', 'Species preserved');
  assert.equal(healedCreature?.stats.trust, 45, 'Stats preserved');
  assert.equal(healedCreature?.stats.energy, 90, 'Energy preserved');
  assert.equal(healedCreature?.memories.length, 1, 'Memories preserved');

  const comp = healedCreature?.appearance.visualPlan?.compositional;
  assert.ok(comp, 'Compositional plan must be present');
  assert.equal(comp?.category, 'fork', 'Healed to fork category');
  // Body blocks must be full 4-prong fork, not 1px hairline
  assert.equal(comp?.bodyBlocks.length, 8, 'Full 4 tines, bridge, neck, and handle blocks');
  const minX = Math.min(...comp!.bodyBlocks.map(b => b.x));
  const maxX = Math.max(...comp!.bodyBlocks.map(b => b.x + b.w));
  assert.ok(comp?.featureAccents.some(f => f.type === 'teeth'), 'Must have 4 shining prong accents');
});

test('existing malformed saved Clicker Whiskers heals deterministically on load without losing identity or stats', () => {
  // Playtest record from user: wired beige/gray computer mouse with two buttons, dark central scroll wheel, black cable.
  // Clicker Whiskers / Mus Electricus Domesticus / title Wired Wanderer / ability Scroll Surge.
  // Model had generated generic curio rectangular block.
  const savedMouseRecord = {
    id: 'oddling-clicker-whiskers-save',
    name: 'Clicker Whiskers',
    speciesName: 'Mus Electricus Domesticus',
    title: 'Wired Wanderer',
    primaryElement: 'Electric',
    temperament: 'Curious & Chirpy',
    provenance: 'ai_extracted',
    specialAbility: {
      name: 'Scroll Surge',
      description: 'Channels high-frequency current through tactile scroll ridges.',
      powerRating: 88,
      icon: '🖱️⚡'
    },
    sourceObject: {
      name: 'Wired Computer Mouse',
      category: 'Electronics',
      material: 'Matte ABS Plastic',
      description: 'Wired beige computer mouse with two buttons and scroll wheel.'
    },
    appearance: {
      bodyShape: 'boxy',
      primaryColor: '#d6d3d1',
      secondaryColor: '#f5f5f4',
      accentColor: '#1c1917',
      eyeStyle: 'wide',
      visualPlan: {
        version: 1,
        archetype: 'compositional',
        compositional: {
          category: 'curio',
          aspectRatio: 'square',
          bodyBlocks: [
            { x: 10, y: 10, w: 16, h: 16, role: 'primary' }
          ],
          featureAccents: [],
          faceX: 18,
          faceY: 18
        }
      }
    },
    stats: { trust: 60, energy: 85, curiosity: 90, generation: 1 },
    memories: [{ timestamp: 1234567, text: 'Awakened from user computer mouse photo.', type: 'awaken' }]
  };

  const healed = sanitizeCreature(savedMouseRecord);
  assert.ok(healed !== null);
  assert.equal(healed.name, 'Clicker Whiskers', 'Name preserved');
  assert.equal(healed.speciesName, 'Mus Electricus Domesticus', 'Species preserved');
  assert.equal(healed.sourceObject.name, 'Wired Computer Mouse');
  assert.equal(healed.stats.trust, 60);

  const comp = healed.appearance.visualPlan?.compositional;
  assert.ok(comp);
  assert.equal(comp.category, 'computer_mouse', 'Heals from curio to computer_mouse');

  // Verify left & right buttons, scroll wheel, and cord
  assert.ok(comp.featureAccents.some(f => f.type === 'wheel'), 'Must have scroll wheel accent');
  assert.ok(comp.featureAccents.some(f => f.type === 'cord'), 'Must have trailing USB cord accent');
  assert.ok(comp.bodyBlocks.some(b => b.x === 11 && b.w === 6), 'Must have left button');
  assert.ok(comp.bodyBlocks.some(b => b.x === 19 && b.w === 6), 'Must have right button');
});

test('loadOnboardingActions immediately syncs claimed player discoveries from collection', () => {
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
    // Stored onboarding only has 0 discoveries currently
    mockStorage['oddlings_onboarding_actions_v1'] = JSON.stringify({
      discoveredObjectCreatureIds: [],
      hasInteracted: false,
      hasFused: false,
      hasCustomizedBiome: false
    });

    const playerTinefang: CreatureDNA = {
      id: 'oddling-tinefang-discovered',
      name: 'Tinefang',
      speciesName: 'Furca Argentea',
      title: 'Silver-Pronged Piercer',
      primaryElement: 'Mechanical',
      temperament: 'Stubborn & Spiky',
      provenance: 'ai_extracted',
      specialAbility: { name: 'Pierce', description: 'Desc', powerRating: 80, icon: '🍴' },
      sourceObject: { name: 'Fork', category: 'Utensil', material: 'Silver', description: 'Fork' },
      appearance: { bodyShape: 'tall', primaryColor: '#ccc', secondaryColor: '#aaa', accentColor: '#fff', eyeStyle: 'wide', pattern: 'glazed', size: 1 },
      habitatPreference: 'Cozy Desk Studio',
      stats: { trust: 40, energy: 90, curiosity: 80, generation: 1 },
      memories: [],
      discoveredAt: Date.now()
    };

    const currentCreatures = [...INITIAL_ODDLINGS, playerTinefang];
    const actions = loadOnboardingActions(currentCreatures);

    assert.ok(actions.discoveredObjectCreatureIds.includes('oddling-tinefang-discovered'), 'Tinefang must be immediately detected as player discovery');
  } finally {
    (globalThis as any).window = originalWindow;
  }
});

test('Save & Restore: export excludes secret, credentials, and unrelated localStorage keys', () => {
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
    // Populate legitimate game keys
    mockStorage[STORAGE_KEY_CREATURES] = JSON.stringify(INITIAL_ODDLINGS);
    mockStorage[STORAGE_KEY_ONBOARDING] = JSON.stringify({
      discoveredObjectCreatureIds: ['sample-id'],
      hasInteracted: true,
      hasFused: false,
      hasCustomizedBiome: false
    });

    // Populate sensitive or unrelated keys that must NEVER be exported
    mockStorage['BASETEN_API_KEY'] = 'secret-baseten-key-12345';
    mockStorage['GEMINI_API_KEY'] = 'secret-gemini-key-67890';
    mockStorage['user_session_token'] = 'bearer-jwt-secret';
    mockStorage['unrelated_app_data'] = JSON.stringify({ some: 'data' });

    const bundle = createSaveBundle();
    const serialized = JSON.stringify(bundle);

    // Assert absolute exclusion of secrets and external keys
    assert.equal(serialized.includes('secret-baseten-key-12345'), false, 'Never export Baseten API keys');
    assert.equal(serialized.includes('secret-gemini-key-67890'), false, 'Never export Gemini API keys');
    assert.equal(serialized.includes('bearer-jwt-secret'), false, 'Never export session tokens');
    assert.equal(serialized.includes('unrelated_app_data'), false, 'Never export arbitrary localStorage keys');

    // Assert strict expected bundle root keys
    const exportedKeys = Object.keys(bundle).sort();
    assert.deepEqual(
      exportedKeys,
      ['activeEgg', 'appName', 'biomeWorlds', 'creatures', 'customBiomes', 'customItems', 'diaries', 'exportedAt', 'format', 'gardenAdventure', 'gardenTasks', 'onboarding', 'preferences', 'version', 'wallet'].sort(),
      'Exported keys must strictly match whitelist'
    );
  } finally {
    (globalThis as any).window = originalWindow;
  }
});

test('Save & Restore: roundtrip creature, custom biome world, and live incubator egg', () => {
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
    const customCreature: CreatureDNA = {
      ...INITIAL_ODDLINGS[0],
      id: 'roundtrip-creature-42',
      name: 'Chrono-Mug',
      stats: { trust: 88, energy: 95, curiosity: 77, generation: 3 },
      sourceObject: {
        name: 'Vintage Watch Mug',
        category: 'Ceramic',
        material: 'Clay & Brass',
        description: 'Mug with gears',
        userPhotoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
      }
    };

    const deskWorld = createStarterWorld('desk', 'cozy_clearing');
    deskWorld.tiles[5][5] = 'stone'; // custom modification

    const now = Date.now();
    const futureHatchAt = now + 90000; // 90 seconds in future
    const activeEgg: IncubatorEgg = {
      id: 'egg-roundtrip-1',
      creature: customCreature,
      pattern: 'stripes',
      primaryColor: '#e07a5f',
      secondaryColor: '#40916c',
      accentColor: '#ffe8d6',
      createdAt: now,
      hatchAt: futureHatchAt,
      isHatched: false,
      isClaimed: false
    };

    const initialBundle: OddlingsSaveBundleV1 = {
      version: 1,
      format: 'oddlings-save',
      appName: 'ODDLINGS',
      exportedAt: now,
      creatures: [customCreature],
      biomeWorlds: { desk: deskWorld },
      activeEgg,
      onboarding: {
        discoveredObjectCreatureIds: ['roundtrip-creature-42'],
        hasInteracted: true,
        hasFused: true,
        hasCustomizedBiome: true
      },
      preferences: { habitatTheme: 'desk', isMuted: false }
    };

    const jsonString = JSON.stringify(initialBundle);

    // Validate and parse
    const parseResult = validateAndParseSaveBundle(jsonString);
    assert.equal(parseResult.success, true, 'Parsing valid bundle must succeed');
    if (!parseResult.success) return;

    assert.equal(parseResult.preview.creatureCount, 1);
    assert.equal(parseResult.preview.biomeCount, 1);
    assert.equal(parseResult.preview.eggStatus, 'incubating');
    assert.ok(parseResult.preview.eggTimeRemainingFormatted?.includes('remaining'));

    // Apply bundle
    const applyResult = applySaveBundle(parseResult.bundle);
    assert.equal(applyResult.success, true, 'Apply bundle must succeed');

    // Verify localStorage was updated correctly
    const storedCreatures: CreatureDNA[] = JSON.parse(mockStorage[STORAGE_KEY_CREATURES]);
    assert.equal(storedCreatures.length, 1);
    assert.equal(storedCreatures[0].id, 'roundtrip-creature-42');
    assert.ok(storedCreatures[0].sourceObject.userPhotoUrl, 'Photo URL preserved');

    const storedEgg: IncubatorEgg = JSON.parse(mockStorage[STORAGE_KEY_ACTIVE_EGG]);
    assert.equal(storedEgg.id, 'egg-roundtrip-1');
    assert.equal(storedEgg.hatchAt, futureHatchAt, 'Hatch timestamp preserved strictly without reset');

    const storedWorld = JSON.parse(mockStorage[getStorageKey('desk')]);
    assert.equal(storedWorld.tiles[5][5], 'stone', 'Custom world tiles preserved');
  } finally {
    (globalThis as any).window = originalWindow;
  }
});

test('Save & Restore: rejects bad version, invalid schema, and prototype pollution with no state mutations', () => {
  const mockStorage: Record<string, string> = {
    [STORAGE_KEY_CREATURES]: JSON.stringify(INITIAL_ODDLINGS)
  };
  const originalWindow = (globalThis as any).window;

  (globalThis as any).window = {
    localStorage: {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, val: string) => { mockStorage[key] = val; },
      removeItem: (key: string) => { delete mockStorage[key]; }
    }
  };

  try {
    const originalStateSnapshot = JSON.stringify(mockStorage);

    // 1. Malformed JSON
    const malformedResult = validateAndParseSaveBundle('{not: valid json}}');
    assert.equal(malformedResult.success, false);
    assert.ok(malformedResult.error.includes('Malformed JSON'));

    // 2. Unsupported version
    const wrongVersionResult = validateAndParseSaveBundle(JSON.stringify({
      version: 999,
      format: 'oddlings-save',
      appName: 'ODDLINGS',
      creatures: INITIAL_ODDLINGS
    }));
    assert.equal(wrongVersionResult.success, false);
    assert.ok(wrongVersionResult.error.includes('Unsupported save version'));

    // 3. Missing creatures array
    const missingCreaturesResult = validateAndParseSaveBundle(JSON.stringify({
      version: 1,
      format: 'oddlings-save',
      appName: 'ODDLINGS'
    }));
    assert.equal(missingCreaturesResult.success, false);
    assert.ok(missingCreaturesResult.error.includes('missing "creatures"'));

    // 4. Prototype pollution attempt
    const protoPayload = '{"version":1,"format":"oddlings-save","appName":"ODDLINGS","__proto__":{"polluted":true},"creatures":[]}';
    const protoResult = validateAndParseSaveBundle(protoPayload);
    // Should be rejected because creatures is empty or revoked
    assert.equal(protoResult.success, false);
    assert.equal((Object.prototype as any).polluted, undefined, 'Object.prototype must not be polluted');

    // Assert storage remains completely unchanged
    assert.equal(JSON.stringify(mockStorage), originalStateSnapshot, 'Storage must not mutate on invalid restore');
  } finally {
    delete (Object.prototype as any).polluted;
    (globalThis as any).window = originalWindow;
  }
});

test('Save & Restore: storage quota error triggers clean rollback to original game save', () => {
  const mockStorage: Record<string, string> = {
    [STORAGE_KEY_CREATURES]: JSON.stringify(INITIAL_ODDLINGS),
    [STORAGE_KEY_ONBOARDING]: JSON.stringify({ discoveredObjectCreatureIds: ['initial-1'], hasInteracted: false, hasFused: false })
  };
  const originalWindow = (globalThis as any).window;

  let hasThrownQuota = false;
  (globalThis as any).window = {
    localStorage: {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, val: string) => {
        // Throw quota error on first creatures write during apply
        if (key === STORAGE_KEY_CREATURES && !hasThrownQuota) {
          hasThrownQuota = true;
          const err = new Error('QuotaExceededError');
          err.name = 'QuotaExceededError';
          throw err;
        }
        mockStorage[key] = val;
      },
      removeItem: (key: string) => { delete mockStorage[key]; }
    }
  };

  try {
    const candidateBundle: OddlingsSaveBundleV1 = {
      version: 1,
      format: 'oddlings-save',
      appName: 'ODDLINGS',
      exportedAt: Date.now(),
      creatures: [{ ...INITIAL_ODDLINGS[0], id: 'incoming-creature' }],
      biomeWorlds: {},
      activeEgg: null,
      onboarding: { discoveredObjectCreatureIds: ['incoming-creature'], hasInteracted: true, hasFused: true }
    };

    const result = applySaveBundle(candidateBundle);
    assert.equal(result.success, false, 'Must report quota failure');
    assert.ok(result.error.includes('quota exceeded'), 'Friendly quota error message');

    // Original state must be preserved
    const creaturesInStorage: CreatureDNA[] = JSON.parse(mockStorage[STORAGE_KEY_CREATURES]);
    assert.equal(creaturesInStorage[0].id, INITIAL_ODDLINGS[0].id, 'Original creature preserved via rollback');
  } finally {
    (globalThis as any).window = originalWindow;
  }
});

test('Save & Restore: restore undo allows reverting back to previous save snapshot', () => {
  const mockStorage: Record<string, string> = {
    [STORAGE_KEY_CREATURES]: JSON.stringify(INITIAL_ODDLINGS),
    [STORAGE_KEY_ONBOARDING]: JSON.stringify({ discoveredObjectCreatureIds: ['original-id'], hasInteracted: false, hasFused: false })
  };
  const originalWindow = (globalThis as any).window;

  (globalThis as any).window = {
    localStorage: {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, val: string) => { mockStorage[key] = val; },
      removeItem: (key: string) => { delete mockStorage[key]; }
    }
  };

  try {
    const candidateCreature: CreatureDNA = { ...INITIAL_ODDLINGS[0], id: 'candidate-99', name: 'Newbie' };
    const candidateBundle: OddlingsSaveBundleV1 = {
      version: 1,
      format: 'oddlings-save',
      appName: 'ODDLINGS',
      exportedAt: Date.now(),
      creatures: [candidateCreature],
      biomeWorlds: {},
      activeEgg: null,
      onboarding: { discoveredObjectCreatureIds: ['candidate-99'], hasInteracted: true, hasFused: true }
    };

    // Apply restore
    const applyResult = applySaveBundle(candidateBundle);
    assert.equal(applyResult.success, true);
    assert.equal(hasPreRestoreSnapshot(), true, 'Pre-restore snapshot must be recorded');

    // Confirm candidate is now in storage
    let current: CreatureDNA[] = JSON.parse(mockStorage[STORAGE_KEY_CREATURES]);
    assert.equal(current[0].id, 'candidate-99');

    // Perform Undo
    const undoResult = restorePreviousSnapshot();
    assert.equal(undoResult.success, true);

    // Confirm original creatures restored
    current = JSON.parse(mockStorage[STORAGE_KEY_CREATURES]);
    assert.equal(current[0].id, INITIAL_ODDLINGS[0].id, 'Original creatures successfully restored on undo');
    assert.equal(hasPreRestoreSnapshot(), false, 'Pre-restore snapshot cleared after undo');
  } finally {
    (globalThis as any).window = originalWindow;
  }
});

test('Save & Restore: legacy repaired fork specimens are healed during restore validation', () => {
  const legacyTinefangRaw = {
    id: 'oddling-legacy-tinefang',
    name: 'Tinefang',
    speciesName: 'Furca Argentea',
    title: 'Silver-Pronged Piercer',
    primaryElement: 'Mechanical',
    temperament: 'Sharp & Stubborn',
    provenance: 'ai_extracted',
    specialAbility: {
      name: 'Four-Prong Pierce',
      description: 'Pierces through obstacles.',
      powerRating: 85,
      icon: '🍴'
    },
    sourceObject: {
      name: 'Polished Stainless Steel', // lost noun!
      category: 'utensil',
      material: 'Polished Stainless Steel',
      description: 'Dinner fork with 4 tines'
    },
    appearance: {
      primaryColor: '#c0c0c0',
      secondaryColor: '#808080',
      accentColor: '#ffffff',
      visualPlan: {
        archetype: 'compositional',
        compositional: {
          category: 'fork',
          bodyBlocks: [
            { x: 12, y: 10, w: 12, h: 4, color: '#c0c0c0' },
            { x: 14, y: 18, w: 8, h: 4, color: '#c0c0c0' },
            { x: 15, y: 26, w: 6, h: 4, color: '#c0c0c0' }
          ],
          featureAccents: []
        }
      }
    },
    habitatPreference: 'Cozy Desk Studio',
    stats: { trust: 45, energy: 90, curiosity: 60, generation: 1 },
    lineage: {
      inheritedTraits: [
        'Four sharp parallel tines designed for piercing and spearing food',
        'Rigid perfectly balanced handle'
      ]
    },
    memories: [],
    discoveredAt: 1700000000000
  };

  const rawBundle = JSON.stringify({
    version: 1,
    format: 'oddlings-save',
    appName: 'ODDLINGS',
    exportedAt: Date.now(),
    creatures: [legacyTinefangRaw],
    biomeWorlds: {},
    activeEgg: null,
    onboarding: { discoveredObjectCreatureIds: ['oddling-legacy-tinefang'], hasInteracted: false, hasFused: false }
  });

  const result = validateAndParseSaveBundle(rawBundle);
  assert.equal(result.success, true, 'Validating legacy fork bundle must succeed');
  if (!result.success) return;

  const restoredCreature = result.bundle.creatures[0];
  assert.equal(restoredCreature.sourceObject.name, 'Dinner Fork', 'Recovered lost noun');
  assert.equal(restoredCreature.speciesName, 'Furca Argentea');
  assert.equal(restoredCreature.stats.trust, 45);

  const comp = restoredCreature.appearance.visualPlan?.compositional;
  assert.ok(comp, 'Must have healed compositional plan');
  assert.equal(comp?.category, 'fork');
  assert.equal(comp?.bodyBlocks.length, 8, 'Must have full 4 tines, bridge, neck, and handle blocks');
});

test('Save & Restore roundtrip preserves living_garden seed growth timestamps and garden tasks', () => {
  const greenhouseWorld = createStarterWorld('greenhouse', 'living_garden');
  // Add custom planted seed
  const plantedTs = 1710000000000;
  greenhouseWorld.decorations.push({
    id: 'seed-custom-1',
    type: 'seed',
    gridX: 12,
    gridY: 11,
    plantedAt: plantedTs,
    growthStage: 2,
    flowerVariant: 'starbloom'
  });

  const bundle = createSaveBundle({
    creatures: INITIAL_ODDLINGS,
    activeEgg: null,
    onboarding: { discoveredObjectCreatureIds: [], hasInteracted: true, hasFused: false },
    gardenTasks: {
      plantedSeed: true,
      grownFlower: true,
      oddlingEnjoyedPond: false,
      rewardClaimed: false
    }
  });

  bundle.biomeWorlds.greenhouse = greenhouseWorld;

  const jsonStr = JSON.stringify(bundle);
  const parsed = validateAndParseSaveBundle(jsonStr);
  assert.equal(parsed.success, true);
  if (!parsed.success) return;

  assert.equal(parsed.bundle.gardenTasks?.plantedSeed, true);
  assert.equal(parsed.bundle.gardenTasks?.grownFlower, true);
  assert.equal(parsed.bundle.gardenTasks?.oddlingEnjoyedPond, false);

  const restoredGh = parsed.bundle.biomeWorlds.greenhouse;
  assert.ok(restoredGh);
  const restoredSeed = restoredGh?.decorations.find((d) => d.id === 'seed-custom-1');
  assert.ok(restoredSeed, 'Seed decoration must be preserved');
  assert.equal(restoredSeed?.plantedAt, plantedTs, 'plantedAt timestamp preserved');
  assert.equal(restoredSeed?.growthStage, 2, 'growthStage preserved');
  assert.equal(restoredSeed?.flowerVariant, 'starbloom', 'flowerVariant preserved');
});

test('Save & Restore includes gardenAdventure, wallet, and diaries in bundle and preview', () => {
  const customAdventure = {
    id: 'adventure-first-garden-v1',
    step: 'watered' as const,
    biomeId: 'greenhouse',
    seedId: 'seed-test-123',
    wateredBy: 'oddling-thornbrew',
    encouragedBy: null,
    contributors: ['oddling-thornbrew'],
    rewardClaimed: false
  };

  const customWallet = {
    seeds: 14,
    gems: 7,
    sparkles: 45,
    questsDone: 3,
    checksDay: '2026-11-02',
    checksToday: 2,
    bonusChecks: 1,
    careDay: '2026-11-02',
    careToday: 5,
    receipts: []
  };

  const customDiaries = {
    'oddling-thornbrew': [
      { id: 'd1', at: 1710000000000, event: 'ability' as const, text: 'Watered the sproutling tenderly.', source: 'local' as const }
    ]
  };

  const bundle = createSaveBundle({
    creatures: INITIAL_ODDLINGS,
    gardenAdventure: customAdventure,
    wallet: customWallet,
    diaries: customDiaries
  });

  assert.equal(bundle.gardenAdventure?.step, 'watered');
  assert.equal(bundle.wallet?.seeds, 14);
  assert.equal(bundle.wallet?.sparkles, 45);
  assert.equal(bundle.diaries?.['oddling-thornbrew']?.[0]?.text, 'Watered the sproutling tenderly.');

  const jsonStr = JSON.stringify(bundle);
  const result = validateAndParseSaveBundle(jsonStr);
  assert.equal(result.success, true);
  if (!result.success) return;

  assert.equal(result.bundle.gardenAdventure?.step, 'watered');
  assert.equal(result.bundle.wallet?.seeds, 14);
  assert.equal(result.bundle.wallet?.gems, 7);
  assert.equal(result.bundle.diaries?.['oddling-thornbrew']?.length, 1);
  assert.equal(result.preview.adventureStep, 'watered');
  assert.ok(result.preview.walletSummary?.includes('14 seeds'));
});

test('validateAndParseSaveBundle gracefully migrates legacy saves missing adventure or wallet', () => {
  const legacyBundle = {
    version: 1,
    format: 'oddlings-save',
    appName: 'ODDLINGS',
    exportedAt: 1700000000000,
    creatures: INITIAL_ODDLINGS,
    biomeWorlds: {},
    activeEgg: null,
    onboarding: { discoveredObjectCreatureIds: [], hasInteracted: false, hasFused: false }
  };

  const result = validateAndParseSaveBundle(JSON.stringify(legacyBundle));
  assert.equal(result.success, true);
  if (!result.success) return;

  // Defaults to not_started and valid starting wallet
  assert.equal(result.bundle.gardenAdventure?.step, 'not_started');
  assert.equal(result.bundle.wallet?.seeds, 10);
  assert.deepEqual(result.bundle.diaries, {});
});

test('applySaveBundle idempotently migrates desk layout and adventure target to greenhouse if greenhouse is bare', () => {
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
    const deskWorld = {
      version: 1,
      biome: 'desk',
      width: 48,
      height: 24,
      tiles: createEmptyTiles(),
      decorations: [
        { id: 'custom-tree-1', type: 'tree' as const, gridX: 10, gridY: 15 }
      ],
      updatedAt: 1700000000000
    };

    const bundle = {
      version: 1,
      format: 'oddlings-save',
      appName: 'ODDLINGS',
      exportedAt: 1700000000000,
      creatures: INITIAL_ODDLINGS.map(c => ({ ...c, biomeId: 'greenhouse' })),
      biomeWorlds: {
        desk: deskWorld,
        greenhouse: {
          version: 1,
          biome: 'greenhouse',
          width: 48,
          height: 24,
          tiles: createEmptyTiles(),
          decorations: [], // empty greenhouse
          updatedAt: 1700000000000
        }
      },
      gardenAdventure: {
        id: 'adventure-first-garden-v1',
        step: 'seed_planted' as const,
        biomeId: 'desk', // legacy reference to desk
        seedId: 'seed-123',
        wateredBy: null,
        encouragedBy: null,
        contributors: [],
        rewardClaimed: false
      },
      wallet: { seeds: 12, gems: 5, sparkles: 20 },
      diaries: {},
      activeEgg: null,
      onboarding: { discoveredObjectCreatureIds: [], hasInteracted: false, hasFused: false }
    };

    const parsed = validateAndParseSaveBundle(JSON.stringify(bundle));
    assert.equal(parsed.success, true);
    if (!parsed.success) return;

    const applied = applySaveBundle(parsed.bundle);
    assert.equal(applied.success, true);

    // Greenhouse in localStorage received desk's decorations
    const greenhouseRaw = mockStorage[getStorageKey('greenhouse')];
    assert.ok(greenhouseRaw);
    const greenhouseWorld = JSON.parse(greenhouseRaw!);
    assert.equal(greenhouseWorld.decorations.length, 1);
    assert.equal(greenhouseWorld.decorations[0].id, 'custom-tree-1');

    // Adventure target migrated to greenhouse
    const adventureRaw = mockStorage[STORAGE_KEY_GARDEN_ADVENTURE];
    assert.ok(adventureRaw);
    const savedAdv = JSON.parse(adventureRaw!);
    assert.equal(savedAdv.biomeId, 'greenhouse');
  } finally {
    (globalThis as any).window = originalWindow;
  }
});

test('released creatures stay absent after reload, including the final Oddling', () => {
  const originalWindow = (globalThis as any).window;
  const data = new Map<string, string>();
  (globalThis as any).window = { localStorage: {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value)
  } };
  try {
    assert.equal(saveCreaturesToStorage(INITIAL_ODDLINGS.slice(1)), true);
    assert.equal(loadCreaturesFromStorage().some(c => c.id === INITIAL_ODDLINGS[0].id), false);
    assert.equal(saveCreaturesToStorage([]), true);
    assert.deepEqual(loadCreaturesFromStorage(), []);
  } finally {
    (globalThis as any).window = originalWindow;
  }
});