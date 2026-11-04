import { parseCreatureResponse } from './creatureResponse';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ElementType, ObjectArchetype, TemperamentType, VisualPlan, CompositionalSilhouette } from '../src/game/creatureTypes';
import { deriveArchetypeFromObject, createDefaultVisualPlan, repairObjectVisualPlan, createCompositionalSilhouette, normalizeAndCenterCompositional } from '../src/game/creatureRules';

export const BASETEN_BASE_URL = 'https://inference.baseten.co/v1';
export const BASETEN_CHAT_ENDPOINT = `${BASETEN_BASE_URL}/chat/completions`;
export const META_MUSE_SPARK_MODEL = 'meta-models/muse-spark-open-1026';

export interface BasetenStatus {
  provider: 'baseten';
  model: string;
  status: 'not_configured' | 'configured_unverified' | 'verified_live';
  hasKey: boolean;
  lastVerifiedAt: number | null;
  message: string;
}

// In-memory status tracker
let lastLiveVerificationTimestamp: number | null = null;
let lastErrorTimestamp: number | null = null;
let lastErrorMessage: string | null = null;

// Simple sliding window rate limiter
const requestTimestamps: number[] = [];
const RATE_LIMIT_WINDOW_MS = 60000;
const MAX_REQUESTS_PER_WINDOW = 20;

export function checkRateLimit(): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  // Clear old timestamps
  while (requestTimestamps.length > 0 && requestTimestamps[0] < now - RATE_LIMIT_WINDOW_MS) {
    requestTimestamps.shift();
  }

  if (requestTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    const oldest = requestTimestamps[0];
    const retryAfter = Math.ceil((oldest + RATE_LIMIT_WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfter };
  }

  requestTimestamps.push(now);
  return { allowed: true };
}

export function getBasetenStatus(): BasetenStatus {
  const apiKey = process.env.BASETEN_API_KEY;
  const hasKey = Boolean(apiKey && apiKey.trim().length > 0);

  if (!hasKey) {
    return {
      provider: 'baseten',
      model: META_MUSE_SPARK_MODEL,
      status: 'not_configured',
      hasKey: false,
      lastVerifiedAt: lastLiveVerificationTimestamp,
      message: 'BASETEN_API_KEY is not set in server environment. Manual & Demo modes are active.'
    };
  }

  if (lastLiveVerificationTimestamp) {
    return {
      provider: 'baseten',
      model: META_MUSE_SPARK_MODEL,
      status: 'verified_live',
      hasKey: true,
      lastVerifiedAt: lastLiveVerificationTimestamp,
      message: 'Verified live connection to Meta Muse Spark Open via Baseten.'
    };
  }

  return {
    provider: 'baseten',
    model: META_MUSE_SPARK_MODEL,
    status: 'configured_unverified',
    hasKey: true,
    lastVerifiedAt: null,
    message: 'BASETEN_API_KEY is configured in server environment. Ready for live request verification.'
  };
}

export interface ExtractedDnaResponse {
  name: string;
  speciesName: string;
  title: string;
  recognizedObject?: string;
  primaryElement: ElementType;
  secondaryElement?: ElementType;
  temperament: TemperamentType;
  material: string;
  description: string;
  visualPlan: VisualPlan;
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
    size: number;
  };
  specialAbility: {
    name: string;
    description: string;
    powerRating: number;
    icon: string;
  };
  inheritedTraits: string[];
}

/**
 * Validates and sanitizes raw JSON returned by Muse Spark.
 * Rejects executable code or SVG; strictly parses object-grounded JSON schema.
 */
