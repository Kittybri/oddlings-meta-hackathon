/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Friendship hearts: one heart per 10 trust, ten hearts in total.
 */

export const MAX_HEARTS = 10;
export const TRUST_PER_HEART = 10;

const TITLES = [
  'Stranger',
  'Curious',
  'Acquainted',
  'Friendly',
  'Buddy',
  'Good Friend',
  'Close Friend',
  'Best Friend',
  'Soulmate',
  'Forever Friend',
  'Forever Friend'
];

export function heartsFromTrust(trust: unknown): number {
  const t = typeof trust === 'number' && Number.isFinite(trust) ? trust : 0;
  return Math.max(0, Math.min(MAX_HEARTS, Math.floor(t / TRUST_PER_HEART)));
}

export function heartTitle(hearts: number): string {
  return TITLES[Math.max(0, Math.min(MAX_HEARTS, Math.floor(hearts)))];
}

export interface HeartUp {
  creatureId: string;
  name: string;
  hearts: number;
  title: string;
}

/**
 * Remembers each creature's heart count and reports new hearts earned.
 * The first pass, and any creature first seen later, only sets a baseline,
 * so loading a save or hatching a creature never pops a celebration.
 */
export class HeartTracker {
  private last = new Map<string, number>();
  private started = false;

  update(creatures: Array<{ id: string; name: string; stats?: { trust?: number } }>): HeartUp[] {
    const ups: HeartUp[] = [];
    for (const c of creatures || []) {
      if (!c?.id) continue;
      const hearts = heartsFromTrust(c.stats?.trust);
      const before = this.last.get(c.id);
      if (this.started && before !== undefined && hearts > before) {
        ups.push({ creatureId: c.id, name: c.name, hearts, title: heartTitle(hearts) });
      }
      this.last.set(c.id, hearts);
    }
    this.started = true;
    return ups;
  }
}
