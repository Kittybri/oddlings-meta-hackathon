/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  CreatureDNA, 
  ElementType, 
  MoodType, 
  ObjectArchetype, 
  SegmentedObject, 
  TemperamentType, 
  VisualPlan, 
  CompositionalSilhouette 
} from './creatureTypes';
import type { BiomeWorldState } from './biomeWorldTypes';

export const ABILITY_COOLDOWN_MS = 15000;

// Model names/traits select a bounded game mechanic; never execute model-provided code.
export function getAbilityEffect(creature: CreatureDNA) {
  const text = `${creature.specialAbility.name} ${creature.specialAbility.description}`.toLowerCase();
  if (/replenish|revitali|restore|recharge|energy|heal/.test(text) || creature.primaryElement === 'Electric') {
    return { kind: 'restore' as const, label: 'Restore energy', description: 'Restore energy to all residents of this biome.' };
  }
  if (/water|irrigat|rain|hydrate/.test(text) || creature.primaryElement === 'Botanical' || creature.primaryElement === 'Ceramic') {
    return { kind: 'water' as const, label: 'Water seeds', description: 'Water all planted seeds in this biome to help them grow.' };
  }
  return { kind: 'inspire' as const, label: 'Inspire residents', description: 'Raise the trust of all residents of this biome.' };
}

export function activateCreatureAbility(
  caster: CreatureDNA, creatures: CreatureDNA[], world: BiomeWorldState, now: number, readyAt = 0
) {
  const fail = (message: string) => ({ ok: false, message, creatures: [] as CreatureDNA[], world, readyAt });
  if ((caster.biomeId || 'greenhouse') !== world.biome) return fail('Move this Oddling here before using its ability.');
  if (now < readyAt) return fail('Ability is cooling down.');
  const effect = getAbilityEffect(caster);
  const power = Math.max(1, Math.min(100, Number.isFinite(caster.specialAbility.powerRating) ? caster.specialAbility.powerRating : 50));
  const amount = Math.round(6 + power / 10);
  if (effect.kind === 'water') {
    const seeds = world.decorations.filter(d => d.type === 'seed');
    if (!seeds.length) return fail('Plant a seed in this biome first.');
    return { ok: true, message: `${caster.name} watered ${seeds.length} seed${seeds.length === 1 ? '' : 's'}!`, creatures: [] as CreatureDNA[],
      world: { ...world, decorations: world.decorations.map(d => d.type === 'seed' ? { ...d, wateredAt: now } : d), updatedAt: now }, readyAt: now + ABILITY_COOLDOWN_MS };
  }
  const affected = creatures.filter(c => (c.biomeId || 'greenhouse') === world.biome).map(c => ({
    ...c, stats: { ...c.stats, energy: effect.kind === 'restore' ? Math.min(100, c.stats.energy + amount) : c.stats.energy,
      trust: effect.kind === 'inspire' ? Math.min(100, c.stats.trust + Math.ceil(amount / 3)) : c.stats.trust },
    memories: [{ timestamp: now, text: `${caster.name} used ${caster.specialAbility.name}: ${effect.label}.`, type: 'play' as const }, ...c.memories].slice(0, 16)
  }));
  return { ok: true, message: effect.kind === 'restore' ? `+${amount} energy for ${affected.length} residents!` : `+${Math.ceil(amount / 3)} trust for ${affected.length} residents!`,
    creatures: affected, world, readyAt: now + ABILITY_COOLDOWN_MS };
}

export function createAppleSilhouette(): CompositionalSilhouette {
  return {
    category: 'apple', aspectRatio: 'square',
    bodyBlocks: [
      { x: 10, y: 9, w: 7, h: 3 }, { x: 19, y: 9, w: 7, h: 3 },
      { x: 7, y: 12, w: 22, h: 4 }, { x: 6, y: 16, w: 24, h: 7 },
      { x: 8, y: 23, w: 20, h: 4 }, { x: 11, y: 27, w: 14, h: 2 }
    ],
    featureAccents: [
      { type: 'accent', x: 17, y: 5, width: 2, height: 6, fillRole: 'dark' },
      { type: 'accent', x: 11, y: 13, width: 3, height: 2, fillRole: 'light' }
    ], faceX: 18, faceY: 18
  };
}

// Repairs only the known generic apple failure; retain model geometry and hybrid chassis.
export function repairObjectVisualPlan(plan: VisualPlan | undefined, sourceName: string): VisualPlan | undefined {
  if (!plan || !/\bapples?\b/i.test(sourceName) || /\+|\u00d7/.test(sourceName)) return plan;
  if (!['curio', 'lemon', 'compositional'].includes(plan.archetype)) return plan;
  const comp = plan.compositional;
  if (comp && !['curio', 'fruit', 'apple'].includes(comp.category)) return plan;
  return { ...plan, archetype: 'compositional', compositional: createAppleSilhouette(),
    definingParts: { ...plan.definingParts, hasStem: true } };
}

// Archetype derivation helper grounded in real-world everyday objects
export function deriveArchetypeFromObject(name: string, category = '', material = ''): ObjectArchetype {
  const combined = `${name} ${category} ${material}`.toLowerCase();
  if (/\b(apples?|pears?|bananas?|strawberr(?:y|ies))\b/.test(name.toLowerCase())) return 'compositional';
  if (/teapot|kettle|tetsubin|iron.*pot/.test(combined)) return 'teapot';
  if (/\b(cup|mug|espresso|coffee|tea|tumbler|drinkware)\b/.test(combined)) return 'cup';
  if (/cactus|succulent|spine|desert|plant|botanic|barrel/.test(combined)) return 'cactus';
  if (/\b(lamp|pivot|light|lantern|bulb|illumination|fixture)\b/.test(combined)) return 'lamp';
  if (/headphone|audio|earphone|headset|sound|monitor/.test(combined)) return 'headphones';
  if (/honey|jar|nectar|clover|jam|pantry/.test(combined)) return 'honey_jar';
  if (/watch|clock|chrono|dial|time|horolog/.test(combined)) return 'pocket_watch';
  if (/lemon|citrus|lime|meyer|orange|fruit/.test(combined)) return 'lemon';
  if (/crystal|prism|gem|relic|curio|oddity|mineral|quartz/.test(combined)) return 'curio';
  return 'compositional';
}

/**
 * Collects all rich semantic cues from any creature or raw storage object,
 * including Latin binomial (e.g. Furca), title, abilities, traits, memories, and category.
 */
export function collectCreatureSemanticText(data: any): string {
  if (!data || typeof data !== 'object') return '';
  const parts: string[] = [];

  if (typeof data.name === 'string') parts.push(data.name);
  if (typeof data.speciesName === 'string') parts.push(data.speciesName);
  if (typeof data.title === 'string') parts.push(data.title);

  const so = data.sourceObject;
  if (so && typeof so === 'object') {
    if (typeof so.name === 'string') parts.push(so.name);
    if (typeof so.category === 'string') parts.push(so.category);
    if (typeof so.material === 'string') parts.push(so.material);
    if (typeof so.description === 'string') parts.push(so.description);
  }

  const sa = data.specialAbility;
  if (sa && typeof sa === 'object') {
    if (typeof sa.name === 'string') parts.push(sa.name);
    if (typeof sa.description === 'string') parts.push(sa.description);
  }

  if (Array.isArray(data.inheritedTraits)) {
    parts.push(...data.inheritedTraits.map(String));
  }
  if (data.lineage && Array.isArray(data.lineage.inheritedTraits)) {
    parts.push(...data.lineage.inheritedTraits.map(String));
  }

  const vp = data.appearance?.visualPlan || data.visualPlan;
  if (vp?.compositional?.category) {
    parts.push(String(vp.compositional.category));
  }

  if (Array.isArray(data.memories)) {
    for (const m of data.memories) {
      if (m && typeof m.text === 'string') parts.push(m.text);
    }
  }

  if (typeof data.description === 'string') parts.push(data.description);
  if (typeof data.category === 'string') parts.push(data.category);
  if (typeof data.material === 'string') parts.push(data.material);

  return parts.join(' ').toLowerCase();
}

/**
 * Disambiguates utensil and tool subtypes based on semantic cues.
 */