export function validateAndSanitizeMuseOutput(raw: unknown, fallbackName: string): ExtractedDnaResponse {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Muse Spark returned empty or non-object response');
  }

  const obj = raw as Record<string, unknown>;

  const validElements: ElementType[] = [
    'Ceramic', 'Botanical', 'Electric', 'Mechanical', 'Glass',
    'Textile', 'Thermal', 'Sonic', 'Chrono', 'Crystalline'
  ];

  const primaryElement = validElements.includes(obj.primaryElement as ElementType)
    ? (obj.primaryElement as ElementType)
    : 'Ceramic';

  const secondaryElement = validElements.includes(obj.secondaryElement as ElementType)
    ? (obj.secondaryElement as ElementType)
    : undefined;

  const validShapes = ['round', 'blob', 'spiky', 'tall', 'boxy', 'chubby'];
  const validEyeStyles = ['wide', 'sleepy', 'beady', 'glowing', 'cyclops', 'sparkle'];
  const validHorns = ['spines', 'antenna', 'steam_pipe', 'buds', 'headphones', 'ears', 'clock_hands'];

  const rawApp = (obj.appearance as Record<string, unknown>) || {};
  const primaryColor = typeof rawApp.primaryColor === 'string' && rawApp.primaryColor.startsWith('#') ? rawApp.primaryColor : '#e07a5f';
  const secondaryColor = typeof rawApp.secondaryColor === 'string' && rawApp.secondaryColor.startsWith('#') ? rawApp.secondaryColor : '#40916c';
  const accentColor = typeof rawApp.accentColor === 'string' && rawApp.accentColor.startsWith('#') ? rawApp.accentColor : '#f4a261';

  // Extract or derive structured VisualPlan (never accepting arbitrary SVG/executable code)
  const validArchetypes: ObjectArchetype[] = ['cup', 'cactus', 'lamp', 'headphones', 'teapot', 'honey_jar', 'pocket_watch', 'lemon', 'compositional', 'curio'];
  const rawPlan = (obj.visualPlan || rawApp.visualPlan) as Record<string, unknown> | undefined;

  let visualPlan: VisualPlan;
  if (rawPlan && typeof rawPlan === 'object' && validArchetypes.includes(rawPlan.archetype as ObjectArchetype)) {
    const rawDefParts = (rawPlan.definingParts as Record<string, unknown>) || {};
    const rawMatSurface = (rawPlan.materialSurface as Record<string, unknown>) || {};
    const rawFace = (rawPlan.facePlacement as Record<string, unknown>) || {};

    const rawComp = (rawPlan.compositional || rawPlan.compositionalSilhouette) as Record<string, unknown> | undefined;
    let compositional: CompositionalSilhouette | undefined = undefined;

    if (rawComp && typeof rawComp === 'object') {
      const rawBlocks = Array.isArray(rawComp.bodyBlocks) ? rawComp.bodyBlocks : [];
      const bodyBlocks = rawBlocks
        .slice(0, 16)
        .map((b: any) => ({
          x: Math.max(0, Math.min(35, typeof b.x === 'number' ? Math.round(b.x) : 10)),
          y: Math.max(0, Math.min(35, typeof b.y === 'number' ? Math.round(b.y) : 10)),
          w: Math.max(1, Math.min(36, typeof b.w === 'number' ? Math.round(b.w) : 16)),
          h: Math.max(1, Math.min(36, typeof b.h === 'number' ? Math.round(b.h) : 16)),
          role: (['primary', 'secondary', 'accent', 'shadow'].includes(b.role) ? b.role : 'primary') as any
        }));

      const rawFeats = Array.isArray(rawComp.featureAccents) ? rawComp.featureAccents : [];
      const validFeatTypes = ['blade', 'handle', 'sole', 'laces', 'teeth', 'strap', 'dial', 'lens', 'cord', 'antenna', 'spout', 'rim', 'button', 'screen', 'hinge', 'pocket', 'accent'];
      const validRoles = ['primary', 'secondary', 'accent', 'dark', 'light'];

      const featureAccents = rawFeats
        .slice(0, 16)
        .map((f: any) => ({
          type: (validFeatTypes.includes(f.type) ? f.type : 'accent') as any,
          x: Math.max(0, Math.min(35, typeof f.x === 'number' ? Math.round(f.x) : 12)),
          y: Math.max(0, Math.min(35, typeof f.y === 'number' ? Math.round(f.y) : 12)),
          width: Math.max(1, Math.min(36, typeof f.width === 'number' ? Math.round(f.width) : 4)),
          height: Math.max(1, Math.min(36, typeof f.height === 'number' ? Math.round(f.height) : 4)),
          fillRole: (validRoles.includes(f.fillRole) ? f.fillRole : 'accent') as any
        }));

      compositional = {
        category: typeof rawComp.category === 'string' ? rawComp.category.slice(0, 30) : 'everyday_item',
        aspectRatio: (['tall', 'wide', 'square', 'elongated_h', 'elongated_v'].includes(rawComp.aspectRatio as string) ? rawComp.aspectRatio : 'square') as any,
        bodyBlocks: bodyBlocks.length > 0 ? bodyBlocks : [{ x: 9, y: 10, w: 18, h: 16, role: 'primary' }],
        featureAccents,
        faceX: typeof rawComp.faceX === 'number' ? Math.max(6, Math.min(30, Math.round(rawComp.faceX))) : 18,
        faceY: typeof rawComp.faceY === 'number' ? Math.max(6, Math.min(30, Math.round(rawComp.faceY))) : 17,
        pixelRows: Array.isArray(rawComp.pixelRows)
          ? rawComp.pixelRows.slice(0, 18).map((r) => String(r).slice(0, 18))
          : undefined
      };
    } else if (rawPlan.archetype === 'compositional') {
      compositional = createCompositionalSilhouette(
        `${typeof obj.name === 'string' ? obj.name : ''} ${fallbackName}`,
        typeof obj.material === 'string' ? obj.material : '',
        typeof obj.description === 'string' ? obj.description : '',
        { primary: primaryColor, secondary: secondaryColor, accent: accentColor }
      );
    }

    if (compositional) {
      compositional = normalizeAndCenterCompositional(
        compositional,
        `${typeof obj.name === 'string' ? obj.name : ''} ${fallbackName} ${typeof obj.material === 'string' ? obj.material : ''} ${typeof obj.description === 'string' ? obj.description : ''}`,
        { primary: primaryColor, secondary: secondaryColor, accent: accentColor }
      );
    }

    visualPlan = {
      version: 1,
      archetype: compositional && rawPlan.archetype === 'curio' ? 'compositional' : rawPlan.archetype as ObjectArchetype,
      compositional,
      proportions: { widthScale: 1.0, heightScale: 1.0 },
      definingParts: {
        hasHandle: Boolean(rawDefParts.hasHandle),
        handleSide: rawDefParts.handleSide === 'left' ? 'left' : 'right',
        hasRim: rawDefParts.hasRim !== undefined ? Boolean(rawDefParts.hasRim) : true,
        hasLid: Boolean(rawDefParts.hasLid),
        hasSpout: Boolean(rawDefParts.hasSpout),
        hasSpines: Boolean(rawDefParts.hasSpines),
        spineDensity: rawDefParts.spineDensity === 'sparse' ? 'sparse' : 'dense',
        hasShade: Boolean(rawDefParts.hasShade),
        hasStem: Boolean(rawDefParts.hasStem),
        hasBase: Boolean(rawDefParts.hasBase),
        hasEarcups: Boolean(rawDefParts.hasEarcups),
        hasHeadband: Boolean(rawDefParts.hasHeadband),
        hasDial: Boolean(rawDefParts.hasDial),
        hasClockHands: Boolean(rawDefParts.hasClockHands),
        hasLeaves: Boolean(rawDefParts.hasLeaves),
        hasSteam: Boolean(rawDefParts.hasSteam),
        hasDrips: Boolean(rawDefParts.hasDrips)
      },
      materialSurface: {
        finish: (['glazed_ceramic', 'matte_plant', 'brushed_metal', 'translucent_glass', 'textured_peel', 'polished_brass', 'matte_fabric', 'durable_rubber', 'smooth_plastic'].includes(rawMatSurface.finish as string)
          ? rawMatSurface.finish
          : 'glazed_ceramic') as any,
        pattern: (['solid', 'spots', 'stripes', 'speckled', 'fluted', 'ribbed'].includes(rawMatSurface.pattern as string)
          ? rawMatSurface.pattern
          : 'solid') as any,
        glazeColor: primaryColor,
        highlightColor: accentColor
      },
      facePlacement: {
        surfaceRegion: (['vessel_front', 'plant_stem', 'shade_center', 'headband_bridge', 'jar_belly', 'watch_dial', 'fruit_center', 'body_center'].includes(rawFace.surfaceRegion as string)
          ? rawFace.surfaceRegion
          : 'vessel_front') as any,
        yOffset: typeof rawFace.yOffset === 'number' ? Math.max(-15, Math.min(15, rawFace.yOffset)) : 0
      }
    };
  } else {
    const derivedArchetype = deriveArchetypeFromObject(
      `${typeof obj.name === 'string' ? obj.name : ''} ${fallbackName}`,
      typeof obj.material === 'string' ? obj.material : '',
      typeof obj.description === 'string' ? obj.description : ''
    );
    visualPlan = createDefaultVisualPlan(derivedArchetype, { primary: primaryColor, secondary: secondaryColor, accent: accentColor });
  }

  const sourceIdentity = obj.recognizedObject || obj.objectName || obj.objectType;
  visualPlan = repairObjectVisualPlan(visualPlan, typeof sourceIdentity === 'string' ? sourceIdentity : fallbackName) || visualPlan;

  const appearance: ExtractedDnaResponse['appearance'] = {
    visualPlan,
    bodyShape: (validShapes.includes(rawApp.bodyShape as string) ? rawApp.bodyShape : 'round') as any,
    primaryColor,
    secondaryColor,
    accentColor,
    eyeStyle: (validEyeStyles.includes(rawApp.eyeStyle as string) ? rawApp.eyeStyle : 'wide') as any,
    hornStyle: validHorns.includes(rawApp.hornStyle as string) ? (rawApp.hornStyle as any) : undefined,
    accessory: (rawApp.accessory as any) || 'sparkles',
    pattern: (rawApp.pattern as any) || 'glazed',
    size: typeof rawApp.size === 'number' ? Math.max(0.8, Math.min(1.3, rawApp.size)) : 1.0
  };

  const rawAbility = (obj.specialAbility as Record<string, unknown>) || {};
  const specialAbility = {
    name: typeof rawAbility.name === 'string' && rawAbility.name.length > 0 ? rawAbility.name : 'Elemental Surge',
    description: typeof rawAbility.description === 'string' && rawAbility.description.length > 0 ? rawAbility.description : 'Channels energy derived from source object.',
    powerRating: typeof rawAbility.powerRating === 'number' ? Math.max(10, Math.min(99, rawAbility.powerRating)) : 75,
    icon: typeof rawAbility.icon === 'string' && rawAbility.icon.length > 0 ? rawAbility.icon : '✨'
  };

  const inheritedTraits = Array.isArray(obj.inheritedTraits)
    ? obj.inheritedTraits.map(String).filter((t) => t.length > 0)
    : [`Traits derived from photographed ${fallbackName}`];

  const rawRecog = obj.recognizedObject || obj.objectName || obj.objectType;
  const recognizedObject = typeof rawRecog === 'string' && rawRecog.trim().length > 0
    ? rawRecog.trim()
    : fallbackName;

  return {
    name: typeof obj.name === 'string' && obj.name.trim().length > 0 ? obj.name.trim() : fallbackName,
    speciesName: typeof obj.speciesName === 'string' && obj.speciesName.trim().length > 0 ? obj.speciesName.trim() : `${fallbackName} Primus`,
    title: typeof obj.title === 'string' && obj.title.trim().length > 0 ? obj.title.trim() : `The ${primaryElement} Creature`,
    recognizedObject,
    primaryElement,
    secondaryElement,
    temperament: (obj.temperament as TemperamentType) || 'Curious & Chirpy',
    material: typeof obj.material === 'string' && obj.material.length > 0 ? obj.material : 'Everyday Composite',
    description: typeof obj.description === 'string' && obj.description.length > 0 ? obj.description : `Living Oddling born from real-world ${recognizedObject}.`,
    visualPlan,
    appearance,
    specialAbility,
    inheritedTraits
  };
}

