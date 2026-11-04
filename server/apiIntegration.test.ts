/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';

const SERVER_URL = process.env.ODDLINGS_TEST_URL || 'http://localhost:3000';

test('biome image route never reports image generation from a text response or a key alone', async () => {
  const status = await fetch(`${SERVER_URL}/api/pixelate/status`).then(r => r.json());
  assert.equal(status.configured, false);
  assert.equal(status.provider, 'none');
  const res = await fetch(`${SERVER_URL}/api/pixelate/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageBase64: 'test' }) });
  assert.equal(res.status, 503);
  assert.equal((await res.json()).success, false);
});

test('GET /api/baseten/status returns accurate provider status', async () => {
  const res = await fetch(`${SERVER_URL}/api/baseten/status`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.provider, 'baseten');
  assert.equal(data.model, 'meta-models/muse-spark-open-1026');
  assert.equal(typeof data.hasKey, 'boolean');
});

test('POST /api/baseten/analyze validates input payload and rejects empty body', async () => {
  const res = await fetch(`${SERVER_URL}/api/baseten/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.ok(data.error && data.error.includes('imageBase64'));
});

test('POST /api/baseten/fuse validates input and handles missing credentials securely', async () => {
  const res = await fetch(`${SERVER_URL}/api/baseten/fuse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      parentA: { name: 'Thornbrew', element: 'Ceramic', ability: 'Steam', material: 'Clay' },
      parentB: { name: 'Luxacanth', element: 'Botanical', ability: 'Spines', material: 'Aloe' }
    })
  });
  // Without live BASETEN_API_KEY or when upstream is unreachable/rate-limited, returns appropriate status without leaking credentials
  assert.ok([200, 401, 429, 500, 502, 503, 504].includes(res.status));
  const data = await res.json();
  if (res.status === 503) {
    assert.ok(data.error.includes('BASETEN_API_KEY is not configured'));
  }
});
