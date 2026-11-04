export const MUSIC_PREF_KEY = 'oddlings_music_enabled_v1';
export type MusicScene = 'title' | 'incubator' | 'fusion' | 'world';
export const SCENE_TRACKS = { title: { name: 'Little Wonders', src: '/audio/oddlings-little-wonders.wav' }, incubator: { name: 'Starlight Nursery', src: '/audio/oddlings-starlight-nursery.wav' }, fusion: { name: 'Quantum Bloom', src: '/audio/oddlings-quantum-bloom.wav' }, world: { name: 'Pixel Daydream', src: '/audio/oddlings-pixel-daydream.wav' } } as const;
export type MusicState = 'off' | 'ready' | 'playing' | 'error';
export class GameMusic {
  private audio: HTMLAudioElement | null = null;
  private listeners = new Set<() => void>();
  private enabled = false;
  private muted = false;
  private state: MusicState = 'off';
  private starting: Promise<void> | null = null;
  private operation = 0;
  private duck = 1;
  private scene: MusicScene = 'world';
  getScene = () => this.scene;
  getTrackSnapshot = () => SCENE_TRACKS[this.scene].name;
  setScene(scene: MusicScene) {
    if (scene === this.scene) return;
    this.stop();
    this.scene = scene; this.duck = 1;
    if (this.audio) { this.audio.src = SCENE_TRACKS[scene].src; this.audio.volume = .4; }
    this.publish(this.enabled ? 'ready' : 'off');
    if (this.enabled) void this.resumeFromGesture();
  }
  constructor(private createAudio: () => HTMLAudioElement = () => new Audio('/audio/oddlings-pixel-daydream.wav'),
    private preference: Pick<Storage, 'getItem' | 'setItem'> | null = typeof localStorage === 'undefined' ? null : localStorage) {
    try { this.enabled = this.preference?.getItem(MUSIC_PREF_KEY) === 'true'; } catch { /* Optional preferences. */ }
    this.state = this.enabled ? 'ready' : 'off';
  }
  getSnapshot = () => this.state;
  getMutedSnapshot = () => this.muted;
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  private publish(state: MusicState) { this.state = state; this.listeners.forEach(fn => fn()); }
  async setEnabled(enabled: boolean) {
    this.enabled = enabled;
    try { this.preference?.setItem(MUSIC_PREF_KEY, String(enabled)); } catch { /* Playback does not require storage. */ }
    if (!enabled) { this.stop(); this.publish('off'); return; }
    await this.resumeFromGesture();
  }
  setDuck(duck: number) {
    if (this.scene !== 'world') return;
    this.duck = Math.max(0, Math.min(1, duck));
    if (this.audio) this.audio.volume = .4 * this.duck;
  }
  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.audio) this.audio.muted = muted;
    this.listeners.forEach(fn => fn());
  }
  async resumeFromGesture(): Promise<void> {
    if (!this.enabled || (this.audio && !this.audio.paused && this.state === 'playing')) return;
    if (this.starting) return this.starting;
    const operation = ++this.operation;
    const start = async () => {
      try {
        if (!this.audio) {
          this.audio = this.createAudio(); this.audio.src = SCENE_TRACKS[this.scene].src; this.audio.loop = true; this.audio.volume = .4 * this.duck;
          this.audio.preload = 'auto'; this.audio.muted = this.muted;
          this.audio.addEventListener('error', () => { if (this.enabled) this.publish('error'); });
        }
        await this.audio.play();
        if (operation !== this.operation) return;
        if (!this.enabled) { this.audio.pause(); return; }
        this.publish(this.audio.paused ? 'ready' : 'playing');
      } catch { if (operation === this.operation) this.publish(this.enabled ? 'error' : 'off'); }
    };
    const promise = start(); this.starting = promise;
    void promise.finally(() => { if (this.starting === promise) this.starting = null; });
    return promise;
  }
  stop() {
    this.operation++; this.starting = null;
    this.audio?.pause();
    this.publish(this.enabled ? 'ready' : 'off');
  }
}
export const gameMusic = new GameMusic();
