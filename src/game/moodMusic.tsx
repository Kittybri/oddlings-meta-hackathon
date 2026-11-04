/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Mood music: the day track fades out and a generated mood takes over when rain is
 * about to come, while it rains, and at night (with crickets). All sound is made
 * from oscillators and filtered noise, so no audio files are needed.
 */

export type Mood = 'day' | 'gathering' | 'rain' | 'wind' | 'night';
export type ActiveMood = Exclude<Mood, 'day'>;

export const NIGHT_LIGHT_THRESHOLD = 0.45;
export const RAIN_MOOD_THRESHOLD = 0.12;
export const FADE_MS = 2500;
export const LOOKAHEAD_S = 1.5;

/** Rain beats everything, then the "rain is coming" build-up, then night, then day. */
export function pickMood(light: number, weather: { state: string; rain: number; wind?: number }): Mood {
  if (weather.state === 'windy' || (weather.wind ?? 0) > .25) return 'wind';
  if (weather.state === 'rain' || weather.rain > RAIN_MOOD_THRESHOLD) return 'rain';
  if (weather.state === 'gathering') return 'gathering';
  if (light < NIGHT_LIGHT_THRESHOLD) return 'night';
  return 'day';
}

/* ------------------------------ composition ------------------------------ */

export interface NoteEvent {
  t: number; // seconds from the start of the bar
  dur: number;
  freq: number;
  vol: number;
  wave: 'sine' | 'triangle' | 'square';
}

export interface BarPlan {
  barSeconds: number;
  notes: NoteEvent[];
}

export interface Chirp {
  t: number; // seconds from the start of the window
  freq: number;
  vol: number;
  pulses: number; // a chirp is a quick trill of pulses
  pan: number; // -1 left .. 1 right: each cricket sits in its own spot
}

export const CRICKET_PULSE_S = 0.027; // about 37 pulses a second, like a real trill

export const MOOD_TEMPO: Record<ActiveMood, number> = { gathering: 62, rain: 72, wind: 60, night: 58 };

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const midiToFreq = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

const SCALES = {
  night: [57, 60, 62, 64, 67, 69, 72], // A minor pentatonic
  rain: [62, 65, 67, 69, 72, 74] // D minor pentatonic
};

const MOOD_SEED: Record<ActiveMood, number> = { gathering: 11, rain: 23, wind: 41, night: 37 };

export function barSecondsFor(mood: ActiveMood): number {
  return (4 * 60) / MOOD_TEMPO[mood];
}

/** One bar of music for a mood. The same bar index always gives the same notes. */
export function composeBar(mood: ActiveMood, barIndex: number): BarPlan {
  if (mood === 'wind') return {barSeconds:4,notes:[]};
  const rng = mulberry32(MOOD_SEED[mood] * 1000 + barIndex);
  const beat = 60 / MOOD_TEMPO[mood];
  const barSeconds = beat * 4;
  const notes: NoteEvent[] = [];

  if (mood === 'gathering') {
    // A low drone and a tense minor-second motif
    notes.push({ t: 0, dur: barSeconds * 1.1, freq: midiToFreq(45), vol: 0.035, wave: 'triangle' });
    notes.push({ t: 0, dur: barSeconds * 1.1, freq: midiToFreq(52), vol: 0.03, wave: 'sine' });
    notes.push({ t: 0, dur: barSeconds * 1.1, freq: midiToFreq(57), vol: 0.05, wave: 'triangle' });
    notes.push({ t: beat * 2, dur: barSeconds * 0.6, freq: midiToFreq(58), vol: 0.05, wave: 'triangle' });
    if (barIndex % 4 === 3) notes.push({ t: beat * 2, dur: beat * 1.5, freq: midiToFreq(64), vol: 0.045, wave: 'triangle' });
    return { barSeconds, notes };
  }

  const scale = SCALES[mood];
  let idx = Math.floor(rng() * scale.length);
  for (let slot = 0; slot < 8; slot++) {
    if (rng() > (mood === 'night' ? 0.5 : 0.6)) continue;
    idx = Math.max(0, Math.min(scale.length - 1, idx + Math.floor(rng() * 3) - 1));
    notes.push({
      t: slot * beat * 0.5,
      dur: beat * (mood === 'night' ? 1.6 : 1.0),
      freq: midiToFreq(scale[idx]),
      vol: mood === 'night' ? 0.075 : 0.07,
      wave: mood === 'night' ? 'sine' : 'triangle'
    });
  }
  if (notes.length === 0) {
    notes.push({ t: 0, dur: beat * 1.6, freq: midiToFreq(scale[0]), vol: 0.075, wave: 'sine' });
  }

  if (mood === 'night') {
    notes.push({ t: 0, dur: barSeconds, freq: midiToFreq(barIndex % 2 === 0 ? 45 : 40), vol: 0.035, wave: 'sine' });
  } else if (barIndex % 2 === 0) {
    notes.push({ t: 0, dur: barSeconds * 2, freq: midiToFreq(50), vol: 0.04, wave: 'sine' });
    notes.push({ t: 0, dur: barSeconds * 2, freq: midiToFreq(57), vol: 0.03, wave: 'sine' });
  }
  return { barSeconds, notes };
}

