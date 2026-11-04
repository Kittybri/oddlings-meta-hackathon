import test from 'node:test';import assert from 'node:assert/strict';
import {exposedGrass,grassPush} from './grassMotion';
import {createStarterWorld} from './biomeWorld';
test('Grass only grows on exposed grass tiles, not buried blocks or other materials',()=>{
 const w=createStarterWorld('greenhouse','cozy_clearing');w.tiles=w.tiles.map(row=>row.map(()=> 'air'));
 w.tiles[12][5]='grass';w.tiles[13][5]='grass';w.tiles[12][6]='dirt';w.tiles[11][7]='water';w.tiles[12][7]='grass';
 assert.deepEqual(exposedGrass(w),[{x:5,y:12}]);
});
test('Grass bends with footsteps but ignores idle, water, other elevations and teleports',()=>{
 const p={x:10,y:12};
 assert.ok(grassPush(p,{gridX:9.8,gridY:12},{gridX:10,gridY:12})>0);
 assert.ok(grassPush(p,{gridX:10.2,gridY:12},{gridX:10,gridY:12})<0);
 assert.equal(grassPush(p,{gridX:10,gridY:12},{gridX:10,gridY:12}),0);
 assert.equal(grassPush(p,{gridX:9.8,gridY:12},{gridX:10,gridY:12,isInWater:true}),0);
 assert.equal(grassPush(p,{gridX:9.8,gridY:9},{gridX:10,gridY:9}),0);
 assert.equal(grassPush(p,{gridX:2,gridY:12},{gridX:10,gridY:12}),0);
 assert.equal(grassPush(p,{gridX:14,gridY:12},{gridX:14.1,gridY:12}),0);
});
