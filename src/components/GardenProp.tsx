import treeCherry from '../../tree-cherry.png';
import treeAutumn from '../../tree-autumn.png';
import treeYoung from '../../tree-young.png';
import treeSapling from '../../tree-sapling.png';
import React from 'react';
import { ExtraGardenProp } from './ExtraGardenProp';
import { BUILD_ITEMS, ExtraBuildType } from '../game/buildCatalog';
import { DecorationType } from '../game/biomeWorldTypes';

/** Original Oddlings pixel props. Every sprite meets the ground at y=32. */
/** Trees cut from the World scenery art, shown as crisp pixel art that fits inside their spot */
const TREE_SPRITES: Record<string, string> = { cherrytree: treeCherry, autumntree: treeAutumn, youngtree: treeYoung, sapling: treeSapling };

export function GardenProp({ type }: { type: DecorationType }) {
  const tree = TREE_SPRITES[type];
  if (tree) {
    return <img src={tree} alt="" draggable={false} className="w-full h-full object-contain object-bottom select-none pointer-events-none" style={{ imageRendering: 'pixelated' }} />;
  }
  let art: React.ReactNode;
  switch (type) {
    case 'bench': art = <>
      <path d="M3 17h26v7H3zM5 25h3v7H5zM24 25h3v7h-3z" fill="#513326" />
      <path d="M4 18h24v2H4zM4 21h24v2H4zM2 25h28v3H2z" fill="#d59659" />
      <path d="M3 23h3v4H3zM26 23h3v4h-3z" fill="#263943" />
    </>; break;
    case 'fence': art = <>
      <path d="M1 20h30v3H1zM1 26h30v3H1z" fill="#ba8654" />
      {[3,13,23].map(x=><g key={x}><path d={`M${x} 18h2v-2h2v2h2v14h-6z`} fill="#edcc91" /><rect x={x+4} y="19" width="2" height="13" fill="#b98a59" /></g>)}
    </>; break;
    case 'flowerpot': art = <>
      <path d="M8 22h16v3H8zM10 25h12v7H10z" fill="#b85c49" /><path d="M10 23h12v2H10zM12 26h3v5h-3z" fill="#ec9a72" />
      <path d="M15 13h2v10h-2zM9 16h6v3H9zM17 18h6v3h-6z" fill="#3b9959" />
      <path d="M13 9h6v9h-6zM10 12h12v3H10z" fill="#f5a4c1" /><rect x="14" y="12" width="4" height="3" fill="#ffe8a1" />
    </>; break;
    case 'campfire': art = <>
      <ellipse className="night-fire-halo" cx="16" cy="22" rx="15" ry="10" fill="#ffad4f" />
      <path d="M4 28h24v4H4zM7 25h4v7H7zM23 25h3v7h-3z" fill="#785341" />
      <g className="pixel-flame"><path d="M8 24v-5h3v-5h3V9h3v7h3v-4h2v7h2v7H8z" fill="#f18446" /><path d="M12 25v-6h3v-5h2v6h4v5z" fill="#ffd16e" /><path d="M15 25v-5h3v5z" fill="#fff2bb" /></g>
      <path d="M5 27h23v3H5z" fill="#89502e" /><path d="M7 27h17v1H7z" fill="#d48a4c" />
    </>; break;
    case 'lamppost': art = <>
      <ellipse className="night-fire-halo" cx="16" cy="9" rx="14" ry="9" fill="#ffe7a2" />
      <path d="M14 12h4v18h-4zM10 30h12v2H10zM8 3h16v2H8zM11 1h10v2H11z" fill="#314651" />
      <path d="M10 5h12v9H10z" fill="#f5cc79" /><rect x="12" y="6" width="8" height="6" fill="#fff1bc" /><path d="M9 13h14v2H9zM15 5h2v9h-2z" fill="#314651" />
    </>; break;
    case 'crystal': art = <>
      <ellipse className="night-fire-halo" cx="16" cy="19" rx="14" ry="12" fill="#8ceee3" />
      <path d="M8 27V16h3v-4h4V7h3v5h4v7h3v9h-4v4H10v-5z" fill="#438fbb" />
      <path d="M12 15h3V9h2v19h-5zM19 17h3v11h-3z" fill="#82e4db" /><path d="M15 11h2v8h-2zM9 19h2v7H9z" fill="#e0fff1" /><path d="M5 30h23v2H5z" fill="#556c7c" />
    </>; break;
    case 'well': art = <>
      <path d="M5 21h22v11H5z" fill="#81959c" /><path d="M7 21h18v3H7z" fill="#2f5160" /><path d="M5 26h22v1H5zM12 27h1v5h-1zM21 27h1v5h-1z" fill="#536d7b" />
      <path d="M7 12h3v10H7zM23 12h3v10h-3z" fill="#966844" /><path d="M4 11h24v3H4zM7 8h18v3H7zM11 5h10v3H11z" fill="#bd705a" /><path d="M15 14h1v8h-1z" fill="#e8d1a1" /><rect x="12" y="21" width="7" height="5" fill="#c7b7a1" />
    </>; break;
    case 'cottage': art = <>
      <path d="M4 13h24v19H4z" fill="#f0d3a4" /><path d="M4 13h3v19H4zM25 13h3v19h-3zM4 29h24v3H4z" fill="#87624c" />
      <path d="M2 12h28v3H2zM5 9h22v3H5zM8 6h16v3H8zM11 3h10v3H11zM14 1h4v2h-4z" fill="#b76159" /><path d="M7 9h18v1H7zM11 6h10v1H11z" fill="#e18a6d" />
      <path d="M18 5V1h4v7z" fill="#6d6468" />
      <path d="M13 21h7v11h-7z" fill="#655044" /><rect x="18" y="26" width="1" height="1" fill="#eed28b" />
      {[8,22].map(x=><g key={x}><rect x={x-1} y="17" width="5" height="6" fill="#6c655c" /><rect x={x} y="18" width="3" height="4" fill="#8db8c6" /><rect className="night-window" x={x} y="18" width="3" height="4" fill="#fff0a9" /><path d={`M${x+1} 18v4M${x} 20h3`} stroke="#8d6b51" strokeWidth=".6" /></g>)}
    </>; break;
    default: return BUILD_ITEMS.some(item => item.type === type) ? <ExtraGardenProp type={type as ExtraBuildType} /> : null;
  }
  return <svg aria-label={type} viewBox="0 0 32 32" className="w-full h-full select-none overflow-visible" shapeRendering="crispEdges">{art}</svg>;
}
