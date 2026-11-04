/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  getBasetenStatus, 
  validateAndSanitizeMuseOutput,
  analyzeObjectWithBaseten,
  fuseCreaturesWithBaseten
} from './basetenService';

test('recognized apple identity repairs generic model anatomy before persistence', () => {
  const dna = validateAndSanitizeMuseOutput({ name: 'Blushpip', recognizedObject: 'Red Apple', visualPlan: { archetype: 'curio' } }, 'Photographed Object');
  assert.equal(dna.visualPlan?.archetype, 'compositional');
  assert.equal(dna.visualPlan?.compositional?.category, 'apple');
});

test('fuseCreaturesWithBaseten throws 503 when API key is missing', async () => {
  const originalKey = process.env.BASETEN_API_KEY;
  delete process.env.BASETEN_API_KEY;

  await assert.rejects(
    async () => {
      await fuseCreaturesWithBaseten({
        parentA: { name: 'Thornbrew', element: 'Ceramic', ability: 'Steam Spout', material: 'Ceramic' },
        parentB: { name: 'Luxacanth', element: 'Botanical', ability: 'Chlorophyll Burst', material: 'Succulent Flesh' }
      });
    },
    (err: any) => {
      assert.equal(err.status, 503);
      assert.ok(err.message.includes('BASETEN_API_KEY is not configured'));
      return true;
    }
  );

  process.env.BASETEN_API_KEY = originalKey;
});

test('fuseCreaturesWithBaseten synthesizes hybrid genetics with mocked Baseten success', async () => {
  const originalKey = process.env.BASETEN_API_KEY;
  process.env.BASETEN_API_KEY = 'mock-baseten-key';

  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url: any, opts: any) => {
    assert.equal(url, 'https://inference.baseten.co/v1/chat/completions');
    assert.equal(opts.headers['Authorization'], 'Bearer mock-baseten-key');
    const body = JSON.parse(opts.body);
    assert.equal(body.model, 'meta-models/muse-spark-open-1026');

    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                name: 'Thorn-Lux Primus',
                speciesName: 'Ceramo Succulentus',
                title: 'The Glazed Floramorph',
                primaryElement: 'Ceramic',
                secondaryElement: 'Botanical',
                temperament: 'Gentle & Shy',
                material: 'Glazed Ceramic & Spiny Aloe',
                description: 'A resilient succulent nestled in kiln-fired armor.',
                appearance: {
                  bodyShape: 'round',
                  primaryColor: '#c85a32',
                  secondaryColor: '#2d6a4f',
                  accentColor: '#52b788',
                  eyeStyle: 'sparkle',
                  hornStyle: 'buds',
                  pattern: 'glazed',
                  size: 1.15
                },
                specialAbility: {
                  name: 'Photosynthetic Steam',
                  description: 'Emits nutrient-rich thermal vapor that revitalizes surroundings.',
                  powerRating: 92,
                  icon: '🌿♨️'
                },
                inheritedTraits: [
                  'Inherited from Thornbrew: Heat retention',
                  'Inherited from Luxacanth: Spiny photosynthesis',
                  'Emergent: Thermal dew generation'
                ]
              })
            }
          }
        ]
      })
    } as any;
  };

  try {
    const result = await fuseCreaturesWithBaseten({
      parentA: { name: 'Thornbrew', element: 'Ceramic', ability: 'Steam Spout', material: 'Ceramic' },
      parentB: { name: 'Luxacanth', element: 'Botanical', ability: 'Chlorophyll Burst', material: 'Succulent Flesh' }
    });

    assert.equal(result.name, 'Thorn-Lux Primus');
    assert.equal(result.primaryElement, 'Ceramic');
    assert.equal(result.secondaryElement, 'Botanical');
    assert.equal(result.specialAbility.name, 'Photosynthetic Steam');
    assert.equal(result.specialAbility.powerRating, 92);
    assert.equal(result.inheritedTraits.length, 3);
  } finally {
    globalThis.fetch = originalFetch;
    process.env.BASETEN_API_KEY = originalKey;
  }
});


test('getBasetenStatus reports unconfigured when BASETEN_API_KEY is not set', () => {
  const originalKey = process.env.BASETEN_API_KEY;
  delete process.env.BASETEN_API_KEY;

  const status = getBasetenStatus();
  assert.equal(status.status, 'not_configured');
  assert.equal(status.hasKey, false);
  assert.equal(status.model, 'meta-models/muse-spark-open-1026');

  process.env.BASETEN_API_KEY = originalKey;
});

test('getBasetenStatus reports configured_unverified when BASETEN_API_KEY is provided', () => {
  const originalKey = process.env.BASETEN_API_KEY;
  process.env.BASETEN_API_KEY = 'test-secret-key-do-not-leak';

  const status = getBasetenStatus();
  assert.equal(status.hasKey, true);
  assert.ok(status.status === 'configured_unverified' || status.status === 'verified_live');

  process.env.BASETEN_API_KEY = originalKey;
});

