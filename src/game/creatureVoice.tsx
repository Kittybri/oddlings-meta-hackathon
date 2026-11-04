/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Creature diaries and photo-based speech.
 * Meta Muse Spark writes diary entries and speech lines from each creature's source
 * object. Anything not returned by the live model is labelled as a local note.
 */

export type DiaryEventType = 'hatch' | 'fuse' | 'pet' | 'feed' | 'play' | 'nap' | 'ability' | 'move' | 'heart' | 'gift';
import { RainStance, stanceFor } from './weatherTalk';

export type SpeechTopic = 'water' | 'flower' | 'shelter' | 'light' | 'pet' | 'sleep' | 'idle' | 'rain';

export const SPEECH_TOPICS: SpeechTopic[] = ['water', 'flower', 'shelter', 'light', 'pet', 'sleep', 'idle', 'rain'];
export const SPEECH_POOL_VERSION = 2; // 2 added the rain topic, so older saved pools are refreshed
export const DIARY_MAX_CHARS = 140;
export const SPEECH_MAX_CHARS = 60;
export const DIARY_MAX_ENTRIES = 20;
export const MODEL_MIN_GAP_MS = 60_000;
export const ROUTINE_MIN_GAP_MS = 120_000;
export const GIFT_DEDUPE_MS = 5_000;
export const SPEECH_POOL_TTL_MS = 30 * 60_000;
export const SPEECH_RETRY_MS = 90_000;

export const MIN_DIARY_CHARS = 24;
export const MIN_SPEECH_CHARS = 4;
const PLACEHOLDERS = new Set(['text', '...', '…', 'entry', 'line']);

export const DIARY_KEY = 'oddlings_diary_v1';
export const POOL_KEY = 'oddlings_voice_pool_v1';
export const MODEL_NAME = 'meta-models/muse-spark-open-1026';

export interface DiaryEntry {
  id: string;
  at: number;
  event: DiaryEventType;
  text: string;
  source: 'muse-spark' | 'local';
  model?: string;
}

export interface VoiceCreature {
  id: string;
  name: string;
  objectName: string;
  category?: string;
  material?: string;
  temperament?: string;
  ability?: string;
  traits: string[];
  rainStance?: RainStance;
}

export interface VoiceContext {
  biome?: string;
  phase?: 'day' | 'sunset' | 'night' | 'dawn';
}

export interface SpeechLine { topic: SpeechTopic; text: string }
interface SpeechPool { lines: SpeechLine[]; at: number; phase: string; source: 'muse-spark'; version?: number }

export interface VoiceRequest {
  kind: 'journal' | 'speech';
  creature: VoiceCreature;
  event?: DiaryEventType;
  eventNote?: string;
  context: VoiceContext;
}

export interface VoiceResponse {
  success: boolean;
  entry?: string;
  lines?: SpeechLine[];
  provenance?: { provider: 'baseten'; model: string; isLive: boolean; timestamp: number };
}

export type VoiceFetcher = (req: VoiceRequest) => Promise<VoiceResponse>;

/* ------------------------------ helpers ------------------------------ */