/**
 * Sends multimodal chat completion request to Baseten Muse Spark Open endpoint
 */
export async function analyzeObjectWithBaseten(params: {
  imageBase64: string;
  objectHint?: string;
  region?: { x: number; y: number; width: number; height: number };
  refining?: boolean;
}): Promise<ExtractedDnaResponse> {
  const apiKey = process.env.BASETEN_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw {
      status: 503,
      message: 'BASETEN_API_KEY is not configured in server environment. Please configure it in server secrets or use Demo / Manual mode.'
    };
  }

  const { allowed, retryAfter } = checkRateLimit();
  if (!allowed) {
    throw {
      status: 429,
      message: `Rate limit exceeded. Please wait ${retryAfter} seconds before analyzing another image.`
    };
  }

  // Ensure base64 string doesn't exceed 6MB
  if (params.imageBase64.length > 8 * 1024 * 1024) {
    throw {
      status: 413,
      message: 'Image size exceeds maximum 6MB limit. Please upload or capture a smaller image.'
    };
  }

  // Format image URL
  const imageUrl = params.imageBase64.startsWith('data:')
    ? params.imageBase64
    : `data:image/jpeg;base64,${params.imageBase64}`;

  const regionNote = params.region
    ? ` Focus specifically on the object inside bounding region: [x: ${Math.round(params.region.x)}%, y: ${Math.round(params.region.y)}%, width: ${Math.round(params.region.width)}%, height: ${Math.round(params.region.height)}%].`
    : '';

  const objectHintNote = params.objectHint
    ? ` Player object hint: "${params.objectHint}".`
    : '';

  const promptText = `You are Muse Spark, an AI creature intelligence model for ODDLINGS.
Analyze the everyday object in the photograph.${regionNote}${objectHintNote}

Identify what real-world object it is (if multiple objects appear, choose the visually dominant one automatically), its physical materials (ceramic, metal, leather, rubber, plastic, fabric, glass, wood, etc.), and functional properties.
Crucial rule: the creature must visibly BE the photographed object brought to life (e.g. a fork must be a FORK MONSTER with 4 separate tines, bridge, and handle; a cup must have vessel, rim, and handle; a shoe must have sole and laces; scissors must have blades and handle loops; keys must have ring and teeth; a backpack must have straps and pocket; a lamp must have stem/base/shade). Do not invent an arbitrary round fantasy blob.
Never output raw SVG, HTML, or executable code. Respond with ONLY a raw JSON object adhering to this schema:
{
  "name": "One playful, evocative creature name e.g. Tinefang, Thornbrew, Kickling, Snips, Keyfang",
  "speciesName": "Latin/Taxonomic scientific binomial e.g. Furca Argentea, Calefactus Spinosus",
  "title": "Short title e.g. Silver-Pronged Piercer, The Steam-Spined Dweller",
  "recognizedObject": "The specific real-world everyday object noun e.g. Dinner Fork, Coffee Mug, Running Shoe, Scissors, House Key, Desk Lamp",
  "primaryElement": "One of: Ceramic | Botanical | Electric | Mechanical | Glass | Textile | Thermal | Sonic | Chrono | Crystalline",
  "secondaryElement": "Optional second element or omit",
  "temperament": "One of: Sleepy & Warm | Curious & Chirpy | Stubborn & Spiky | Playful & Bouncy | Gentle & Shy | Energetic & Sparky | Zen & Contemplative",
  "material": "Specific physical material identified e.g. Polished Stainless Steel, Glazed Stoneware, Vulcanized Rubber, Brushed Brass",
  "description": "2-sentence biography explaining how this living creature inherited its behavior from its everyday object origins",
  "visualPlan": {
    "archetype": "One of: cup | cactus | lamp | headphones | teapot | honey_jar | pocket_watch | lemon | compositional",
    "compositional": {
      "category": "One of: fork | utensil | footwear | tool | keys | bag | electronics | stationery | appliance | vessel | curio",
      "aspectRatio": "One of: tall | wide | square | elongated_h | elongated_v",
      "bodyBlocks": [
        { "x": 8, "y": 14, "w": 20, "h": 12, "role": "primary" }
      ],
      "featureAccents": [
        { "type": "sole | laces | blade | teeth | strap | dial | lens | cord | button | spout", "x": 8, "y": 24, "width": 20, "height": 3, "fillRole": "dark" }
      ],
      "faceX": 18,
      "faceY": 17
    },
    "definingParts": {
      "hasHandle": false,
      "hasRim": false,
      "hasSpout": false,
      "hasSpines": false,
      "hasShade": false,
      "hasStem": false,
      "hasEarcups": false,
      "hasHeadband": false,
      "hasDial": false,
      "hasSteam": false
    },
    "materialSurface": {
      "finish": "One of: glazed_ceramic | matte_plant | brushed_metal | translucent_glass | textured_peel | polished_brass | matte_fabric | durable_rubber | smooth_plastic",
      "pattern": "One of: solid | spots | stripes | speckled | fluted | ribbed"
    }
  },
  "appearance": {
    "bodyShape": "One of: round | blob | spiky | tall | boxy | chubby",
    "primaryColor": "Hex color e.g. #e07a5f matching dominant object color",
    "secondaryColor": "Hex color e.g. #2a9d8f matching accent",
    "accentColor": "Hex color e.g. #ffd166",
    "eyeStyle": "One of: wide | sleepy | beady | glowing | cyclops | sparkle",
    "hornStyle": "One of: spines | antenna | steam_pipe | buds | headphones | ears | clock_hands",
    "accessory": "One of: steam | sparkles | leaves | gears | bubbles | glow",
    "pattern": "One of: solid | spots | stripes | glazed | circuit | bark",
    "size": 1.0
  },
  "specialAbility": {
    "name": "Creative signature ability grounded in object function e.g. Steam Spines, Rebound Kick, Precision Snip",
    "description": "One sentence describing the ability effect",
    "powerRating": 75,
    "icon": "One or two thematic emojis e.g. ☕👟✂️🔑"
  },
  "inheritedTraits": [
    "Specific trait 1 inherited from object",
    "Specific trait 2 inherited from object",
    "Behavioral quirk based on everyday use"
  ]
}`;

  const payload = {
    model: META_MUSE_SPARK_MODEL,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: promptText + (params.refining ? '\nReturn concise complete JSON. Short descriptions, at most 6 body blocks and 3 accents. No commentary.' : '') },
          { type: 'image_url', image_url: { url: imageUrl } }
        ]
      }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.65,
    max_tokens: 3500
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  try {
    const res = await fetch(BASETEN_CHAT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });


    if (!res.ok) {
      const errText = await res.text();
      // Record failure without leaking auth header
      lastErrorTimestamp = Date.now();
      lastErrorMessage = `Baseten HTTP ${res.status}: ${errText.slice(0, 150)}`;

      if (res.status === 401) {
        throw { status: 401, message: 'Invalid or expired BASETEN_API_KEY. Please verify your Baseten credentials.' };
      }
      if (res.status === 402) {
        throw { status: 402, message: 'Baseten account payment required or insufficient credits for Muse Spark.' };
      }
      if (res.status === 429) {
        throw { status: 429, message: 'Upstream rate limit reached on Baseten. Please wait a moment.' };
      }
      throw { status: res.status, message: `Baseten service error (${res.status}): ${errText.slice(0, 120)}` };
    }

    const json = await res.json();
    const choice = json.choices?.[0];
    const parsed = parseCreatureResponse(choice);

    const validated = validateAndSanitizeMuseOutput(parsed, params.objectHint || 'Photographed Object');

    // Mark as verified live!
    lastLiveVerificationTimestamp = Date.now();
    lastErrorMessage = null;

    return validated;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw { status: 504, message: 'Request to Meta Muse Spark on Baseten timed out after 35 seconds.' };
    }
    if (err.status) throw err;
    throw { status: 500, message: err.message || 'Failed to communicate with Baseten inference API.' };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Live Fusion Synthesis using Meta Muse Spark Open:
 * Takes Parent A and Parent B and synthesizes a hybrid with traceable genetics.
 */
