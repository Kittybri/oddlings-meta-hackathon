/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Live chat with a creature, written by Meta Muse Spark Open on Fireworks.
 * The creature answers in its own voice and knows its object, mood, hearts, weather and recent memories.
 */

import { normalizeImageUrl } from './itemService';

export const FIREWORKS_CHAT_ENDPOINT = 'https://api.fireworks.ai/inference/v1/chat/completions';
export const FIREWORKS_MUSE_SPARK_MODEL = 'accounts/fireworks/models/muse-spark-open';
export const CHAT_MAX_CHARS = 200;
export const CHAT_HISTORY = 8;

const RAIN_STANCES = ['loves', 'hates', 'worried', 'curious'];
const WEATHERS = ['clear', 'gathering', 'rain', 'clearing'];
const PHASES = ['day', 'sunset', 'night', 'dawn'];

const clip = (s: unknown, max: number): string =>
  typeof s === 'string' ? s.replace(/[\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';
const num = (v: unknown, lo: number, hi: number): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : undefined;

export interface ChatTurn {
  from: 'you' | 'creature';
  text: string;
}

export interface ChatInput {
  creature: {
    name: string;
    objectName: string;
    material?: string;
    temperament?: string;
    ability?: string;
    rainStance?: string;
  };
  state: {
    hearts?: number;
    energy?: number;
    mood?: string;
    biome?: string;
    phase?: string;
    weather?: string;
    memories: string[];
  };
  history: ChatTurn[];
  message: string;
}

export function sanitizeChatInput(body: any): ChatInput | null {
  const c = body?.creature || {};
  const name = clip(c.name, 40);
  const objectName = clip(c.objectName, 40);
  const message = clip(body?.message, CHAT_MAX_CHARS);
  if (!name || !objectName || !message) return null;
  const s = body?.state || {};
  const history = Array.isArray(body?.history) ? body.history : [];
  return {
    creature: {
      name,
      objectName,
      material: clip(c.material, 30) || undefined,
      temperament: clip(c.temperament, 30) || undefined,
      ability: clip(c.ability, 40) || undefined,
      rainStance: RAIN_STANCES.includes(c.rainStance) ? c.rainStance : undefined
    },
    state: {
      hearts: num(s.hearts, 0, 10),
      energy: num(s.energy, 0, 100),
      mood: clip(s.mood, 20) || undefined,
      biome: clip(s.biome, 40) || undefined,
      phase: PHASES.includes(s.phase) ? s.phase : undefined,
      weather: WEATHERS.includes(s.weather) ? s.weather : undefined,
      memories: Array.isArray(s.memories) ? s.memories.slice(0, 5).map((m: unknown) => clip(m, 100)).filter(Boolean) : []
    },
    history: history
      .slice(-CHAT_HISTORY)
      .filter((t: any) => t && (t.from === 'you' || t.from === 'creature'))
      .map((t: any) => ({ from: t.from, text: clip(t.text, CHAT_MAX_CHARS) }))
      .filter((t: ChatTurn) => t.text),
    message
  };
}

export function buildChatPrompt(input: ChatInput): string {
  const c = input.creature;
  const s = input.state;
  const facts = [
    `You are ${c.name}, a tiny 8-bit pixel pet in the game ODDLINGS, born from a photo of a real ${c.objectName}.`,
    c.material ? `Material: ${c.material}.` : '',
    c.temperament ? `Personality: ${c.temperament}.` : '',
    c.ability ? `Special ability: ${c.ability}.` : '',
    c.rainStance ? `You ${c.rainStance === 'loves' ? 'love' : c.rainStance === 'hates' ? 'hate' : c.rainStance === 'worried' ? 'worry about' : 'are curious about'} rain.` : '',
    s.hearts !== undefined ? `Friendship with the player: ${s.hearts} of 10 hearts.` : '',
    s.energy !== undefined ? `Energy: ${s.energy} of 100.` : '',
    s.mood ? `Mood right now: ${s.mood}.` : '',
    s.biome ? `You live in: ${s.biome}.` : '',
    s.phase ? `Time of day: ${s.phase}.` : '',
    s.weather ? `Weather: ${s.weather === 'gathering' ? 'clouds gathering, rain is coming' : s.weather}.` : '',
    s.memories.length ? `Recent memories: ${s.memories.join(' | ')}` : ''
  ].filter(Boolean).join('\n');
  const talk = input.history.map((t) => `${t.from === 'you' ? 'Player' : c.name}: ${t.text}`).join('\n');
  return `${facts}
Stay in character. Think like a ${c.objectName}: its shape, use and feel. Warm, playful, a little silly. More hearts means more affectionate.
No profanity, no real brands, no talk about being an AI. At most one emoji.
${talk ? `Conversation so far:\n${talk}\n` : ''}Player: ${input.message}
Reply as ${c.name} in 1 or 2 short sentences, under 160 characters.
Respond with ONLY a JSON object: {"reply": "your words"}`;
}

/** The creature's reply from the model text: a {"reply"} object, or a short plain answer. */
export function parseChatReply(content: string): string | null {
  for (let start = content.indexOf('{'); start >= 0; start = content.indexOf('{', start + 1)) {
    const end = content.indexOf('}', start);
    if (end < 0) break;
    try {
      const reply = clip(JSON.parse(content.slice(start, end + 1))?.reply, CHAT_MAX_CHARS);
      if (reply && reply.toLowerCase() !== 'your words') return reply;
    } catch {
      /* not JSON: try the next brace */
    }
  }
  const plain = clip(content.replace(/^["'\s]+|["'\s]+$/g, ''), CHAT_MAX_CHARS + 1);
  return plain && !plain.includes('{') && plain.length <= CHAT_MAX_CHARS ? plain : null;
}

/** Sends one prompt (text, or text plus a photo) to Muse Spark on Fireworks and returns the reply text. */
async function askMuseSpark(prompt: string | Array<Record<string, unknown>>): Promise<string> {
  const apiKey = (process.env.FIREWORKS_API_KEY || '').trim();
  if (!apiKey) throw { status: 503, message: 'FIREWORKS_API_KEY is not configured in server environment.' };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);
  try {
    const res = await fetch(FIREWORKS_CHAT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: FIREWORKS_MUSE_SPARK_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        max_tokens: 4000,
        reasoning_effort: 'low'
      }),
      signal: controller.signal
    });
    if (!res.ok) {
      const errText = await res.text();
      if (res.status === 401) throw { status: 401, message: 'Invalid or expired FIREWORKS_API_KEY.' };
      if (res.status === 429) throw { status: 429, message: 'Fireworks rate limit reached.' };
      throw { status: res.status, message: `Fireworks error: ${errText.slice(0, 160)}` };
    }
    const json: any = await res.json();
    const content = json.choices?.[0]?.message?.content;
    return typeof content === 'string' ? content.trim() : '';
  } catch (err: any) {
    if (err?.name === 'AbortError') throw { status: 504, message: 'Request to Muse Spark timed out.' };
    if (err?.status) throw err;
    throw { status: 500, message: err?.message || 'Request failed on Fireworks.' };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function chatWithCreature(input: ChatInput): Promise<{ reply: string }> {
  const reply = parseChatReply(await askMuseSpark(buildChatPrompt(input)));
  if (!reply) throw { status: 502, message: 'Muse Spark returned no usable reply.' };
  return { reply };
}

// ---- Naming a new creature ----

/** Muse Spark suggests one fresh name for a just-hatched creature, different from the ones already tried. */
export async function suggestCreatureName(body: any): Promise<{ name: string }> {
  const clean = (v: unknown, n: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, n) : '');
  const objectName = clean(body?.objectName, 60);
  const material = clean(body?.material, 60);
  const temperament = clean(body?.temperament, 40);
  const description = clean(body?.description, 240);
  const ability = clean(body?.ability, 80);
  const element = clean(body?.element, 40);
  const colors = clean(body?.colors, 80);
  const avoid = Array.isArray(body?.avoid) ? body.avoid.map((x: unknown) => clean(x, 24)).filter(Boolean).slice(0, 12) : [];
  if (!objectName) throw { status: 400, message: 'The creature\'s object is required.' };
  const prompt = [
    'Invent one cute, short name (1 or 2 words, at most 14 letters) for this pixel-art pet creature. The name must fit THIS creature:',
    'It was born from a ' + objectName + (material ? ' made of ' + material : '') + '.',
    ...(description ? ['What it is like: ' + description] : []),
    ...(colors ? ['Its colors: ' + colors + '.'] : []),
    ...(element ? ['Element: ' + element + '.'] : []),
    ...(ability ? ['Its special ability: ' + ability + '.'] : []),
    ...(temperament ? ['Its personality: ' + temperament + '.'] : []),
    'Blend a clear hint of the object with its look, ability or personality (a pun or a sound word is great), so a player can guess what it is from the name. Easy to say. No numbers, no emoji, no quotes.',
    ...(avoid.length ? ['Do not use any of these names: ' + avoid.join(', ') + '.'] : []),
    'Reply with the name only.'
  ].join('\n');
  const raw = String(await askMuseSpark(prompt) || '');
  const name = raw.split('\n').map((l) => l.replace(/["'*_.:!]/g, '').replace(/^name\s*/i, '').trim()).find(Boolean)?.slice(0, 24) || '';
  if (!name || !/^[\p{L}][\p{L}\s'-]*$/u.test(name)) throw { status: 502, message: 'Muse Spark returned no usable name.' };
  return { name };
}

// ---- Creatures talking to each other ----

export type Relationship = 'friends' | 'rivals' | 'neutral';
export const BANTER_LINE_CHARS = 70;

// Materials that get along, and ones that rub each other the wrong way
const FRIEND_PAIRS = [
  'Botanical+Glass', 'Ceramic+Thermal', 'Electric+Mechanical', 'Electric+Sonic', 'Botanical+Textile',
  'Crystalline+Glass', 'Chrono+Mechanical', 'Ceramic+Botanical', 'Sonic+Textile', 'Chrono+Crystalline'
];
const RIVAL_PAIRS = [
  'Glass+Thermal', 'Botanical+Thermal', 'Mechanical+Textile', 'Botanical+Electric', 'Ceramic+Mechanical',
  'Chrono+Sonic', 'Crystalline+Electric', 'Glass+Sonic'
];
const pairKey = (a: string, b: string) => [a, b].sort().join('+');

/** How two creatures feel about each other, from their materials. */
export function relationshipOf(a: string | undefined, b: string | undefined): Relationship {
  if (!a || !b) return 'neutral';
  if (a === b) return 'friends';
  const key = pairKey(a, b);
  if (FRIEND_PAIRS.includes(key)) return 'friends';
  if (RIVAL_PAIRS.includes(key)) return 'rivals';
  return 'neutral';
}

interface BanterCreature {
  name: string;
  objectName: string;
  element?: string;
  temperament?: string;
}

export interface BanterInput {
  a: BanterCreature;
  b: BanterCreature;
  relationship: Relationship;
  weather?: string;
  phase?: string;
  /** Something the two just did together, for example blooming a flower, so they talk about it */
  topic?: string;
}

export interface BanterLine {
  speaker: 'a' | 'b';
  text: string;
}

function sanitizeBanterCreature(c: any): BanterCreature | null {
  const name = clip(c?.name, 40);
  const objectName = clip(c?.objectName, 40);
  if (!name || !objectName) return null;
  return { name, objectName, element: clip(c?.element, 20) || undefined, temperament: clip(c?.temperament, 30) || undefined };
}

export function sanitizeBanterInput(body: any): BanterInput | null {
  const a = sanitizeBanterCreature(body?.a);
  const b = sanitizeBanterCreature(body?.b);
  if (!a || !b) return null;
  return {
    a,
    b,
    relationship: relationshipOf(a.element, b.element),
    weather: WEATHERS.includes(body?.weather) ? body.weather : undefined,
    phase: PHASES.includes(body?.phase) ? body.phase : undefined,
    topic: clip(body?.topic, 120) || undefined
  };
}

const MOOD_OF: Record<Relationship, string> = {
  friends: 'They are good friends: sweet, teasing, supportive.',
  rivals: 'They are playful rivals: competitive and a little grumpy, but never mean.',
  neutral: 'They are just getting to know each other: curious and polite.'
};

export function buildBanterPrompt(input: BanterInput): string {
  const who = (c: BanterCreature) =>
    `${c.name}, made from a ${c.objectName}${c.element ? ` (${c.element})` : ''}${c.temperament ? `, ${c.temperament}` : ''}`;
  return `Two tiny 8-bit pixel pets meet in the game ODDLINGS.
A: ${who(input.a)}
B: ${who(input.b)}
${MOOD_OF[input.relationship]}
${input.topic ? `They just did this together: ${input.topic}. Celebrate it and talk about how each of them helped.\n` : ''}${input.weather ? `Weather: ${input.weather}. ` : ''}${input.phase ? `Time of day: ${input.phase}.` : ''}
Write a 4-line speech-bubble exchange: A, B, A, B. Each line under 60 characters, in character, joking about what they are made of. No brands, at most one emoji per line.
Respond with ONLY a JSON object: {"lines": ["A line", "B line", "A line", "B line"]}`;
}

/** The exchange from the model text, alternating speakers starting with A. */
export function parseBanter(content: string): BanterLine[] | null {
  for (let start = content.indexOf('{'); start >= 0; start = content.indexOf('{', start + 1)) {
    let depth = 0;
    let end = -1;
    for (let i = start; i < content.length; i++) {
      if (content[i] === '{') depth++;
      else if (content[i] === '}' && --depth === 0) {
        end = i;
        break;
      }
    }
    if (end < 0) break;
    try {
      const raw = JSON.parse(content.slice(start, end + 1))?.lines;
      if (!Array.isArray(raw)) continue;
      const lines = raw
        .map((l: unknown) => clip(typeof l === 'string' ? l : (l as any)?.text, BANTER_LINE_CHARS).replace(/^[AB]:\s*/, ''))
        .filter((t: string) => t.length >= 2 && !/^[AB] line$/i.test(t))
        .slice(0, 4)
        .map((text: string, i: number) => ({ speaker: (i % 2 === 0 ? 'a' : 'b') as 'a' | 'b', text }));
      if (lines.length >= 2) return lines;
    } catch {
      /* not JSON: try the next brace */
    }
  }
  return null;
}

export async function banterBetweenCreatures(input: BanterInput): Promise<{ relationship: Relationship; lines: BanterLine[] }> {
  // The model now and then answers with something unusable, so it gets one more try
  let content = await askMuseSpark(buildBanterPrompt(input));
  let lines = parseBanter(content);
  if (!lines) {
    content = await askMuseSpark(buildBanterPrompt(input));
    lines = parseBanter(content);
  }
  if (!lines) throw { status: 502, message: `Muse Spark returned no usable exchange (${content.length} chars): ${clip(content, 200)}` };
  return { relationship: input.relationship, lines };
}

// ---- Photo quests: a creature asks for something, the player snaps it, Muse Spark checks the photo ----

export interface QuestInput {
  quest: string; // what the creature asked for, e.g. "something red"
  imageUrl: string;
  creatureName: string;
  objectName: string;
}

export interface QuestResult {
  match: boolean;
  seen: string;
  reply: string;
}

export function sanitizeQuestInput(body: any): QuestInput | null {
  const quest = clip(body?.quest, 60);
  const imageUrl = normalizeImageUrl(body?.imageBase64);
  const creatureName = clip(body?.creature?.name, 40);
  const objectName = clip(body?.creature?.objectName, 40);
  if (!quest || !imageUrl || !creatureName || !objectName) return null;
  return { quest, imageUrl, creatureName, objectName };
}

export function buildQuestPrompt(input: QuestInput): string {
  return `You judge a photo quest in the cute pixel pet game ODDLINGS.
${input.creatureName}, a pet made from a ${input.objectName}, asked the player to photograph: ${input.quest}.
Look at the photo. Does it clearly show ${input.quest}? Be fair but not too strict: the main object counts.
Respond with ONLY a JSON object:
{"match": true or false, "seen": "the main thing in the photo, 2 to 5 words", "reply": "${input.creatureName}'s reaction in under 90 characters, in character"}`;
}

export function parseQuestResult(content: string): QuestResult | null {
  for (let start = content.indexOf('{'); start >= 0; start = content.indexOf('{', start + 1)) {
    const end = content.indexOf('}', start);
    if (end < 0) break;
    try {
      const o = JSON.parse(content.slice(start, end + 1));
      const match = o?.match === true || o?.match === 'true';
      const seen = clip(o?.seen, 40);
      const reply = clip(o?.reply, 120);
      if ((o?.match === true || o?.match === false || typeof o?.match === 'string') && reply) return { match, seen, reply };
    } catch {
      /* not JSON: try the next brace */
    }
  }
  return null;
}

export async function checkQuestPhoto(input: QuestInput): Promise<QuestResult> {
  const content = await askMuseSpark([
    { type: 'text', text: buildQuestPrompt(input) },
    { type: 'image_url', image_url: { url: input.imageUrl } }
  ]);
  const result = parseQuestResult(content);
  if (!result) throw { status: 502, message: 'Muse Spark could not judge the photo. Try again!' };
  return result;
}
