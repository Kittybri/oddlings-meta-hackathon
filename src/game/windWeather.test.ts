import test from 'node:test';import assert from 'node:assert/strict';
import {stormProfile,DEMO_STORM,WIND_PHASE_MS,CLEAR_SKY,nextOverride,getWeather,smoothWeather,saveOverride,loadOverride} from './weather';
import {pickMood,composeBar,MoodMusic} from './moodMusic';
import {windGust} from './wind';
test('Storms progress from gathering through rain, wind and clearing; manual wind survives reload',()=>{
 const end=DEMO_STORM.gatherMs+DEMO_STORM.rainMs;
 assert.equal(stormProfile(1,DEMO_STORM).state,'gathering');
 assert.equal(stormProfile(DEMO_STORM.gatherMs+15000,DEMO_STORM).state,'rain');
 assert.equal(stormProfile(end+1,DEMO_STORM).state,'windy');
 assert.equal(stormProfile(end+1,DEMO_STORM).rain,0);
 assert.equal(stormProfile(end+WIND_PHASE_MS+1,DEMO_STORM).state,'clearing');
 assert.deepEqual(stormProfile(end+WIND_PHASE_MS+DEMO_STORM.clearMs,DEMO_STORM),CLEAR_SKY);
 const wind=nextOverride({kind:'storm',startedAt:1000},2000);assert.equal(wind?.kind,'wind');
 const store=new Map<string,string>();const storage={getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>{store.set(k,v);}};
 saveOverride(storage,wind);assert.deepEqual(loadOverride(storage),wind);
 assert.equal(getWeather(3000,1000,wind).state,'windy');
 assert.equal(nextOverride(wind,3000)?.kind,'clear');
 const shown=smoothWeather(CLEAR_SKY,{state:'windy',cloud:.4,rain:0,wind:.9,msUntilRain:null},1);
 assert.ok((shown.wind??0)>0 && (shown.wind??0)<.9);
});
test('Strong wind wins over rain tail/night; its soundtrack has no notes; gusts stay bounded',()=>{
 assert.equal(pickMood(.1,{state:'windy',rain:.05,wind:.8}),'wind');
 assert.equal(composeBar('wind',1).notes.length,0);
 for(let t=0;t<100;t+=.13){const g=windGust(.9,t,12);assert.ok(g>=0&&g<=.9);assert.equal(windGust(0,t),0);}
});
test('Wind audio starts only noise and a slow gust oscillator, with no musical voices',()=>{
 const param=()=>({value:0,cancelScheduledValues(){},setValueAtTime(){},linearRampToValueAtTime(){},setTargetAtTime(){},exponentialRampToValueAtTime(){}});
 let oscillators=0,sources=0;
 const node=()=>({gain:param(),frequency:param(),Q:param(),connect(n:any){return n;},start(){},stop(){}});
 const ctx:any={state:'running',currentTime:0,sampleRate:100,destination:{},resume:async()=>{},close:async()=>{},createGain:node,createBiquadFilter:node,createBuffer:()=>({getChannelData:()=>new Float32Array(200)}),createBufferSource:()=>{sources++;return node();},createOscillator:()=>{oscillators++;return node();},createAnalyser:()=>({fftSize:16,getFloatTimeDomainData(){}})};
 const music=new MoodMusic(null,()=>ctx,{autoStart:false,fadeMs:0});music.setMood('wind');music.tick();
 assert.equal(sources,2);assert.equal(oscillators,1);assert.equal(music.getDebug().voices,0);music.dispose();
});