// Muse Spark sometimes stops mid-answer, leaving JSON that cannot be read; those tries are repeated
// (up to three in all) before the player sees a plain message. Key, credit and rate-limit errors are not retried.
export async function fuseCreaturesWithBaseten(params: Parameters<typeof fuseOnceWithBaseten>[0]): Promise<ExtractedDnaResponse> {
  let lastErr: any;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await fuseOnceWithBaseten(params);
    } catch (err: any) {
      lastErr = err;
      const status = err?.status || 500;
      if (status !== 500 && status !== 502) throw err;
    }
  }
  console.warn('Fusion gave up after 3 tries:', lastErr?.message);
  throw { status: 502, message: 'Meta Muse Spark sent back an unfinished answer three times in a row' };
}

async function fuseOnceWithBaseten(params: {
  parentA: { name: string; element: string; ability: string; material: string; traits?: string[] };
  parentB: { name: string; element: string; ability: string; material: string; traits?: string[] };
}): Promise<ExtractedDnaResponse> {
  const apiKey = process.env.BASETEN_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw {
      status: 503,
      message: 'BASETEN_API_KEY is not configured in server environment. Please use algorithmic fusion.'
    };
  }

  const { allowed, retryAfter } = checkRateLimit();
  if (!allowed) {
    throw { status: 429, message: `Rate limit exceeded. Please wait ${retryAfter} seconds.` };
  }

  const promptText = `You are Muse Spark, an AI creature intelligence engine for ODDLINGS.
Perform a Genetic Fusion synthesis between two parent Oddlings:

PARENT A:
- Name: ${params.parentA.name}
- Element: ${params.parentA.element}
- Material: ${params.parentA.material}
- Signature Ability: ${params.parentA.ability}
- Traits: ${params.parentA.traits?.join(', ') || 'N/A'}

PARENT B:
- Name: ${params.parentB.name}
- Element: ${params.parentB.element}
- Material: ${params.parentB.material}
- Signature Ability: ${params.parentB.ability}
- Traits: ${params.parentB.traits?.join(', ') || 'N/A'}

Generate a hybrid species (Generation 2+) where anatomy and traits from BOTH parents are visibly and functionally inherited.
Parent A contributes the primary body chassis archetype, while Parent B contributes defining anatomical parts (such as cactus spines, brass lamp stem, studio earcups, dial, etc.).
Never output raw SVG or code. Respond with ONLY a raw JSON object conforming to the Creature DNA schema:
{
  "name": "Combined hybrid name",
  "speciesName": "Taxonomic binomial e.g. ParentA-ParentB Hybridus",
  "title": "Evocative hybrid title",
  "primaryElement": "${params.parentA.element}",
  "secondaryElement": "${params.parentB.element}",
  "temperament": "Harmonized temperament from parents",
  "material": "${params.parentA.material} & ${params.parentB.material}",
  "description": "Two sentences describing how this hybrid expresses features from both ${params.parentA.name} and ${params.parentB.name}",
  "visualPlan": {
    "archetype": "Primary vessel/body archetype from Parent A e.g. cup, lamp, cactus, etc.",
    "definingParts": {
      "hasHandle": false,
      "hasSpines": false,
      "hasSteam": false,
      "hasShade": false,
      "hasStem": false,
      "hasEarcups": false,
      "hasHeadband": false
    },
    "materialSurface": {
      "finish": "One of: glazed_ceramic | matte_plant | brushed_metal | translucent_glass | textured_peel | polished_brass",
      "pattern": "speckled"
    }
  },
  "appearance": {
    "bodyShape": "One of: round | blob | spiky | tall | boxy | chubby",
    "primaryColor": "Hex color",
    "secondaryColor": "Hex color",
    "accentColor": "Hex color",
    "eyeStyle": "One of: wide | sleepy | beady | glowing | cyclops | sparkle",
    "hornStyle": "One of: spines | antenna | steam_pipe | buds | headphones | ears | clock_hands",
    "accessory": "sparkles",
    "pattern": "glazed",
    "size": 1.1
  },
  "specialAbility": {
    "name": "Fused hybrid ability combining aspects of both parents",
    "description": "Description of hybrid ability",
    "powerRating": 88,
    "icon": "✨"
  },
  "inheritedTraits": [
    "Inherited from Parent A (${params.parentA.name}): specific anatomical trait",
    "Inherited from Parent B (${params.parentB.name}): specific anatomical trait",
    "Emergent hybrid synergy trait"
  ]
}`;

  const payload = {
    model: META_MUSE_SPARK_MODEL,
    messages: [
      { role: 'user', content: promptText }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
    max_tokens: 6000
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  try {
    const res = await fetch(BASETEN_CHAT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });


    if (!res.ok) {
      const errText = await res.text();
      if (res.status === 401) throw { status: 401, message: 'Invalid or expired BASETEN_API_KEY.' };
      if (res.status === 402) throw { status: 402, message: 'Baseten account payment required or insufficient credits.' };
      if (res.status === 429) throw { status: 429, message: 'Baseten rate limit reached.' };
      throw { status: res.status, message: `Baseten error: ${errText.slice(0, 120)}` };
    }

    const json = await res.json();
    const choice = json.choices?.[0];
    const message = choice?.message || {};
    let rawContent = message.content || choice?.text || (typeof choice === 'string' ? choice : '');

    if ((!rawContent || typeof rawContent !== 'string' || !rawContent.trim()) && typeof message.reasoning_content === 'string') {
      const match = message.reasoning_content.match(/```json\s*([\s\S]*?)\s*```/) || message.reasoning_content.match(/\{[\s\S]*\}/);
      if (match) {
        rawContent = match[1] || match[0];
      }
    }

    const content = typeof rawContent === 'string' ? rawContent.trim() : (Array.isArray(rawContent) ? rawContent.map((c: any) => c.text || '').join('') : '');
    if (!content) {
      throw { status: 502, message: 'No content returned for fusion by Meta Muse Spark Open.' };
    }

    const cleanedContent = content.trim().replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
    let parsed: any;
    try {
      parsed = JSON.parse(cleanedContent);
    } catch {
      throw { status: 502, message: 'Meta Muse Spark sent back an unfinished answer' };
    }

    lastLiveVerificationTimestamp = Date.now();
    return validateAndSanitizeMuseOutput(parsed, `${params.parentA.name} x ${params.parentB.name}`);
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw { status: 504, message: 'Live fusion request timed out.' };
    }
    if (err.status) throw err;
    throw { status: 500, message: err.message || 'Failed live fusion on Baseten.' };
  } finally {
    clearTimeout(timeoutId);
  }
}
