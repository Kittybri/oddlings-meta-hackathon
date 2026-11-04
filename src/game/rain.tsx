/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Rain drops and ground splashes. Every drop is aimed at the ground height of the
 * column it lands in, so rain hits the terrain, the water and the platforms.
 * The simulation is plain data, so it can run in a worker and keep falling smoothly
 * even when the page's main thread stalls for a moment.
 */

export const MAX_DROPS = 480;
export const SPLASH_LIFE_S = 0.32;
export const SPLASH_GRAVITY = 300;
export const SPLASH_CHANCE = 0.3; // only some drops make a visible splash
export const DROPS_PER_SECOND = 300; // at full intensity across a 900px wide view
export const DRIFT_X = -50; // wind pushes drops to the left as they fall
export const DEFAULT_GROUND = 0.75;

export interface Drop {
  x: number;
  y: number;
  vx: number;
  vy: number;
  len: number;
  near: boolean; // nearer drops are a little longer, faster and brighter
  landX: number; // where this drop will hit
  target: number; // y of the ground it will hit
}

export interface SplashParticle {
  vx: number;
  vy: number;
}

export interface Splash {
  x: number;
  y: number;
  age: number;
  parts: SplashParticle[];
}

export interface Pixel {
  x: number;
  y: number;
  w: number;
  h: number;
  alpha: number;
}

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);

/** How many new drops this frame, carrying the fraction to the next one. */
export function dropsToSpawn(intensity: number, width: number, dt: number, carry: number, reduced = false): { count: number; carry: number } {
  const rate = clamp01(intensity) * DROPS_PER_SECOND * (width / 900) * (reduced ? 0.35 : 1);
  const total = carry + rate * dt;
  const count = Math.floor(total);
  return { count, carry: total - count };
}

/**
 * A new drop that lands at landX on the ground (a fraction of the view height from groundAt).
 * It starts above the view, shifted so the wind carries it onto landX.
 */
export function spawnDrop(rng: () => number, width: number, height: number, groundAt: (x: number) => number): Drop {
  const landX = rng() * width;
  const target = Math.max(4, Math.min(height, groundAt(landX) * height - rng() * 3));
  const near = rng() < 0.4;
  const vy = near ? 700 + rng() * 250 : 480 + rng() * 200;
  const startY = -12 - rng() * 30;
  const fall = (target - startY) / vy;
  const len = near ? 5 + Math.floor(rng() * 4) : 3 + Math.floor(rng() * 3);
  return { x: landX - DRIFT_X * fall, y: startY, vx: DRIFT_X, vy, len, near, landX, target };
}

export function stepDrops(drops: Drop[], dt: number): { alive: Drop[]; landed: Drop[] } {
  const alive: Drop[] = [];
  const landed: Drop[] = [];
  for (const d of drops) {
    const y = d.y + d.vy * dt;
    if (y >= d.target) {
      landed.push(d);
    } else {
      alive.push({ ...d, y, x: d.x + d.vx * dt });
    }
  }
  return { alive, landed };
}

export function shouldSplash(rng: () => number): boolean {
  return rng() < SPLASH_CHANCE;
}

export function makeSplash(rng: () => number, drop: Drop): Splash {
  const parts: SplashParticle[] = [];
  for (let i = 0; i < 2; i++) {
    const dir = i === 0 ? -1 : 1;
    parts.push({ vx: dir * (18 + rng() * 26), vy: -(25 + rng() * 22) });
  }
  return { x: drop.landX, y: drop.target, age: 0, parts };
}

export function stepSplashes(splashes: Splash[], dt: number): Splash[] {
  const out: Splash[] = [];
  for (const s of splashes) {
    const age = s.age + dt;
    if (age < SPLASH_LIFE_S) out.push({ ...s, age });
  }
  return out;
}