test('validateAndSanitizeMuseOutput safely repairs missing and malformed fields', () => {
  const malformed = {
    name: 'Voltwhir',
    primaryElement: 'InvalidElement',
    appearance: {
      bodyShape: 'invalidShape',
      primaryColor: 'not-hex'
    },
    specialAbility: {
      powerRating: 999
    }
  };

  const sanitized = validateAndSanitizeMuseOutput(malformed, 'Fallback Item');
  assert.equal(sanitized.name, 'Voltwhir');
  // Invalid element repaired to Ceramic
  assert.equal(sanitized.primaryElement, 'Ceramic');
  // Invalid shape repaired to round
  assert.equal(sanitized.appearance.bodyShape, 'round');
  // Power rating clamped to max 99
  assert.equal(sanitized.specialAbility.powerRating, 99);
  // Color fallback
  assert.equal(sanitized.appearance.primaryColor, '#e07a5f');
});

test('analyzeObjectWithBaseten throws 503 when API key is missing', async () => {
  const originalKey = process.env.BASETEN_API_KEY;
  delete process.env.BASETEN_API_KEY;

  await assert.rejects(
    async () => {
      await analyzeObjectWithBaseten({ imageBase64: 'data:image/jpeg;base64,123' });
    },
    (err: any) => {
      assert.equal(err.status, 503);
      assert.ok(err.message.includes('BASETEN_API_KEY is not configured'));
      return true;
    }
  );

  process.env.BASETEN_API_KEY = originalKey;
});

test('analyzeObjectWithBaseten throws 413 for oversized payloads', async () => {
  const originalKey = process.env.BASETEN_API_KEY;
  process.env.BASETEN_API_KEY = 'mock-key';

  // 9MB string
  const hugePayload = 'a'.repeat(9 * 1024 * 1024);

  await assert.rejects(
    async () => {
      await analyzeObjectWithBaseten({ imageBase64: hugePayload });
    },
    (err: any) => {
      assert.equal(err.status, 413);
      return true;
    }
  );

  process.env.BASETEN_API_KEY = originalKey;
});

test('analyzeObjectWithBaseten processes mocked upstream success correctly', async () => {
  const originalKey = process.env.BASETEN_API_KEY;
  process.env.BASETEN_API_KEY = 'mock-baseten-key';

  const originalFetch = globalThis.fetch;

  // Mock global fetch
  globalThis.fetch = async (url: any, opts: any) => {
    assert.equal(url, 'https://inference.baseten.co/v1/chat/completions');
    assert.equal(opts.headers['Authorization'], 'Bearer mock-baseten-key');
    const body = JSON.parse(opts.body);
    assert.equal(body.model, 'meta-models/muse-spark-open-1026');

    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                name: 'Chrono-Optic',
                speciesName: 'Horolo Vitrum',
                title: 'The Brass Chronometer',
                primaryElement: 'Chrono',
                secondaryElement: 'Glass',
                temperament: 'Curious & Chirpy',
                material: 'Sapphire Glass & Brass',
                description: 'An observant pocket lens creature that tracks chronological ripples.',
                appearance: {
                  bodyShape: 'round',
                  primaryColor: '#b08968',
                  secondaryColor: '#00b4d8',
                  accentColor: '#f1c40f',
                  eyeStyle: 'cyclops',
                  hornStyle: 'clock_hands',
                  pattern: 'glazed',
                  size: 1.05
                },
                specialAbility: {
                  name: 'Epoch Lens',
                  description: 'Magnifies temporal pulses.',
                  powerRating: 88,
                  icon: '⏱️🔍'
                },
                inheritedTraits: ['Brass gears', 'Convex lens']
              })
            }
          }
        ]
      })
    } as any;
  };

  try {
    const result = await analyzeObjectWithBaseten({
      imageBase64: 'data:image/png;base64,abc12345',
      objectHint: 'Brass Clock'
    });

    assert.equal(result.name, 'Chrono-Optic');
    assert.equal(result.primaryElement, 'Chrono');
    assert.equal(result.secondaryElement, 'Glass');
    assert.equal(result.specialAbility.name, 'Epoch Lens');
    assert.equal(result.specialAbility.powerRating, 88);
  } finally {
    globalThis.fetch = originalFetch;
    process.env.BASETEN_API_KEY = originalKey;
  }
});

