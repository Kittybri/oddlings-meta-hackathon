import { sharedConfigured, reserveShared, redisCommand, sharedJobKey } from './sharedAiStore';
import { randomUUID } from 'node:crypto';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Meta Muse Spark Open (via Baseten) reviews a creature sprite that was traced from
 * the player's photo: it fixes each color to the object's true color, flags traced
 * parts that are really hand or background, and picks where the cute face goes.
 */

import { BASETEN_CHAT_ENDPOINT, META_MUSE_SPARK_MODEL, checkRateLimit } from './basetenService';
import { extractJsonObject } from './voiceService';
import { normalizeImageUrl } from './itemService';

// One process owns the persisted daily reservations and active model work.
// Cloud Run must run a single instance for this file-backed ceiling to be global.
import fs from 'node:fs';
import path from 'node:path';
import { AsyncLocalStorage } from 'node:async_hooks';

export const AI_BUSY_MESSAGE = 'Our Oddlings are busy. Please try again later.';
export const LOST_JOB_MESSAGE = 'This request was interrupted or expired. Please try again; any reserved game currency will be returned.';
export interface AiUsage { day: string; image: number; text: number; reservedCents: number }
export class AiUsageGate {
  active = 0;
  constructor(private read: () => AiUsage | null, private write: (usage: AiUsage) => void,
    private clock = Date.now, private dailyCents = 500, private concurrency = 4) {}
  reserve(kind: 'image' | 'text'): () => void {
    const day = new Date(this.clock()).toISOString().slice(0, 10);
    const stored = this.read();
    const usage = stored?.day === day ? { ...stored } : { day, image: 0, text: 0, reservedCents: 0 };
    // Conservative configurable reservation, not a provider billing measurement.
    const cents = kind === 'image' ? 10 : 5;
    if (this.active >= this.concurrency || usage.reservedCents + cents > this.dailyCents || usage[kind] >= (kind === 'image' ? 100 : 500)) {
      throw Object.assign(new Error(AI_BUSY_MESSAGE), { status: 429 });
    }
    usage[kind]++; usage.reservedCents += cents;
    try { this.write(usage); } catch { throw Object.assign(new Error(AI_BUSY_MESSAGE), { status: 429 }); }
    this.active++;
    let released = false;
    return () => { if (!released) { released = true; this.active--; } };
  }
}
const usageFile = path.join(process.cwd(), 'ai-daily-usage.json');
const positive = (s: string | undefined, fallback: number) => Number.isFinite(Number(s)) && Number(s) > 0 ? Math.floor(Number(s)) : fallback;
export const aiUsageGate = new AiUsageGate(() => {
  try {
    const value = JSON.parse(fs.readFileSync(usageFile, 'utf8'));
    if (typeof value.day !== 'string' || !['image', 'text', 'reservedCents'].every(k => Number.isFinite(value[k]) && value[k] >= 0)) throw new Error('Invalid usage');
    return value;
  } catch (err: any) { if (err.code === 'ENOENT') return null; throw Object.assign(new Error(AI_BUSY_MESSAGE), { status: 429 }); }
}, usage => {
  fs.writeFileSync(usageFile + '.tmp', JSON.stringify(usage));
  fs.renameSync(usageFile + '.tmp', usageFile);
}, Date.now, positive(process.env.AI_DAILY_BUDGET_CENTS, 2000), positive(process.env.AI_MAX_CONCURRENT, 4));
export const aiRequestLease = new AsyncLocalStorage<{ release: () => void; background: boolean }>();

const LETTERS = 'abcdefgh';
const ROW = /^[a-h#.]{1,32}$/;
const HEX = /^#[0-9a-f]{6}$/i;

export interface SpriteReviewInput {
  imageUrl: string;
  rows: string[];
  palette: string[];
  objectName: string;
}

/** Validates the request: a photo, sprite rows of palette letters and the palette itself. */
export function sanitizeSpriteReview(body: any): SpriteReviewInput | null {
  const imageUrl = normalizeImageUrl(body?.imageBase64);
  if (!imageUrl) return null;
  const rows = Array.isArray(body?.rows) ? body.rows : null;
  if (!rows || rows.length < 4 || rows.length > 32) return null;
  if (!rows.every((r: unknown) => typeof r === 'string' && ROW.test(r) && r.length === rows[0].length)) return null;
  const palette = Array.isArray(body?.palette) ? body.palette.filter((c: unknown) => typeof c === 'string' && HEX.test(c)) : [];
  if (!palette.length || palette.length > LETTERS.length) return null;
  const objectName = typeof body?.objectName === 'string' ? body.objectName.replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, 60) : '';
  return { imageUrl, rows, palette, objectName };
}

