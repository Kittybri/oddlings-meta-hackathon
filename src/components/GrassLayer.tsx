import { ScenePaused } from './sceneMotion';
import {weatherBus} from '../game/weatherBus';
import {windGust} from '../game/wind';
import React,{useEffect,useMemo,useRef} from 'react';
import { BiomeWorldState } from '../game/biomeWorldTypes';
import { exposedGrass, grassPush, GrassWalker } from '../game/grassMotion';

export const GrassLayer = React.memo(function GrassLayer({world,actors,residents=[],heldId,paused=false}:{
  world:BiomeWorldState;actors?:React.RefObject<Record<string,GrassWalker>>;
  residents?:readonly string[];heldId?:string;paused?:boolean;
}){
 const scenePaused = React.useContext(ScenePaused);
  const patches=useMemo(()=>exposedGrass(world),[world.tiles]);
  const blades=useRef<Array<SVGGElement|null>>([]);
  const current=useRef({residents,heldId});current.current={residents,heldId};
  useEffect(()=>{
    const reset=()=>blades.current.forEach(el=>el?.setAttribute('transform','skewX(0)'));
    reset();
    if(scenePaused || paused || matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    let frame=0,last=0;const previous:Record<string,GrassWalker>={};
    const bends=patches.map(()=>0);
    const tick=(now:number)=>{
      frame=requestAnimationFrame(tick);
      if(now-last<32 || document.hidden)return;
      const dt=Math.min(.1,(now-last)/1000||.033);last=now;
      const walkers=current.current.residents.flatMap(id=>{
        const next=actors?.current[id],prev=previous[id];
        if(next)previous[id]={...next};
        return next && prev && id!==current.current.heldId ? [{prev,next}] : [];
      });
      patches.forEach((patch,i)=>{
        let push=0;
        for(const w of walkers){const p=grassPush(patch,w.prev,w.next);if(Math.abs(p)>Math.abs(push))push=p;}
        const footstep=push;
        const wind=weatherBus.get().wind??0;
        const strong=Math.max(0,Math.min(1,(wind-.4)/.6));
        const seconds=now/1000;
        const flutter=strong*(Math.sin(seconds*7.5+patch.x*1.4)*11+Math.sin(seconds*13+patch.x*.7)*5);
        push+=windGust(wind,seconds,patch.x)*(28+strong*28)+flutter;
        push=Math.max(-58,Math.min(58,push));
        const rate=footstep ? 18 : strong>0 ? 14 : 5;
        bends[i]+=(push-bends[i])*(1-Math.exp(-dt*rate));
        if(Math.abs(bends[i])<.03)bends[i]=0;
        // SVG skew applied around the foot of each tuft, not the world origin.
        blades.current[i]?.setAttribute('transform',`skewX(${-bends[i].toFixed(2)}) scale(1,${(1-strong*.16*Math.abs(Math.sin(seconds*5+patch.x))).toFixed(3)})`);
      });
    };
    frame=requestAnimationFrame(tick);
    return()=>{cancelAnimationFrame(frame);reset();};
  },[patches,actors,paused,scenePaused]);
  return <svg data-testid="reactive-grass" aria-hidden="true" className="absolute inset-0 w-full h-full pointer-events-none" style={{zIndex:21}} viewBox="0 0 768 384" preserveAspectRatio="none" shapeRendering="crispEdges">
    {patches.map((p,i)=><g key={`${p.x}:${p.y}`} transform={`translate(${p.x*16} ${p.y*16})`}>
      <g ref={el=>{blades.current[i]=el;}}>
        {/* A continuous soft base, with overlapping back and front blades. */}
        <path d="M0 1V-2h3v-1h3v1h4v-1h3v1h3v3z" fill="#347747"/>
        {[0,2,4,6,8,10,12,14].map((x,j)=>{
          const h=3+((p.x*7+p.y*3+j*5)%4);
          return <path key={'back'+j} d={`M${x} 0v-${h-2}h-1v-2h2v2h1V0z`} fill={['#438c50','#4d9958','#3d874d'][(p.x+j)%3]}/>;
        })}
        {[1,4,7,10,13,15].map((x,j)=>{
          const h=3+((p.x*3+p.y+j*7)%5);
          const lean=(p.x+j)%2?1:-1;
          return <g key={'front'+j}>
            <path d={`M${x-1} 0v-2h${lean}v-${h-3}h${lean}v-1h1v${h-2}h${-lean}v2z`} fill={['#6eaf63','#5ca45b','#80b96c'][(p.x+j)%3]}/>
            <rect x={x+lean} y={-h} width="1" height="2" fill={j%3===0?'#b2d38b':'#91c47a'}/>
          </g>;
        })}
        <path d="M0 0h16v1H0zM2-1h3v1H2zM8-1h4v1H8z" fill="#65a65c"/>
      </g>
    </g>)}
  </svg>;
}, (previous, next) => previous.world.tiles === next.world.tiles && previous.actors === next.actors
  && previous.heldId === next.heldId && previous.paused === next.paused
  && (previous.residents || []).join('\0') === (next.residents || []).join('\0'));
