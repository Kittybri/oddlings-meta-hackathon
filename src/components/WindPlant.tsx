import { ScenePaused } from './sceneMotion';
import gardenTree from '../../garden-tree-px.png';
import React,{useEffect,useRef,useContext,createContext} from 'react';
import {weatherBus} from '../game/weatherBus';
import {windGust} from '../game/wind';
const WindActive=createContext(true);
export function WindPlant({children,offset=0,tall=false,paused=false}:{children:React.ReactNode;offset?:number;tall?:boolean;paused?:boolean}){
 const scenePaused = React.useContext(ScenePaused);
 const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  if(scenePaused || paused || matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  let frame=0,last=0,previous='';
  const tick=(now:number)=>{
   frame=requestAnimationFrame(tick);if(now-last<32||document.hidden)return;last=now;
   // Placed trees and plants only bend while the weather is windy; in calm weather they stand still
   const weather=weatherBus.get() as {wind?:number;state?:string};
   const gust=weather.state==='windy'?windGust(weather.wind??0,now/1000,offset):0;
   const value=gust>.001?`skewX(${-gust*(tall?7:22)}deg)`:'none';
   if(ref.current&&value!==previous){ref.current.style.transform=value;previous=value;}
  };
  frame=requestAnimationFrame(tick);
  return()=>{cancelAnimationFrame(frame);if(ref.current)ref.current.style.transform='none';};
 },[offset,tall,paused,scenePaused]);
 return <WindActive.Provider value={!paused && !scenePaused}><div data-testid="wind-plant" ref={ref} className="w-full h-full" style={{transformOrigin:'50% 100%'}}>{children}</div></WindActive.Provider>;
}
/** A leaf leaves the canopy, tumbles rightward, and sinks toward the ground. */
export function fallingLeafPose(age:number,wind:number,seed:number){
 const t=Math.max(0,age),w=Math.max(0,Math.min(1,wind));
 return {x:t*(3+w*5)+Math.sin(t*3+seed)*.8,y:t*14+t*t*4+Math.sin(t*4+seed)*.7,rotation:seed*37+t*100,opacity:age<0||age>=4?0:Math.min(1,t*5,(4-t)*2)};
}
function TreeLeaves(){
 const allowed=useContext(WindActive);
 const nodes=useRef<Array<SVGGElement|null>>([]);
 useEffect(()=>{
  const hide=()=>nodes.current.forEach(n=>n?.setAttribute('opacity','0'));
  hide();if(!allowed||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  let raf=0,last=0,nextAt=0,serial=0;
  const particles=Array.from({length:8},()=>({born:-10000,wind:0,x:0,y:0,seed:0}));
  const tick=(now:number)=>{
   raf=requestAnimationFrame(tick);if(now-last<32||document.hidden)return;last=now;
   const wind=weatherBus.get().wind??0;
   if(wind>.2&&now>nextAt){
    const i=serial%8,seed=serial++;const anchors=[[10,21],[24,10],[37,23],[29,31],[15,32]];
    const [x,y]=anchors[seed%anchors.length];
    particles[i]={born:now,wind,x,y,seed};nextAt=now+1000-wind*500;
   }
   particles.forEach((p,i)=>{
    const pose=fallingLeafPose((now-p.born)/1000,p.wind,p.seed),el=nodes.current[i];
    if(!el)return;
    el.setAttribute('opacity',p.y+pose.y>=63?'0':pose.opacity.toFixed(2));
    if(pose.opacity>0)el.setAttribute('transform',`translate(${p.x+pose.x} ${p.y+pose.y}) rotate(${pose.rotation}) scale(.38)`);
   });
  };
  raf=requestAnimationFrame(tick);return()=>{cancelAnimationFrame(raf);hide();};
 },[allowed]);
 return <svg data-testid="tree-falling-leaves" aria-hidden="true" viewBox="0 0 48 64" preserveAspectRatio="none" className="absolute inset-0 w-full h-full overflow-visible pointer-events-none" shapeRendering="crispEdges">
  {Array.from({length:8},(_,i)=><g key={i} ref={el=>{nodes.current[i]=el;}} opacity="0"><path d="M-2 0v-2h3v1h2v3H0V1h-2z" fill={['#a5c879','#7fb56b','#d1c17a'][i%3]}/><path d="M-1-1h2v1h-2z" fill="#d4dda0"/></g>)}
 </svg>;
}
/** A leafy oak in the same style as the World scenery, as chunky pixel art that fits inside its spot. */
export function WindTree(){
 return <div className="relative w-full h-full">
 {/* Cut from the World scenery art, so placed trees match the trees in the background */}
 <img src={gardenTree} alt="Leafy oak tree" draggable={false} className="absolute inset-0 w-full h-full object-contain object-bottom select-none pointer-events-none" style={{ imageRendering: 'pixelated' }} />
 <TreeLeaves />
 </div>;
}