/**
 * Cricket chirps for a window: three crickets at different pitches and places, each trilling
 * now and then at its own irregular pace, like a real evening chorus.
 */
export function composeCrickets(windowSeconds: number, windowIndex: number): Chirp[] {
  const rng = mulberry32(9000 + windowIndex);
  const crickets = [
    { base: 4400, pan: -0.55 },
    { base: 4700, pan: 0.1 },
    { base: 5000, pan: 0.6 }
  ];
  const chirps: Chirp[] = [];
  for (const { base, pan } of crickets) {
    let t = rng() * 1.6;
    while (t < windowSeconds) {
      chirps.push({ t, freq: base + (rng() - 0.5) * 60, vol: 0.018 + rng() * 0.014, pulses: 7 + Math.floor(rng() * 5), pan });
      t += 1.1 + rng() * 1.7;
    }
  }
  return chirps.sort((a, b) => a.t - b.t);
}

export const THUNDER_WINDOW_S = 8;
export const THUNDER_CHANCE = 0.12;

/** A distant rumble now and then while it rains: its offset in the window, or null. */
export function thunderAt(windowIndex: number): { t: number; vol: number } | null {
  const rng = mulberry32(5000 + windowIndex);
  if (rng() > THUNDER_CHANCE) return null;
  return { t: rng() * (THUNDER_WINDOW_S - 3), vol: 0.1 + rng() * 0.06 };
}

/* ------------------------------ the engine ------------------------------ */

/** The day-track player this layer cooperates with. */
export interface MusicHost {
  getSnapshot(): string;
  getScene?(): string;
  getMutedSnapshot(): boolean;
  subscribe(fn: () => void): () => void;
  setDuck(duck: number): void;
}

export interface MoodMusicOptions {
  fadeMs?: number;
  tickMs?: number;
  autoStart?: boolean;
}

export interface MoodDebug {
  mood: Mood;
  ctxState: string;
  enabled: boolean;
  muted: boolean;
  duck: number;
  level: number;
  voices: number;
}

const defaultContext = (): AudioContext | null => {
  try {
    const C = (typeof window !== 'undefined' && ((window as any).AudioContext || (window as any).webkitAudioContext)) || null;
    return C ? new C() : null;
  } catch {
    return null;
  }
};

export class MoodMusic {
  private mood: Mood = 'day';
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private buses: Partial<Record<ActiveMood, GainNode>> = {};
  private noise: AudioBuffer | null = null;
  private beds: Partial<Record<ActiveMood, AudioScheduledSourceNode[]>> = {};
  private timer: ReturnType<typeof setInterval> | null = null;
  private fadeTimer: ReturnType<typeof setInterval> | null = null;
  private duck = 1;
  private voices = 0;
  private barIndex = 0;
  private barCursor = 0;
  private cricketIndex = 0;
  private cricketCursor = 0;
  private thunderIndex = 0;
  private thunderCursor = 0;
  private unsubscribe: (() => void) | null = null;
  private resumeListener: (() => void) | null = null;
  private readonly fadeMs: number;
  private readonly tickMs: number;

  constructor(
    private host: MusicHost | null,
    private makeContext: () => AudioContext | null = defaultContext,
    options: MoodMusicOptions = {}
  ) {
    this.fadeMs = options.fadeMs ?? FADE_MS;
    this.tickMs = options.tickMs ?? 250;
    if (host) this.unsubscribe = host.subscribe(() => this.apply());
    if (options.autoStart !== false) this.timer = setInterval(() => this.tick(), this.tickMs);
  }

  private get enabled(): boolean {
    return this.host ? this.host.getSnapshot() !== 'off' && (!this.host.getScene || this.host.getScene() === 'world') : true;
  }
  private get muted(): boolean {
    return this.host ? this.host.getMutedSnapshot() : false;
  }

  setMood(mood: Mood): void {
    if (mood === this.mood) return;
    this.mood = mood;
    this.apply();
  }

  getMood(): Mood {
    return this.mood;
  }

