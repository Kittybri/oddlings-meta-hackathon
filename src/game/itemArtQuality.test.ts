import test from 'node:test';
import assert from 'node:assert/strict';
import { hasUsableItemSilhouette, retryItemArt } from './itemArtQuality';

test('one rejected drawing is retried internally and a good result is returned', async () => {
  let calls = 0;
  let refining = 0;
  assert.equal(await retryItemArt(async () => ++calls === 1 ? null : 'good', () => refining++), 'good');
  assert.equal(calls, 2);
  assert.equal(refining, 1);
});

test('repeated failures stop after two attempts and limits are never retried', async () => {
  let calls = 0;
  assert.equal(await retryItemArt(async () => { calls++; throw new Error('Interrupted'); }), null);
  assert.equal(calls, 2);
  calls = 0;
  await assert.rejects(retryItemArt(async () => { calls++; throw new Error('Daily limit reached'); }));
  assert.equal(calls, 1);
});

test('item checker accepts a coherent silhouette including small detached details', () => {
  const pixels = new Uint8Array(20 * 20 * 4);
  for (let y = 3; y < 17; y++) {
    for (let x = 3; x < 17; x++) pixels[(y * 20 + x) * 4 + 3] = 255;
  }
  pixels[3] = 255;
  assert.equal(hasUsableItemSilhouette(pixels, 20, 20), true);
});

test('item checker rejects empty, solid backgrounds and scattered fragments', () => {
  const pixels = new Uint8Array(20 * 20 * 4);
  assert.equal(hasUsableItemSilhouette(pixels, 20, 20), false);
  for (let p = 0; p < 400; p++) pixels[p * 4 + 3] = 255;
  assert.equal(hasUsableItemSilhouette(pixels, 20, 20), false);
  pixels.fill(0);
  for (let y = 0; y < 20; y += 2) {
    for (let x = 0; x < 20; x += 2) pixels[(y * 20 + x) * 4 + 3] = 255;
  }
  assert.equal(hasUsableItemSilhouette(pixels, 20, 20), false);
});
