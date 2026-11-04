export const SPEECH_DURATION_MS = 3000;
export const WORLD_DAY_MS = 20 * 60 * 1000;
export const WORLD_CLOCK_KEY = 'oddlings_world_clock_v1';
export interface Speech { bubbleText?: string; bubbleExpiresAt?: number; nextSpeechAt?: number }
export function createSpeech(text: string, now = Date.now()): Speech {
  return { bubbleText: text, bubbleExpiresAt: now + SPEECH_DURATION_MS, nextSpeechAt: now + SPEECH_DURATION_MS + 2000 };
}
export function speechIsVisible(speech: Speech, now = Date.now()): boolean {
  return Boolean(speech.bubbleText && typeof speech.bubbleExpiresAt === 'number' && now < speech.bubbleExpiresAt);
}
export function canSpeak(speech: Speech, now = Date.now()): boolean {
  return !speechIsVisible(speech, now) && now >= (speech.nextSpeechAt || 0);
}
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const mix = (a: number[], b: number[], t: number) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * clamp(t))).join(',')})`;
const stops = [
  { at: 0, top: [25,136,204], bottom: [173,232,242], light: 1 },
  { at: .48, top: [25,136,204], bottom: [173,232,242], light: 1 },
  { at: .60, top: [105,78,158], bottom: [255,160,100], light: .6 },
  { at: .68, top: [13,24,59], bottom: [50,65,103], light: .15 },
  { at: .90, top: [13,24,59], bottom: [50,65,103], light: .15 },
  { at: .96, top: [103,104,167], bottom: [255,188,148], light: .55 },
  { at: 1, top: [25,136,204], bottom: [173,232,242], light: 1 }
];
export function getWorldAtmosphere(elapsed: number) {
  const phase = ((elapsed % WORLD_DAY_MS) + WORLD_DAY_MS) % WORLD_DAY_MS / WORLD_DAY_MS;
  const right = stops.findIndex(s => s.at > phase);
  const a = stops[Math.max(0, right - 1)], b = stops[right === -1 ? stops.length - 1 : right];
  const t = (phase - a.at) / (b.at - a.at || 1);
  const light = a.light + (b.light - a.light) * t;
  const sunProgress = clamp(phase / .65);
  return {
    phase, light, skyTop: mix(a.top,b.top,t), skyBottom: mix(a.bottom,b.bottom,t),
    label: phase < .48 ? 'Day' : phase < .68 ? 'Sunset' : phase < .9 ? 'Night' : 'Dawn',
    sunX: 8 + sunProgress * 84,
    sunY: 72 - Math.sin(sunProgress * Math.PI) * 65,
    sunOpacity: phase < .65 ? Math.min(1, (.65 - phase) / .035) : 0,
    moonOpacity: clamp((1 - light) / .85),
    starOpacity: clamp((.6 - light) / .45)
  };
}
export function loadWorldEpoch(now = Date.now()): number {
  try {
    const raw = localStorage.getItem(WORLD_CLOCK_KEY);
    const saved = raw ? Number(raw) : NaN;
    if (Number.isFinite(saved) && saved > 0 && saved <= now) return saved;
    localStorage.setItem(WORLD_CLOCK_KEY, String(now));
  } catch { /* World still animates if browser storage is unavailable. */ }
  return now;
}
