/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * World weather. A storm gathers (sky greys, clouds thicken), rains, then clears.
 * The schedule is a pure function of the World clock, so it survives reloads.
 */

export type WeatherState = 'clear' | 'gathering' | 'rain' | 'windy' | 'clearing';

export interface Weather {
  state: WeatherState;
  cloud: number; // 0 clear sky .. 1 fully overcast
  rain: number; // 0 .. 1 rain intensity
  wind?: number; // 0 .. 1 sustained wind strength
  msUntilRain: number | null; // set while gathering
}

export interface StormSpec {
  gatherMs: number;
  rainMs: number;
  clearMs: number;
  windMs?: number;
}

export type WeatherOverride = { kind: 'storm'; startedAt: number } | { kind: 'wind'; startedAt: number } | { kind: 'clear'; until: number } | null;

export const WIND_PHASE_MS = 60_000;
export const MANUAL_WIND_MS = 90_000;
export const WEATHER_WINDOW_MS = 9 * 60_000;
export const RAIN_RAMP_IN_MS = 8_000;
export const RAIN_RAMP_OUT_MS = 12_000;
export const AUTO_RAIN_CHANCE = 0.35;
export const AUTO_OVERCAST_CHANCE = 0.2;
export const AUTO_GATHER_MS = 75_000;
export const AUTO_CLEAR_MS = 45_000;
/** The storm you trigger by hand is short, so it is easy to show off. */
export const DEMO_STORM: StormSpec = { gatherMs: 25_000, rainMs: 100_000, clearMs: 20_000 };
export const MANUAL_CLEAR_MS = 5 * 60_000;

export const CLEAR_SKY: Weather = { state: 'clear', cloud: 0, rain: 0, msUntilRain: null };

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (t: number) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

/** FNV-1a, so the same window always gets the same weather. */
export function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Weather `t` ms after a storm began (negative or past the end means clear). */
export function stormProfile(t: number, spec: StormSpec): Weather {
  const { gatherMs, rainMs, clearMs } = spec;
  const rainEnd = gatherMs + rainMs;
  const windMs = spec.windMs ?? WIND_PHASE_MS;
  const windEnd = rainEnd + windMs;
  if (t < 0 || t >= windEnd + clearMs) return CLEAR_SKY;
  if (t < gatherMs) {
    return { state: 'gathering', cloud: smooth(t / gatherMs), rain: 0, msUntilRain: gatherMs - t };
  }
  if (t < rainEnd) {
    const rain = clamp01(Math.min((t - gatherMs) / RAIN_RAMP_IN_MS, (rainEnd - t) / RAIN_RAMP_OUT_MS));
    return { state: 'rain', cloud: 1, rain, msUntilRain: null };
  }
  if (t < windEnd) return { state: 'windy', cloud: .75 - .4 * smooth((t-rainEnd)/windMs), rain: 0, wind: .85, msUntilRain: null };
  return { state: 'clearing', cloud: .35 * (1 - smooth((t - windEnd) / clearMs)), rain: 0, wind: .85 * (1-smooth((t-windEnd)/clearMs)), msUntilRain: null };
}

/** The storm (if any) planned for one weather window. */
export function windowStorm(windowIndex: number): { startOffsetMs: number; spec: StormSpec } | null {
  const h = hash(`weather:${windowIndex}`);
  if ((h % 1000) / 1000 >= AUTO_RAIN_CHANCE) return null;
  return {
    startOffsetMs: ((h >>> 10) % 120) * 1000,
    spec: { gatherMs: AUTO_GATHER_MS, rainMs: 120_000 + ((h >>> 18) % 120) * 1000, clearMs: AUTO_CLEAR_MS }
  };
}

/** Some windows are just grey and cloudy, without rain. */
export function windowOvercast(windowIndex: number): { startOffsetMs: number; durationMs: number } | null {
  const h = hash(`weather:${windowIndex}`);
  const roll = (h % 1000) / 1000;
  if (roll < AUTO_RAIN_CHANCE || roll >= AUTO_RAIN_CHANCE + AUTO_OVERCAST_CHANCE) return null;
  return { startOffsetMs: 60_000 + ((h >>> 10) % 120) * 1000, durationMs: 150_000 + ((h >>> 18) % 90) * 1000 };
}

