/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  generateCreatureFromObject, 
  fuseCreatures, 
  calculateInteractionResult, 
  determineCreatureMood,
  deriveArchetypeFromObject,
  createDefaultVisualPlan,
  createForkSilhouette,
  createSpoonSilhouette,
  createKnifeSilhouette,
  createCompositionalSilhouette,
  isCompositionalMalformed,
  normalizeAndCenterCompositional,
  detectUtensilOrToolType
} from './creatureRules';
import { repairObjectVisualPlan, activateCreatureAbility, getAbilityEffect } from './creatureRules';
import { INITIAL_ODDLINGS } from './creatureCatalog';
import { createStarterWorld, computeSeedGrowth } from './biomeWorld';

test('saved generic apple gets lobed fruit anatomy while hybrid chassis and arbitrary geometry survive', () => {
  const plan = createDefaultVisualPlan('curio', { primary: '#ee2222', secondary: '#bb2222', accent: '#ffffff' });
  const repaired = repairObjectVisualPlan(plan, 'Red Apple')!;
  assert.equal(repaired.compositional?.category, 'apple');
  assert.ok(repaired.compositional!.bodyBlocks.length >= 5);
  assert.equal(repairObjectVisualPlan(plan, 'Red Apple + Coffee Mug'), plan);
  const custom = { ...plan, archetype: 'compositional' as const, compositional: { ...repaired.compositional!, category: 'custom_model_shape' } };
  assert.equal(repairObjectVisualPlan(custom, 'Red Apple'), custom);
  assert.equal(deriveArchetypeFromObject('Red Apple', 'Fruit', 'Natural skin'), 'compositional');
  assert.notEqual(deriveArchetypeFromObject('Steel fork', 'Utensil', 'Steel'), 'cup');
});

test('ability changes only current residents, clamps stats and rejects cooldown and remote use', () => {
  const caster = { ...INITIAL_ODDLINGS[0], biomeId: 'greenhouse', specialAbility: { name: 'Crisp Replenish', description: 'Restore energy', powerRating: 68, icon: '🍎' } };
  const friend = { ...INITIAL_ODDLINGS[1], id: 'friend', stats: { ...INITIAL_ODDLINGS[1].stats, energy: 95 } };
  const remote = { ...friend, id: 'remote', biomeId: 'lab' };
  const world = createStarterWorld('greenhouse');
  const result = activateCreatureAbility(caster, [caster, friend, remote], world, 1000);
  assert.equal(result.ok, true);
  assert.equal(result.creatures.length, 2);
  assert.equal(result.creatures.find(c => c.id === 'friend')!.stats.energy, 100);
  assert.equal(friend.stats.energy, 95);
  assert.equal(activateCreatureAbility(caster, [caster], world, 2000, result.readyAt).ok, false);
  assert.equal(activateCreatureAbility(remote, [remote], world, 2000).ok, false);
});

test('watering actually accelerates seed growth without mutating the world', () => {
  const caster = { ...INITIAL_ODDLINGS[0], biomeId: 'desk', primaryElement: 'Ceramic' as const,
    specialAbility: { name: 'Water plants', description: 'Water seeds', powerRating: 50, icon: '💧' } };
  const world = createStarterWorld('desk');
  world.decorations = [{ id: 'seed', type: 'seed', gridX: 4, gridY: 18, plantedAt: 1000 }];
  assert.equal(getAbilityEffect(caster).kind, 'water');
  const result = activateCreatureAbility(caster, [caster], world, 12000);
  assert.equal(result.ok, true);
  assert.equal(world.decorations[0].wateredAt, undefined);
  assert.equal(computeSeedGrowth(world.decorations[0], 12000).stage, 1);
  assert.equal(computeSeedGrowth(result.world.decorations[0], 12000).stage, 2);
  assert.equal(activateCreatureAbility(caster, [caster], { ...world, decorations: [] }, 12000).ok, false);
});
import { SegmentedObject, CreatureDNA, ObjectArchetype, CompositionalSilhouette } from './creatureTypes';

