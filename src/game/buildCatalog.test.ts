import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILD_ITEMS } from './buildCatalog';
import { createStarterWorld, addDecoration, sanitizeBiomeWorld, DECOR_TILES, canPlaceDecoration } from './biomeWorld';

test('All 24 building props retain explicit sizes, grounded placement and saved-world support',()=>{
  assert.equal(BUILD_ITEMS.length,24);assert.equal(new Set(BUILD_ITEMS.map(i=>i.type)).size,24);
  const base=createStarterWorld('greenhouse','cozy_clearing');
  base.tiles=base.tiles.map((row,y)=>row.map(()=>y>=18?'grass':'air'));base.decorations=[];
  for(const item of BUILD_ITEMS){
    assert.deepEqual(DECOR_TILES[item.type],[...item.tiles]);
    const result=canPlaceDecoration(base,item.type,24,1);assert.ok(result.allowed,item.type);assert.equal(result.snappedY,18);
    const world=addDecoration(base,item.type,24,1);assert.equal(world.decorations[0]?.gridY,18);
    assert.equal(sanitizeBiomeWorld(JSON.parse(JSON.stringify(world)))?.decorations[0]?.type,item.type);
  }
  assert.ok(DECOR_TILES.wooddoor[1]<DECOR_TILES.cottage[1]);
  assert.ok(DECOR_TILES.chest[1]<DECOR_TILES.wooddoor[1]);
  assert.ok(DECOR_TILES.windmill[1]>DECOR_TILES.cottage[1]);
});
test('Large structures reject narrow unsupported ledges',()=>{
  const w=createStarterWorld('greenhouse','cozy_clearing');
  w.tiles=w.tiles.map(row=>row.map(()=> 'air'));w.tiles[18][24]='stone';
  assert.equal(canPlaceDecoration(w,'gazebo',24,1).allowed,false);
  assert.equal(canPlaceDecoration(w,'windmill',24,1).allowed,false);
});
