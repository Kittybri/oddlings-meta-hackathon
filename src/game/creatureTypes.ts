/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ElementType = 
  | 'Ceramic'
  | 'Botanical'
  | 'Electric'
  | 'Mechanical'
  | 'Glass'
  | 'Textile'
  | 'Thermal'
  | 'Sonic'
  | 'Chrono'
  | 'Crystalline';

export type TemperamentType =
  | 'Sleepy & Warm'
  | 'Curious & Chirpy'
  | 'Stubborn & Spiky'
  | 'Playful & Bouncy'
  | 'Gentle & Shy'
  | 'Energetic & Sparky'
  | 'Zen & Contemplative';

export type MoodType = 'happy' | 'curious' | 'sleepy' | 'excited' | 'hungry' | 'loving';

export type ProvenanceMode = 'preset_demo' | 'user_upload_manual' | 'ai_extracted';

export interface ProvenanceDetails {
  provider: 'baseten' | 'local_demo' | 'user_manual';
  model?: string; // e.g. 'meta-models/muse-spark-open-1026'
  isLive: boolean;
  timestamp: number;
  sourceDescription: string;
}

export type ObjectArchetype =
  | 'cup'          // ceramic/metal/glass mug or cup: vessel, rim, handle, liquid/steam
  | 'cactus'       // botanical succulent: barrel/column, branching pads, needle clusters
  | 'lamp'         // lighting: weighted base, articulated stem/neck, lamp shade/bulb, halo glow
  | 'headphones'   // audio: overhead arch headband, padded dual earcups, cords/accents
  | 'teapot'       // kettle/pot: round/fluted belly, arched spout, lid knob, sturdy loop handle
  | 'honey_jar'    // hexagonal/round jar: threaded rim/cork lid, honey dripping/level, dipper
  | 'pocket_watch' // horology: circular metallic casing, winding crown/top loop, clock face/hands, chain
  | 'lemon'        // citrus: tapered oval fruit body, pitted peel texture, leafy stem
  | 'compositional'// arbitrary everyday object constructed from compositional pixel parts
  | 'curio';       // flexible curious object with customizable anatomical parts

export interface CompositionalPart {
  type:
    | 'blade'
    | 'handle'
    | 'sole'
    | 'laces'
    | 'teeth'
    | 'strap'
    | 'dial'
    | 'lens'
    | 'cord'
    | 'antenna'
    | 'spout'
    | 'rim'
    | 'button'
    | 'screen'
    | 'hinge'
    | 'pocket'
    | 'wheel'
    | 'seam'
    | 'accent';
  x: number; // 0..36
  y: number; // 0..36
  width: number;
  height: number;
  fillRole: 'primary' | 'secondary' | 'accent' | 'dark' | 'light';
}

export interface CompositionalSilhouette {
  category: string; // e.g. 'footwear', 'tool', 'bag', 'camera', 'appliance', etc.
  aspectRatio?: 'tall' | 'wide' | 'square' | 'elongated_h' | 'elongated_v';
  // Bounded safe rect blocks defining the object's body silhouette (0..36)
  bodyBlocks: Array<{
    x: number;
    y: number;
    w: number;
    h: number;
    role?: 'primary' | 'secondary' | 'accent' | 'shadow';
  }>;
  // Distinct recognizable object parts (e.g. laces on a shoe, scissor blades, key teeth, backpack straps)
  featureAccents: CompositionalPart[];
  // Face positioning on the object
  faceX?: number; // center x of eyes (default ~18)
  faceY?: number; // center y of eyes (default ~18)
  // Optional 16x16 or 18x18 character pixel matrix e.g. rows of '.', 'P', 'S', 'A', 'D'
  pixelRows?: string[];
}

export interface VisualPlan {
  version: 1;
  archetype: ObjectArchetype;
  compositional?: CompositionalSilhouette;
  proportions?: {
    widthScale?: number;
    heightScale?: number;
  };
  definingParts: {
    hasHandle?: boolean;
    handleSide?: 'left' | 'right';
    hasRim?: boolean;
    hasLid?: boolean;
    hasSpout?: boolean;
    hasSpines?: boolean;
    spineDensity?: 'sparse' | 'dense';
    hasShade?: boolean;
    hasStem?: boolean;
    hasBase?: boolean;
    hasEarcups?: boolean;
    hasHeadband?: boolean;
    hasDial?: boolean;
    hasClockHands?: boolean;
    hasLeaves?: boolean;
    hasSteam?: boolean;
    hasDrips?: boolean;
    liquidFillColor?: string;
  };
  materialSurface: {
    finish: 'glazed_ceramic' | 'matte_plant' | 'brushed_metal' | 'translucent_glass' | 'textured_peel' | 'polished_brass' | 'matte_fabric' | 'durable_rubber' | 'smooth_plastic';
    pattern?: 'solid' | 'spots' | 'stripes' | 'speckled' | 'fluted' | 'ribbed';
    glazeColor?: string;
    highlightColor?: string;
  };
  facePlacement: {
    surfaceRegion: 'vessel_front' | 'plant_stem' | 'shade_center' | 'headband_bridge' | 'jar_belly' | 'watch_dial' | 'fruit_center' | 'body_center';
    yOffset?: number; // px offset (-15 to 15)
  };
  inheritedFeatures?: {
    chassisFrom?: string;
    accentsFrom?: string;
    inheritedPartKeys: string[];
  };
}