export function detectUtensilOrToolType(
  combinedText: string
): 'fork' | 'spoon' | 'knife' | 'computer_mouse' | 'tool' | 'footwear' | 'keys' | 'bag' | 'electronics' | 'vessel' | 'stationery' | 'eyewear' | 'furniture' | null {
  const text = combinedText.toLowerCase();

  // 0. Computer Mouse / Input Peripheral (never biological rodent mouse)
  if (
    /\b(?:computer\s*mouse|pc\s*mouse|trackball|scroll\s*wheel|scroll\s*surge|mus\s*electricus|wired\s*mouse|corded\s*mouse|optical\s*mouse|usb\s*mouse)\b/i.test(text) ||
    (/\bmouse\b/i.test(text) && /\b(?:wire|cord|cable|usb|scroll|click|sensor|laser|optical|pad|button|electricus)\b/i.test(text))
  ) {
    return 'computer_mouse';
  }

  // 1. Fork: Latin Furca, prongs, tines, four-prong, pierce, spear
  if (/fork|tine|prong|furca|pierc|spear/i.test(text)) {
    return 'fork';
  }

  // 2. Spoon: Latin Cochleare, ladle, scoop, curved bowl
  if (/spoon|ladle|scoop|cochlear/i.test(text)) {
    return 'spoon';
  }

  // 3. Knife: blade, cleaver, cutter, cullter, shear, slice, carve
  if (/knife|blade|cleaver|cutter|culter|slice|carv/i.test(text)) {
    return 'knife';
  }

  // 4. Workshop & cutting tools: scissors, pliers, wrench, hammer, screwdriver
  if (/scissor|shears|plier|wrench|hammer|stapler|screwdriver|saw\b|tool/i.test(text)) {
    return 'tool';
  }

  // 5. Footwear: strictly shoe / boot / heels with word boundary so scroll wheel never matches
  if (/shoe|sneaker|boot|sandal|slipper|footwear|\bheels?\b|loafer/i.test(text)) {
    return 'footwear';
  }

  // 6. Keys
  if (/key|fob|chain|latch|lock|car.*key/i.test(text)) {
    return 'keys';
  }

  // 7. Bags
  if (/bag|backpack|pack|purse|tote|pouch|satchel|briefcase|luggage/i.test(text)) {
    return 'bag';
  }

  // 8. Electronics
  if (/camera|phone|lens|screen|remote|console|gadget|radio/i.test(text)) {
    return 'electronics';
  }

  // 9. Vessels
  if (/bottle|flask|thermos|soda|can\b|beverage|dispenser/i.test(text)) {
    return 'vessel';
  }

  // 10. Stationery
  if (/book|notebook|journal|pen\b|pencil|marker|eraser|ruler/i.test(text)) {
    return 'stationery';
  }

  // 11. Eyewear
  if (/glass|spectacle|sunglass|shade|eyewear|goggle/i.test(text)) {
    return 'eyewear';
  }

  // 12. Furniture
  if (/chair|seat|stool|bench|desk|table|shelf|couch/i.test(text)) {
    return 'furniture';
  }

  return null;
}

/**
 * Generates an iconic, connected 16-bit silver fork monster silhouette in a 36x36 canvas:
 * - FOUR separate tines at top with exactly 1px air gaps (x=12, 15, 18, 21, each w=2)
 * - Solid curved head bridge (w=13, h=5, x=11..23, y=11..15) firmly anchoring all 4 tines
 * - Connected neck (w=6, h=2, x=15..20, y=16..17)
 * - Long, visibly 4-6px wide handle (w=6, h=9, x=15..20, y=18..26)
 * - Flared pommel / base (w=8, h=3, x=14..21, y=27..29)
 * - Metallic specular glints on each of the 4 tines
 * - Perfectly centered face coordinates at (18, 13) on the bridge
 */
export function createForkSilhouette(
  _colors?: { primary: string; secondary: string; accent: string }
): CompositionalSilhouette {
  return {
    category: 'fork',
    aspectRatio: 'tall',
    bodyBlocks: [
      // 4 clearly separate tines across the top with exactly 1px gaps between them
      // Tine 1: x:12..13, Gap: x:14 (1px)
      // Tine 2: x:15..16, Gap: x:17 (1px)
      // Tine 3: x:18..19, Gap: x:20 (1px)
      // Tine 4: x:21..22
      { x: 12, y: 5, w: 2, h: 6, role: 'primary' },
      { x: 15, y: 5, w: 2, h: 6, role: 'primary' },
      { x: 18, y: 5, w: 2, h: 6, role: 'primary' },
      { x: 21, y: 5, w: 2, h: 6, role: 'primary' },
      // Fork head bridge joining all 4 tines solidly
      { x: 11, y: 11, w: 14, h: 5, role: 'primary' },
      // Connected neck
      { x: 15, y: 16, w: 6, h: 2, role: 'secondary' },
      // Long, visibly 4-6px wide silver ergonomic handle
      { x: 15, y: 18, w: 6, h: 9, role: 'secondary' },
      // Flared handle base / pommel
      { x: 14, y: 27, w: 8, h: 4, role: 'primary' }
    ],
    featureAccents: [
      // Metallic silver reflection glint on each of the 4 prongs
      { type: 'teeth', x: 12, y: 5, width: 1, height: 5, fillRole: 'light' },
      { type: 'teeth', x: 15, y: 5, width: 1, height: 5, fillRole: 'light' },
      { type: 'teeth', x: 18, y: 5, width: 1, height: 5, fillRole: 'light' },
      { type: 'teeth', x: 21, y: 5, width: 1, height: 5, fillRole: 'light' },
      // Curved bridge bevel highlight
      { type: 'rim', x: 12, y: 11, width: 12, height: 1, fillRole: 'light' },
      // Handle central embossed bevel ridge
      { type: 'handle', x: 17, y: 19, width: 2, height: 7, fillRole: 'light' },
      // Shadow underside of handle base
      { type: 'accent', x: 15, y: 30, width: 6, height: 1, fillRole: 'dark' }
    ],
    faceX: 18,
    faceY: 13
  };
}

/**
 * Generates an iconic, readable 16-bit spoon silhouette with curved oval bowl and hollow scoop.
 */
export function createSpoonSilhouette(
  _colors?: { primary: string; secondary: string; accent: string }
): CompositionalSilhouette {
  return {
    category: 'spoon',
    aspectRatio: 'tall',
    bodyBlocks: [
      // Curved spoon bowl head (wide oval)
      { x: 10, y: 4, w: 14, h: 11, role: 'primary' },
      // Inner hollow spoon scoop
      { x: 12, y: 6, w: 10, h: 7, role: 'secondary' },
      // Tapered neck
      { x: 15, y: 15, w: 4, h: 3, role: 'primary' },
      // Silver spoon handle (4-6px wide)
      { x: 15, y: 18, w: 5, h: 9, role: 'secondary' },
      // Handle pommel flare
      { x: 14, y: 27, w: 7, h: 3, role: 'primary' }
    ],
    featureAccents: [
      // Spoon rim reflective glint
      { type: 'rim', x: 11, y: 4, width: 12, height: 2, fillRole: 'light' },
      // Inner hollow reflection
      { type: 'accent', x: 13, y: 7, width: 4, height: 4, fillRole: 'light' },
      // Handle center spine
      { type: 'handle', x: 17, y: 19, width: 1, height: 8, fillRole: 'light' }
    ],
    faceX: 17,
    faceY: 9
  };
}

/**
 * Generates an iconic, readable 16-bit knife silhouette with beveled cutting blade and bolster.
 */
export function createKnifeSilhouette(
  _colors?: { primary: string; secondary: string; accent: string }
): CompositionalSilhouette {
  return {
    category: 'knife',
    aspectRatio: 'tall',
    bodyBlocks: [
      // Blade spine & flat back
      { x: 12, y: 4, w: 4, h: 12, role: 'primary' },
      // Beveled cutting blade with curved belly
      { x: 16, y: 6, w: 5, h: 10, role: 'secondary' },
      // Bolster / finger guard
      { x: 11, y: 16, w: 12, h: 2, role: 'accent' },
      // Riveted handle (5-6px wide)
      { x: 14, y: 18, w: 6, h: 9, role: 'primary' },
      // Handle butt
      { x: 13, y: 27, w: 8, h: 3, role: 'shadow' }
    ],
    featureAccents: [
      // Razor-sharp cutting edge shine
      { type: 'blade', x: 18, y: 7, width: 2, height: 9, fillRole: 'light' },
      // Handle rivets
      { type: 'button', x: 16, y: 20, width: 2, height: 2, fillRole: 'light' },
      { type: 'button', x: 16, y: 24, width: 2, height: 2, fillRole: 'light' }
    ],
    faceX: 17,
    faceY: 10
  };
}

