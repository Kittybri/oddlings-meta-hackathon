import test from 'node:test';
import assert from 'node:assert';
import { parseSafeJson, fetchBasetenStatus } from './basetenClient';

test('parseSafeJson cleanly intercepts <!doctype html> without throwing Unexpected token <', async () => {
  const fakeHtmlResponse = new Response('<!doctype html><html><body>Error</body></html>', {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });

  await assert.rejects(
    async () => {
      await parseSafeJson(fakeHtmlResponse, 'Meta live fusion');
    },
    (err: any) => {
      assert.match(err.message, /(Backend service unavailable in this preview runtime|The game server is busy for a moment)/);
      assert.doesNotMatch(err.message, /Unexpected token/);
      return true;
    }
  );
});

test('parseSafeJson safely extracts JSON error responses with non-200 HTTP status', async () => {
  const fakeErrorResponse = new Response(JSON.stringify({ error: 'BASETEN_API_KEY is not configured in server environment.' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' }
  });

  await assert.rejects(
    async () => {
      await parseSafeJson(fakeErrorResponse, 'Meta live fusion');
    },
    (err: any) => {
      assert.strictEqual(err.message, 'BASETEN_API_KEY is not configured in server environment.');
      return true;
    }
  );
});

test('parseSafeJson correctly returns parsed data on success', async () => {
  const fakeSuccessResponse = new Response(JSON.stringify({ success: true, hybridDna: { name: 'Pyrolux' } }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });

  const data = await parseSafeJson<any>(fakeSuccessResponse, 'Meta live fusion');
  assert.strictEqual(data.success, true);
  assert.strictEqual(data.hybridDna.name, 'Pyrolux');
});