const area = (frac: number, words: [string, string, string]) => (frac < 0.34 ? words[0] : frac < 0.67 ? words[1] : words[2]);

/** One line per palette color: how much of the sprite it covers and where it sits. */
export function describeColors(input: SpriteReviewInput): string[] {
  const w = input.rows[0].length;
  const h = input.rows.length;
  let filled = 0;
  for (const row of input.rows) for (const ch of row) if (/[a-h]/.test(ch)) filled++;
  return input.palette.map((hex, i) => {
    const letter = LETTERS[i];
    let n = 0, sx = 0, sy = 0, top = h, bottom = -1;
    input.rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        if (row[x] !== letter) continue;
        n++;
        sx += x;
        sy += y;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    });
    if (!n) return letter + ' ' + hex + ': unused';
    const where = area((sy / n + 0.5) / h, ['top', 'middle', 'bottom']) + ' ' + area((sx / n + 0.5) / w, ['left', 'center', 'right']);
    return letter + ' ' + hex + ': ' + Math.round((100 * n) / Math.max(1, filled)) + '% of the sprite, ' + where + ', rows ' + top + '-' + bottom;
  });
}

export function buildSpritePrompt(input: SpriteReviewInput): string {
  return [
    'You are Muse Spark, the pixel-art director of the cute 8-bit game ODDLINGS.',
    'The photo shows a real object' + (input.objectName ? ' (a ' + input.objectName + ')' : '') + '.',
    'A ' + input.rows[0].length + ' wide, ' + input.rows.length + ' tall pixel sprite (row 0 at the top) was traced from it with these colors:',
    describeColors(input).join('\n'),
    '',
    'Answer quickly. Respond with ONLY a raw JSON object with these keys:',
    '- "colors": an object mapping each letter to the true color of that part of the object as a hex color like #aabbcc.',
    '  Use clean, slightly brighter game colors. Correct colors the camera made muddy or tinted. Keep dark parts dark.',
    '- "face_row": the sprite row where a cute face (eyes and smile) should go: on the front of the main body,',
    '  below any hat, hair or lid, and not on a logo.'
  ].join('\n');
}

/** Keeps only well-formed parts of Muse Spark's reply. */
export function parseSpriteReview(parsed: any, input: SpriteReviewInput): { colors: Record<string, string>; remove: string[]; face?: { x: number; y: number } } | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const used = LETTERS.slice(0, input.palette.length);
  const colors: Record<string, string> = {};
  if (parsed.colors && typeof parsed.colors === 'object') {
    for (const [k, v] of Object.entries(parsed.colors)) {
      const letter = String(k).trim().toLowerCase();
      if (used.includes(letter) && letter.length === 1 && typeof v === 'string' && HEX.test(v.trim())) colors[letter] = v.trim().toLowerCase();
    }
  }
  const remove = Array.isArray(parsed.remove)
    ? [...new Set(parsed.remove.map((l: unknown) => String(l).trim().toLowerCase()).filter((l: string) => l.length === 1 && used.includes(l)))] as string[]
    : [];
  // The face goes on the chosen row, on the body cell nearest the middle of the body
  let face: { x: number; y: number } | undefined;
  const y = Math.round(Number(parsed.face_row ?? parsed.face?.y));
  if (Number.isFinite(y) && y >= 0 && y < input.rows.length) {
    const cells = [...input.rows[y]].map((ch, x) => (/[a-h]/.test(ch) ? x : -1)).filter((x) => x >= 0);
    if (cells.length) {
      const mid = (cells[0] + cells[cells.length - 1]) / 2;
      const x = cells.reduce((a, b) => (Math.abs(b - mid) < Math.abs(a - mid) ? b : a));
      face = { x, y };
    }
  }
  if (!Object.keys(colors).length && !remove.length && !face) return null;
  return { colors, remove, face };
}

// Model calls run as background jobs that the client checks on, because the hosting
// proxy cuts off requests that wait longer than about ten seconds.
type SpriteReview = NonNullable<ReturnType<typeof parseSpriteReview>>;
export interface Job<T> {
  status: 'pending' | 'done' | 'error';
  result?: T;
  error?: string;
  at: number;
}
const JOB_TTL_MS = 10 * 60 * 1000;
const MAX_JOBS = 100;
const jobs = new Map<string, Job<unknown>>();