test('generateCreatureFromObject generates valid DNA with element and appearance', () => {
  const mockObject: SegmentedObject = {
    id: 'test-mug',
    name: 'Coffee Mug',
    category: 'Drinkware',
    material: 'Ceramic Glaze',
    defaultElement: 'Ceramic',
    description: 'Hot coffee mug',
    center: [50, 50],
    maskPolygon: [[10, 10], [90, 10], [90, 90], [10, 90]],
    colorPalette: {
      primary: '#e07a5f',
      secondary: '#f4f1de',
      accent: '#3d405b'
    },
    icon: '☕'
  };

  const creature = generateCreatureFromObject(mockObject);
  assert.ok(creature.name.length > 0, 'Creature should have a name');
  assert.equal(creature.primaryElement, 'Ceramic');
  assert.equal(creature.sourceObject.material, 'Ceramic Glaze');
  assert.equal(creature.stats.generation, 1);
  assert.ok(creature.specialAbility.powerRating > 0);
  assert.equal(creature.appearance.primaryColor, '#e07a5f');
});

test('fuseCreatures combines two parents and increments generation', () => {
  const parentA: CreatureDNA = {
    id: 'parent-a',
    name: 'Muggle',
    speciesName: 'Muggle Primus',
    title: 'The Ceramic Spirit',
    primaryElement: 'Ceramic',
    temperament: 'Sleepy & Warm',
    provenance: 'preset_demo',
    specialAbility: {
      name: 'Glaze Shield',
      description: 'Hardens shell',
      powerRating: 60,
      icon: '☕'
    },
    sourceObject: {
      name: 'Coffee Mug',
      category: 'Drinkware',
      material: 'Ceramic',
      description: 'Mug'
    },
    appearance: {
      bodyShape: 'chubby',
      primaryColor: '#c86d51',
      secondaryColor: '#ffffff',
      accentColor: '#333333',
      eyeStyle: 'sleepy',
      pattern: 'glazed',
      size: 1.0
    },
    habitatPreference: 'Cozy Desk Studio',
    stats: { trust: 50, energy: 80, curiosity: 60, generation: 1 },
    memories: [],
    discoveredAt: Date.now()
  };

  const parentB: CreatureDNA = {
    id: 'parent-b',
    name: 'Spiket',
    speciesName: 'Spiket Primus',
    title: 'The Cactus Spirit',
    primaryElement: 'Botanical',
    temperament: 'Stubborn & Spiky',
    provenance: 'preset_demo',
    specialAbility: {
      name: 'Spine Burst',
      description: 'Fires spines',
      powerRating: 70,
      icon: '🌵'
    },
    sourceObject: {
      name: 'Mini Cactus',
      category: 'Plant',
      material: 'Botanical Spines',
      description: 'Cactus'
    },
    appearance: {
      bodyShape: 'spiky',
      primaryColor: '#2d6a4f',
      secondaryColor: '#74c69d',
      accentColor: '#d8f3dc',
      eyeStyle: 'wide',
      hornStyle: 'spines',
      pattern: 'spots',
      size: 1.1
    },
    habitatPreference: 'Sunlit Greenhouse',
    stats: { trust: 60, energy: 70, curiosity: 50, generation: 1 },
    memories: [],
    discoveredAt: Date.now()
  };

  const { hybrid, recipeName } = fuseCreatures(parentA, parentB);
  assert.equal(hybrid.stats.generation, 2, 'Hybrid must be Generation 2');
  assert.equal(hybrid.primaryElement, 'Ceramic');
  assert.equal(hybrid.secondaryElement, 'Botanical');
  assert.ok(hybrid.lineage, 'Hybrid must record lineage');
  assert.equal(hybrid.lineage?.parentAId, 'parent-a');
  assert.equal(hybrid.lineage?.parentBId, 'parent-b');
  assert.ok(recipeName.includes('Muggle'));
});

