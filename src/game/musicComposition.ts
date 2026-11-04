// Original Oddlings chiptune: warm plucks, soft chords, a bass line and light percussion.
// Render once and loop an AudioBuffer, avoiding timer gaps and duplicate tracks.
export const MUSIC_PREF_KEY = 'oddlings_music_enabled_v1';
export const MUSIC_SAMPLE_RATE = 24000;
export const MUSIC_SECONDS = 40; // 16 bars at 96 BPM
export type MusicState = 'off' | 'ready' | 'playing' | 'error';
const hz = (note: number) => 440 * 2 ** ((note - 69) / 12);
export function renderSoundtrack(sampleRate = MUSIC_SAMPLE_RATE): [Float32Array<ArrayBuffer>, Float32Array<ArrayBuffer>] {
  const length = Math.round(sampleRate * MUSIC_SECONDS);
  const left = new Float32Array(length), right = new Float32Array(length);
  const beat = .625;
  const chords = [[60,64,67,71], [57,60,64,67], [53,57,60,64], [55,59,62,67]];
  const melody = [7, 12, 11, 7, 4, 7, 2, 4, 0, 4, 7, 9, 7, 4, 2, 0];
  const note = (midi: number, time: number, duration: number, volume: number, pan: number, instrument: 'pluck' | 'pad' | 'bass') => {
    const count = Math.ceil(duration * sampleRate), start = Math.round(time * sampleRate), f = hz(midi);
    for (let i = 0; i < count; i++) {
      const t = i / sampleRate, phase = t * f * Math.PI * 2;
      const release = Math.min(1, (duration - t) / .12);
      const env = instrument === 'pad' ? Math.min(1, t / .22) * release : Math.min(1, t / .008) * Math.exp(-t * (instrument === 'bass' ? 4 : 5)) * release;
      const wave = Math.sin(phase) + (instrument === 'pluck' ? .23 * Math.sin(phase * 2) + .09 * Math.sin(phase * 3) : .12 * Math.sin(phase * 2));
      const value = wave * env * volume;
      const at = (start + i) % length;
      left[at] += value * Math.sqrt((1 - pan) / 2); right[at] += value * Math.sqrt((1 + pan) / 2);
    }
  };
  for (let bar = 0; bar < 16; bar++) {
    const chord = chords[bar % 4], time = bar * 4 * beat;
    chord.forEach((n, i) => note(n, time, 4 * beat + .25, .033, (i - 1.5) * .28, 'pad'));
    [0,2].forEach(b => note(chord[0] - 24, time + b * beat, beat * 1.7, .12, 0, 'bass'));
    for (let b = 0; b < 8; b++) {
      note(chord[b % 4] + 12, time + b * beat / 2, beat * .65, .035, b % 2 ? .45 : -.45, 'pluck');
    }
    for (let b = 0; b < 4; b++) {
      const scale = melody[(bar * 4 + b) % melody.length];
      note(72 + scale, time + b * beat, beat * .9, .075, -.12, 'pluck');
    }
    // Quiet deterministic noise ticks and round kick; no downloaded samples.
    for (let hit = 0; hit < 4; hit++) {
      const start = Math.round((time + hit * beat) * sampleRate);
      for (let i = 0; i < sampleRate * .06; i++) {
        const t = i / sampleRate;
        const noise = Math.sin(i * 127.1 + bar * 311.7 + hit) * 43758.5453;
        const v = ((noise - Math.floor(noise)) * 2 - 1) * Math.exp(-t * 100) * .016;
        const kick = hit % 2 === 0 ? Math.sin(2 * Math.PI * (70 * t - 170 * t * t)) * Math.exp(-t * 60) * .07 : 0;
        left[(start + i) % length] += v + kick; right[(start + i) % length] += v + kick;
      }
    }
  }
  // Match the loop endpoints over a 20ms boundary blend to avoid a repeat click.
  const blend = Math.round(sampleRate * .02);
  for (const channel of [left, right]) {
    const delta = channel[0] - channel[length - 1];
    for (let i = 0; i < blend; i++) {
      const correction = delta * (1 - i / blend) * .5;
      channel[i] -= correction; channel[length - 1 - i] += correction;
    }
  }
  return [left, right];
}