export function startJob<T>(run: () => Promise<T>): string {
  const now = Date.now();
  for (const [id, job] of jobs) if (now - job.at > JOB_TTL_MS || jobs.size > MAX_JOBS) jobs.delete(id);
  const id = now.toString(36) + Math.random().toString(36).slice(2, 10);
  const job: Job<T> = { status: 'pending', at: now };
  jobs.set(id, job);
  const lease = aiRequestLease.getStore();
  if (lease) lease.background = true;
  Promise.resolve().then(run).then(
    (result) => {
      job.status = 'done';
      job.result = result;
    },
    (err: any) => {
      job.status = 'error';
      job.error = err?.message || 'Request failed.';
    }
  ).finally(() => lease?.release());
  return id;
}

export function getJob(id: string): Job<unknown> {
  const job = jobs.get(id);
  if (!job || Date.now() - job.at > JOB_TTL_MS) {
    jobs.delete(id);
    return { status: 'error', error: LOST_JOB_MESSAGE, at: Date.now() };
  }
  return job;
}

export function startSpriteReview(input: SpriteReviewInput, run: (input: SpriteReviewInput) => Promise<SpriteReview> = reviewSpriteWithMuseSpark): string {
  return startJob(() => run(input));
}

export async function reviewSpriteWithMuseSpark(input: SpriteReviewInput): Promise<SpriteReview> {
  const apiKey = process.env.BASETEN_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw { status: 503, message: 'BASETEN_API_KEY is not configured in server environment.' };
  }
  const { allowed, retryAfter } = checkRateLimit();
  if (!allowed) throw { status: 429, message: 'Rate limit exceeded. Please wait ' + retryAfter + ' seconds.' };

  const payload = {
    model: META_MUSE_SPARK_MODEL,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: buildSpritePrompt(input) },
          { type: 'image_url', image_url: { url: input.imageUrl } }
        ]
      }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 9000 // Muse Spark thinks before it answers; a low cap cuts the JSON off
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);
  try {
    const res = await fetch(BASETEN_CHAT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    if (!res.ok) {
      const errText = await res.text();
      if (res.status === 401) throw { status: 401, message: 'Invalid or expired BASETEN_API_KEY.' };
      if (res.status === 402) throw { status: 402, message: 'Baseten account payment required or insufficient credits.' };
      if (res.status === 429) throw { status: 429, message: 'Baseten rate limit reached.' };
      throw { status: res.status, message: 'Baseten error: ' + errText.slice(0, 120) };
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
      parsed = extractJsonObject(content, (o) => parseSpriteReview(o, input) !== null);
    } catch {
      throw { status: 502, message: 'Muse Spark reply was not usable JSON (' + content.length + ' chars, ends: ' + content.slice(-160) + ').' };
    }
    const review = parseSpriteReview(parsed, input);
    if (!review) throw { status: 502, message: 'Meta Muse Spark Open returned no usable sprite review.' };
    return review;
  } catch (err: any) {
    if (err.name === 'AbortError') throw { status: 504, message: 'Sprite review timed out.' };
    if (err.status) throw err;
    throw { status: 500, message: err.message || 'Sprite review failed on Baseten.' };
  } finally {
    clearTimeout(timeoutId);
  }
}

// ---- Muse Image: the creature's art, drawn from the player's photo ----------------

export const META_IMAGE_EDITS_ENDPOINT = 'https://api.meta.ai/v1/images/edits';
export const MUSE_IMAGE_MODEL = 'muse-image-1.0';

/** The Meta Model API key, under either name the docs and this app use. */
export function metaModelApiKey(): string {
  return (process.env.META_API_KEY || process.env.MODEL_API_KEY || '').trim();
}