const clip = (s: unknown, max: number): string =>
  typeof s === 'string' ? s.replace(/[\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';

export function cleanLine(raw: unknown, max: number): string {
  let t = clip(raw, max * 3).replace(/^["'`\s]+|["'`\s]+$/g, '').replace(/[<>{}\[\]]/g, '');
  if (t.length > max) {
    const cut = t.slice(0, max);
    const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
    t = stop > max * 0.5 ? cut.slice(0, stop + 1) : cut.replace(/\s+\S*$/, '').replace(/[,;:\-]+$/, '') + '…';
  }
  return t;
}

/** False for empty, too-short or echoed-placeholder model output. */
export function isRealText(s: string, min: number): boolean {
  return s.length >= min && !PLACEHOLDERS.has(s.toLowerCase());
}

/** A diary entry must say something after "Dear diary," and not just trail off. */
export function isRealDiary(s: string): boolean {
  const body = s.replace(/^dear diary,?\s*/i, '').replace(/[.…\s]+$/, '');
  return isRealText(s, MIN_DIARY_CHARS) && body.length >= 10;
}

export function toVoiceCreature(c: any): VoiceCreature {
  return {
    id: String(c?.id ?? ''),
    name: clip(c?.name, 40) || 'Oddling',
    objectName: clip(c?.sourceObject?.name, 40) || 'mystery thing',
    category: clip(c?.sourceObject?.category, 30) || undefined,
    material: clip(c?.sourceObject?.material, 30) || undefined,
    temperament: clip(c?.temperament, 30) || undefined,
    ability: clip(c?.specialAbility?.name, 40) || undefined,
    traits: Array.isArray(c?.lineage?.inheritedTraits)
      ? c.lineage.inheritedTraits.slice(0, 3).map((t: unknown) => clip(t, 80)).filter(Boolean)
      : [],
    rainStance: stanceFor(String(c?.id ?? ''))
  };
}

export function phaseFromClock(now: number, epoch: number, dayMs = 20 * 60 * 1000): NonNullable<VoiceContext['phase']> {
  const t = (((now - epoch) % dayMs) + dayMs) % dayMs / dayMs;
  if (t < 0.5) return 'day';
  if (t < 0.68) return 'sunset';
  if (t < 0.92) return 'night';
  return 'dawn';
}

/** Map a stored memory to a diary event, or null when it is not diary-worthy. */
export function eventFromMemory(m: { type?: string; text?: string }): DiaryEventType | null {
  const text = m?.text || '';
  if (/relocated|moved/i.test(text)) return 'move';
  if (m?.type === 'feed' && /^Gift (loved|liked|neutral|disliked):/i.test(text)) return 'gift';
  if (m?.type === 'awaken') return 'hatch';
  if (m?.type === 'fuse') return 'fuse';
  if (m?.type === 'play' && /\bused\b/i.test(text)) return 'ability';
  if (m?.type === 'pet' || m?.type === 'feed' || m?.type === 'play' || m?.type === 'nap') return m.type;
  return null;
}

const ROUTINE: DiaryEventType[] = ['pet', 'feed', 'play', 'nap'];

/* ------------------------- local fallback text ------------------------ */

export function localDiaryText(c: VoiceCreature, event: DiaryEventType, ctx: VoiceContext = {}, note?: string): string {
  const o = c.objectName.toLowerCase();
  const night = ctx.phase === 'night';
  const hearts = note?.match(/(\d+) hearts?/)?.[1];
  const gift = note?.match(/^Gift (loved|liked|neutral|disliked): ([^.]+)/i);
  const giftTaste = gift?.[1].toLowerCase();
  const giftName = gift?.[2] ?? 'a treat';
  const lines: Record<DiaryEventType, string> = {
    hatch: `Dear diary, I hatched today! Yesterday I was a ${o}. Now I have feet!`,
    fuse: `Dear diary, I got fused with a friend. My ${o} bits feel extra fancy.`,
    pet: `Dear diary, someone petted me. My ${o} heart went doki-doki.`,
    feed: `Dear diary, snack time! Best day for a ${o} like me.`,
    play: `Dear diary, I played all day. Still a very good ${o}.`,
    nap: night ? `Dear diary, night nap. Dreamed I was a ${o} again.` : `Dear diary, nap time. Zzz. Dreamed of being a ${o}.`,
    ability: `Dear diary, I used ${c.ability || 'my power'} today! Everyone clapped. Probably.`,
    move: `Dear diary, I moved to a new place${ctx.biome ? ` called ${ctx.biome}` : ''}. Sniff sniff. New smells!`,
    heart: hearts
      ? `Dear diary, we reached ${hearts} hearts! My ${o} heart is so full.`
      : `Dear diary, my ${o} heart grew bigger today. We are friends!`,
    gift:
      giftTaste === 'disliked'
        ? `Dear diary, I got ${giftName}. Yuck! Not my taste at all.`
        : giftTaste === 'loved'
          ? `Dear diary, I got ${giftName}! My favorite! My ${o} heart is full.`
          : `Dear diary, someone gave me ${giftName}. Thank you!`
  };
  return cleanLine(lines[event], DIARY_MAX_CHARS);
}

/* ------------------------------- storage ------------------------------ */

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
function safeStorage(): StorageLike | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
    if (typeof localStorage !== 'undefined') return localStorage;
    return null;
  } catch {
    return null;
  }
}

function readJson<T>(key: string, fallback: T, store: StorageLike | null): T {
  try {
    const raw = store?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key: string, value: unknown, store: StorageLike | null) {
  try {
    store?.setItem(key, JSON.stringify(value));
  } catch {
    /* quota or privacy mode: the diary just won't persist */
  }
}

/* ------------------------------ the engine ----------------------------- */

export interface VoiceDeps {
  fetcher?: VoiceFetcher;
  store?: StorageLike | null;
  now?: () => number;
}

export class CreatureVoice {
  private diaries: Record<string, DiaryEntry[]>;
  private pools: Record<string, SpeechPool>;
  private lastModelCall: Record<string, number> = {};
  private lastRoutine: Record<string, number> = {};
  private lastGift: Record<string, { note: string; at: number }> = {};
  private poolInFlight = new Set<string>();
  private poolRetryAt: Record<string, number> = {};
  private roster: Record<string, VoiceCreature> = {};
  private listeners = new Set<() => void>();
  private fetcher: VoiceFetcher;
  private store: StorageLike | null;
  private now: () => number;
  private seq = 0;

  constructor(deps: VoiceDeps = {}) {
    this.store = deps.store === undefined ? safeStorage() : deps.store;
    this.now = deps.now || Date.now;
    this.fetcher = deps.fetcher || defaultFetcher;
    this.diaries = readJson(DIARY_KEY, {}, this.store);
    this.pools = readJson(POOL_KEY, {}, this.store);
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit() {
    this.listeners.forEach((fn) => fn());
  }

  setRoster(creatures: any[]) {
    const next: Record<string, VoiceCreature> = {};
    for (const c of creatures || []) if (c?.id) next[c.id] = toVoiceCreature(c);
    this.roster = next;
  }

  getDiary(creatureId: string): DiaryEntry[] {
    return this.diaries[creatureId] || [];
  }

  /**
   * Reloads diaries and transient pools from storage, resets transient throttling,
   * and notifies all subscribers so UI stays in sync on restore and undo.
   */
  reloadFromStorage(): void {
    if (!this.store) {
      this.store = safeStorage();
    }
    this.diaries = readJson(DIARY_KEY, {}, this.store);
    this.pools = readJson(POOL_KEY, {}, this.store);
    this.lastModelCall = {};
    this.lastRoutine = {};
    this.lastGift = {};
    this.poolInFlight.clear();
    this.poolRetryAt = {};
    this.baselineDone = false;
    this.seenMemories.clear();
    this.emit();
  }

  /** Writes a local note at once, then upgrades it with Muse Spark when allowed. */
  async recordEvent(creature: VoiceCreature, event: DiaryEventType, ctx: VoiceContext = {}, eventNote?: string): Promise<DiaryEntry | null> {
    const t = this.now();
    const key = creature.id;

    if (ROUTINE.includes(event)) {
      const last = this.lastRoutine[key] || 0;
      if (t - last < ROUTINE_MIN_GAP_MS) return null;
      this.lastRoutine[key] = t;
    }

    // The habitat can report one eaten treat twice in the same moment.
    if (event === 'gift') {
      const last = this.lastGift[key];
      if (last && last.note === (eventNote || '') && t - last.at < GIFT_DEDUPE_MS) return null;
      this.lastGift[key] = { note: eventNote || '', at: t };
    }

    const entry: DiaryEntry = {
      id: `${key}_${t}_${this.seq++}`,
      at: t,
      event,
      text: localDiaryText(creature, event, ctx, eventNote),
      source: 'local'
    };
    this.diaries[key] = [entry, ...(this.diaries[key] || [])].slice(0, DIARY_MAX_ENTRIES);
    this.persist();
    this.emit();

    // Routine care, gifts and milestones get separate slots, so a pet never blocks a heart-up entry.
    const slot = `${key}:${ROUTINE.includes(event) ? 'routine' : event === 'gift' ? 'gift' : 'milestone'}`;
    const lastCall = this.lastModelCall[slot] || 0;
    if (t - lastCall < MODEL_MIN_GAP_MS) return entry;
    this.lastModelCall[slot] = t;

    try {
      const res = await this.fetcher({ kind: 'journal', creature, event, eventNote: clip(eventNote, 120) || undefined, context: ctx });
      const text = cleanLine(res?.entry, DIARY_MAX_CHARS);
      if (res?.success && isRealDiary(text) && res.provenance?.isLive) {
        const list = this.diaries[key] || [];
        const idx = list.findIndex((e) => e.id === entry.id);
        if (idx >= 0) {
          list[idx] = { ...list[idx], text, source: 'muse-spark', model: res.provenance.model || MODEL_NAME };
          this.diaries[key] = list;
          this.persist();
          this.emit();
          return list[idx];
        }
      }
    } catch {
      /* stays a local note */
    }
    return entry;
  }

  /** Records a confirmed factual keepsake directly without live model request. */
  addConfirmedKeepsake(creatureId: string, text: string, event: DiaryEventType = 'ability'): DiaryEntry {
    const t = this.now();
    const entry: DiaryEntry = {
      id: `${creatureId}_${t}_${this.seq++}`,
      at: t,
      event,
      text: cleanLine(text, DIARY_MAX_CHARS),
      source: 'local'
    };
    this.diaries[creatureId] = [entry, ...(this.diaries[creatureId] || [])].slice(0, DIARY_MAX_ENTRIES);
    this.persist();
    this.emit();
    return entry;
  }

  /** Called with the latest creatures; records an entry for each memory not seen before. */
  observeCreatures(creatures: any[], ctx: VoiceContext = {}): void {
    const baseline = !this.baselineDone;
    for (const c of creatures || []) {
      if (!c?.id || !Array.isArray(c.memories)) continue;
      const seen = this.seenMemories.get(c.id) || new Set<number>();
      const fresh = c.memories.filter((m: any) => !seen.has(m.timestamp));
      for (const m of c.memories) seen.add(m.timestamp);
      this.seenMemories.set(c.id, seen);
      // First pass only records what already exists, so a reload does not flood the diary.
      if (baseline) continue;
      for (const m of [...fresh].reverse()) {
        const ev = eventFromMemory(m);
        if (ev) void this.recordEvent(toVoiceCreature(c), ev, ctx, m.text);
      }
    }
    this.baselineDone = true;
  }
  private baselineDone = false;
  private seenMemories = new Map<string, Set<number>>();

  /* ------------------------------- speech ------------------------------ */

  /**
   * Returns a photo-based line for a topic, or the fallback while no model pool exists.
   * Triggers a background refill when the pool is missing, stale or from another phase.
   */
  photoLine(creatureId: string, topic: SpeechTopic, fallback: string, ctx: VoiceContext = {}): string {
    const creature = this.roster[creatureId];
    if (!creature) return fallback;
    const t = this.now();
    const pool = this.pools[creatureId];
    const stale = !pool || pool.version !== SPEECH_POOL_VERSION || t - pool.at > SPEECH_POOL_TTL_MS || pool.phase !== (ctx.phase || '');
    if (stale) void this.refillPool(creature, ctx);
    const matches = pool?.lines.filter((l) => l.topic === topic) || [];
    if (!matches.length) return fallback;
    return matches[Math.floor(Math.random() * matches.length)].text;
  }

  async refillPool(creature: VoiceCreature, ctx: VoiceContext = {}): Promise<boolean> {
    const key = creature.id;
    const t = this.now();
    if (this.poolInFlight.has(key) || t < (this.poolRetryAt[key] || 0)) return false;
    this.poolInFlight.add(key);
    this.poolRetryAt[key] = t + SPEECH_RETRY_MS;
    try {
      const res = await this.fetcher({ kind: 'speech', creature, context: ctx });
      const lines = sanitizeSpeechLines(res?.lines);
      if (res?.success && res.provenance?.isLive && lines.length) {
        this.pools[key] = { lines, at: this.now(), phase: ctx.phase || '', source: 'muse-spark', version: SPEECH_POOL_VERSION };
        this.poolRetryAt[key] = 0;
        writeJson(POOL_KEY, this.pools, this.store);
        return true;
      }
    } catch {
      /* keep fallback lines */
    } finally {
      this.poolInFlight.delete(key);
    }
    return false;
  }

  private persist() {
    writeJson(DIARY_KEY, this.diaries, this.store);
  }
}

export function sanitizeSpeechLines(raw: unknown): SpeechLine[] {
  if (!Array.isArray(raw)) return [];
  const out: SpeechLine[] = [];
  const perTopic: Record<string, number> = {};
  for (const item of raw) {
    const topic = (item as any)?.topic as SpeechTopic;
    if (!SPEECH_TOPICS.includes(topic)) continue;
    const text = cleanLine((item as any)?.text, SPEECH_MAX_CHARS);
    if (!isRealText(text, MIN_SPEECH_CHARS)) continue;
    perTopic[topic] = (perTopic[topic] || 0) + 1;
    if (perTopic[topic] > 3) continue;
    out.push({ topic, text });
  }
  return out.slice(0, 24);
}

const defaultFetcher: VoiceFetcher = async (req) => {
  const res = await fetch('/api/baseten/voice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req)
  });
  const text = await res.text();
  if (text.trim().startsWith('<')) throw new Error('Backend unavailable in this runtime.');
  const data = JSON.parse(text);
  if (!res.ok) throw new Error(data?.error || `Voice request failed (HTTP ${res.status})`);
  return data as VoiceResponse;
};

/** Shared instance used by the game UI. */
export const creatureVoice = new CreatureVoice();