export function autoWeather(now: number, epoch: number): Weather {
  const elapsed = now - epoch;
  if (elapsed < 0) return CLEAR_SKY;
  const index = Math.floor(elapsed / WEATHER_WINDOW_MS);
  const within = elapsed - index * WEATHER_WINDOW_MS;

  const storm = windowStorm(index);
  if (storm) return stormProfile(within - storm.startOffsetMs, storm.spec);

  const overcast = windowOvercast(index);
  if (overcast) {
    const t = within - overcast.startOffsetMs;
    if (t >= 0 && t < overcast.durationMs) {
      const cloud = 0.55 * Math.sin((t / overcast.durationMs) * Math.PI);
      return { state: 'clear', cloud: clamp01(cloud), rain: 0, msUntilRain: null };
    }
  }
  return CLEAR_SKY;
}

export function getWeather(now: number, epoch: number, override: WeatherOverride = null): Weather {
  if (override?.kind === 'storm') {
    const t = now - override.startedAt;
    const total = DEMO_STORM.gatherMs + DEMO_STORM.rainMs + WIND_PHASE_MS + DEMO_STORM.clearMs;
    if (t >= 0 && t < total) return stormProfile(t, DEMO_STORM);
  } else if (override?.kind === 'wind' && now-override.startedAt >= 0 && now-override.startedAt < MANUAL_WIND_MS) {
    return {state:'windy',cloud:.35,rain:0,wind:.9,msUntilRain:null};
  } else if (override?.kind === 'clear' && now < override.until) {
    return CLEAR_SKY;
  }
  return autoWeather(now, epoch);
}

/**
 * What pressing W does: start a storm, then strong wind, then force clear skies, then go back to automatic weather.
 * If the automatic weather is already stormy, the first press clears it instead.
 */
export function nextOverride(current: WeatherOverride, now: number, automaticNow: Weather = CLEAR_SKY): WeatherOverride {
  if (current?.kind === 'storm' && now - current.startedAt < DEMO_STORM.gatherMs + DEMO_STORM.rainMs + WIND_PHASE_MS + DEMO_STORM.clearMs) {
    return { kind: 'wind', startedAt: now };
  }
  if (current?.kind === 'wind' && now-current.startedAt < MANUAL_WIND_MS) return {kind:'clear',until:now+MANUAL_CLEAR_MS};
  if (current?.kind === 'clear' && now < current.until) return null;
  if (!current && (automaticNow.state === 'gathering' || automaticNow.state === 'rain' || automaticNow.state === 'windy')) {
    return { kind: 'clear', until: now + MANUAL_CLEAR_MS };
  }
  return { kind: 'storm', startedAt: now };
}

export const CLOUD_RATE = 0.1; // per second at most
export const RAIN_RATE = 0.12;

/**
 * Moves the shown clouds and rain toward the real weather at a limited speed, so a
 * handoff between automatic and manual weather blends instead of jumping.
 */
export function smoothWeather(shown: Weather, target: Weather, dtSeconds: number): Weather {
  const dt = Math.max(0, Math.min(10, dtSeconds));
  const move = (from: number, to: number, rate: number) => {
    const step = rate * dt;
    return from < to ? Math.min(to, from + step) : Math.max(to, from - step);
  };
  return { ...target, cloud: move(shown.cloud, target.cloud, CLOUD_RATE), rain: move(shown.rain, target.rain, RAIN_RATE), wind: move(shown.wind ?? 0, target.wind ?? 0, .15) };
}

export function weatherLabel(w: Weather): string {
  if (w.state === 'gathering') return '☁ Storm coming';
  if (w.state === 'rain') return '🌧 Rain';
  if (w.state === 'windy') return '🌬 Strong wind';
  if (w.state === 'clearing') return '🌤 Clearing';
  return w.cloud > 0.25 ? '☁ Cloudy' : '';
}

export interface OverrideStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export const WEATHER_OVERRIDE_KEY = 'oddlings_weather_override_v1';

export function loadOverride(store: OverrideStorage | null): WeatherOverride {
  try {
    const raw = store?.getItem(WEATHER_OVERRIDE_KEY);
    const o = raw ? JSON.parse(raw) : null;
    if (o?.kind === 'storm' && Number.isFinite(o.startedAt)) return { kind: 'storm', startedAt: o.startedAt };
    if (o?.kind === 'wind' && Number.isFinite(o.startedAt)) return {kind:'wind',startedAt:o.startedAt};
    if (o?.kind === 'clear' && Number.isFinite(o.until)) return { kind: 'clear', until: o.until };
  } catch {
    /* ignore a corrupt value */
  }
  return null;
}

export function saveOverride(store: OverrideStorage | null, o: WeatherOverride): void {
  try {
    if (!o) store?.removeItem?.(WEATHER_OVERRIDE_KEY);
    else store?.setItem(WEATHER_OVERRIDE_KEY, JSON.stringify(o));
  } catch {
    /* weather still works without storage */
  }
}
