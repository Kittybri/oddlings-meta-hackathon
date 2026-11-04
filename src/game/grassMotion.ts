import type { BiomeWorldState } from './biomeWorldTypes';
export interface GrassWalker { gridX:number; gridY:number; isInWater?:boolean }
export interface GrassPatch { x:number; y:number }
export function exposedGrass(world:BiomeWorldState):GrassPatch[]{
  return world.tiles.flatMap((row,y)=>row.flatMap((tile,x)=>tile==='grass' && y>0 && world.tiles[y-1]?.[x]==='air' ? [{x,y}] : []));
}
/** Only a foot moving across the same surface bends grass; no response to teleports or floating bodies. */
export function grassPush(patch:GrassPatch,previous:GrassWalker,next:GrassWalker):number{
  const dx=next.gridX-previous.gridX;
  if(next.isInWater || Math.abs(dx)<.002 || Math.abs(dx)>1.5 || Math.abs(next.gridY-patch.y)>.45)return 0;
  const distance=Math.abs(next.gridX-patch.x);
  return distance>=1.25 ? 0 : Math.sign(dx)*34*(1-distance/1.25);
}