/** The pixels of one splash: a small spreading ripple plus two tiny droplets. */
export function splashPixels(s: Splash): Pixel[] {
  const p = s.age / SPLASH_LIFE_S;
  const alpha = 1 - p;
  const ripple = 2 + p * 6;
  const out: Pixel[] = [{ x: Math.round(s.x - ripple / 2), y: Math.round(s.y), w: Math.round(ripple), h: 1, alpha: alpha * 0.6 }];
  for (const part of s.parts) {
    out.push({
      x: Math.round(s.x + part.vx * s.age),
      y: Math.round(s.y + part.vy * s.age + 0.5 * SPLASH_GRAVITY * s.age * s.age),
      w: 1,
      h: 1,
      alpha: alpha * 0.9
    });
  }
  return out;
}

/** One layer of falling rain for a view of a given size. */
export class RainSim {
  drops: Drop[] = [];
  splashes: Splash[] = [];
  width = 0;
  height = 0;
  rain = 0;
  private carry = 0;
  private ground: number[] = [];

  constructor(private rng: () => number = Math.random, private reduced = false) {}

  resize(width: number, height: number): void {
    this.width = Math.max(0, width);
    this.height = Math.max(0, height);
  }

  setRain(value: number): void {
    this.rain = clamp01(value);
  }

  /** Ground height for each tile column, as a fraction of the view height. */
  setGround(columns: number[]): void {
    this.ground = columns.map(clamp01);
  }

  groundAt = (x: number): number => {
    if (!this.ground.length || this.width <= 0) return DEFAULT_GROUND;
    const col = Math.max(0, Math.min(this.ground.length - 1, Math.floor((x / this.width) * this.ground.length)));
    return this.ground[col];
  };

  /** True while there is anything left to draw or more rain to make. */
  get active(): boolean {
    return this.rain > 0.01 || this.drops.length > 0 || this.splashes.length > 0;
  }

  step(dt: number): void {
    if (this.width <= 0 || this.height <= 0) return;
    const step = Math.max(0, Math.min(0.05, dt));
    const spawn = dropsToSpawn(this.rain, this.width, step, this.carry, this.reduced);
    this.carry = spawn.carry;
    for (let i = 0; i < spawn.count && this.drops.length < MAX_DROPS; i++) {
      this.drops.push(spawnDrop(this.rng, this.width, this.height, this.groundAt));
    }
    const moved = stepDrops(this.drops, step);
    this.drops = moved.alive;
    for (const d of moved.landed) {
      if (shouldSplash(this.rng)) this.splashes.push(makeSplash(this.rng, d));
    }
    this.splashes = stepSplashes(this.splashes, step);
  }
}

export interface CanvasLike {
  clearRect(x: number, y: number, w: number, h: number): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  fillStyle: string | CanvasGradient | CanvasPattern;
  globalAlpha: number;
}

/** Draws the current rain: thin streaks (1px wide) and small splashes. */
export function drawRain(ctx: CanvasLike, sim: RainSim): void {
  ctx.clearRect(0, 0, sim.width, sim.height);
  ctx.fillStyle = 'rgb(190, 212, 245)';
  ctx.globalAlpha = 0.55;
  for (const d of sim.drops) if (!d.near) ctx.fillRect(Math.round(d.x), Math.round(d.y - d.len), 1, d.len);
  ctx.fillStyle = 'rgb(220, 234, 255)';
  ctx.globalAlpha = 0.85;
  for (const d of sim.drops) if (d.near) ctx.fillRect(Math.round(d.x), Math.round(d.y - d.len), 1, d.len);
  ctx.fillStyle = 'rgb(230, 240, 255)';
  for (const s of sim.splashes) {
    for (const p of splashPixels(s)) {
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillRect(p.x, p.y, p.w, p.h);
    }
  }
  ctx.globalAlpha = 1;
}

/** Fraction of the view height where the ground starts in each tile column of a world. */
export function groundColumns(tiles: ReadonlyArray<ReadonlyArray<string>> | undefined): number[] {
  if (!tiles || !tiles.length || !tiles[0]?.length) return [];
  const rows = tiles.length;
  const cols = tiles[0].length;
  const out: number[] = [];
  for (let x = 0; x < cols; x++) {
    let row = -1;
    for (let y = 0; y < rows; y++) {
      if (tiles[y][x] !== 'air') {
        row = y;
        break;
      }
    }
    out.push(row === -1 ? 0.9 : row / rows);
  }
  return out;
}