  /** Browsers only allow audio after a click or key press, so resume on the first one. */
  attach(): void {
    if (this.resumeListener || typeof window === 'undefined') return;
    this.resumeListener = () => {
      if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined);
    };
    window.addEventListener('pointerdown', this.resumeListener, { passive: true });
    window.addEventListener('keydown', this.resumeListener, { passive: true });
  }

  getDebug(): MoodDebug {
    let level = 0;
    if (this.analyser) {
      const data = new Float32Array(this.analyser.fftSize);
      this.analyser.getFloatTimeDomainData(data);
      let sum = 0;
      for (const v of data) sum += v * v;
      level = Math.sqrt(sum / data.length);
    }
    return { mood: this.mood, ctxState: this.ctx?.state ?? 'none', enabled: this.enabled, muted: this.muted, duck: this.duck, level, voices: this.voices };
  }

  dispose(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.fadeTimer) clearInterval(this.fadeTimer);
    this.timer = this.fadeTimer = null;
    this.unsubscribe?.();
    this.unsubscribe = null;
    if (this.resumeListener && typeof window !== 'undefined') {
      window.removeEventListener('pointerdown', this.resumeListener);
      window.removeEventListener('keydown', this.resumeListener);
    }
    this.resumeListener = null;
    (Object.keys(this.beds) as ActiveMood[]).forEach((m) => this.stopBed(m));
    void this.ctx?.close?.().catch(() => undefined);
    this.ctx = null;
  }

  /* --------------------------- state changes --------------------------- */

  private apply(): void {
    const active = this.mood !== 'day' && this.enabled;
    this.fadeDuck(this.mood === 'day' || !this.enabled ? 1 : 0);

    if (!active) {
      this.fadeBuses(null);
      return;
    }
    if (!this.ensureContext()) return;
    const ctx = this.ctx!;
    void ctx.resume().catch(() => undefined);
    this.master!.gain.setTargetAtTime(this.muted ? 0 : 1, ctx.currentTime, 0.05);

    const mood = this.mood as ActiveMood;
    this.startBed(mood);
    this.fadeBuses(mood);
    this.barIndex = 0;
    this.barCursor = ctx.currentTime + 0.3;
    this.cricketIndex = 0;
    this.cricketCursor = ctx.currentTime + 0.3;
    this.thunderIndex = 0;
    this.thunderCursor = ctx.currentTime + 2;
  }

  private ensureContext(): boolean {
    if (this.ctx) return true;
    const ctx = this.makeContext();
    if (!ctx) return false;
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(ctx.destination);
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.master.connect(this.analyser);
    for (const m of ['gathering', 'rain', 'wind', 'night'] as ActiveMood[]) {
      const bus = ctx.createGain();
      bus.gain.value = 0;
      bus.connect(this.master);
      this.buses[m] = bus;
    }
    const length = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    const rng = mulberry32(424242);
    for (let i = 0; i < length; i++) data[i] = rng() * 2 - 1;
    return true;
  }

  private fadeBuses(target: ActiveMood | null): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const seconds = this.fadeMs / 1000;
    for (const m of ['gathering', 'rain', 'wind', 'night'] as ActiveMood[]) {
      const bus = this.buses[m];
      if (!bus) continue;
      bus.gain.cancelScheduledValues(now);
      bus.gain.setValueAtTime(bus.gain.value, now);
      bus.gain.linearRampToValueAtTime(m === target ? 1 : 0, now + seconds);
      if (m !== target) setTimeout(() => this.mood !== m && this.stopBed(m), this.fadeMs + 200);
    }
  }

  private fadeDuck(to: number): void {
    if (!this.host) return;
    if (this.fadeTimer) clearInterval(this.fadeTimer);
    const from = this.duck;
    if (from === to) return;
    const steps = Math.max(1, Math.round(this.fadeMs / 80));
    let i = 0;
    this.fadeTimer = setInterval(() => {
      i++;
      this.duck = from + ((to - from) * i) / steps;
      this.host?.setDuck(this.duck);
      if (i >= steps && this.fadeTimer) {
        clearInterval(this.fadeTimer);
        this.fadeTimer = null;
      }
    }, 80);
  }

  /* ------------------------------ sound beds ------------------------------ */

  private noiseSource(): AudioBufferSourceNode {
    const src = this.ctx!.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    return src;
  }

  private bandNoise(bus: GainNode, type: BiquadFilterType, freq: number, q: number, gain: number, ramp?: { from: number; seconds: number }): AudioScheduledSourceNode {
    const ctx = this.ctx!;
    const src = this.noiseSource();
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = ctx.createGain();
    if (ramp) {
      g.gain.setValueAtTime(ramp.from, ctx.currentTime);
      g.gain.linearRampToValueAtTime(gain, ctx.currentTime + ramp.seconds);
    } else {
      g.gain.value = gain;
    }
    src.connect(filter).connect(g).connect(bus);
    src.start();
    return src;
  }

  private startBed(mood: ActiveMood): void {
    if (this.beds[mood]?.length) return;
    const bus = this.buses[mood]!;
    const beds: AudioScheduledSourceNode[] = [];
    if (mood === 'wind') {
      const ctx = this.ctx!;
      const source = this.noiseSource();
      const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 950;
      const gain = ctx.createGain(); gain.gain.value = .075;
      const gust = ctx.createOscillator(); gust.type='sine'; gust.frequency.value=.13;
      const depth = ctx.createGain(); depth.gain.value=.035;
      gust.connect(depth).connect(gain.gain);
      source.connect(filter).connect(gain).connect(bus); source.start(); gust.start();
      beds.push(source,gust);
      beds.push(this.bandNoise(bus,'bandpass',500,.6,.05));
    } else if (mood === 'rain') {
      beds.push(this.bandNoise(bus, 'bandpass', 1300, 0.4, 0.036));
      beds.push(this.bandNoise(bus, 'lowpass', 800, 0.7, 0.026));
    } else if (mood === 'gathering') {
      beds.push(this.bandNoise(bus, 'lowpass', 320, 0.7, 0.045, { from: 0.015, seconds: 60 }));
      beds.push(this.bandNoise(bus, 'bandpass', 420, 1.2, 0.04));
    } else {
      beds.push(this.bandNoise(bus, 'bandpass', 300, 0.8, 0.022));
    }
    this.beds[mood] = beds;
  }

  private stopBed(mood: ActiveMood): void {
    for (const s of this.beds[mood] || []) {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    }
    this.beds[mood] = [];
  }

  /* ------------------------------ scheduling ------------------------------ */

  /** Plays the notes due in the next moment. Runs on a timer and can be called by hand. */
  tick(): void {
    if (!this.ctx || this.ctx.state !== 'running' || this.mood === 'day' || !this.enabled) return;
    const mood = this.mood as ActiveMood;
    const bus = this.buses[mood];
    if (!bus) return;
    if (mood === 'wind') return; // Wind ambience only: no melody, thunder or crickets.
    const horizon = this.ctx.currentTime + LOOKAHEAD_S;

    while (this.barCursor < horizon) {
      const plan = composeBar(mood, this.barIndex++);
      for (const n of plan.notes) this.playNote(bus, this.barCursor + n.t, n);
      this.barCursor += plan.barSeconds;
    }
    if (mood === 'night') {
      while (this.cricketCursor < horizon) {
        for (const c of composeCrickets(2, this.cricketIndex++)) this.playChirp(bus, this.cricketCursor + c.t, c);
        this.cricketCursor += 2;
      }
    }
    if (mood === 'rain') {
      while (this.thunderCursor < horizon) {
        const th = thunderAt(this.thunderIndex++);
        if (th) this.playThunder(bus, this.thunderCursor + th.t, th.vol);
        this.thunderCursor += THUNDER_WINDOW_S;
      }
    }
  }

  private playNote(bus: GainNode, at: number, n: NoteEvent): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = n.wave;
    osc.frequency.value = n.freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(n.vol, at + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, at + n.dur);
    osc.connect(g).connect(bus);
    osc.start(at);
    osc.stop(at + n.dur + 0.05);
    this.voices++;
    osc.onended = () => {
      this.voices--;
    };
  }

  /** One cricket trill: a single tone chopped into quick soft pulses, drifting slightly up in pitch. */
  private playChirp(bus: GainNode, at: number, c: Chirp): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    const total = c.pulses * CRICKET_PULSE_S;
    osc.frequency.setValueAtTime(c.freq, at);
    osc.frequency.linearRampToValueAtTime(c.freq * 1.015, at + total);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    for (let p = 0; p < c.pulses; p++) {
      const t0 = at + p * CRICKET_PULSE_S;
      const swell = 0.75 + 0.25 * Math.sin(((p + 1) / (c.pulses + 1)) * Math.PI); // loudest in the middle of the trill
      g.gain.linearRampToValueAtTime(c.vol * swell, t0 + 0.007);
      g.gain.linearRampToValueAtTime(0.0001, t0 + CRICKET_PULSE_S * 0.8);
    }
    const panner = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
    if (panner) {
      panner.pan.value = c.pan;
      osc.connect(g).connect(panner).connect(bus);
    } else {
      osc.connect(g).connect(bus);
    }
    osc.start(at);
    osc.stop(at + total + 0.05);
    this.voices++;
    osc.onended = () => {
      this.voices--;
    };
  }

  private playThunder(bus: GainNode, at: number, vol: number): void {
    const ctx = this.ctx!;
    const src = this.noiseSource();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 140;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(vol, at + 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 3);
    src.connect(filter).connect(g).connect(bus);
    src.start(at);
    src.stop(at + 3.1);
  }
}