test('calculateInteractionResult rewards favorite element matches with extra trust', () => {
  const creature: CreatureDNA = {
    id: 'c1',
    name: 'Thornbrew',
    speciesName: 'Calefactus Spinosus',
    title: 'Steam Spined',
    primaryElement: 'Ceramic',
    secondaryElement: 'Botanical',
    temperament: 'Sleepy & Warm',
    provenance: 'preset_demo',
    specialAbility: { name: 'Steam', description: 'Steam', powerRating: 70, icon: '☕' },
    sourceObject: { name: 'Mug', category: 'Drink', material: 'Clay', description: 'Desc' },
    appearance: {
      bodyShape: 'round',
      primaryColor: '#aaa',
      secondaryColor: '#bbb',
      accentColor: '#ccc',
      eyeStyle: 'sleepy',
      pattern: 'glazed',
      size: 1
    },
    habitatPreference: 'Cozy Desk Studio',
    stats: { trust: 50, energy: 50, curiosity: 50, generation: 1 },
    memories: [],
    discoveredAt: Date.now()
  };

  const favoriteFeed = calculateInteractionResult(creature, 'feed', 'Botanical');
  const genericFeed = calculateInteractionResult(creature, 'feed', 'Electric');

  assert.ok(favoriteFeed.trustDelta > genericFeed.trustDelta, 'Favorite element food grants more trust');
  assert.equal(favoriteFeed.energyDelta, 25);

  const petResult = calculateInteractionResult(creature, 'pet');
  assert.equal(petResult.trustDelta, 6);

  const mood = determineCreatureMood({ ...creature, stats: { ...creature.stats, trust: 90 } });
  assert.equal(mood, 'loving');
});

test('deriveArchetypeFromObject maps object names and categories to distinct non-blob archetypes', () => {
  assert.equal(deriveArchetypeFromObject('Ceramic Coffee Mug', 'Drinkware', 'Clay'), 'cup');
  assert.equal(deriveArchetypeFromObject('Espresso Cup', 'Kitchen', 'Porcelain'), 'cup');
  assert.equal(deriveArchetypeFromObject('Mini Desk Cactus', 'Houseplants', 'Botanical'), 'cactus');
  assert.equal(deriveArchetypeFromObject('Gooseneck Desk Lamp', 'Lighting', 'Brass'), 'lamp');
  assert.equal(deriveArchetypeFromObject('Studio Headphones', 'Audio Gear', 'Plastic & Leather'), 'headphones');
  assert.equal(deriveArchetypeFromObject('Cast Iron Teapot', 'Drinkware', 'Iron'), 'teapot');
  assert.equal(deriveArchetypeFromObject('Clover Honey Jar', 'Pantry', 'Glass'), 'honey_jar');
  assert.equal(deriveArchetypeFromObject('Antique Pocket Watch', 'Horology', 'Gold'), 'pocket_watch');
  assert.equal(deriveArchetypeFromObject('Fresh Organic Lemon', 'Produce', 'Citrus Rind'), 'lemon');
  assert.equal(deriveArchetypeFromObject('Mystery Crystal Prism', 'Oddity', 'Quartz'), 'curio');
});

test('generateCreatureFromObject attaches versioned VisualPlan grounded in the object anatomy', () => {
  const cupObject: SegmentedObject = {
    id: 'cup-specimen',
    name: 'Glazed Ceramic Mug',
    category: 'Drinkware',
    material: 'Stoneware Clay',
    defaultElement: 'Ceramic',
    description: 'A blue ceramic mug with a sturdy curved handle',
    center: [50, 50],
    maskPolygon: [[20, 20], [80, 20], [70, 80], [30, 80]],
    colorPalette: { primary: '#2a6f97', secondary: '#014f86', accent: '#a9d6e5' },
    icon: '☕'
  };

  const creature = generateCreatureFromObject(cupObject);
  assert.ok(creature.appearance.visualPlan, 'Creature must contain a VisualPlan');
  assert.equal(creature.appearance.visualPlan.version, 1);
  assert.equal(creature.appearance.visualPlan.archetype, 'cup');
  assert.equal(creature.appearance.visualPlan.definingParts.hasHandle, true, 'Cup must have handle');
  assert.equal(creature.appearance.visualPlan.definingParts.hasRim, true, 'Cup must have open rim');
  assert.equal(creature.appearance.visualPlan.definingParts.hasSteam, true, 'Cup creature has steam');
  assert.equal(creature.appearance.visualPlan.facePlacement.surfaceRegion, 'vessel_front');
});