/**
 * Generates an iconic, connected 16-bit computer mouse monster silhouette in a 36x36 canvas:
 * - Rounded stepped domed chassis (ABS plastic body)
 * - Clear left and right click buttons with central seam
 * - Dark rubberized scroll wheel with tactile ribs in front slot
 * - Trailing USB cord curving from front top
 * - Cute visible face resting on smooth palm rest
 * - Grounded feet baseline at bottom of body
 */
export function createComputerMouseSilhouette(
  _colors?: { primary: string; secondary: string; accent: string }
): CompositionalSilhouette {
  return {
    category: 'computer_mouse',
    aspectRatio: 'tall',
    bodyBlocks: [
      // 1. Front click button deck (split into left and right click blocks)
      // Left Click Button
      { x: 11, y: 7, w: 6, h: 9, role: 'secondary' },
      // Right Click Button
      { x: 19, y: 7, w: 6, h: 9, role: 'secondary' },
      // Front chassis nose bridge behind/below wheel slot
      { x: 13, y: 6, w: 10, h: 2, role: 'primary' },
      // 2. Main ergonomic domed palm rest
      { x: 9, y: 16, w: 18, h: 8, role: 'primary' },
      // 3. Lower curved chassis base
      { x: 11, y: 24, w: 14, h: 4, role: 'primary' },
      // 4. Rounded bottom rim / glide pad support (feet baseline sits at y=29..31)
      { x: 13, y: 28, w: 10, h: 2, role: 'shadow' }
    ],
    featureAccents: [
      // A. Trailing flexible USB cable exiting top front
      { type: 'cord', x: 17, y: 1, width: 2, height: 5, fillRole: 'dark' },
      { type: 'cord', x: 15, y: 0, width: 3, height: 2, fillRole: 'dark' },
      // B. Dark central rubberized scroll wheel in center slot
      { type: 'wheel', x: 17, y: 8, width: 2, height: 6, fillRole: 'dark' },
      // C. 1px button divider groove below wheel
      { type: 'seam', x: 17, y: 14, width: 2, height: 2, fillRole: 'dark' },
      // D. Horizontal button boundary groove
      { type: 'seam', x: 11, y: 16, width: 14, height: 1, fillRole: 'dark' },
      // E. Ergonomic dome gloss highlight on left shoulder
      { type: 'rim', x: 10, y: 18, width: 2, height: 5, fillRole: 'light' },
      // F. Tactile clicker glints on buttons
      { type: 'accent', x: 12, y: 8, width: 4, height: 1, fillRole: 'light' },
      { type: 'accent', x: 20, y: 8, width: 4, height: 1, fillRole: 'light' }
    ],
    faceX: 18,
    faceY: 20
  };
}

/**
 * Creates safe, bounded compositional 16-bit pixel geometry for unseen everyday objects.
 */
export function createCompositionalSilhouette(
  name: string,
  category = '',
  material = '',
  _colors?: { primary: string; secondary: string; accent: string }
): CompositionalSilhouette {
  const combined = `${name} ${category} ${material}`.toLowerCase();
  if (/\bapples?\b/.test(combined)) return createAppleSilhouette();
  const detectedType = detectUtensilOrToolType(combined);

  if (detectedType === 'computer_mouse') {
    return createComputerMouseSilhouette(_colors);
  }
  if (detectedType === 'fork') {
    return createForkSilhouette(_colors);
  }
  if (detectedType === 'spoon') {
    return createSpoonSilhouette(_colors);
  }
  if (detectedType === 'knife') {
    return createKnifeSilhouette(_colors);
  }

  // 2. Footwear (shoe, sneaker, boot, slipper)
  if (/shoe|sneaker|boot|sandal|slipper|footwear|\bheels?\b|cleat|loafer/.test(combined)) {
    return {
      category: 'footwear',
      aspectRatio: 'wide',
      bodyBlocks: [
        { x: 7, y: 21, w: 22, h: 5, role: 'shadow' },
        { x: 9, y: 14, w: 18, h: 8, role: 'primary' },
        { x: 9, y: 10, w: 7, h: 5, role: 'secondary' }
      ],
      featureAccents: [
        { type: 'sole', x: 7, y: 23, width: 22, height: 3, fillRole: 'dark' },
        { type: 'laces', x: 17, y: 13, width: 6, height: 5, fillRole: 'accent' }
      ],
      faceX: 16,
      faceY: 17
    };
  }

  // 3. Cutting / Workshop Tools (scissors, pliers, wrench, hammer, stapler)
  if (/scissor|shears|plier|tool|wrench|hammer|stapler|screwdriver|saw/.test(combined)) {
    return {
      category: 'tool',
      aspectRatio: 'tall',
      bodyBlocks: [
        { x: 12, y: 6, w: 4, h: 12, role: 'secondary' },
        { x: 20, y: 6, w: 4, h: 12, role: 'secondary' },
        { x: 15, y: 16, w: 6, h: 4, role: 'accent' },
        { x: 10, y: 20, w: 6, h: 8, role: 'primary' },
        { x: 20, y: 20, w: 6, h: 8, role: 'primary' }
      ],
      featureAccents: [
        { type: 'blade', x: 12, y: 6, width: 4, height: 12, fillRole: 'light' },
        { type: 'blade', x: 20, y: 6, width: 4, height: 12, fillRole: 'light' },
        { type: 'handle', x: 11, y: 22, width: 4, height: 4, fillRole: 'dark' },
        { type: 'handle', x: 21, y: 22, width: 4, height: 4, fillRole: 'dark' }
      ],
      faceX: 18,
      faceY: 18
    };
  }

  // 3. Keys
  if (/key|fob|chain|latch|lock|car.*key/.test(combined)) {
    return {
      category: 'keys',
      aspectRatio: 'tall',
      bodyBlocks: [
        { x: 12, y: 6, w: 12, h: 10, role: 'accent' },
        { x: 16, y: 16, w: 4, h: 12, role: 'primary' },
        { x: 20, y: 21, w: 4, h: 6, role: 'secondary' }
      ],
      featureAccents: [
        { type: 'dial', x: 15, y: 8, width: 6, height: 6, fillRole: 'dark' },
        { type: 'teeth', x: 20, y: 21, width: 4, height: 2, fillRole: 'accent' },
        { type: 'teeth', x: 20, y: 25, width: 3, height: 2, fillRole: 'accent' }
      ],
      faceX: 18,
      faceY: 11
    };
  }

  // 4. Bags / Luggage
  if (/bag|backpack|pack|purse|tote|pouch|satchel|briefcase|luggage|duffel/.test(combined)) {
    return {
      category: 'bag',
      aspectRatio: 'square',
      bodyBlocks: [
        { x: 9, y: 9, w: 18, h: 18, role: 'primary' },
        { x: 11, y: 18, w: 14, h: 8, role: 'secondary' },
        { x: 15, y: 6, w: 6, h: 3, role: 'accent' }
      ],
      featureAccents: [
        { type: 'strap', x: 9, y: 11, width: 2, height: 14, fillRole: 'dark' },
        { type: 'strap', x: 25, y: 11, width: 2, height: 14, fillRole: 'dark' },
        { type: 'pocket', x: 13, y: 19, width: 10, height: 2, fillRole: 'accent' }
      ],
      faceX: 18,
      faceY: 14
    };
  }

  // 5. Electronics / Optics
  if (/camera|phone|lens|screen|remote|console|gameboy|tech|gadget|radio/.test(combined)) {
    return {
      category: 'electronics',
      aspectRatio: 'wide',
      bodyBlocks: [
        { x: 8, y: 11, w: 20, h: 15, role: 'primary' },
        { x: 13, y: 13, w: 10, h: 10, role: 'accent' },
        { x: 10, y: 8, w: 5, h: 3, role: 'secondary' }
      ],
      featureAccents: [
        { type: 'lens', x: 15, y: 15, width: 6, height: 6, fillRole: 'dark' },
        { type: 'button', x: 23, y: 9, width: 3, height: 2, fillRole: 'accent' }
      ],
      faceX: 18,
      faceY: 17
    };
  }

  // 6. Bottle / Can / Flask
  if (/bottle|can|flask|thermos|soda|beverage|lotion|spray|dispenser/.test(combined)) {
    return {
      category: 'vessel',
      aspectRatio: 'tall',
      bodyBlocks: [
        { x: 11, y: 12, w: 14, h: 16, role: 'primary' },
        { x: 14, y: 6, w: 8, h: 6, role: 'secondary' },
        { x: 11, y: 18, w: 14, h: 5, role: 'accent' }
      ],
      featureAccents: [
        { type: 'spout', x: 15, y: 5, width: 6, height: 2, fillRole: 'dark' },
        { type: 'rim', x: 14, y: 11, width: 8, height: 2, fillRole: 'light' }
      ],
      faceX: 18,
      faceY: 15
    };
  }

  // 7. Stationery / Books
  if (/book|notebook|journal|pen|pencil|marker|eraser|ruler/.test(combined)) {
    return {
      category: 'stationery',
      aspectRatio: 'tall',
      bodyBlocks: [
        { x: 9, y: 8, w: 18, h: 20, role: 'primary' },
        { x: 23, y: 10, w: 3, h: 16, role: 'secondary' },
        { x: 9, y: 8, w: 3, h: 20, role: 'shadow' }
      ],
      featureAccents: [
        { type: 'accent', x: 16, y: 6, width: 3, height: 23, fillRole: 'accent' }
      ],
      faceX: 16,
      faceY: 16
    };
  }

  // 8. Eyewear / Glasses
  if (/glass|spectacle|sunglass|shade|eyewear|goggle|lens/.test(combined)) {
    return {
      category: 'eyewear',
      aspectRatio: 'wide',
      bodyBlocks: [
        { x: 7, y: 14, w: 10, h: 9, role: 'secondary' },
        { x: 19, y: 14, w: 10, h: 9, role: 'secondary' },
        { x: 16, y: 16, w: 4, h: 2, role: 'primary' },
        { x: 11, y: 13, w: 14, h: 12, role: 'primary' }
      ],
      featureAccents: [
        { type: 'lens', x: 8, y: 15, width: 8, height: 7, fillRole: 'light' },
        { type: 'lens', x: 20, y: 15, width: 8, height: 7, fillRole: 'light' },
        { type: 'hinge', x: 5, y: 15, width: 3, height: 2, fillRole: 'dark' },
        { type: 'hinge', x: 28, y: 15, width: 3, height: 2, fillRole: 'dark' }
      ],
      faceX: 18,
      faceY: 18
    };
  }

  // 9. Furniture / Chair / Table
  if (/chair|seat|stool|bench|desk|table|shelf|couch|sofa/.test(combined)) {
    return {
      category: 'furniture',
      aspectRatio: 'tall',
      bodyBlocks: [
        { x: 10, y: 6, w: 16, h: 11, role: 'primary' },
        { x: 8, y: 17, w: 20, h: 4, role: 'secondary' },
        { x: 9, y: 21, w: 3, h: 9, role: 'shadow' },
        { x: 24, y: 21, w: 3, h: 9, role: 'shadow' }
      ],
      featureAccents: [
        { type: 'accent', x: 12, y: 8, width: 12, height: 2, fillRole: 'accent' },
        { type: 'accent', x: 10, y: 17, width: 16, height: 2, fillRole: 'light' }
      ],
      faceX: 18,
      faceY: 11
    };
  }

  // 10. Other Utensils (whisk, spatula, chopstick, cutlery)
  if (/whisk|spatula|cutlery|chopstick|utensil|tong|peeler|grater/.test(combined)) {
    return {
      category: 'utensil',
      aspectRatio: 'tall',
      bodyBlocks: [
        { x: 12, y: 5, w: 12, h: 10, role: 'primary' },
        { x: 15, y: 14, w: 6, h: 13, role: 'secondary' },
        { x: 14, y: 26, w: 8, h: 4, role: 'primary' }
      ],
      featureAccents: [
        { type: 'rim', x: 13, y: 5, width: 10, height: 2, fillRole: 'light' },
        { type: 'handle', x: 16, y: 16, width: 4, height: 10, fillRole: 'light' }
      ],
      faceX: 18,
      faceY: 10
    };
  }

  // 11. General everyday item
  return {
    category: 'curio',
    aspectRatio: 'square',
    bodyBlocks: [
      { x: 9, y: 10, w: 18, h: 16, role: 'primary' },
      { x: 11, y: 8, w: 14, h: 4, role: 'secondary' },
      { x: 11, y: 18, w: 14, h: 6, role: 'accent' }
    ],
    featureAccents: [
      { type: 'accent', x: 13, y: 12, width: 10, height: 2, fillRole: 'light' }
    ],
    faceX: 18,
    faceY: 16
  };
}

