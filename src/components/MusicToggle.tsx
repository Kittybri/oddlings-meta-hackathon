import React, { useSyncExternalStore } from 'react';
import { gameMusic } from '../game/gameMusic';
export function MusicToggle() {
  const state = useSyncExternalStore(gameMusic.subscribe, gameMusic.getSnapshot, () => 'off' as const);
  const muted = useSyncExternalStore(gameMusic.subscribe, gameMusic.getMutedSnapshot, () => false);
  const enabled = state !== 'off';
  const track = useSyncExternalStore(gameMusic.subscribe, gameMusic.getTrackSnapshot, () => 'Little Wonders');
  return <div className="flex flex-col items-center gap-1.5">
    <button data-music-toggle="true" aria-pressed={enabled} aria-label={enabled ? 'Turn soundtrack off' : 'Turn soundtrack on'}
      onClick={() => { void gameMusic.setEnabled(!enabled); }}
      className={`flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 ${enabled ? 'border-emerald-400/60 bg-emerald-950/70 text-emerald-200' : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-cyan-400'}`}>
      <span aria-hidden="true">{enabled ? '♫' : '♪'}</span> Soundtrack {enabled ? 'On' : 'Off'}
    </button>
    <span role="status" className="text-[10px] text-slate-400">{state === 'playing' && muted ? 'Audio muted · press M to unmute' : state === 'playing' ? `Now playing · ${track} · loops continuously` : state === 'ready' ? 'Tap anywhere to resume your music' : state === 'error' ? 'Audio could not start. Turn off and on to retry.' : 'A cozy original chiptune for your world'}</span>
  </div>;
}
