import React from 'react';

// Pixel wind across the habitat: a few thin gust streaks with a little curl, and some leaves tumbling along.
// It only blows while the weather is windy (fading in and out); stronger wind adds opacity and speed.
const GUSTS = [
  { top: 14, delay: 0, dur: 5.2, w: 46 },
  { top: 27, delay: -2.1, dur: 6.1, w: 34 },
  { top: 41, delay: -3.7, dur: 4.8, w: 54 },
  { top: 56, delay: -1.2, dur: 5.7, w: 40 },
  { top: 68, delay: -4.4, dur: 6.4, w: 30 },
  { top: 33, delay: -5.3, dur: 5.0, w: 42 }
];
const LEAVES = [
  { top: 20, delay: -0.4, dur: 7.5, color: '#7cc04a' },
  { top: 48, delay: -3.1, dur: 8.6, color: '#a3d65c' },
  { top: 62, delay: -5.8, dur: 7.1, color: '#e0a83a' },
  { top: 35, delay: -6.9, dur: 9.2, color: '#5fa83c' }
];

export function WindVisuals({ strength, windy }: { strength: number; windy: boolean }) {
  const s = Math.max(0, Math.min(1, strength || 0));
  const opacity = windy ? 0.45 + s * 0.55 : 0;
  const speed = 1 / (1 + s * 0.8);
  return (
    <div data-testid="wind-gusts" aria-hidden="true" className="absolute inset-0 overflow-hidden pointer-events-none z-[22]" style={{ opacity, transition: 'opacity 2s linear', visibility: windy ? 'visible' : 'hidden', transitionProperty: 'opacity, visibility', transitionDuration: '2s' }}>
      <style>{`
        @keyframes oddlings-gust { 0% { transform: translateX(-15vw); opacity: 0 } 15% { opacity: .55 } 70% { opacity: .45 } 100% { transform: translateX(115vw); opacity: 0 } }
        @keyframes oddlings-gust-curl { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-3px) } }
        @keyframes oddlings-leaf-fly { 0% { transform: translate(-8vw, 0); opacity: 0 } 10% { opacity: .9 } 90% { opacity: .9 } 100% { transform: translate(112vw, 26px); opacity: 0 } }
        @keyframes oddlings-leaf-spin { 0% { transform: translateY(0) rotate(0deg) } 25% { transform: translateY(-7px) rotate(90deg) } 50% { transform: translateY(2px) rotate(180deg) } 75% { transform: translateY(-4px) rotate(270deg) } 100% { transform: translateY(0) rotate(360deg) } }
        .oddlings-gust { position: absolute; left: 0; animation: oddlings-gust linear infinite }
        .oddlings-gust > svg { display: block; animation: oddlings-gust-curl 1.4s steps(2) infinite }
        .oddlings-leaf { position: absolute; left: 0; animation: oddlings-leaf-fly linear infinite }
        .oddlings-leaf > svg { display: block; animation: oddlings-leaf-spin 1.6s steps(4) infinite }
        @media (prefers-reduced-motion: reduce) { .oddlings-gust, .oddlings-leaf { display: none } }
      `}</style>
      {GUSTS.map((g, i) => (
        <div key={'g' + i} className="oddlings-gust" style={{ top: g.top + '%', animationDelay: g.delay + 's', animationDuration: g.dur * speed + 's' }}>
          <svg viewBox="0 0 24 5" width={g.w * 2} height="10" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
            <path d="M0 3h14v1H0z" fill="#ffffff" opacity=".55" />
            <path d="M14 2h5v1h-5z M19 1h2v1h-2z M21 2h1v1h-1z" fill="#ffffff" opacity=".55" />
            <path d="M4 0h8v1H4z" fill="#ffffff" opacity=".3" />
          </svg>
        </div>
      ))}
      {LEAVES.map((l, i) => (
        <div key={'l' + i} className="oddlings-leaf" style={{ top: l.top + '%', animationDelay: l.delay + 's', animationDuration: l.dur * speed + 's' }}>
          <svg viewBox="0 0 4 3" width="8" height="6" shapeRendering="crispEdges">
            <path d="M1 0h2v1H1z M0 1h4v1H0z M1 2h1v1H1z" fill={l.color} />
            <path d="M2 2h1v1H2z" fill="#3d6b2a" />
          </svg>
        </div>
      ))}
    </div>
  );
}