/**
 * Validates whether a compositional visual plan is malformed (e.g. skinny hairline,
 * normalized 0..1 floats, degenerate near-empty geometry, or disconnected floating blocks).
 */
export function isCompositionalMalformed(comp: unknown, semanticText = ''): boolean {
  if (!comp || typeof comp !== 'object') return true;
  const c = comp as Record<string, unknown>;
  const blocks = c.bodyBlocks;
  if (!Array.isArray(blocks) || blocks.length === 0) return true;

  // Check if coordinates were output as 0..1 normalized floats
  const isNormalizedFloats = blocks.every((b: any) =>
    typeof b.x === 'number' && typeof b.y === 'number' && typeof b.w === 'number' && typeof b.h === 'number' &&
    b.x <= 1.05 && b.y <= 1.05 && b.w <= 1 && b.h <= 1
  );
  if (isNormalizedFloats) return true;

  let minX = 999;
  let maxX = -999;
  let minY = 999;
  let maxY = -999;
  let maxBlockWidth = 0;
  let totalArea = 0;

  for (const b of blocks as Array<{ x: number; y: number; w: number; h: number }>) {
    if (typeof b.x !== 'number' || typeof b.y !== 'number' || typeof b.w !== 'number' || typeof b.h !== 'number') {
      return true;
    }
    minX = Math.min(minX, b.x);
    maxX = Math.max(maxX, b.x + b.w);
    minY = Math.min(minY, b.y);
    maxY = Math.max(maxY, b.y + b.h);
    maxBlockWidth = Math.max(maxBlockWidth, b.w);
    totalArea += Math.max(0, b.w) * Math.max(0, b.h);
  }

  const totalWidth = maxX - minX;
  const totalHeight = maxY - minY;

  // 1. Degenerate: single hairline, near-empty area, or collapsing bounds
  if (totalWidth < 6 || maxBlockWidth <= 2 || totalArea < 25) return true;
  if (totalHeight < 6) return true;

  // 2. Collapsed against extreme canvas boundary
  if (minX >= 31 || maxX <= 5 || minY >= 31 || maxY <= 5) return true;

  // 3. Disconnected blocks check:
  // Sort blocks by y coordinate. If there is a vertical gap > 3px between consecutive block spans
  // with no block bridging them, the geometry is disconnected floating pieces.
  const sortedByY = [...blocks].sort((a: any, b: any) => a.y - b.y);
  let maxCoveredY = sortedByY[0].y + sortedByY[0].h;
  for (let i = 1; i < sortedByY.length; i++) {
    const nextBlock = sortedByY[i];
    if (nextBlock.y > maxCoveredY + 3) {
      // Disconnected vertical gap > 3px with nothing connecting them!
      return true;
    }
    maxCoveredY = Math.max(maxCoveredY, nextBlock.y + nextBlock.h);
  }

  // 4. Targeted check for utensils with fork semantic cues:
  // If the semantic text clearly indicates a fork (species Furca, tines, prongs, four-prong, pierce),
  // but the plan lacks 4 top tines, it is a malformed fork specimen needing targeted repair.
  if (semanticText && /fork|tine|prong|furca|pierc|spear/i.test(semanticText)) {
    const topTines = blocks.filter((b: any) => b.y <= 9 && b.w <= 3);
    if (topTines.length < 4) {
      return true;
    }
  }

  // 5. Targeted check for computer mouse / input peripheral semantic cues:
  // If the semantic text indicates a computer mouse (wired mouse, scroll wheel, scroll surge, mus electricus),
  // but the plan lacks computer mouse category or is curio with no scroll wheel or cord feature accent,
  // it is a malformed mouse needing targeted repair.
  if (
    semanticText &&
    (/\b(?:computer\s*mouse|pc\s*mouse|trackball|scroll\s*wheel|scroll\s*surge|mus\s*electricus|wired\s*mouse|corded\s*mouse|optical\s*mouse|usb\s*mouse)\b/i.test(semanticText) ||
    (/\bmouse\b/i.test(semanticText) && /\b(?:wire|cord|cable|usb|scroll|click|sensor|laser|optical|pad|button|electricus)\b/i.test(semanticText)))
  ) {
    const accents = (c.featureAccents || []) as Array<{ type: string }>;
    const hasWheelOrCord = accents.some((a) => a.type === 'wheel' || a.type === 'cord');
    if (c.category !== 'computer_mouse' || !hasWheelOrCord) {
      return true;
    }
  }

  return false;
}

