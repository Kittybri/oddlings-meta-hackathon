import test from 'node:test';
import assert from 'node:assert/strict';
import { startSharedJob, getSharedJob, reserveAi, aiRequestLease } from './spriteService';
import { reserveShared } from './sharedAiStore';

test('production rejects paid work without shared storage; shared results survive a new reader', async () => {
  const saved = {url:process.env.AI_REDIS_REST_URL,token:process.env.AI_REDIS_REST_TOKEN,mode:process.env.NODE_ENV};
  const originalFetch=globalThis.fetch;
  try {
    delete process.env.AI_REDIS_REST_URL; delete process.env.AI_REDIS_REST_TOKEN;
    process.env.NODE_ENV='production';
    await assert.rejects(reserveAi('text'));
    await assert.rejects(startSharedJob(async()=>({})));
    process.env.AI_REDIS_REST_URL='https://redis.example.invalid';
    process.env.AI_REDIS_REST_TOKEN='test-only';
    const data=new Map<string,string>();
    let slots=0,used=0,released=0;
    globalThis.fetch=async (_url,init) => {
      const cmd=JSON.parse(String(init?.body));
      let result:unknown=null;
      if(cmd[0]==='SET') { data.set(cmd[1],cmd[2]); result='OK'; }
      if(cmd[0]==='GET') result=data.get(cmd[1])||null;
      if(cmd[0]==='ZREM') {slots--;result=1;}
      if(cmd[0]==='EVAL') {
        if(slots>=4) result=0;
        else {slots++;used++;result=1;}
      }
      return new Response(JSON.stringify({result}),{status:200});
    };
    const releases=await Promise.all(Array.from({length:4},()=>reserveShared('text')));
    await assert.rejects(reserveShared('text'));
    assert.equal(used,4);
    releases.forEach(r=>r());
    await new Promise(r=>setTimeout(r,0));
    assert.equal(slots,0);
    const id=await aiRequestLease.run({background:false,release:()=>{released++;}},()=>startSharedJob(async()=>({image:'saved-art'})));
    await new Promise(r=>setTimeout(r,10));
    const job=await getSharedJob(id);
    assert.equal(job.status,'done');
    assert.deepEqual(job.result,{image:'saved-art'});
    assert.equal(released,1);
    assert.equal((await getSharedJob('missing')).status,'error');
    globalThis.fetch=async()=>{throw Error('outage');};
    await assert.rejects(reserveAi('text'));
    await assert.rejects(getSharedJob(id));
  } finally {
    globalThis.fetch=originalFetch;
    for(const [key,value] of Object.entries({AI_REDIS_REST_URL:saved.url,AI_REDIS_REST_TOKEN:saved.token,NODE_ENV:saved.mode})) {
      if(value===undefined) delete process.env[key]; else process.env[key]=value;
    }
  }
});

test('image timeout remains active after headers while the body stalls', async t => {
  const { drawCreatureWithMuseImage } = await import('./spriteService');
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.META_API_KEY;
  process.env.META_API_KEY = 'test-only';
  t.mock.timers.enable({ apis: ['setTimeout'] });
  try {
    globalThis.fetch = async (_url, init) => ({
      ok: true,
      json: () => new Promise((_resolve, reject) => {
        init!.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      })
    }) as Response;
    const pending = drawCreatureWithMuseImage({imageUrl:'data:image/png;base64,AAAA',objectName:'test'});
    const rejected = assert.rejects(pending, (err: any) => err.status === 504);
    await Promise.resolve();
    await Promise.resolve();
    t.mock.timers.tick(90001);
    await rejected;
  } finally {
    t.mock.timers.reset();
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.META_API_KEY;
    else process.env.META_API_KEY = originalKey;
  }
});