export const INCUBATION_DURATION_SECONDS = 30; // long enough for Muse Image to finish drawing the creature (16–23 s measured)

export interface IncubatorEgg {
  id: string; // egg_timestamp_random
  creature: CreatureDNA;
  photoThumbnail?: string; // lightweight compressed thumbnail of original photo
  primaryColor: string; // egg shell primary color
  secondaryColor: string; // egg stripe / spots color
  accentColor: string; // egg speckle / glow color
  pattern: 'stripes' | 'spots' | 'zigzag' | 'cosmic' | 'cracked';
  createdAt: number; // absolute unix timestamp ms
  hatchAt: number; // createdAt + (INCUBATION_DURATION_SECONDS * 1000)
  isHatched: boolean; // true once timer reached and user clicked to hatch
  isClaimed: boolean; // true once creature is added to player's active collection
}

export interface CreatureDNA {
  id: string;
  name: string;
  speciesName: string; // Latin / taxonomy e.g. "Calefactus Spinosus"
  title: string; // e.g. "The Steam-Spined Dweller"
  primaryElement: ElementType;
  secondaryElement?: ElementType;
  temperament: TemperamentType;
  provenance: ProvenanceMode;
  provenanceDetails?: ProvenanceDetails;
  specialAbility: {
    name: string;
    description: string;
    powerRating: number; // 1-100
    icon: string;
  };
  sourceObject: {
    name: string;
    category: string;
    material: string;
    imageCutout?: string;
    userPhotoUrl?: string;
    spritePhotoUrl?: string; // larger copy of the photo, used to draw the creature's sprite
    description: string;
    selectionRegion?: { x: number; y: number; width: number; height: number };
  };
  appearance: {
    visualPlan?: VisualPlan;
    bodyShape: 'round' | 'blob' | 'spiky' | 'tall' | 'boxy' | 'chubby';
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    eyeStyle: 'wide' | 'sleepy' | 'beady' | 'glowing' | 'cyclops' | 'sparkle';
    hornStyle?: 'spines' | 'antenna' | 'steam_pipe' | 'buds' | 'headphones' | 'ears' | 'clock_hands';
    accessory?: 'steam' | 'sparkles' | 'leaves' | 'gears' | 'bubbles' | 'glow';
    pattern: 'solid' | 'spots' | 'stripes' | 'glazed' | 'circuit' | 'bark';
    size: number; // 0.8 to 1.3
  };
  habitatPreference: 'Cozy Desk Studio' | 'Sunlit Greenhouse' | 'Midnight Tech Lab';
  stats: {
    trust: number; // 0 - 100
    energy: number; // 0 - 100
    curiosity: number; // 0 - 100
    generation: number; // 1 for wild, 2+ for hybrids
  };
  lineage?: {
    parentAId?: string;
    parentAName?: string;
    parentBId?: string;
    parentBName?: string;
    inheritedTraits: string[];
  };
  memories: Array<{
    timestamp: number;
    text: string;
    type: 'pet' | 'feed' | 'play' | 'nap' | 'fuse' | 'awaken';
  }>;
  discoveredAt: number;
  isFavorite?: boolean;
  worldRegion?: number; // Signed World region; legacy residents start at home (0).
  biomeId?: string; // ID of the biome this creature resides in (default 'greenhouse' = World)
}

export interface SegmentedObject {
  id: string;
  name: string;
  category: string;
  material: string;
  defaultElement: ElementType;
  description: string;
  // Interactive polygon coordinates as [x%, y%] relative to photo
  maskPolygon: Array<[number, number]>;
  center: [number, number];
  colorPalette: {
    primary: string;
    secondary: string;
    accent: string;
  };
  icon: string;
  samplePhotoUrl?: string;
}

export interface PhotoScene {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  theme: string;
  imageUrl: string;
  objects: SegmentedObject[];
}

export interface FoodTreat {
  id: string;
  name: string;
  element: ElementType;
  icon: string;
  description: string;
  color: string;
}

export interface FirstRunGoals {
  discoveredTwo: boolean;
  caredForOddling: boolean;
  fusedSpecies: boolean;
  builtBiomeHome: boolean;
}

export interface IntegrationStatus {
  gameEngine: {
    status: 'active';
    description: 'Autonomous 60fps simulation, procedural Web Audio, genetic inheritance engine';
  };
  demoMode: {
    status: 'active';
    description: 'Pre-designed scenes, SVG vector masks, and procedural DNA algorithms';
  };
  samSegmentation: {
    status: 'unconfigured';
    name: string;
    message: string;
  };
  museSpark: {
    status: 'unconfigured';
    name: string;
    message: string;
  };
}