/**
 * Normalizes, bounds, and centers any compositional visual plan in the 36x36 canvas.
 * Deterministically heals malformed plans (like the skinny or disconnected fork bug)
 * based on rich source semantic text, while safely scaling the entire bounding box
 * together and preserving valid custom compositional geometry and material palette.
 */
export function normalizeAndCenterCompositional(
  comp: CompositionalSilhouette,
  sourceText?: string,
  colors?: { primary: string; secondary: string; accent: string }
): CompositionalSilhouette {
  const combinedText = (sourceText || '').toLowerCase();

  // 1. If malformed or disconnected, heal deterministically based on source object identity
  if (isCompositionalMalformed(comp, combinedText)) {
    const detectedType = detectUtensilOrToolType(combinedText);
    if (detectedType === 'computer_mouse') {
      return createComputerMouseSilhouette(colors);
    }
    if (detectedType === 'fork') {
      return createForkSilhouette(colors);
    }
    if (detectedType === 'spoon') {
      return createSpoonSilhouette(colors);
    }
    if (detectedType === 'knife') {
      return createKnifeSilhouette(colors);
    }
    return createCompositionalSilhouette(sourceText || 'Everyday Object', '', '', colors);
  }

  // 2. If valid model geometry, preserve custom blocks and material palette,
  // scaling the bounding box together rather than clamping individual blocks.
  let blocks = comp.bodyBlocks.map((b) => ({ ...b }));
  let feats = (comp.featureAccents || []).map((f) => ({ ...f }));

  // Check if coordinates were 0..1 floats
  const maxCoord = Math.max(
    ...blocks.map((b) => Math.max(b.x + b.w, b.y + b.h)),
    ...feats.map((f) => Math.max(f.x + f.width, f.y + f.height)),
    1
  );

  if (maxCoord <= 1.5) {
    // Scale 0..1 to 36
    blocks = blocks.map((b) => ({
      ...b,
      x: Math.round(b.x * 36),
      y: Math.round(b.y * 36),
      w: Math.max(1, Math.round(b.w * 36)),
      h: Math.max(1, Math.round(b.h * 36))
    }));
    feats = feats.map((f) => ({
      ...f,
      x: Math.round(f.x * 36),
      y: Math.round(f.y * 36),
      width: Math.max(1, Math.round(f.width * 36)),
      height: Math.max(1, Math.round(f.height * 36))
    }));
  } else if (maxCoord > 40) {
    // Scale down from percentage (0..100) or high-res to 36
    const factor = 36 / Math.max(maxCoord, 100);
    blocks = blocks.map((b) => ({
      ...b,
      x: Math.round(b.x * factor),
      y: Math.round(b.y * factor),
      w: Math.max(1, Math.round(b.w * factor)),
      h: Math.max(1, Math.round(b.h * factor))
    }));
    feats = feats.map((f) => ({
      ...f,
      x: Math.round(f.x * factor),
      y: Math.round(f.y * factor),
      width: Math.max(1, Math.round(f.width * factor)),
      height: Math.max(1, Math.round(f.height * factor))
    }));
  }

  // Line up stacked body blocks that are only a few pixels off-center (e.g. a head
  // drawn 2px left of its body), carrying their feature accents along with them.
  if (blocks.length > 1) {
    const anchor = blocks.reduce((a, b) => (b.w * b.h > a.w * a.h ? b : a));
    const anchorCx = anchor.x + anchor.w / 2;
    blocks = blocks.map((b) => {
      const dx = Math.round(anchorCx - (b.x + b.w / 2));
      if (b === anchor || dx === 0 || Math.abs(dx) > 3) return b;
      feats = feats.map((f) => {
        const cx = f.x + f.width / 2;
        const cy = f.y + f.height / 2;
        return cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h ? { ...f, x: f.x + dx } : f;
      });
      return { ...b, x: b.x + dx };
    });
  }

  // Compute current unified bounding box
  let minX = Math.min(...blocks.map((b) => b.x));
  let maxX = Math.max(...blocks.map((b) => b.x + b.w));
  let minY = Math.min(...blocks.map((b) => b.y));
  let maxY = Math.max(...blocks.map((b) => b.y + b.h));
  let totalW = maxX - minX;
  let totalH = maxY - minY;

  // Scale the bounding box together if oversized, instead of clamping individual blocks
  if (totalW > 30 || totalH > 30) {
    const scale = Math.min(30 / Math.max(totalW, 1), 30 / Math.max(totalH, 1));
    const originX = minX;
    const originY = minY;

    blocks = blocks.map((b) => ({
      ...b,
      x: originX + Math.round((b.x - originX) * scale),
      y: originY + Math.round((b.y - originY) * scale),
      w: Math.max(1, Math.round(b.w * scale)),
      h: Math.max(1, Math.round(b.h * scale))
    }));

    feats = feats.map((f) => ({
      ...f,
      x: originX + Math.round((f.x - originX) * scale),
      y: originY + Math.round((f.y - originY) * scale),
      width: Math.max(1, Math.round(f.width * scale)),
      height: Math.max(1, Math.round(f.height * scale))
    }));

    minX = Math.min(...blocks.map((b) => b.x));
    maxX = Math.max(...blocks.map((b) => b.x + b.w));
    minY = Math.min(...blocks.map((b) => b.y));
    maxY = Math.max(...blocks.map((b) => b.y + b.h));
    totalW = maxX - minX;
    totalH = maxY - minY;
  }

  // Center the unified bounding box in the 36x36 canvas
  const targetCenterX = 18;
  const targetCenterY = 18;
  const currentCenterX = minX + totalW / 2;
  const currentCenterY = minY + totalH / 2;
  const shiftX = Math.round(targetCenterX - currentCenterX);
  const shiftY = Math.round(targetCenterY - currentCenterY);

  blocks = blocks.map((b) => ({
    ...b,
    x: b.x + shiftX,
    y: b.y + shiftY
  }));

  feats = feats.map((f) => ({
    ...f,
    x: f.x + shiftX,
    y: f.y + shiftY
  }));

  // Re-check overall bounds and shift the ENTIRE group if touching outer canvas padding [2..34]
  const finalMinX = Math.min(...blocks.map((b) => b.x));
  const finalMaxX = Math.max(...blocks.map((b) => b.x + b.w));
  const finalMinY = Math.min(...blocks.map((b) => b.y));
  const finalMaxY = Math.max(...blocks.map((b) => b.y + b.h));

  let adjustX = 0;
  if (finalMinX < 2) adjustX = 2 - finalMinX;
  else if (finalMaxX > 34) adjustX = 34 - finalMaxX;

  let adjustY = 0;
  if (finalMinY < 2) adjustY = 2 - finalMinY;
  else if (finalMaxY > 34) adjustY = 34 - finalMaxY;

  if (adjustX !== 0 || adjustY !== 0) {
    blocks = blocks.map((b) => ({ ...b, x: b.x + adjustX, y: b.y + adjustY }));
    feats = feats.map((f) => ({ ...f, x: f.x + adjustX, y: f.y + adjustY }));
  }

  // Final bounds
  const boundMinX = Math.min(...blocks.map((b) => b.x));
  const boundMaxX = Math.max(...blocks.map((b) => b.x + b.w));
  const boundMinY = Math.min(...blocks.map((b) => b.y));
  const boundMaxY = Math.max(...blocks.map((b) => b.y + b.h));

  // Center face coordinates relative to the unified body
  const centerBodyX = Math.round((boundMinX + boundMaxX) / 2);
  let faceX = typeof comp.faceX === 'number' ? comp.faceX + shiftX + adjustX : centerBodyX;
  if (faceX < boundMinX || faceX > boundMaxX || Math.abs(faceX - centerBodyX) > 4) {
    faceX = centerBodyX;
  }
  let faceY = typeof comp.faceY === 'number' ? comp.faceY + shiftY + adjustY : Math.round(boundMinY + (boundMaxY - boundMinY) * 0.4);
  faceY = Math.max(boundMinY + 1, Math.min(boundMaxY - 2, faceY));

  // A face near the feet or drawn over a dark strap/band looks broken. Move it to the
  // nearest clear rows to 40% of the body height (eyes faceY-1..faceY+1, mouth to faceY+4).
  const bodyH = boundMaxY - boundMinY;
  const darkRows = feats
    .filter((f) => f.fillRole === 'dark' && f.x < faceX + 4 && f.x + f.width > faceX - 4)
    .map((f) => [f.y, f.y + f.height - 1] as const);
  const faceClear = (y: number) => darkRows.every(([a, b]) => y + 4 < a || y - 1 > b);
  if (faceY > boundMinY + bodyH * 0.65 || !faceClear(faceY)) {
    const ideal = Math.round(boundMinY + bodyH * 0.4);
    let best = ideal;
    for (let d = 0; d <= bodyH; d++) {
      const up = ideal - d;
      const down = ideal + d;
      if (up >= boundMinY + 1 && faceClear(up)) { best = up; break; }
      if (down <= boundMaxY - 5 && faceClear(down)) { best = down; break; }
    }
    faceY = Math.max(boundMinY + 1, Math.min(boundMaxY - 2, best));
  }

  return {
    ...comp,
    bodyBlocks: blocks,
    featureAccents: feats,
    faceX,
    faceY
  };
}