test('fuseCreatures produces hybrid inheriting recognizable anatomy from both parents (cup + cactus)', () => {
  const parentCup: CreatureDNA = {
    id: 'parent-cup-1',
    name: 'Muggle',
    speciesName: 'Poculum Ceramicum',
    title: 'The Ceramic Vessel',
    primaryElement: 'Ceramic',
    temperament: 'Sleepy & Warm',
    provenance: 'preset_demo',
    specialAbility: { name: 'Scald Shield', description: 'Steam blast', powerRating: 65, icon: '☕' },
    sourceObject: { name: 'Clay Cup', category: 'Drinkware', material: 'Ceramic', description: 'Mug' },
    appearance: {
      bodyShape: 'round',
      primaryColor: '#8d0801',
      secondaryColor: '#f4a261',
      accentColor: '#ffffff',
      eyeStyle: 'sleepy',
      pattern: 'glazed',
      size: 1.0,
      visualPlan: createDefaultVisualPlan('cup', { primary: '#8d0801', secondary: '#f4a261', accent: '#ffffff' }, { hasHandle: true, hasRim: true, hasSteam: true })
    },
    habitatPreference: 'Cozy Desk Studio',
    stats: { trust: 50, energy: 80, curiosity: 60, generation: 1 },
    memories: [],
    discoveredAt: Date.now()
  };

  const parentCactus: CreatureDNA = {
    id: 'parent-cactus-1',
    name: 'Spiket',
    speciesName: 'Cactus Aculeatus',
    title: 'The Desert Sentry',
    primaryElement: 'Botanical',
    temperament: 'Stubborn & Spiky',
    provenance: 'preset_demo',
    specialAbility: { name: 'Spine Barrage', description: 'Sharp spines', powerRating: 70, icon: '🌵' },
    sourceObject: { name: 'Saguaro Cactus', category: 'Flora', material: 'Succulent', description: 'Cactus' },
    appearance: {
      bodyShape: 'spiky',
      primaryColor: '#2d6a4f',
      secondaryColor: '#52b788',
      accentColor: '#d8f3dc',
      eyeStyle: 'sparkle',
      pattern: 'spots',
      size: 1.1,
      visualPlan: createDefaultVisualPlan('cactus', { primary: '#2d6a4f', secondary: '#52b788', accent: '#d8f3dc' }, { hasSpines: true })
    },
    habitatPreference: 'Sunlit Greenhouse',
    stats: { trust: 60, energy: 70, curiosity: 50, generation: 1 },
    memories: [],
    discoveredAt: Date.now()
  };

  const { hybrid } = fuseCreatures(parentCup, parentCactus);
  assert.ok(hybrid.appearance.visualPlan, 'Hybrid must contain visualPlan');
  // Chassis inherited from parent A
  assert.equal(hybrid.appearance.visualPlan.archetype, 'cup', 'Chassis is inherited from parent A (cup vessel)');
  assert.equal(hybrid.appearance.visualPlan.definingParts.hasHandle, true, 'Retains cup handle');
  assert.equal(hybrid.appearance.visualPlan.definingParts.hasRim, true, 'Retains open rim');
  // Inherits defining parts from parent B (cactus spines!)
  assert.equal(hybrid.appearance.visualPlan.definingParts.hasSpines, true, 'Must inherit cactus spines!');
  assert.ok(hybrid.appearance.visualPlan.inheritedFeatures?.chassisFrom?.includes('Muggle'));
  assert.ok(hybrid.appearance.visualPlan.inheritedFeatures?.accentsFrom?.includes('Spiket'));
  assert.ok(hybrid.appearance.visualPlan.inheritedFeatures?.inheritedPartKeys.some(k => k.includes('cactus spines')));
});

