import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCreatureResponse } from './creatureResponse';
import { requestBasetenAnalysis } from '../src/services/basetenClient';
import { WalletBook, NEW_WALLET, WALLET_KEY } from '../src/game/lifeSeeds';

const dna = { name: 'Bambloo', recognizedObject: 'Bamboo', material: 'Plant', description: 'A leafy creature.', appearance: {}, specialAbility: { name: 'Grow' } };
test('accepts JSON, fences, prose and text blocks while rejecting incomplete or invalid creatures', () => {
  for (const content of [JSON.stringify(dna), '```\n'+JSON.stringify(dna)+'\n```', 'Here is your creature:\n'+JSON.stringify(dna), [{ type: 'text', text: JSON.stringify(dna) }]]) {
    assert.deepEqual(parseCreatureResponse({ message: { content } }), dna);
  }
  for (const content of ['{"name":', '{}', '[]', 'sorry', JSON.stringify({ ...dna, specialAbility: null })]) {
    assert.throws(() => parseCreatureResponse({ message: { content } }), (e: any) => e.retryable === true);
  }
  assert.throws(() => parseCreatureResponse({ finish_reason: 'length', message: { content: JSON.stringify(dna) } }));
  assert.throws(() => parseCreatureResponse({ message: { reasoning_content: JSON.stringify(dna) } }));
});

test('retries a malformed answer once, reports refinement, and uses a concise retry request', async () => {
  const original = globalThis.fetch;
  let calls = 0, refinements = 0;
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options!.body as string);
    assert.equal(body.refining, calls === 1);
    calls++;
    return Response.json(calls === 1 ? { retryable: true, error: 'invalid' } : { success: true, dna }, { status: calls === 1 ? 502 : 200 });
  };
  try {
    const result = await requestBasetenAnalysis({ imageBase64: 'test' }, () => refinements++);
    assert.equal(result.dna.name, 'Bambloo');
    assert.equal(calls, 2);
    assert.equal(refinements, 1);
  } finally { globalThis.fetch = original; }
});

test('two malformed responses stop after one retry', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({ retryable: true, error: 'invalid' }, { status: 502 }); };
  try {
    await assert.rejects(requestBasetenAnalysis({ imageBase64: 'test' }));
    assert.equal(calls, 2);
  } finally { globalThis.fetch = original; }
});

test('seed reservation survives reload, blocks duplicates, and refunds or commits once', () => {
  const data = new Map([[WALLET_KEY, JSON.stringify(NEW_WALLET)]]);
  let blocked = false;
  const store = { getItem: (key: string) => data.get(key) || null, setItem: (key: string, value: string) => { if (blocked) throw Error('quota'); data.set(key, value); } };
  const wallet = new WalletBook(store);
  const pending = wallet.beginIncubation()!;
  assert.equal(wallet.get().seeds, NEW_WALLET.seeds - 1);
  assert.equal(wallet.beginIncubation(), null);
  const restored = new WalletBook(store);
  assert.equal(restored.get().incubation?.id, pending.id);
  blocked = true;
  assert.equal(restored.settleIncubation(pending.id, true), false);
  blocked = false;
  assert.equal(restored.settleIncubation(pending.id, true), true);
  assert.equal(restored.settleIncubation(pending.id, true), true);
  assert.equal(restored.get().seeds, NEW_WALLET.seeds);
  const next = restored.beginIncubation()!;
  restored.settleIncubation(next.id, false);
  restored.settleIncubation(next.id, true);
  assert.equal(restored.get().seeds, NEW_WALLET.seeds - 1);
});


test('timeout ends the request without another attempt', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new DOMException('Timed out', 'AbortError'); };
  try {
    await assert.rejects(requestBasetenAnalysis({ imageBase64: 'test' }), /too long/);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});