export function createDefaultVisualPlan(
  archetype: ObjectArchetype,
  colors: { primary: string; secondary: string; accent: string },
  customParts?: Partial<VisualPlan['definingParts']>
): VisualPlan {
  switch (archetype) {
    case 'cup':
      return {
        version: 1,
        archetype: 'cup',
        definingParts: {
          hasHandle: true,
          handleSide: 'right',
          hasRim: true,
          hasSteam: true,
          liquidFillColor: '#4a2810',
          ...customParts
        },
        materialSurface: {
          finish: 'glazed_ceramic',
          pattern: 'speckled',
          glazeColor: colors.primary,
          highlightColor: '#ffffff'
        },
        facePlacement: {
          surfaceRegion: 'vessel_front',
          yOffset: 3
        }
      };
    case 'cactus':
      return {
        version: 1,
        archetype: 'cactus',
        definingParts: {
          hasSpines: true,
          spineDensity: 'dense',
          hasLeaves: true,
          ...customParts
        },
        materialSurface: {
          finish: 'matte_plant',
          pattern: 'ribbed',
          glazeColor: colors.primary,
          highlightColor: colors.secondary
        },
        facePlacement: {
          surfaceRegion: 'plant_stem',
          yOffset: 0
        }
      };
    case 'lamp':
      return {
        version: 1,
        archetype: 'lamp',
        definingParts: {
          hasBase: true,
          hasStem: true,
          hasShade: true,
          ...customParts
        },
        materialSurface: {
          finish: 'polished_brass',
          pattern: 'solid',
          glazeColor: colors.primary,
          highlightColor: '#fffbeb'
        },
        facePlacement: {
          surfaceRegion: 'shade_center',
          yOffset: 0
        }
      };
    case 'headphones':
      return {
        version: 1,
        archetype: 'headphones',
        definingParts: {
          hasEarcups: true,
          hasHeadband: true,
          ...customParts
        },
        materialSurface: {
          finish: 'brushed_metal',
          pattern: 'solid',
          glazeColor: colors.primary,
          highlightColor: colors.accent
        },
        facePlacement: {
          surfaceRegion: 'headband_bridge',
          yOffset: 2
        }
      };
    case 'teapot':
      return {
        version: 1,
        archetype: 'teapot',
        definingParts: {
          hasHandle: true,
          handleSide: 'right',
          hasSpout: true,
          hasLid: true,
          hasSteam: true,
          ...customParts
        },
        materialSurface: {
          finish: 'glazed_ceramic',
          pattern: 'fluted',
          glazeColor: colors.primary,
          highlightColor: '#ffffff'
        },
        facePlacement: {
          surfaceRegion: 'vessel_front',
          yOffset: 4
        }
      };
    case 'honey_jar':
      return {
        version: 1,
        archetype: 'honey_jar',
        definingParts: {
          hasLid: true,
          hasDrips: true,
          liquidFillColor: colors.primary,
          ...customParts
        },
        materialSurface: {
          finish: 'translucent_glass',
          pattern: 'solid',
          glazeColor: colors.primary,
          highlightColor: '#ffffff'
        },
        facePlacement: {
          surfaceRegion: 'jar_belly',
          yOffset: 2
        }
      };
    case 'pocket_watch':
      return {
        version: 1,
        archetype: 'pocket_watch',
        definingParts: {
          hasDial: true,
          hasClockHands: true,
          ...customParts
        },
        materialSurface: {
          finish: 'polished_brass',
          pattern: 'solid',
          glazeColor: colors.primary,
          highlightColor: '#fef3c7'
        },
        facePlacement: {
          surfaceRegion: 'watch_dial',
          yOffset: 0
        }
      };
    case 'lemon':
      return {
        version: 1,
        archetype: 'lemon',
        definingParts: {
          hasLeaves: true,
          ...customParts
        },
        materialSurface: {
          finish: 'textured_peel',
          pattern: 'spots',
          glazeColor: colors.primary,
          highlightColor: '#ffffff'
        },
        facePlacement: {
          surfaceRegion: 'fruit_center',
          yOffset: 0
        }
      };
    case 'compositional': {
      const comp = createCompositionalSilhouette('', '', '', colors);
      return {
        version: 1,
        archetype: 'compositional',
        compositional: comp,
        definingParts: {
          hasHandle: false,
          hasSpines: false,
          ...customParts
        },
        materialSurface: {
          finish: 'matte_fabric',
          pattern: 'solid',
          glazeColor: colors.primary,
          highlightColor: colors.accent
        },
        facePlacement: {
          surfaceRegion: 'body_center',
          yOffset: 0
        }
      };
    }
    case 'curio':
    default:
      return {
        version: 1,
        archetype: 'curio',
        definingParts: {
          hasHandle: false,
          hasSpines: false,
          ...customParts
        },
        materialSurface: {
          finish: 'glazed_ceramic',
          pattern: 'solid',
          glazeColor: colors.primary,
          highlightColor: '#ffffff'
        },
        facePlacement: {
          surfaceRegion: 'body_center',
          yOffset: 0
        }
      };
  }
}

// Deterministic name generation matrices
const PREFIXES: Record<ElementType, string[]> = {
  Ceramic: ['Terra', 'Porce', 'Glazo', 'Vaso', 'Kiln', 'Calef'],
  Botanical: ['Sprout', 'Thorn', 'Bramble', 'Flos', 'Phyto', 'Verd'],
  Electric: ['Volt', 'Lumi', 'Spark', 'Amp', 'Fila', 'Lux'],
  Mechanical: ['Chrono', 'Cog', 'Gear', 'Tick', 'Piston', 'Mechan'],
  Glass: ['Prism', 'Vitro', 'Glaze', 'Halo', 'Lens', 'Opti'],
  Textile: ['Weave', 'Plush', 'Spool', 'Thread', 'Velour', 'Felt'],
  Thermal: ['Ember', 'Pyro', 'Steam', 'Kettle', 'Warm', 'Fume'],
  Sonic: ['Echo', 'Reso', 'Beat', 'Deci', 'Harmon', 'Pulse'],
  Chrono: ['Tempo', 'Epoch', 'Pendul', 'Aon', 'Horolo', 'Dial'],
  Crystalline: ['Amber', 'Quartz', 'Glisten', 'Nectar', 'Facet', 'Gem']
};

const SUFFIXES: Record<ElementType, string[]> = {
  Ceramic: ['brew', 'pot', 'ware', 'mug', 'cup', 'clay'],
  Botanical: ['canth', 'leaf', 'flora', 'root', 'thorn', 'bloom'],
  Electric: ['ling', 'arc', 'watt', 'beam', 'flash', 'glow'],
  Mechanical: ['bot', 'whir', 'gadget', 'spring', 'drive', 'cog'],
  Glass: ['loupe', 'lens', 'shimmer', 'shard', 'spec', 'orb'],
  Textile: ['puff', 'cushion', 'bundle', 'stitch', 'wrap', 'snug'],
  Thermal: ['furnace', 'steam', 'haze', 'vent', 'broth', 'forge'],
  Sonic: ['chirp', 'tune', 'bell', 'whistle', 'song', 'hum'],
  Chrono: ['tick', 'beat', 'hour', 'moment', 'track', 'step'],
  Crystalline: ['drop', 'comb', 'dew', 'facet', 'gleam', 'honey']
};

export function pick<T>(arr: T[], seed: number): T {
  const idx = Math.abs(seed) % arr.length;
  return arr[idx];
}

export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Generates an original creature DNA from a segmented real-world object.
 */