test('utensil subtypes: fork has 4 clearly separate tines with 1px gaps, spoon has curved scoop, knife has blade', () => {
  // 1. Fork
  const forkComp = createCompositionalSilhouette('Dinner Fork', 'Utensil', 'Silver');
  assert.equal(forkComp.category, 'fork');
  assert.equal(forkComp.aspectRatio, 'tall');
  // Check the 4 separate tines with 1px gaps
  const tines = forkComp.bodyBlocks.filter(b => b.y === 5 && b.h === 6 && b.w === 2);
  assert.equal(tines.length, 4, 'Must have 4 separate tines');
  assert.deepEqual(tines.map(t => t.x), [12, 15, 18, 21], 'Tines must be separated by 1px air gaps (at 14, 17, 20)');
  // Check 4 tine reflection feature accents
  const teethAccents = forkComp.featureAccents.filter(f => f.type === 'teeth');
  assert.equal(teethAccents.length, 4, 'Must have 4 shining tine accents');
  // Check neck and handle
  const handleBlock = forkComp.bodyBlocks.find(b => b.w >= 6 && b.h >= 8);
  assert.ok(handleBlock, 'Must have a 6px wide silver ergonomic handle');
  assert.equal(handleBlock.w, 6, 'Handle must be visibly 4-6px wide');

  // 2. Spoon
  const spoonComp = createCompositionalSilhouette('Soup Spoon', 'Utensil', 'Silver');
  assert.equal(spoonComp.category, 'spoon');
  const spoonBowl = spoonComp.bodyBlocks.find(b => b.w >= 12 && b.h >= 10);
  assert.ok(spoonBowl, 'Must have curved spoon bowl head');
  assert.ok(spoonComp.featureAccents.some(f => f.type === 'rim'), 'Must have spoon rim highlight');

  // 3. Knife
  const knifeComp = createCompositionalSilhouette('Steak Knife', 'Utensil', 'Steel');
  assert.equal(knifeComp.category, 'knife');
  const knifeBlade = knifeComp.bodyBlocks.find(b => b.y <= 6 && b.h >= 10);
  assert.ok(knifeBlade, 'Must have a blade body block');
  assert.ok(knifeComp.featureAccents.some(f => f.type === 'blade'), 'Must have blade cutting shine');
});

test('isCompositionalMalformed correctly detects skinny hairlines, disconnected blocks, and fork tines', () => {
  // 1. Critical bug fixture: single 1-pixel wide line at far right
  const malformedSkinnyLine = {
    category: 'utensil',
    aspectRatio: 'tall',
    bodyBlocks: [
      { x: 33, y: 4, w: 1, h: 26, role: 'primary' }
    ],
    featureAccents: [],
    faceX: 18,
    faceY: 17
  };
  assert.equal(isCompositionalMalformed(malformedSkinnyLine), true, 'Single pixel hairline must be detected as malformed');

  // 2. Disconnected blocks with large vertical air gap (playtest bug)
  const malformedDisconnected = {
    category: 'utensil',
    aspectRatio: 'tall',
    bodyBlocks: [
      { x: 10, y: 4, w: 4, h: 6, role: 'primary' },
      { x: 22, y: 4, w: 4, h: 6, role: 'primary' },
      { x: 16, y: 18, w: 4, h: 10, role: 'secondary' } // 8px vertical gap from y: 10 to y: 18
    ],
    featureAccents: [],
    faceX: 18,
    faceY: 17
  };
  assert.equal(isCompositionalMalformed(malformedDisconnected), true, 'Disconnected blocks with vertical air gap must be detected as malformed');

  // 3. Fork semantic text with missing tines
  const malformedForkBlocks = {
    category: 'utensil',
    bodyBlocks: [
      { x: 10, y: 5, w: 16, h: 20, role: 'primary' }
    ],
    featureAccents: []
  };
  assert.equal(
    isCompositionalMalformed(malformedForkBlocks, 'Furca Argentea Silver-Pronged Piercer Four-Prong Pierce'),
    true,
    'Utensil with fork semantic cues lacking 4 tines must be detected as malformed'
  );

  // 4. Normalized 0..1 floats from LLM
  const malformedNormalizedFloats = {
    category: 'utensil',
    bodyBlocks: [
      { x: 0.85, y: 0.1, w: 0.05, h: 0.8, role: 'primary' }
    ],
    featureAccents: []
  };
  assert.equal(isCompositionalMalformed(malformedNormalizedFloats), true, 'Normalized 0..1 floats must be detected as malformed');

  // 5. Healthy connected plan (e.g. key or shoe)
  const healthyPlan = {
    category: 'keys',
    bodyBlocks: [
      { x: 12, y: 6, w: 12, h: 10, role: 'accent' },
      { x: 16, y: 15, w: 4, h: 12, role: 'primary' },
      { x: 20, y: 21, w: 4, h: 6, role: 'secondary' }
    ],
    featureAccents: [
      { type: 'teeth', x: 20, y: 22, width: 4, height: 4, fillRole: 'light' }
    ],
    faceX: 18,
    faceY: 15
  };
  assert.equal(isCompositionalMalformed(healthyPlan), false, 'Healthy connected plan must not be marked malformed');
});

