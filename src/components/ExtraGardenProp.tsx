import React from 'react';
import { BUILD_ITEMS, ExtraBuildType } from '../game/buildCatalog';

/** Own pixel artwork, cropped to its actual bounds; baseline always y=32. */
export function ExtraGardenProp({type}:{type:ExtraBuildType}) {
  const item=BUILD_ITEMS.find(i=>i.type===type);
  if(!item)return null;
  let art:React.ReactNode;
  switch(type){
    case 'wooddoor': art=<><path d="M5 0h22v32H5z" fill="#674631"/><path d="M7 2h18v29H7z" fill="#be8753"/><path d="M9 4h6v11H9zM17 4h6v11h-6zM9 18h14v10H9z" fill="#91603f"/><path d="M10 5h4v8h-4zM18 5h4v8h-4z" fill="#8cbcc3"/><rect x="21" y="16" width="2" height="2" fill="#ffe096"/></>;break;
    case 'chest':art=<><path d="M1 16h30v16H1zM3 12h26v4H3z" fill="#855332"/><path d="M3 17h26v12H3zM5 13h22v3H5z" fill="#d49a53"/><path d="M1 20h30v3H1zM4 13h2v19H4zM26 13h2v19h-2z" fill="#574c42"/><path d="M13 19h6v7h-6z" fill="#efd07d"/><rect x="15" y="21" width="2" height="3" fill="#66523b"/></>;break;
    case 'barrel':art=<><path d="M8 0h16v2h4v28h-4v2H8v-2H4V2h4z" fill="#94633d"/><path d="M10 1h3v30h-3zM18 1h3v30h-3z" fill="#c59355"/><path d="M5 5h22v3H5zM5 24h22v3H5z" fill="#596572"/><path d="M6 6h20v1H6zM6 25h20v1H6z" fill="#a8b5bc"/></>;break;
    case 'workbench':art=<><path d="M1 12h30v6H1zM4 18h4v14H4zM24 18h4v14h-4z" fill="#7d5237"/><path d="M2 12h28v3H2zM5 19h2v12H5zM10 24h12v2H10z" fill="#c08d56"/><path d="M7 12h1v4H7zM15 12h1v4h-1zM23 12h1v4h-1z" fill="#543629"/><rect x="19" y="8" width="3" height="6" fill="#6c7d89"/><rect x="21" y="10" width="7" height="2" fill="#e8c47c"/></>;break;
    case 'bookshelf':art=<><path d="M3 0h26v32H3z" fill="#654331"/><path d="M5 2h22v27H5z" fill="#302e37"/>{[3,15].map(y=><g key={y}>{['#cc726f','#dcb964','#6eaf9b','#7b94c4','#b288bb'].map((c,i)=><g key={c}><rect x={6+i*4} y={y} width="3" height="10" fill={c}/><rect x={6+i*4} y={y+2} width="3" height="1" fill="#eed9aa"/></g>)}</g>)}<path d="M3 13h26v2H3zM3 27h26v3H3z" fill="#b98150"/></>;break;
    case 'bed':art=<><path d="M1 18h3v14H1zM28 20h3v12h-3zM4 26h24v4H4z" fill="#784d38"/><path d="M4 20h24v6H4z" fill="#9b7bbb"/><path d="M4 20h8v5H4z" fill="#fff0cf"/><path d="M13 20h15v2H13zM22 22h6v4h-6z" fill="#c2a4da"/></>;break;
    case 'picnictable':art=<><path d="M4 14h24v4H4zM0 23h32v3H0zM9 18h3v14H9zM21 18h3v14h-3z" fill="#96623d"/><path d="M4 14h24v1H4zM0 23h32v1H0z" fill="#dab078"/><path d="M11 26h10v2H11z" fill="#684936"/></>;break;
    case 'gate':art=<><path d="M0 8h4v24H0zM28 8h4v24h-4z" fill="#d9ba83"/><path d="M5 13h22v3H5zM5 25h22v3H5zM6 12h3v17H6zM14 12h3v17h-3zM23 12h3v17h-3z" fill="#b98b56"/><rect x="24" y="20" width="3" height="2" fill="#48565d"/></>;break;
    case 'ladder':art=<><path d="M6 0h4v32H6zM22 0h4v32h-4z" fill="#a16f43"/>{[3,9,15,21,27].map(y=><g key={y}><rect x="8" y={y} width="16" height="3" fill="#d6a66c"/><rect x="8" y={y+2} width="16" height="1" fill="#785234"/></g>)}</>;break;
    case 'haybale':art=<><path d="M2 10h28v22H2z" fill="#c49945"/>{[4,8,12,16,20,24,28].map(x=><rect key={x} x={x} y="11" width="1" height="20" fill="#f2d779"/>)}<path d="M8 10h3v22H8zM22 10h3v22h-3z" fill="#a26e4e"/></>;break;
    case 'wheatpatch':art=<><path d="M0 28h32v4H0z" fill="#754d34"/>{[3,9,16,23,29].map((x,i)=><g key={x}><path d={`M${x} 8v21`} stroke="#bfa15c" strokeWidth="1.5"/>{[8,13,18].map(y=><path key={y} d={`M${x-3} ${y}h3v3h-3zM${x} ${y+2}h3v3h-3z`} fill={i%2?'#e7bf60':'#f2d987'}/>)}</g>)}</>;break;
    case 'carrotpatch':art=<><path d="M0 25h32v7H0z" fill="#744933"/>{[5,16,27].map(x=><g key={x}><path d={`M${x-2} 23h4v6h-4z`} fill="#ec9851"/><path d={`M${x-1} 16h2v8h-2zM${x-4} 19h3v3h-3zM${x+1} 18h3v3h-3z`} fill="#72b66a"/></g>)}</>;break;
    case 'bamboo':art=<><path d="M12 0h4v32h-4zM21 7h3v25h-3z" fill="#6caa66"/>{[5,13,21,29].map(y=><rect key={y} x="12" y={y} width="4" height="1" fill="#d4d897"/>)}<path d="M4 8h8v3H4zM16 12h9v3h-9zM4 21h8v3H4zM24 19h7v3h-7z" fill="#3a8757"/></>;break;
    case 'pinetree':art=<><path d="M14 24h4v8h-4z" fill="#865d43"/><path d="M14 0h4v3h3v4h3v4h-3v2h5v5h3v6h3v4H0v-4h3v-6h3v-5h5v-2H8V7h3V3h3z" fill="#316952"/><path d="M14 3h3v4h3v3H9V7h3V5h2zM7 17h16v2H7zM3 25h26v2H3z" fill="#69a27c"/></>;break;
    case 'stonearch':art=<><path d="M0 32V8h3V4h5V1h16v3h5v4h3v24h-7V12h-3V9H10v3H7v20z" fill="#798d9b"/><path d="M2 9h5v4H2zM8 3h7v4H8zM17 3h7v4h-7zM25 9h5v4h-5zM1 20h6v2H1zM25 20h6v2h-6z" fill="#b5c1c1"/><path d="M0 29h8v3H0zM24 29h8v3h-8z" fill="#596f7c"/></>;break;
    case 'gazebo':art=<><path d="M4 14h3v18H4zM25 14h3v18h-3zM3 29h26v3H3zM6 23h20v2H6z" fill="#bd9362"/><path d="M1 12h30v3H1zM4 9h24v3H4zM8 6h16v3H8zM12 3h8v3h-8zM15 1h2v2h-2z" fill="#638b81"/><path d="M5 11h22v1H5zM9 8h14v1H9z" fill="#9db9a1"/></>;break;
    case 'windmill':art=<><path d="M11 11h10l4 21H7z" fill="#e2c89e"/><path d="M10 23h12v1H10zM13 27h6v5h-6z" fill="#805d4c"/><path d="M9 11h14V8h-3V5h-8v3H9z" fill="#a56d59"/><g fill="#c9a773"><path d="M15 0h3v24h-3zM2 10h28v3H2z"/></g><g fill="#f5e8bc"><path d="M17 0h5v8h-5zM22 11h8v5h-8zM11 15h5v8h-5zM2 6h8v5H2z"/></g><rect x="14" y="9" width="5" height="5" fill="#7b6861"/></>;break;
    case 'fountain':art=<><path d="M3 25h26v7H3zM0 24h32v3H0zM12 11h8v14h-8zM7 9h18v4H7z" fill="#8ea4b0"/><path d="M4 25h24v2H4zM8 9h16v2H8z" fill="#7dc8d7"/><path d="M15 4h2v6h-2zM6 14h2v7H6zM24 14h2v7h-2zM10 18h2v5h-2zM20 18h2v5h-2z" fill="#b3e3e8"/><path d="M5 30h22v1H5z" fill="#607d8e"/></>;break;
    case 'signpost':art=<><path d="M14 12h4v20h-4z" fill="#805939"/><path d="M2 3h25v3h4v3h-4v3H2z" fill="#cb9c62"/><path d="M5 6h15v2H5z" fill="#7a593d"/><path d="M13 30h7v2h-7z" fill="#5d4938"/></>;break;
    case 'pumpkin':art=<><path d="M14 8h4v4h-4z" fill="#628756"/><path d="M4 14h24v3h3v12h-3v3H4v-3H1V17h3z" fill="#cf8549"/><path d="M6 15h2v15H6zM15 13h2v19h-2zM24 15h2v15h-2z" fill="#e7a451"/><path d="M7 19h5v4H7zM20 19h5v4h-5zM10 26h12v3H10z" fill="#765138"/><path className="night-window" d="M7 19h5v4H7zM20 19h5v4h-5zM10 26h12v3H10z" fill="#ffdf8b"/></>;break;
  }
  return <svg aria-label={item.label} viewBox={`0 ${item.top} 32 ${32-item.top}`} preserveAspectRatio="none" className="w-full h-full select-none overflow-visible" shapeRendering="crispEdges">{art}</svg>;
}