export function generateCreatureFromObject(
  object: SegmentedObject,
  options?: {
    provenance?: 'preset_demo' | 'user_upload_manual' | 'ai_extracted';
    userPhotoUrl?: string;
    selectionRegion?: { x: number; y: number; width: number; height: number };
    archetype?: ObjectArchetype;
    visualPlan?: VisualPlan;
  }
): CreatureDNA {
  const hash = hashString(object.name + object.category + object.material);
  const elem = object.defaultElement;
  
  const prefix = pick(PREFIXES[elem] || ['Odd'], hash);
  const suffix = pick(SUFFIXES[elem] || ['ling'], hash + 7);
  const creatureName = `${prefix}${suffix}`;

  const temperaments: TemperamentType[] = [
    'Sleepy & Warm',
    'Curious & Chirpy',
    'Stubborn & Spiky',
    'Playful & Bouncy',
    'Gentle & Shy',
    'Energetic & Sparky',
    'Zen & Contemplative'
  ];
  const temperament = pick(temperaments, hash + 3);

  const bodyShapes: Array<'round' | 'blob' | 'spiky' | 'tall' | 'boxy' | 'chubby'> = [
    'round', 'blob', 'spiky', 'tall', 'boxy', 'chubby'
  ];
  const eyeStyles: Array<'wide' | 'sleepy' | 'beady' | 'glowing' | 'cyclops' | 'sparkle'> = [
    'wide', 'sleepy', 'beady', 'glowing', 'cyclops', 'sparkle'
  ];
  const hornStyles: Array<'spines' | 'antenna' | 'steam_pipe' | 'buds' | 'headphones' | 'ears' | 'clock_hands'> = [
    'spines', 'antenna', 'steam_pipe', 'buds', 'headphones', 'ears', 'clock_hands'
  ];

  const bodyShape = pick(bodyShapes, hash + 1);
  const eyeStyle = pick(eyeStyles, hash + 2);
  const hornStyle = pick(hornStyles, hash + 4);

  // Abilities tailored to elemental type & source
  const abilities: Record<ElementType, { name: string; desc: string; icon: string }> = {
    Ceramic: {
      name: 'Glaze Shield',
      desc: 'Hardens exterior shell with polished porcelain luster, reflecting temperature shocks.',
      icon: '🛡️'
    },
    Botanical: {
      name: 'Photosynth Bloom',
      desc: 'Absorbs ambient sunlight and blooms tiny aromatic petals to soothe nearby companions.',
      icon: '🌸'
    },
    Electric: {
      name: 'Filament Beacon',
      desc: 'Illuminates the room with a comforting golden aura that reveals hidden micro-details.',
      icon: '💡'
    },
    Mechanical: {
      name: 'Clockwork Rhythm',
      desc: 'Emits a precise rhythmic ticking cadence that calms anxious thoughts and coordinates team actions.',
      icon: '⚙️'
    },
    Glass: {
      name: 'Prismatic Focus',
      desc: 'Bends incoming rays of daylight into miniature rainbows with hypnotic sparkling patterns.',
      icon: '🌈'
    },
    Textile: {
      name: 'Snuggle Wrap',
      desc: 'Coils its soft plush tendrils around teammates to provide emotional warmth and restfulness.',
      icon: '🧣'
    },
    Thermal: {
      name: 'Aroma Vapor',
      desc: 'Gently vents warm fragrant steam, filling the habitat with notes of rich roast or citrus.',
      icon: '♨️'
    },
    Sonic: {
      name: 'Acoustic Purr',
      desc: 'Resonates at 432Hz, producing a deep restorative frequency that elevates everyone’s mood.',
      icon: '🎶'
    },
    Chrono: {
      name: 'Time Ticker',
      desc: 'Slows down perception of chaotic movements, granting incredible focus and agility.',
      icon: '⏱️'
    },
    Crystalline: {
      name: 'Amber Honey Coat',
      desc: 'Coats surrounding treats in golden crystallizing dew that preserves freshness indefinitely.',
      icon: '🍯'
    }
  };

  const selectedAbility = abilities[elem] || {
    name: 'Spark of Wonder',
    desc: 'Breathes curious life into the surrounding environment.',
    icon: '✨'
  };

  const habitatPreference = elem === 'Botanical' ? 'Sunlit Greenhouse' 
    : (elem === 'Electric' || elem === 'Mechanical' || elem === 'Sonic') ? 'Midnight Tech Lab'
    : 'Cozy Desk Studio';

  const provenance = options?.provenance || (options?.userPhotoUrl ? 'user_upload_manual' : 'preset_demo');

  const archetype = options?.archetype || deriveArchetypeFromObject(object.name, object.category, object.material);
  const visualPlan = options?.visualPlan || createDefaultVisualPlan(archetype, {
    primary: object.colorPalette.primary,
    secondary: object.colorPalette.secondary,
    accent: object.colorPalette.accent
  });

  return {
    id: `oddling-${Date.now()}-${hash % 10000}`,
    name: creatureName,
    speciesName: `${creatureName} Primus`,
    title: `The ${object.material} Spirit`,
    primaryElement: elem,
    temperament,
    provenance,
    specialAbility: {
      name: selectedAbility.name,
      description: selectedAbility.desc,
      powerRating: 60 + (hash % 35),
      icon: `${object.icon} ${selectedAbility.icon}`
    },
    sourceObject: {
      name: object.name,
      category: object.category,
      material: object.material,
      description: object.description,
      userPhotoUrl: options?.userPhotoUrl || object.samplePhotoUrl,
      selectionRegion: options?.selectionRegion
    },
    appearance: {
      visualPlan,
      bodyShape,
      primaryColor: object.colorPalette.primary,
      secondaryColor: object.colorPalette.secondary,
      accentColor: object.colorPalette.accent,
      eyeStyle,
      hornStyle,
      pattern: 'glazed',
      size: 0.9 + ((hash % 30) / 100)
    },
    habitatPreference,
    stats: {
      trust: 40,
      energy: 85,
      curiosity: 70,
      generation: 1
    },
    memories: [
      {
        timestamp: Date.now(),
        text: provenance === 'user_upload_manual'
          ? `Awakened from player's photograph of ${object.name} (${object.material}) via Manual Region Selection!`
          : `Awakened from preset scene specimen ${object.name} (${object.material}) in Demo Mode.`,
        type: 'awaken'
      }
    ],
    discoveredAt: Date.now()
  };
}

/**
 * Genetic Fusion algorithm: takes Parent A and Parent B and synthesizes
 * an original Hybrid Species inheriting traits and visual anatomy from both.
 */
