import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpeech, speechIsVisible, canSpeak, getWorldAtmosphere, loadWorldEpoch, WORLD_DAY_MS, WORLD_CLOCK_KEY } from './worldAtmosphere';

test('Speech expires at three wall-clock seconds without simulation ticks', () => {
  const speech = createSpeech('Hello', 1000);
  assert.equal(speechIsVisible(speech, 3999), true);
  assert.equal(speechIsVisible(speech, 4000), false);
  assert.equal(speechIsVisible(speech, 50000), false);
  assert.equal(canSpeak(speech, 4000), false);
  assert.equal(canSpeak(speech, 6000), true);
  assert.equal(speechIsVisible({ bubbleText: 'legacy stuck comment' }, 1000), false);
});

test('Shared World clock progresses through day, sunset, night and dawn then loops', () => {
  const day = getWorldAtmosphere(WORLD_DAY_MS * .25);
  const sunset = getWorldAtmosphere(WORLD_DAY_MS * .6);
  const night = getWorldAtmosphere(WORLD_DAY_MS * .8);
  const dawn = getWorldAtmosphere(WORLD_DAY_MS * .96);
  assert.equal(day.label, 'Day'); assert.equal(sunset.label, 'Sunset');
  assert.equal(night.label, 'Night'); assert.equal(dawn.label, 'Dawn');
  assert.ok(day.sunOpacity > 0); assert.equal(night.sunOpacity, 0);
  assert.ok(sunset.sunY > day.sunY);
  assert.ok(night.starOpacity > .9); assert.equal(day.starOpacity, 0);
  assert.ok(night.light < sunset.light && sunset.light < day.light);
  assert.deepEqual(getWorldAtmosphere(12345), getWorldAtmosphere(WORLD_DAY_MS + 12345));
  for (let n = 0; n < 1000; n++) {
    const a = getWorldAtmosphere(WORLD_DAY_MS * n / 1000);
    assert.ok(a.sunX >= 8 && a.sunX <= 92); assert.ok(a.sunY >= 7 && a.sunY <= 72);
    assert.ok(a.light >= 0 && a.light <= 1); assert.ok(Number.isFinite(a.phase));
  }
});

test('World epoch survives reload and repairs invalid stored clock values', () => {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) } });
  assert.equal(loadWorldEpoch(1000), 1000);
  assert.equal(loadWorldEpoch(5000), 1000);
  values.set(WORLD_CLOCK_KEY, 'NaN'); assert.equal(loadWorldEpoch(6000), 6000);
  values.set(WORLD_CLOCK_KEY, '999999'); assert.equal(loadWorldEpoch(7000), 7000);
});
