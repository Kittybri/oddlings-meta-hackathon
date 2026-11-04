import React from 'react';
import { getWorldAtmosphere } from '../game/worldAtmosphere';
export function WorldSky({ atmosphere, weather }: { atmosphere: ReturnType<typeof getWorldAtmosphere>; weather?: { cloud: number } }) {
  const cloud = weather?.cloud ?? 0;
  const a = atmosphere;
  return <div data-testid="world-sky" aria-label={`${a.label} sky`} className="absolute inset-0 overflow-hidden pointer-events-none" style={{ background: `linear-gradient(${a.skyTop}, ${a.skyBottom})` }}>
    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1000 500" preserveAspectRatio="none" shapeRendering="crispEdges" style={{ opacity: a.starOpacity * (1 - cloud * .9) }} aria-hidden="true">
      {Array.from({ length: 45 }, (_, i) => <rect key={i} x={(i * 137 + 37) % 985} y={(i * 67 + 23) % 285} width={i % 5 === 0 ? 3 : 2} height={i % 5 === 0 ? 3 : 2} fill={i % 3 ? '#e0edff' : '#a8c9f5'} />)}
    </svg>
    <div data-testid="world-sun" aria-label="Sun" className="absolute w-12 h-12 motion-safe:transition-[left,top,opacity] motion-safe:duration-1000 motion-safe:ease-linear" style={{ left: `${a.sunX}%`, top: `${a.sunY}%`, opacity: a.sunOpacity * (1 - cloud * .92), transform: 'translate(-50%, -50%)', filter: `drop-shadow(0 0 18px ${a.label === 'Sunset' ? '#ff9b61' : '#ffe890'})` }}>
      <svg viewBox="0 0 24 24" shapeRendering="crispEdges" className="w-full h-full" aria-hidden="true"><path d="M8 0h8v2h4v2h2v4h2v8h-2v4h-2v2h-4v2H8v-2H4v-2H2v-4H0V8h2V4h2V2h4z" fill={a.label === 'Sunset' ? '#ff985f' : '#facc15'} /><path d="M6 4h12v2h2v12h-2v2H6v-2H4V6h2z" fill={a.label === 'Sunset' ? '#ffc58b' : '#fff3b0'} /><rect x="8" y="7" width="9" height="9" fill="#fff8dc" /></svg>
    </div>
    <div data-testid="world-moon" aria-label="Moon" className="absolute top-[12%] left-[72%] w-10 h-10" style={{ opacity: a.moonOpacity * (1 - cloud * .85) }}>
      <svg viewBox="0 0 20 20" shapeRendering="crispEdges" className="w-full h-full" aria-hidden="true"><path d="M6 0h8v2h4v4h2v8h-2v4h-4v2H6v-2H2v-4H0V6h2V2h4z" fill="#dbeafe" /><path d="M10 0h4v2h4v4h2v8h-2v4h-4v2h-4V0z" fill="#a9bfdc" /><rect x="4" y="7" width="4" height="3" fill="#9cafce" /><rect x="11" y="13" width="3" height="3" fill="#8097b7" /></svg>
    </div>
    {cloud > 0.01 && <>
      <div data-testid="world-overcast" className="absolute inset-0 motion-safe:transition-opacity motion-safe:duration-1000" style={{ background: `linear-gradient(rgba(62,72,88,${cloud * .82}), rgba(132,142,154,${cloud * .6}))` }} />
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1000 500" preserveAspectRatio="none" shapeRendering="crispEdges" style={{ opacity: Math.min(1, cloud * 1.2) }} aria-hidden="true">
        {Array.from({ length: 9 }, (_, i) => {
          const x = (i * 163 + 40) % 1000;
          const y = 20 + (i * 53) % 150;
          const w = 150 + (i % 3) * 50;
          return <g key={i} fill={i % 2 ? '#7b8798' : '#9aa5b4'}><rect x={x} y={y} width={w} height={26} /><rect x={x + 24} y={y - 14} width={w - 70} height={16} /><rect x={x + 12} y={y + 26} width={w - 40} height={10} fill="#6a7587" /></g>;
        })}
      </svg>
    </>}
  </div>;
}
