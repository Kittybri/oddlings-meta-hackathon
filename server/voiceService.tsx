/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Creature diary entries and speech lines written by Meta Muse Spark Open via Baseten.
 */

import { BASETEN_CHAT_ENDPOINT, META_MUSE_SPARK_MODEL, checkRateLimit } from './basetenService';

const TOPICS = ['water', 'flower', 'shelter', 'light', 'pet', 'sleep', 'idle', 'rain'];
const RAIN_STANCES = ['loves', 'hates', 'worried', 'curious'];
const RAIN_FEELING: Record<string, string> = {
  loves: 'loves rain and gets happy and playful',
  hates: 'hates getting wet and complains about it',
  worried: 'gets nervous and worried when it rains',
  curious: 'is curious and fascinated by rain'
};
const EVENTS = ['hatch', 'fuse', 'pet', 'feed', 'play', 'nap', 'ability', 'move', 'heart', 'gift'];
const PHASES = ['day', 'sunset', 'night', 'dawn'];

const clip = (s: unknown, max: number): string =>
  typeof s === 'string' ? s.replace(/[\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';

// The model sometimes echoes a placeholder from the prompt instead of writing real text.
const PLACEHOLDERS = new Set(['text', '...', '…', 'entry', 'line']);
const isRealText = (s: string, min: number): boolean => s.length >= min && !PLACEHOLDERS.has(s.toLowerCase());
const isRealDiary = (s: string): boolean =>
  isRealText(s, 24) && s.replace(/^dear diary,?\s*/i, '').replace(/[.…\s]+$/, '').length >= 10;

export interface VoiceInput {
  kind: 'journal' | 'speech';
  creature: {
    name: string;
    objectName: string;
    category?: string;
    material?: string;
    temperament?: string;
    ability?: string;
    traits?: string[];
    rainStance?: string;
  };
  event?: string;
  eventNote?: string;
  context?: { biome?: string; phase?: string };
}

export interface VoiceOutput {
  entry?: string;
  lines?: Array<{ topic: string; text: string }>;
}

/** Index of the brace that closes the object opening at start, or -1. */
function findObjectEnd(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return i;
  }
  return -1;
}

/**
 * Finds the first JSON object in model text that parses and passes accept. Replies often carry
 * extra prose, code fences, or draft objects before the real answer.
 */
export function extractJsonObject(text: string, accept: (obj: any) => boolean = () => true): any {
  for (let start = text.indexOf('{'); start >= 0; start = text.indexOf('{', start + 1)) {
    const end = findObjectEnd(text, start);
    if (end < 0) continue;
    try {
      const obj = JSON.parse(text.slice(start, end + 1));
      if (accept(obj)) return obj;
    } catch {
      /* not JSON: try the next brace */
    }
  }
  throw new Error('No usable JSON object in model output.');
}

export function sanitizeVoiceInput(body: any): VoiceInput | null {
  if (!body || (body.kind !== 'journal' && body.kind !== 'speech')) return null;
  const c = body.creature || {};
  const objectName = clip(c.objectName, 40);
  const name = clip(c.name, 40);
  if (!objectName || !name) return null;
  const event = EVENTS.includes(body.event) ? body.event : undefined;
  if (body.kind === 'journal' && !event) return null;
  return {
    kind: body.kind,
    creature: {
      name,
      objectName,
      category: clip(c.category, 30) || undefined,
      material: clip(c.material, 30) || undefined,
      temperament: clip(c.temperament, 30) || undefined,
      ability: clip(c.ability, 40) || undefined,
      traits: Array.isArray(c.traits) ? c.traits.slice(0, 3).map((t: unknown) => clip(t, 80)).filter(Boolean) : [],
      rainStance: RAIN_STANCES.includes(c.rainStance) ? c.rainStance : undefined
    },
    event,
    eventNote: clip(body.eventNote, 120) || undefined,
    context: {
      biome: clip(body.context?.biome, 40) || undefined,
      phase: PHASES.includes(body.context?.phase) ? body.context.phase : undefined
    }
  };
}

export function buildVoicePrompt(input: VoiceInput): string {
  const c = input.creature;
  const facts = [
    `Name: ${c.name}`,
    `Made from a real photo of: ${c.objectName}`,
    c.category ? `Object type: ${c.category}` : '',
    c.material ? `Material: ${c.material}` : '',
    c.temperament ? `Temperament: ${c.temperament}` : '',
    c.ability ? `Signature ability: ${c.ability}` : '',
    c.traits && c.traits.length ? `Inherited traits: ${c.traits.join('; ')}` : '',
    c.rainStance ? `Feelings about rain: ${RAIN_FEELING[c.rainStance]}` : '',
    input.context?.biome ? `Lives in: ${input.context.biome}` : '',
    input.context?.phase ? `Time of day in the world: ${input.context.phase}` : ''
  ].filter(Boolean).join('\n');

  const voice = `Voice: a tiny cute 8-bit pixel pet. Warm, playful, a little silly. Always think like the original ${c.objectName} (its shape, use, material and feel). No profanity, no real-world brands, no emoji spam.`;

  if (input.kind === 'journal') {
    return `You are Muse Spark writing a pixel-pet diary for the game ODDLINGS.
${facts}
Event: ${input.event}${input.eventNote ? ` (${input.eventNote})` : ''}
${voice}
Write ONE diary entry in the creature's own first-person voice, 1 to 3 short sentences, at most 140 characters total. Start with "Dear diary," when it fits.
Respond with ONLY a raw JSON object with a single key "entry" whose value is the diary entry itself.`;
  }

  return `You are Muse Spark writing tiny speech-bubble lines for a pixel pet in the game ODDLINGS.
${facts}
${voice}
Write exactly 2 lines for each topic: water, flower, shelter, light, pet, sleep, idle, rain.
- water: near a pond. flower: near a flower. shelter: in a cozy shelter. light: near a lantern or lamp.
- pet: being petted. sleep: falling asleep. idle: just wandering.
- rain: it is raining right now. React the way this creature feels about rain, using its real object (for example worrying about getting wet, or loving the splashes).
Each line is at most 55 characters, first person, referencing the original ${c.objectName} where it is funny or sweet. At most one simple emoji per line.
Respond with ONLY a raw JSON object with a single key "lines": an array of 16 objects, each with a "topic" (one of the eight topics) and a "text" (the speech line itself).`;
}

export function parseVoiceOutput(kind: 'journal' | 'speech', parsed: any): VoiceOutput {
  if (kind === 'journal') {
    const entry = clip(parsed?.entry, 400);
    return isRealDiary(entry) ? { entry } : {};
  }
  const lines = Array.isArray(parsed?.lines) ? parsed.lines : [];
  return {
    lines: lines
      .filter((l: any) => TOPICS.includes(l?.topic) && isRealText(clip(l?.text, 200), 4))
      .slice(0, 24)
      .map((l: any) => ({ topic: l.topic as string, text: clip(l.text, 200) }))
  };
}

export async function generateCreatureVoice(input: VoiceInput): Promise<VoiceOutput> {
  const apiKey = process.env.BASETEN_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw { status: 503, message: 'BASETEN_API_KEY is not configured in server environment.' };
  }
  const { allowed, retryAfter } = checkRateLimit();
  if (!allowed) throw { status: 429, message: `Rate limit exceeded. Please wait ${retryAfter} seconds.` };

  const payload = {
    model: META_MUSE_SPARK_MODEL,
    messages: [{ role: 'user', content: buildVoicePrompt(input) }],
    response_format: { type: 'json_object' },
    temperature: 0.9,
    max_tokens: input.kind === 'journal' ? 1500 : 4000
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(BASETEN_CHAT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
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

    const json: any = await res.json();
    const choice = json.choices?.[0];
    const message = choice?.message || {};
    let rawContent = message.content || choice?.text || '';
    if ((!rawContent || typeof rawContent !== 'string' || !rawContent.trim()) && typeof message.reasoning_content === 'string') {
      rawContent = message.reasoning_content;
    }
    const content = typeof rawContent === 'string'
      ? rawContent.trim()
      : Array.isArray(rawContent) ? rawContent.map((c: any) => c.text || '').join('') : '';
    if (!content) throw { status: 502, message: 'No content returned by Meta Muse Spark Open.' };

    let parsed: any;
    try {
      parsed = extractJsonObject(content, (o) => (input.kind === 'journal' ? isRealDiary(clip(o?.entry, 400)) : Array.isArray(o?.lines)));
    } catch {
      throw { status: 502, message: `Muse Spark reply was not usable JSON (${content.length} chars): ${clip(content, 200)}` };
    }
    const out = parseVoiceOutput(input.kind, parsed);
    if (!out.entry && !(out.lines && out.lines.length)) {
      throw { status: 502, message: 'Meta Muse Spark Open returned no usable text.' };
    }
    return out;
  } catch (err: any) {
    if (err.name === 'AbortError') throw { status: 504, message: 'Voice request timed out.' };
    if (err.status) throw err;
    throw { status: 500, message: err.message || 'Voice request failed on Baseten.' };
  } finally {
    clearTimeout(timeoutId);
  }
}
