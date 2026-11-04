/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Draws rain on an OffscreenCanvas in a worker, so it keeps falling smoothly even
 * when the page's main thread is busy with the game.
 */

import { RainSim, drawRain } from './rain';

type RainMessage =
  | { type: 'init'; canvas: OffscreenCanvas; width: number; height: number; reduced: boolean }
  | { type: 'resize'; width: number; height: number }
  | { type: 'rain'; value: number }
  | { type: 'ground'; columns: number[] };

const scope: any = self;
let canvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;
let sim = new RainSim();
let running = false;
let last = 0;

const nextFrame = (cb: (t: number) => void) =>
  typeof scope.requestAnimationFrame === 'function' ? scope.requestAnimationFrame(cb) : setTimeout(() => cb(performance.now()), 16);

function frame(now: number) {
  if (!canvas || !ctx) {
    running = false;
    return;
  }
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  sim.step(dt);
  drawRain(ctx as any, sim);
  if (sim.active) {
    nextFrame(frame);
  } else {
    running = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

function ensureRunning() {
  if (!running && sim.active && ctx) {
    running = true;
    last = performance.now();
    nextFrame(frame);
  }
}

scope.onmessage = (e: MessageEvent<RainMessage>) => {
  const m = e.data;
  if (m.type === 'init') {
    canvas = m.canvas;
    canvas.width = m.width;
    canvas.height = m.height;
    ctx = canvas.getContext('2d');
    sim = new RainSim(Math.random, m.reduced);
    sim.resize(m.width, m.height);
  } else if (m.type === 'resize' && canvas) {
    canvas.width = m.width;
    canvas.height = m.height;
    sim.resize(m.width, m.height);
  } else if (m.type === 'rain') {
    sim.setRain(m.value);
    ensureRunning();
  } else if (m.type === 'ground') {
    sim.setGround(m.columns);
  }
};
