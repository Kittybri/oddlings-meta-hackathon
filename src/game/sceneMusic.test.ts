import test from 'node:test';
import assert from 'node:assert/strict';
import { GameMusic } from './gameMusic';
import { readFileSync } from 'node:fs';

test('Scene music switches one looping player, preserves off/mute, and ignores weather ducking outside World', async () => {
  const audio={src:'',paused:true,loop:false,volume:0,muted:false,preload:'',addEventListener(){},pause(){this.paused=true;},async play(){this.paused=false;}};
  let created=0;
  const m=new GameMusic(()=>{created++;return audio as unknown as HTMLAudioElement;},null);
  m.setScene('title');assert.equal(created,0);
  await m.setEnabled(true);assert.equal(m.getTrackSnapshot(),'Little Wonders');assert.match(audio.src,/little-wonders/);
  m.setMuted(true);m.setScene('incubator');await m.resumeFromGesture();assert.equal(created,1);assert.ok(audio.loop);assert.ok(audio.muted);assert.match(audio.src,/starlight-nursery/);
  m.setDuck(0);assert.equal(audio.volume,.4);
  m.setScene('fusion');await m.resumeFromGesture();assert.equal(m.getTrackSnapshot(),'Quantum Bloom');assert.match(audio.src,/quantum-bloom/);assert.equal(created,1);assert.ok(audio.muted);
  m.setScene('world');await m.resumeFromGesture();m.setDuck(0);assert.equal(audio.volume,0);
  await m.setEnabled(false);m.setScene('title');assert.equal(m.getSnapshot(),'off');assert.ok(audio.paused);
});
test('Original scene assets contain complete bounded loops with matching PCM endpoints',()=>{
  for(const name of ['little-wonders','starlight-nursery','quantum-bloom']){
    const b=readFileSync(new URL(`../../public/audio/oddlings-${name}.wav`,import.meta.url));
    assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.readUInt32LE(24),24000);
    assert.ok((b.length-44)/48000>30);assert.ok(Math.abs(b.readInt16LE(44)-b.readInt16LE(b.length-2))<=1);
    let peak=0;for(let i=44;i<b.length;i+=2)peak=Math.max(peak,Math.abs(b.readInt16LE(i)));
    assert.ok(peak>1000 && peak<32767);
  }
});