test('normalizeAndCenterCompositional heals exact legacy playtest fixture with lost noun', () => {
  const legacyTinefangPlaytestRecord = {
    id: 'oddling-tinefang-playtest',
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
      name: 'Polished Stainless Steel', // NOUN FORK LOST!
      category: 'Utensil',
      material: 'Polished Stainless Steel',
      description: 'A polished metal utensil.'
    },
    appearance: {
      bodyShape: 'tall',
      primaryColor: '#e2e8f0',
      secondaryColor: '#94a3b8',
      accentColor: '#ffffff',
      eyeStyle: 'wide',
      visualPlan: {
        version: 1,
        archetype: 'compositional',
        compositional: {
          category: 'utensil',
          aspectRatio: 'tall',
          bodyBlocks: [
            { x: 10, y: 4, w: 4, h: 6, role: 'primary' },
            { x: 22, y: 4, w: 4, h: 6, role: 'primary' },
            { x: 16, y: 18, w: 4, h: 10, role: 'secondary' }
          ],
          featureAccents: [],
          faceX: 18,
          faceY: 17
        }
      }
    },
    inheritedTraits: [
      'Four sharp parallel tines designed for piercing and spearing food',
      'Rigid perfectly balanced handle'
    ]
  };

  // 1. Gather semantic cues without knowing noun fork was in sourceObject.name
  const semantic = `${legacyTinefangPlaytestRecord.name} ${legacyTinefangPlaytestRecord.speciesName} ${legacyTinefangPlaytestRecord.title} ${legacyTinefangPlaytestRecord.specialAbility.name} ${legacyTinefangPlaytestRecord.inheritedTraits.join(' ')}`;
  const healed = normalizeAndCenterCompositional(
    legacyTinefangPlaytestRecord.appearance.visualPlan.compositional as any,
    semantic
  );

  assert.equal(healed.category, 'fork');
  // Check 4 separate tines with 1px gaps
  const tines = healed.bodyBlocks.filter(b => b.w === 2 && b.y <= 6);
  assert.equal(tines.length, 4, 'Must heal to 4 separate tines');
  assert.deepEqual(tines.map(t => t.x), [12, 15, 18, 21]);
  // Gaps: 15-14 = 1, 18-17 = 1, 21-20 = 1
  assert.equal(tines[1].x - (tines[0].x + tines[0].w), 1, '1px gap between tine 1 and 2');
  assert.equal(tines[2].x - (tines[1].x + tines[1].w), 1, '1px gap between tine 2 and 3');
  assert.equal(tines[3].x - (tines[2].x + tines[2].w), 1, '1px gap between tine 3 and 4');

  // Check connected bridge and 6px wide handle
  const bridge = healed.bodyBlocks.find(b => b.w >= 12 && b.y === 11);
  assert.ok(bridge, 'Must have solid bridge anchoring all 4 tines');
  const handle = healed.bodyBlocks.find(b => b.w === 6 && b.y === 18);
  assert.ok(handle, 'Must have visibly 6px wide handle');
});

test('scale bounding box together without collapsing blocks to edge', () => {
  // A valid custom 3-block character where blocks have relative spacing
  const customWideModel: CompositionalSilhouette = {
    category: 'custom_character',
    bodyBlocks: [
      { x: 10, y: 10, w: 10, h: 10, role: 'primary' },
      { x: 22, y: 12, w: 8, h: 8, role: 'secondary' }
    ],
    featureAccents: [
      { type: 'button', x: 14, y: 14, width: 2, height: 2, fillRole: 'light' }
    ],
    faceX: 15,
    faceY: 15
  };

  const normalized = normalizeAndCenterCompositional(customWideModel, 'Custom Robot');
  assert.equal(normalized.category, 'custom_character', 'Preserves custom category');
  assert.equal(normalized.bodyBlocks.length, 2, 'Preserves both blocks');

  // The relative horizontal gap between block 1 (right edge: x + w) and block 2 (x)
  // Originally: block 1 right edge = 20, block 2 left edge = 22 -> gap of 2px
  const b1 = normalized.bodyBlocks[0];
  const b2 = normalized.bodyBlocks[1];
  const gap = b2.x - (b1.x + b1.w);
  assert.equal(gap, 2, 'Relative spacing between blocks must be preserved, not clamped independently');
});