test('validateAndSanitizeMuseOutput validates and sanitizes visualPlan avoiding malicious SVG or code injection', () => {
  const payloadWithMaliciousPlan = {
    name: 'Hackling',
    primaryElement: 'Ceramic',
    visualPlan: {
      archetype: '<script>alert(1)</script>', // invalid archetype
      definingParts: {
        hasHandle: 'yes-string',
        hasRim: true,
        maliciousCode: 'rm -rf /'
      },
      materialSurface: {
        finish: 'invalid_finish',
        glazeColor: 'javascript:void(0)'
      }
    }
  };

  const sanitized = validateAndSanitizeMuseOutput(payloadWithMaliciousPlan, 'Vintage Teapot');
  assert.ok(sanitized.visualPlan);
  // Archetype fallback based on fallback hint 'Vintage Teapot' -> 'teapot'
  assert.equal(sanitized.visualPlan.archetype, 'teapot');
  assert.equal(sanitized.visualPlan.version, 1);
  assert.equal(typeof sanitized.visualPlan.definingParts.hasHandle, 'boolean');
  assert.equal(sanitized.visualPlan.definingParts.hasSpout, true);
  assert.equal(sanitized.visualPlan.definingParts.hasHandle, true);
  // Color sanitized to valid hex
  assert.match(sanitized.visualPlan.materialSurface.glazeColor || '', /^#[0-9a-fA-F]{6}$/);
});


// Global credit reservations and lost-job recovery use synthetic providers only.
test('daily AI reservations survive reload, roll over, cap concurrency and fail closed', async () => {
  const { AiUsageGate } = await import('./spriteService');
  let saved: any = null;
  let now = Date.UTC(2026, 10, 3);
  const read = () => saved;
  const write = (value: any) => { saved = { ...value }; };
  const gate = new AiUsageGate(read, write, () => now, 20, 1);
  const release = gate.reserve('image');
  assert.throws(() => gate.reserve('text'), /busy/i);
  release(); release(); assert.equal(gate.active, 0);
  gate.reserve('image')();
  assert.throws(() => new AiUsageGate(read, write, () => now, 20).reserve('text'), /busy/i);
  now += 86400000;
  gate.reserve('text')(); assert.equal(saved.reservedCents, 5);
  const broken = new AiUsageGate(() => null, () => { throw new Error('disk full'); });
  assert.throws(() => broken.reserve('text'), /busy/i); assert.equal(broken.active, 0);
});

test('unknown jobs are terminal retry errors and background work retains its slot', async () => {
  const { getJob, startJob, aiRequestLease, AiUsageGate } = await import('./spriteService');
  assert.equal(getJob('lost-after-restart').status, 'error');
  assert.match(getJob('lost-after-restart').error!, /try again/i);
  const gate = new AiUsageGate(() => null, () => {}, Date.now, 500, 1);
  let finish!: (value: string) => void;
  const pending = new Promise<string>(resolve => { finish = resolve; });
  const lease = { release: gate.reserve('text'), background: false };
  const id = aiRequestLease.run(lease, () => startJob(() => pending));
  assert.ok(lease.background); assert.equal(gate.active, 1);
  assert.throws(() => gate.reserve('text'), /busy/i);
  finish('done'); await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(getJob(id).status, 'done'); assert.equal(gate.active, 0);
});


test('one trusted proxy ignores a forged leftmost visitor address', async () => {
  const express = (await import('express')).default;
  const app = express(); app.set('trust proxy', 1);
  app.get('/', (req, res) => { res.json({ ip: req.ip }); });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  try {
    const address = server.address() as { port: number };
    const url = 'http://127.0.0.1:' + address.port;
    const first = await (await fetch(url, { headers: { 'X-Forwarded-For': '1.1.1.1, 203.0.113.8' } })).json();
    const second = await (await fetch(url, { headers: { 'X-Forwarded-For': '2.2.2.2, 203.0.113.8' } })).json();
    assert.equal(first.ip, '203.0.113.8'); assert.equal(second.ip, first.ip);
    const direct = await (await fetch(url)).json(); assert.equal(direct.ip, '127.0.0.1');
  } finally { await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())); }
});


test('paid sprite pollers reject lost jobs and busy responses without waiting forever', async () => {
  const { drawFusionArt, drawItemArt } = await import('../src/game/photoSprite');
  const originalFetch = globalThis.fetch;
  let polls = 0;
  try {
    globalThis.fetch = (async (_url: any, options: any) => {
      if (options?.method === 'POST') return new Response(JSON.stringify({ jobId: 'old-server-job' }));
      polls++; return new Response(JSON.stringify({ status: 'error', error: 'Request was interrupted. Please try again.' }));
    }) as typeof fetch;
    await assert.rejects(() => drawFusionArt({ imageA: 'a', imageB: 'b', nameA: 'A', nameB: 'B', hybridName: 'C' }), /try again/i);
    assert.equal(polls, 1);
    globalThis.fetch = (async () => new Response(JSON.stringify({ error: 'Our Oddlings are busy. Please try again later.' }), { status: 429 })) as typeof fetch;
    await assert.rejects(() => drawItemArt('photo', 'mug'), /busy/i);
  } finally { globalThis.fetch = originalFetch; }
});
