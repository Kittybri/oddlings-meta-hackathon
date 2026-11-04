/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Gift tastes: every creature loves one treat, likes another, dislikes one,
 * and is neutral about the rest. Tastes are discovered by giving treats.
 */

export type Taste = 'loved' | 'liked' | 'neutral' | 'disliked';

export const TASTE_TRUST: Record<Taste, number> = { loved: 15, liked: 10, neutral: 7, disliked: -3 };
export const TASTE_ICON: Record<Taste, string> = { loved: '❤️', liked: '👍', neutral: '🙂', disliked: '🤢' };
export const TASTE_KEY = 'oddlings_tastes_v1';

const REACTIONS: Record<Taste, string[]> = {
  loved: ['LOVE it! ❤️', 'My favorite! 💖', 'Best. Day. Ever! ✨'],
  liked: ['Yum! 😋', 'Tasty! 👍', 'Mmm, nice!'],
  neutral: ['Thanks! 🙂', 'Okay snack!', 'Munch munch.'],
  disliked: ['Ew... 🤢', 'Not my taste...', 'Blegh! 😖']
};

const FLAVOR: Record<Taste, string> = {
  loved: 'Radiated pure joy!',
  liked: 'Munched happily.',
  neutral: 'Ate politely.',
  disliked: 'Made a funny face.'
};

/** FNV-1a, so the same creature always gets the same tastes. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

interface TasteCreature {
  id: string;
  primaryElement?: string;
  secondaryElement?: string;
}

/** Treat elements ordered from most to least loved for this creature. */
export function tasteRanking(creature: TasteCreature, elements: string[]): string[] {
  const unique = [...new Set(elements)];
  const first: string[] = [];
  for (const e of [creature.primaryElement, creature.secondaryElement]) {
    if (e && unique.includes(e) && !first.includes(e)) first.push(e);
  }
  const rest = unique.filter((e) => !first.includes(e)).sort((a, b) => hash(creature.id + a) - hash(creature.id + b) || a.localeCompare(b));
  return [...first, ...rest];
}

export function tasteOf(creature: TasteCreature, treatElement: string, elements: string[]): Taste {
  const order = tasteRanking(creature, elements);
  const i = order.indexOf(treatElement);
  if (i < 0) return 'neutral';
  if (i === 0) return 'loved';
  if (i === 1) return 'liked';
  if (i === order.length - 1 && order.length >= 3) return 'disliked';
  return 'neutral';
}

export function reactionLine(taste: Taste, rand: () => number = Math.random): string {
  const lines = REACTIONS[taste];
  return lines[Math.floor(rand() * lines.length)];
}

/** Memory text for a gift; the diary reads the taste and treat name back out of it. */
export function giftMemory(taste: Taste, treatName: string): string {
  return `Gift ${taste}: ${treatName}. ${FLAVOR[taste]}`;
}

export function clampTrust(trust: number, delta: number): number {
  return Math.max(0, Math.min(100, trust + delta));
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function safeStorage(): StorageLike | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

/** Remembers which tastes the player has discovered, per creature and treat. */
export class TasteBook {
  private data: Record<string, Record<string, Taste>>;
  private listeners = new Set<() => void>();

  constructor(private store: StorageLike | null = safeStorage()) {
    this.data = {};
    try {
      const raw = this.store?.getItem(TASTE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      if (parsed && typeof parsed === 'object') this.data = parsed;
    } catch {
      this.data = {};
    }
  }

  known(creatureId: string): Record<string, Taste> {
    return this.data[creatureId] || {};
  }

  reveal(creatureId: string, treatId: string, taste: Taste): void {
    if (this.data[creatureId]?.[treatId] === taste) return;
    this.data[creatureId] = { ...this.data[creatureId], [treatId]: taste };
    try {
      this.store?.setItem(TASTE_KEY, JSON.stringify(this.data));
    } catch {
      /* private mode: tastes just won't persist */
    }
    this.listeners.forEach((fn) => fn());
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

/** Shared instance used by the game UI. */
export const tasteBook = new TasteBook();