test('a bladeless fan with piercing wind and routine language is neither a fork nor a knife', () => {
  assert.equal(detectUtensilOrToolType('Bladeless Tower Fan Air Purifier. Pierces stale air during its cleaning routine.'), null);
  assert.equal(detectUtensilOrToolType('Dinner utensil with four prongs'), 'fork');
});

test('detectUtensilOrToolType correctly identifies computer mouse and does NOT confuse scroll wheel with heel', () => {
  // Test mouse cues
  const mouseText = 'Wired Computer Mouse Matte ABS Plastic Clicker Whiskers Mus Electricus Domesticus Wired Wanderer Scroll Surge two buttons dark central scroll wheel black cable';
  const detected = detectUtensilOrToolType(mouseText);
  assert.equal(detected, 'computer_mouse', 'Must detect computer_mouse');

  // Ensure scroll wheel does not trigger footwear
  const wheelOnly = 'dark central scroll wheel with rubber ribs';
  assert.equal(detectUtensilOrToolType(wheelOnly), 'computer_mouse');

  // Genuine footwear with heel should still detect footwear
  const shoeText = 'High heel leather boots with ankle strap';
  assert.equal(detectUtensilOrToolType(shoeText), 'footwear');
});

test('normalizeAndCenterCompositional heals exact Clicker Whiskers playtest fixture to iconic computer mouse', () => {
  // Exact user playtest fixture:
  // User uploaded wired beige/gray computer mouse with two buttons, dark central scroll wheel, black cable.
  // Model output generic curio rectangular blocks.
  const malformedMouseFixture: CompositionalSilhouette = {
    category: 'curio',
    aspectRatio: 'square',
    bodyBlocks: [
      { x: 10, y: 10, w: 16, h: 16, role: 'primary' },
      { x: 12, y: 8, w: 12, h: 4, role: 'secondary' }
    ],
    featureAccents: [],
    faceX: 18,
    faceY: 16
  };

  const semantic = 'Wired Computer Mouse Matte ABS Plastic Clicker Whiskers Mus Electricus Domesticus Wired Wanderer Scroll Surge two buttons dark central scroll wheel black cable';
  const colors = { primary: '#d6d3d1', secondary: '#f5f5f4', accent: '#292524' };

  const healed = normalizeAndCenterCompositional(malformedMouseFixture, semantic, colors);

  assert.equal(healed.category, 'computer_mouse', 'Healed category must be computer_mouse');

  // Verify left and right click buttons
  const leftBtn = healed.bodyBlocks.find(b => b.x === 11 && b.w === 6 && b.role === 'secondary');
  const rightBtn = healed.bodyBlocks.find(b => b.x === 19 && b.w === 6 && b.role === 'secondary');
  assert.ok(leftBtn, 'Must have distinct left click button');
  assert.ok(rightBtn, 'Must have distinct right click button');

  // Verify dark central scroll wheel
  const wheel = healed.featureAccents.find(f => f.type === 'wheel');
  assert.ok(wheel, 'Must have dark rubberized scroll wheel');
  assert.equal(wheel.x, 17);

  // Verify trailing cable exiting top
  const cord = healed.featureAccents.find(f => f.type === 'cord');
  assert.ok(cord, 'Must have trailing USB cord');
  assert.ok(cord.y <= 2, 'Cord exits from top');

  // Verify grounded feet baseline
  const maxY = Math.max(...healed.bodyBlocks.map(b => b.y + b.h));
  assert.ok(maxY <= 31 && maxY >= 28, 'Base of body sits at feet baseline');
});



