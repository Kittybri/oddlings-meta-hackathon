import test from 'node:test';
import assert from 'node:assert/strict';
import { WalletBook, NEW_WALLET, WALLET_KEY } from './lifeSeeds';
import { createEmptyTiles, getStorageKey } from './biomeWorld';
import { loadWorldRegion, transferWorldItem, recoverWorldTransfer } from './worldRegions';
import type { CreatureDNA } from './creatureTypes';

test('wallet does not report successful spends, rewards or purchases after failed writes', () => {
  const w = new WalletBook({ getItem: () => JSON.stringify(NEW_WALLET), setItem: () => { throw Error('quota'); } });
  assert.equal(w.spendSeed(), false);
  assert.equal(w.spendGem(), false);
  assert.equal(w.spendSparkles(10), false);
  assert.equal(w.recordCheck(), false);
  assert.equal(w.rewardCare(), false);
  assert.equal(w.buy('gem').ok, false);
  assert.throws(() => w.rewardQuest());
  assert.equal(new WalletBook(null).spendSeed(), false);
});

test('fusion reservation survives reload, refunds once, and retains completed result until claimed', () => {
  const data = new Map([[WALLET_KEY, JSON.stringify(NEW_WALLET)]]);
  const store = { getItem: (k: string) => data.get(k) || null, setItem: (k: string, v: string) => { data.set(k,v); } };
  const w = new WalletBook(store);
  const id = w.beginFusion(10)!;
  assert.ok(id);
  assert.equal(w.get().sparkles, 5);
  const reload = new WalletBook(store);
  assert.equal(reload.get().fusion?.id, id);
  assert.equal(reload.refundFusion(id), true);
  assert.equal(reload.refundFusion(id), true);
  assert.equal(reload.get().sparkles, 15);
  assert.equal(w.finishFusion(id, {id:'late'} as CreatureDNA), false);
  const next = reload.beginFusion(10)!;
  assert.equal(reload.finishFusion(next, {id:'hybrid'} as CreatureDNA), true);
  assert.equal(new WalletBook(store).get().fusion?.result?.id, 'hybrid');
  assert.equal(reload.claimFusion(next), true);
  assert.equal(reload.get().sparkles, 5);
});

test('a failed second region write still exposes both committed transfer states after reload', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  const data = new Map<string,string>();
  let fail = true;
  const store = { getItem:(k:string)=>data.get(k)||null, removeItem:(k:string)=>data.delete(k),
    setItem:(k:string,v:string)=>{ if(fail && k===getStorageKey('world_region_1')) throw Error('quota'); data.set(k,v); } };
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:store});
  try {
    const source = {version:1 as const,biome:'greenhouse',width:48 as const,height:24 as const,tiles:createEmptyTiles(),decorations:[],updatedAt:1};
    const target = {...source,biome:'world_region_1',updatedAt:2};
    transferWorldItem(source,target);
    assert.equal(loadWorldRegion(0).updatedAt,1);
    assert.equal(loadWorldRegion(1).updatedAt,2);
    assert.ok(data.get('oddlings_world_transfer_v1'));
    fail=false;
    recoverWorldTransfer();
    assert.equal(data.has('oddlings_world_transfer_v1'),false);
    assert.equal(JSON.parse(data.get(getStorageKey('world_region_1'))!).updatedAt,2);
  } finally {
    if(previous) Object.defineProperty(globalThis,'localStorage',previous);
    else Reflect.deleteProperty(globalThis,'localStorage');
  }
});