/** One house style for every creature, so the whole collection looks like one game. */
export function buildCreatureArtPrompt(objectName: string, colors: string[] = []): string {
  const name = objectName.replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, 60);
  // The photo's main colors, measured from its pixels, keep the drawing from drifting to other hues
  const palette = colors.filter((c) => /^#[0-9a-f]{6}$/i.test(c)).slice(0, 8);
  return [
    'Redraw the main object in this photo' + (name ? ' (a ' + name + ')' : '') + ' as one cute creature for a cozy 8-bit pixel-art game.',
    'Keep the real object\'s shape, colors and recognizable details, so it is clearly the same thing.',
    'Use the photo\'s own colors for every part (skin, hair, fabric, paint, metal). Do not tint it or invent new colors.',
    ...(palette.length ? ['The object\'s main colors, from the photo, are: ' + palette.join(', ') + '. Use these colors.'] : []),
    'Keep its hair, hat, clothes and accessories as they are in the photo.',
    'Do not draw any eyes, mouth or face, even if the object has one (a doll, plush or figure): leave the front plain, because the game adds its own eyes.',
    'Give it two little feet.',
    'Style: chunky pixel art that looks like a 32x32 sprite scaled up, thick dark outline, 6 to 8 flat colors, no gradients, no anti-aliasing.',
    'Show the whole creature, front view, centered, filling about 70% of the image.',
    'Leave out any hands, people, table or room. Plain solid white background, no shadow, no text.'
  ].join('\n');
}

/** Photo items: the object redrawn as a placeable pixel-art game prop (no face, no feet), same chunky style as the World. */
export function buildItemArtPrompt(objectName: string, colors: string[] = []): string {
  const name = objectName.replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, 60);
  const palette = colors.filter((c) => /^#[0-9a-f]{6}$/i.test(c)).slice(0, 8);
  return [
    'Redraw the main object in this photo' + (name ? ' (a ' + name + ')' : '') + ' as one placeable item for a cozy 16-bit pixel-art game world.',
    'Keep the real object\'s shape, colors, markings and recognizable details (prints, logos as simple shapes, accessories), so it is clearly the same thing.',
    'Use the photo\'s own colors. Do not tint it or invent new colors.',
    ...(palette.length ? ['The object\'s main colors, from the photo, are: ' + palette.join(', ') + '.'] : []),
    'It is an object, not a creature: do not add arms or feet, and do not add a face to things that have none.',
    'If the object has its own face (a doll, plush, figure or printed character), draw that face clearly: its eyes, eyebrows, mouth, blush and glasses or goggles exactly as in the photo, large enough to read at small size.',
    'Keep every marking that makes it recognizable: prints, patterns, stitching, badges, buttons, straps and accessories.',
    'Style: chunky pixel art like a 32x32 game sprite scaled up, thick dark outline, 6 to 10 flat colors, no gradients, no anti-aliasing.',
    'Show the whole object standing upright, front or three-quarter view, centered, filling about 75% of the image.',
    'Leave out hands, people, table and room. Plain solid white background, no shadow, no text.'
  ].join('\n');
}

/** Fusion: Muse Image sees both parent creatures and draws the one hybrid they make together, in the same house style. */
export function buildFusionArtPrompt(nameA: string, nameB: string, hybridName: string, traits: string[] = []): string {
  const clean = (s: string) => s.replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, 60);
  const kept = traits.map(clean).filter(Boolean).slice(0, 4);
  return [
    'The two images are two cute pixel-art creatures: the first is ' + clean(nameA) + ', the second is ' + clean(nameB) + '.',
    'Draw ONE new creature' + (hybridName ? ' called ' + clean(hybridName) : '') + ' that is a fusion of both: mix their body shapes, parts and colors so a player can see which features came from each parent.',
    'Take the main body shape from one parent and clear signature parts (handle, stem, leaves, spines, shade, laces, etc.) from the other.',
    ...(kept.length ? ['It inherits: ' + kept.join('; ') + '.'] : []),
    'Do not draw any eyes, mouth or face: leave the front plain, because the game adds its own eyes.',
    'Give it two little feet.',
    'Style: chunky pixel art that looks like a 32x32 sprite scaled up, thick dark outline, 6 to 10 flat colors, no gradients, no anti-aliasing.',
    'Show only the one fused creature, front view, centered, filling about 70% of the image. Plain solid white background, no shadow, no text.'
  ].join('\n');
}

/** House style for biome backdrops: the photo's scene redrawn as a side-view pixel game background. */
export function buildBiomeArtPrompt(biomeName: string): string {
  const name = biomeName.replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, 60);
  return [
    'Redraw this photo as a wide side-view background for a cozy 16-bit pixel-art game' + (name ? ' (a place called ' + name + ')' : '') + '.',
    'Keep the same place, its layout, landmarks and main colors so it is clearly the same scene, but simplify it into calm game scenery.',
    'Style: chunky pixel art like a scaled-up 320x180 game background, limited palette of about 16 colors, soft daylight, no anti-aliasing, no gradients.',
    'Remove people, faces, text, logos and screens. No characters, no user interface, no borders.',
    'Keep the bottom third simple and fairly flat, because game ground and platforms are built over it.'
  ].join('\n');
}