export function fuseCreatures(parentA: CreatureDNA, parentB: CreatureDNA): {
  hybrid: CreatureDNA;
  recipeName: string;
  synergy: { title: string; bonus: string };
} {
  const hash = hashString(parentA.name + parentB.name + parentA.id + parentB.id);

  // Hybrid naming: Combine root from A and suffix from B, or vice-versa
  const nameSliceA = parentA.name.slice(0, Math.ceil(parentA.name.length / 2));
  const nameSliceB = parentB.name.slice(Math.floor(parentB.name.length / 2));
  const hybridName = `${nameSliceA}${nameSliceB.toLowerCase()}`;

  // Primary & secondary element inheritance
  const primaryElement = parentA.primaryElement;
  const secondaryElement = parentB.primaryElement;

  // Hybrid ability generation
  const hybridAbilityName = `${parentA.specialAbility.name.split(' ')[0]} ${parentB.specialAbility.name.split(' ')[1] || parentB.specialAbility.name.split(' ')[0]}`;
  const hybridAbilityDesc = `Harmonizes ${parentA.name}'s ${parentA.specialAbility.name} with ${parentB.name}'s ${parentB.specialAbility.name}, creating an intensified synergistic burst.`;
  const combinedPower = Math.min(99, Math.round((parentA.specialAbility.powerRating + parentB.specialAbility.powerRating) * 0.58));

  // Visual genetic inheritance
  // Parent A provides chassis archetype; Parent B provides distinct anatomical accents
  const primaryColor = parentA.appearance.primaryColor;
  const secondaryColor = parentB.appearance.secondaryColor;
  const accentColor = parentA.appearance.accentColor || parentB.appearance.accentColor;

  const baseArchetype = parentA.appearance.visualPlan?.archetype || deriveArchetypeFromObject(parentA.sourceObject.name, parentA.sourceObject.category, parentA.sourceObject.material);
  const parentBArchetype = parentB.appearance.visualPlan?.archetype || deriveArchetypeFromObject(parentB.sourceObject.name, parentB.sourceObject.category, parentB.sourceObject.material);

  const parentAParts = parentA.appearance.visualPlan?.definingParts || {};
  const parentBParts = parentB.appearance.visualPlan?.definingParts || {};

  const inheritedPartKeys: string[] = [];
  const hybridDefiningParts: VisualPlan['definingParts'] = { ...parentAParts };

  if (parentBArchetype === 'cactus' || parentBParts.hasSpines || parentB.appearance.hornStyle === 'spines') {
    hybridDefiningParts.hasSpines = true;
    hybridDefiningParts.spineDensity = 'dense';
    inheritedPartKeys.push(`${parentB.name}'s defensive cactus spines`);
  }
  if (parentBArchetype === 'lamp' || parentBParts.hasStem || parentBParts.hasShade) {
    hybridDefiningParts.hasStem = true;
    inheritedPartKeys.push(`${parentB.name}'s articulated brass stem`);
  }
  if (parentBArchetype === 'headphones' || parentBParts.hasHeadband || parentBParts.hasEarcups) {
    hybridDefiningParts.hasHeadband = true;
    hybridDefiningParts.hasEarcups = true;
    inheritedPartKeys.push(`${parentB.name}'s studio earcups`);
  }
  if (parentBParts.hasSteam || parentAParts.hasSteam || parentA.appearance.accessory === 'steam' || parentB.appearance.accessory === 'steam') {
    hybridDefiningParts.hasSteam = true;
    inheritedPartKeys.push('Thermal steam venting');
  }
  if (parentBParts.hasLeaves || parentAParts.hasLeaves || parentB.primaryElement === 'Botanical') {
    hybridDefiningParts.hasLeaves = true;
    inheritedPartKeys.push('Botanical succulent sprouts');
  }
  if (parentBParts.hasClockHands || parentBArchetype === 'pocket_watch') {
    hybridDefiningParts.hasClockHands = true;
    inheritedPartKeys.push('Ticking tourbillon mechanism');
  }

  const hybridVisualPlan: VisualPlan = {
    version: 1,
    archetype: baseArchetype,
    proportions: {
      widthScale: 1.0,
      heightScale: 1.0
    },
    definingParts: hybridDefiningParts,
    materialSurface: {
      finish: parentA.appearance.visualPlan?.materialSurface.finish || 'glazed_ceramic',
      pattern: parentB.appearance.visualPlan?.materialSurface.pattern || 'speckled',
      glazeColor: primaryColor,
      highlightColor: accentColor
    },
    facePlacement: parentA.appearance.visualPlan?.facePlacement || {
      surfaceRegion: 'vessel_front',
      yOffset: 0
    },
    inheritedFeatures: {
      chassisFrom: `${parentA.name} (${baseArchetype})`,
      accentsFrom: `${parentB.name} (${parentBArchetype})`,
      inheritedPartKeys: inheritedPartKeys.length > 0 ? inheritedPartKeys : [`Chassis from ${parentA.name}`, `Affinity aura from ${parentB.name}`]
    }
  };

  const inheritedTraits = [
    `Chassis structure (${baseArchetype}) inherited from ${parentA.name} (${parentA.primaryElement})`,
    `Anatomical accents (${inheritedPartKeys.join(', ') || parentB.primaryElement}) inherited from ${parentB.name}`,
    `Hybrid ability [${hybridAbilityName}] synthesizes both genetic lines`
  ];

  const hybrid: CreatureDNA = {
    id: `hybrid-${Date.now()}-${hash % 10000}`,
    name: hybridName,
    speciesName: `${parentA.name.slice(0, 4)}-${parentB.name.slice(0, 4)} Hybridus`,
    title: `The ${parentA.primaryElement}-${parentB.primaryElement} Chimera`,
    primaryElement,
    secondaryElement,
    temperament: pick([parentA.temperament, parentB.temperament, 'Playful & Bouncy', 'Energetic & Sparky'], hash),
    provenance: 'preset_demo',
    provenanceDetails: {
      provider: 'local_demo',
      isLive: false,
      timestamp: Date.now(),
      sourceDescription: `Algorithmic genetic cross of ${parentA.name} and ${parentB.name}`
    },
    specialAbility: {
      name: hybridAbilityName,
      description: hybridAbilityDesc,
      powerRating: combinedPower,
      icon: `${parentA.sourceObject.name.slice(0, 2)}✨${parentB.sourceObject.name.slice(0, 2)}`
    },
    sourceObject: {
      name: `${parentA.name} × ${parentB.name}`,
      category: `${parentA.primaryElement} / ${parentB.primaryElement} Fusion`,
      material: `${parentA.sourceObject.material} & ${parentB.sourceObject.material}`,
      description: `Discovered in Creature Fusion Lab by combining ${parentA.name} and ${parentB.name}.`
    },
    appearance: {
      visualPlan: hybridVisualPlan,
      bodyShape: parentA.appearance.bodyShape,
      primaryColor,
      secondaryColor,
      accentColor,
      eyeStyle: parentB.appearance.eyeStyle,
      hornStyle: parentB.appearance.hornStyle || parentA.appearance.hornStyle,
      accessory: 'sparkles',
      pattern: 'glazed',
      size: Math.min(1.2, Math.max(0.85, (parentA.appearance.size + parentB.appearance.size) / 2))
    },
    habitatPreference: parentA.habitatPreference,
    stats: {
      trust: Math.round((parentA.stats.trust + parentB.stats.trust) / 2) + 10,
      energy: 95,
      curiosity: 90,
      generation: Math.max(parentA.stats.generation, parentB.stats.generation) + 1
    },
    lineage: {
      parentAId: parentA.id,
      parentAName: `${parentA.name} (${parentA.primaryElement})`,
      parentBId: parentB.id,
      parentBName: `${parentB.name} (${parentB.primaryElement})`,
      inheritedTraits
    },
    memories: [
      {
        timestamp: Date.now(),
        text: `Fused into existence from ${parentA.name} and ${parentB.name} in the Fusion Lab!`,
        type: 'fuse'
      }
    ],
    discoveredAt: Date.now(),
    isFavorite: true
  };

  return {
    hybrid,
    recipeName: `${parentA.name} + ${parentB.name}`,
    synergy: {
      title: `${parentA.primaryElement} + ${parentB.primaryElement} Synergy`,
      bonus: `Awakened higher generation (Gen ${hybrid.stats.generation}) with +${Math.round(combinedPower * 0.15)} Ability Power!`
    }
  };
}

/**
 * Calculates trust, energy and mood changes when player interacts with an Oddling
 */
export function calculateInteractionResult(
  creature: CreatureDNA,
  action: 'pet' | 'feed' | 'play' | 'rest',
  treatElement?: ElementType
): {
  trustDelta: number;
  energyDelta: number;
  memoryText: string;
  mood: MoodType;
} {
  let trustDelta = 0;
  let energyDelta = 0;
  let memoryText = '';
  let mood: MoodType = 'happy';

  switch (action) {
    case 'pet':
      trustDelta = 6;
      energyDelta = -2;
      mood = creature.stats.trust > 70 ? 'loving' : 'happy';
      memoryText = `Enjoyed gentle soothing strokes; trust increased.`;
      break;

    case 'feed':
      const isFavoriteMatch = treatElement && (treatElement === creature.primaryElement || treatElement === creature.secondaryElement);
      trustDelta = isFavoriteMatch ? 12 : 7;
      energyDelta = 25;
      mood = 'happy';
      memoryText = isFavoriteMatch
        ? `Ate their favorite ${treatElement} treat! Radiated supreme joy.`
        : `Munced on a tasty treat with hearty delight.`;
      break;

    case 'play':
      trustDelta = 8;
      energyDelta = -18;
      mood = 'excited';
      memoryText = `Chased toys joyfully across the habitat.`;
      break;

    case 'rest':
      trustDelta = 3;
      energyDelta = 40;
      mood = 'sleepy';
      memoryText = `Curled up for a cozy regenerative nap.`;
      break;
  }

  return {
    trustDelta,
    energyDelta,
    memoryText,
    mood
  };
}

export function determineCreatureMood(creature: CreatureDNA): MoodType {
  if (creature.stats.energy < 20) return 'sleepy';
  if (creature.stats.trust > 85) return 'loving';
  if (creature.stats.energy > 80 && creature.stats.curiosity > 75) return 'excited';
  if (creature.stats.curiosity > 60) return 'curious';
  return 'happy';
}
