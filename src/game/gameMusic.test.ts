import test from 'node:test';
import assert from 'node:assert/strict';
import { GameMusic, MUSIC_PREF_KEY } from './gameMusic';
import { renderSoundtrack, MUSIC_SECONDS } from './musicComposition';

function fakePlayer() {
  const audio: any = { loop: false, paused: true, volume: 1, muted: false, starts: 0, pauses: 0,
    addEventListener() {}, play: async () => { audio.starts++; audio.paused = false; }, pause: () => { audio.pauses++; audio.paused = true; } };
  return audio;
}
test('Original soundtrack contains finite bounded stereo music for a full loop', () => {
  const [left,right] = renderSoundtrack(2000);
  assert.equal(left.length, MUSIC_SECONDS * 2000); assert.equal(right.length,left.length);
  let peak = 0, energy = 0;
  for(let i=0;i<left.length;i++) { assert.ok(Number.isFinite(left[i]) && Number.isFinite(right[i])); peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i])); energy+=left[i]*left[i]; }
  assert.ok(peak < 1 && peak > .05); assert.ok(energy>10);
  assert.ok(Math.abs(left[0]-left[left.length-1]) < 0.000001);
});
test('Soundtrack uses one looping player, persists choice, toggles off and respects global mute', async () => {
  const audio = fakePlayer(); let players = 0;
  const data = new Map<string,string>();
  const music = new GameMusic(() => { players++; return audio; }, {getItem:k=>data.get(k)??null,setItem:(k,v)=>{data.set(k,v);}});
  assert.equal(music.getSnapshot(),'off'); assert.equal(players,0);
  await Promise.all([music.setEnabled(true),music.resumeFromGesture(),music.setEnabled(true)]);
  assert.equal(music.getSnapshot(),'playing'); assert.equal(players,1); assert.equal(audio.loop,true); assert.equal(audio.starts,1);
  music.setMuted(true); assert.equal(audio.muted,true); music.setMuted(false); assert.equal(audio.muted,false);
  await music.setEnabled(false); assert.equal(audio.paused,true); assert.equal(music.getSnapshot(),'off'); assert.equal(data.get(MUSIC_PREF_KEY),'false');
  await music.setEnabled(true); assert.equal(players,1); assert.equal(audio.starts,2); music.stop(); assert.equal(audio.paused,true);
});
test('Saved music waits for interaction; playback failure is recoverable', async () => {
  const audio=fakePlayer(); let players=0;
  const music=new GameMusic(()=>{players++;return audio;},{getItem:()=> 'true',setItem(){}});
  assert.equal(music.getSnapshot(),'ready'); assert.equal(players,0);
  await music.resumeFromGesture(); assert.equal(music.getSnapshot(),'playing'); music.stop();
  const broken=new GameMusic(()=>{throw new Error('Audio unavailable');},null);
  await broken.setEnabled(true); assert.equal(broken.getSnapshot(),'error'); await broken.setEnabled(false); assert.equal(broken.getSnapshot(),'off');
});

test('Packaged music asset is a complete seamless stereo WAV', async () => {
  const {readFileSync} = await import('node:fs');
  const wav=readFileSync(new URL('../../public/audio/oddlings-pixel-daydream.wav',import.meta.url));
  assert.equal(wav.toString('ascii',0,4),'RIFF'); assert.equal(wav.toString('ascii',8,12),'WAVE');
  assert.equal(wav.readUInt16LE(22),2); assert.equal(wav.readUInt32LE(24),24000);
  assert.equal(wav.readUInt32LE(40),40*24000*4);
  assert.ok(Math.abs(wav.readInt16LE(44)-wav.readInt16LE(wav.length-4))<=1);
});