/** Pulls the first image out of an images endpoint reply as a data URL. */
export function parseCreatureArt(json: any): string | null {
  const item = Array.isArray(json?.data) ? json.data[0] : null;
  const b64 = typeof item?.b64_json === 'string' ? item.b64_json.trim() : '';
  if (!b64 || !/^[A-Za-z0-9+/=\s]+$/.test(b64)) return null;
  const format = json?.output_format === 'png' || json?.output_format === 'jpeg' ? json.output_format : 'webp';
  return 'data:image/' + format + ';base64,' + b64.replace(/\s+/g, '');
}

export async function drawCreatureWithMuseImage(params: { imageUrl: string; objectName: string; colors?: string[]; prompt?: string; extraImageUrls?: string[] }): Promise<{ image: string }> {
  const apiKey = metaModelApiKey();
  if (!apiKey) throw { status: 503, message: 'META_API_KEY is not configured in server environment.' };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90000);
  try {
    const res = await fetch(META_IMAGE_EDITS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
      body: JSON.stringify({
        model: MUSE_IMAGE_MODEL,
        prompt: params.prompt || buildCreatureArtPrompt(params.objectName, params.colors),
        images: [params.imageUrl, ...(params.extraImageUrls || [])].map((image_url) => ({ image_url })),
        n: 1,
        size: '1024x1024',
        response_format: 'b64_json',
        output_format: 'png'
      }),
      signal: controller.signal
    });
    if (!res.ok) {
      const errText = await res.text();
      if (res.status === 401) throw { status: 401, message: 'Invalid or expired META_API_KEY.' };
      if (res.status === 402) throw { status: 402, message: 'Meta Model API credits are used up or billing is not set up.' };
      if (res.status === 429) throw { status: 429, message: 'Meta Model API rate limit reached.' };
      throw { status: res.status, message: 'Meta Model API error: ' + errText.slice(0, 160) };
    }
    const image = parseCreatureArt(await res.json());
    if (!image) throw { status: 502, message: 'Muse Image returned no image.' };
    return { image };
  } catch (err: any) {
    if (err.name === 'AbortError') throw { status: 504, message: 'Muse Image request timed out.' };
    if (err.status) throw err;
    throw { status: 500, message: err.message || 'Muse Image request failed.' };
  } finally {
    clearTimeout(timeoutId);
  }
}


export async function reserveAi(kind: 'image' | 'text'): Promise<() => void> {
  if (sharedConfigured()) return reserveShared(kind);
  if (process.env.NODE_ENV === 'production') throw new Error(AI_BUSY_MESSAGE);
  return aiUsageGate.reserve(kind);
}

export async function startSharedJob<T>(run: () => Promise<T>): Promise<string> {
  if (!sharedConfigured()) {
    if (process.env.NODE_ENV === 'production') throw new Error(AI_BUSY_MESSAGE);
    return startJob(run);
  }
  const id = randomUUID();
  const at = Date.now();
  await redisCommand('SET', sharedJobKey(id), JSON.stringify({ status: 'pending', at }), 'EX', 600);
  const lease = aiRequestLease.getStore();
  if (lease) lease.background = true;
  void (async () => {
    let job: Job<T>;
    try { job = { status: 'done', at, result: await run() }; }
    catch (err: any) { job = { status: 'error', at, error: err?.message || 'Request failed.' }; }
    try {
      await redisCommand('SET', sharedJobKey(id), JSON.stringify(job), 'EX', 600);
    } catch {
      // The pending record remains and expires. Never publish success before it is durable.
      console.warn('Could not persist an AI job result.');
    } finally { lease?.release(); }
  })();
  return id;
}

export async function getSharedJob(id: string): Promise<Job<unknown>> {
  if (!sharedConfigured()) {
    if (process.env.NODE_ENV === 'production') throw new Error(AI_BUSY_MESSAGE);
    return getJob(id);
  }
  const raw = await redisCommand('GET', sharedJobKey(id));
  if (!raw) return { status: 'error', at: Date.now(), error: LOST_JOB_MESSAGE };
  const job = JSON.parse(raw) as Job<unknown>;
  return Date.now() - job.at > JOB_TTL_MS
    ? { status: 'error', at: Date.now(), error: LOST_JOB_MESSAGE } : job;
}
export function startSharedSpriteReview(input: SpriteReviewInput): Promise<string> {
  return startSharedJob(() => reviewSpriteWithMuseSpark(input));
}
