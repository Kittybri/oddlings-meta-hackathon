import type { CreatureDNA } from './creatureTypes';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Life Seeds, Craft Gems and Sparkle Coins: the player's allowance for turning photos into things.
 * A Life Seed hatches a creature, a Craft Gem makes an item. Players start with a few
 * and earn more by finishing photo quests. Quest photo checks are limited per day.
 * Sparkle Coins are earned by caring for creatures and finishing quests, and buy more of
 * all three in the Sparkle Shop.
 */

export const START_SEEDS = 10;
export const START_GEMS = 5;
export const START_SPARKLES = 15; // enough to try the shop once
export const QUEST_CHECKS_PER_DAY = 15; // photo checks, so a few misses still leave room for wins
export const GEM_EVERY_QUESTS = 2; // a Craft Gem for every 2nd finished quest
export const QUEST_SPARKLES = 5;
export const CARE_SPARKLES_PER_DAY = 20; // petting, feeding, playing and naps earn 1 each, up to this a day
export const WALLET_KEY = 'oddlings_wallet_v1';

export const SEED_NAME = 'Life Seed';
export const GEM_NAME = 'Craft Gem';
export const SPARKLE_NAME = 'Sparkle Coin';
export const SEED_ICON = '🌱';
export const GEM_ICON = '🔮';
export const SPARKLE_ICON = '✨';

export interface Wallet {
  seeds: number;
  gems: number;
  sparkles: number;
  questsDone: number;
  checksDay: string; // local date the check counts belong to
  checksToday: number;
  bonusChecks: number; // extra checks bought for checksDay
  careDay: string; // local date the care earnings belong to
  careToday: number;
  /** One-time rewards already paid out (for example the first garden adventure), so none is ever paid twice */
  receipts: string[];
  fusion?: { id: string; cost: number; result?: CreatureDNA };
}

export const NEW_WALLET: Wallet = {
  seeds: START_SEEDS,
  gems: START_GEMS,
  sparkles: START_SPARKLES,
  questsDone: 0,
  checksDay: '',
  checksToday: 0,
  bonusChecks: 0,
  careDay: '',
  careToday: 0,
  receipts: []
};

const count = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : fallback);
const day = (v: unknown) => (typeof v === 'string' ? v.slice(0, 10) : '');

export function cleanWallet(raw: any): Wallet {
  if (!raw || typeof raw !== 'object') return { ...NEW_WALLET };
  return {
    fusion: raw.fusion && typeof raw.fusion.id === 'string' && Number.isFinite(raw.fusion.cost) && raw.fusion.cost > 0 ? raw.fusion : undefined,
    seeds: count(raw.seeds, START_SEEDS),
    gems: count(raw.gems, START_GEMS),
    sparkles: count(raw.sparkles, START_SPARKLES),
    questsDone: count(raw.questsDone, 0),
    checksDay: day(raw.checksDay),
    checksToday: count(raw.checksToday, 0),
    bonusChecks: count(raw.bonusChecks, 0),
    careDay: day(raw.careDay),
    careToday: count(raw.careToday, 0),
    receipts: Array.isArray(raw.receipts) ? raw.receipts.filter((r: unknown): r is string => typeof r === 'string').slice(-50) : []
  };
}

export const dayOf = (now: number): string => {
  const d = new Date(now);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

/** The wallet with today's check counts (yesterday's are dropped). */
function checksForToday(w: Wallet, now: number): Wallet {
  const today = dayOf(now);
  return w.checksDay === today ? w : { ...w, checksDay: today, checksToday: 0, bonusChecks: 0 };
}

export function checksLeft(w: Wallet, now: number): number {
  const t = checksForToday(w, now);
  return Math.max(0, QUEST_CHECKS_PER_DAY + t.bonusChecks - t.checksToday);
}

/** Records one quest photo check; null when today's checks are used up. */
export function recordCheck(w: Wallet, now: number): Wallet | null {
  if (checksLeft(w, now) <= 0) return null;
  const t = checksForToday(w, now);
  return { ...t, checksToday: t.checksToday + 1 };
}

/** Refunds one quest photo check on local read/decode failure or provider error; handles day rollover safely. */
export function refundCheck(w: Wallet, now = Date.now(), reservedDay = dayOf(now)): Wallet | null {
  const t = checksForToday(w, now);
  // A late failure must never refund a different day's reservation.
  if (t.checksDay !== reservedDay) return t;
  if (t.checksToday > 0) {
    return { ...t, checksToday: t.checksToday - 1 };
  }
  return t;
}

/** A finished quest: +1 Life Seed, Sparkle Coins, and a Craft Gem every GEM_EVERY_QUESTS quests. */
export function questReward(w: Wallet): { wallet: Wallet; seeds: number; gems: number; sparkles: number } {
  const questsDone = w.questsDone + 1;
  const gems = questsDone % GEM_EVERY_QUESTS === 0 ? 1 : 0;
  return {
    wallet: { ...w, questsDone, seeds: w.seeds + 1, gems: w.gems + gems, sparkles: w.sparkles + QUEST_SPARKLES },
    seeds: 1,
    gems,
    sparkles: QUEST_SPARKLES
  };
}

/** One care action (pet, feed, play, nap): +1 Sparkle Coin until today's care limit. */
export function careReward(w: Wallet, now: number): Wallet | null {
  const today = dayOf(now);
  const careToday = w.careDay === today ? w.careToday : 0;
  if (careToday >= CARE_SPARKLES_PER_DAY) return null;
  return { ...w, sparkles: w.sparkles + 1, careDay: today, careToday: careToday + 1 };
}

export function spend(w: Wallet, kind: 'seeds' | 'gems'): Wallet | null {
  return w[kind] > 0 ? { ...w, [kind]: w[kind] - 1 } : null;
}

// ---- The Sparkle Shop ----

export interface ShopItem {
  id: string;
  icon: string;
  name: string;
  description: string;
  price: number;
  /** The wallet after buying, or null when it would do nothing right now. */
  apply: (w: Wallet, now: number) => Wallet | null;
}

export const SHOP_ITEMS: ShopItem[] = [
  {
    id: 'check',
    icon: '📸',
    name: '+1 Quest Check',
    description: 'One more quest photo today',
    price: 5,
    apply: (w, now) => {
      const t = checksForToday(w, now);
      return { ...t, bonusChecks: t.bonusChecks + 1 };
    }
  },
  {
    id: 'check-refill',
    icon: '📸',
    name: 'Quest Refill',
    description: 'Back to ' + QUEST_CHECKS_PER_DAY + ' quest photos today',
    price: 30,
    apply: (w, now) => (checksLeft(w, now) >= QUEST_CHECKS_PER_DAY ? null : { ...checksForToday(w, now), checksToday: 0, bonusChecks: 0 })
  },
  {
    id: 'seed',
    icon: SEED_ICON,
    name: '+1 ' + SEED_NAME,
    description: 'Hatch one more creature',
    price: 10,
    apply: (w) => ({ ...w, seeds: w.seeds + 1 })
  },
  {
    id: 'seed-bundle',
    icon: SEED_ICON,
    name: 'Seed Bundle',
    description: 'Back up to ' + START_SEEDS + ' ' + SEED_NAME + 's',
    price: 40,
    apply: (w) => (w.seeds >= START_SEEDS ? null : { ...w, seeds: START_SEEDS })
  },
  {
    id: 'gem',
    icon: GEM_ICON,
    name: '+1 ' + GEM_NAME,
    description: 'Make one more item',
    price: 8,
    apply: (w) => ({ ...w, gems: w.gems + 1 })
  },
  {
    id: 'gem-bundle',
    icon: GEM_ICON,
    name: 'Gem Bundle',
    description: 'Back up to ' + START_GEMS + ' ' + GEM_NAME + 's',
    price: 30,
    apply: (w) => (w.gems >= START_GEMS ? null : { ...w, gems: START_GEMS })
  }
];

export type BuyResult = { ok: true; wallet: Wallet } | { ok: false; reason: 'unknown' | 'too-poor' | 'already-full' | 'storage' };

export function buy(w: Wallet, itemId: string, now: number): BuyResult {
  const item = SHOP_ITEMS.find((i) => i.id === itemId);
  if (!item) return { ok: false, reason: 'unknown' };
  const next = item.apply(w, now);
  if (!next) return { ok: false, reason: 'already-full' };
  if (w.sparkles < item.price) return { ok: false, reason: 'too-poor' };
  return { ok: true, wallet: { ...next, sparkles: next.sparkles - item.price } };
}

interface Store {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const browserStore = (): Store | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};

/** The saved wallet, shared by the incubator, the item maker, quests, the shop and the top bar. */
export class WalletBook {
  private listeners = new Set<() => void>();
  constructor(private store: Store | null = browserStore(), private clock: () => number = Date.now) {}

  get(): Wallet {
    try {
      return cleanWallet(JSON.parse(this.store?.getItem(WALLET_KEY) || 'null'));
    } catch {
      return { ...NEW_WALLET };
    }
  }

  /** Saves the wallet and reports whether the save really stuck (read back and compared). */
  private save(w: Wallet): boolean {
    const text = JSON.stringify(w);
    let ok = false;
    try {
      this.store?.setItem(WALLET_KEY, text);
      ok = !!this.store && this.store.getItem(WALLET_KEY) === text;
    } catch {
      ok = false; // blocked or full storage
    }
    this.reload();
    return ok;
  }

  hasReceipt(id: string): boolean {
    return this.get().receipts.includes(id);
  }

  /**
   * Pays a one-time reward. The currency and its receipt go into the wallet in a single save, so the
   * reward is either fully paid and recorded or not paid at all. Asking again after it was paid
   * returns 'already' and pays nothing.
   */
  claimOnce(id: string, seeds: number, gems: number, sparkles: number): 'granted' | 'already' | 'failed' {
    const w = this.get(); // fresh from storage, so another tab's claim is seen
    if (w.receipts.includes(id)) return 'already';
    const ok = this.save({
      ...w,
      seeds: w.seeds + seeds,
      gems: w.gems + gems,
      sparkles: w.sparkles + sparkles,
      receipts: [...w.receipts, id].slice(-50)
    });
    return ok ? 'granted' : 'failed';
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  reload(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch {}
    }
  }

  beginFusion(cost: number): string | null {
    const w = this.get();
    if (w.fusion || w.sparkles < cost) return null;
    const id = crypto.randomUUID();
    return this.save({ ...w, sparkles: w.sparkles - cost, fusion: { id, cost } }) ? id : null;
  }

  finishFusion(id: string, result: CreatureDNA): boolean {
    const w = this.get();
    return w.fusion?.id === id && this.save({ ...w, fusion: { ...w.fusion, result } });
  }

  refundFusion(id: string): boolean {
    const w = this.get();
    if (w.fusion?.id !== id) return true;
    return this.save({ ...w, sparkles: w.sparkles + w.fusion.cost, fusion: undefined });
  }

  claimFusion(id: string): boolean {
    const w = this.get();
    return w.fusion?.id !== id || this.save({ ...w, fusion: undefined });
  }

  spendSeed(): boolean {
    const next = spend(this.get(), 'seeds');
    return !!next && this.save(next);
  }

  spendGem(): boolean {
    const next = spend(this.get(), 'gems');
    return !!next && this.save(next);
  }

  refundSeed(): boolean {
    const w = this.get();
    return this.save({ ...w, seeds: w.seeds + 1 });
  }

  /** Spends Sparkle Coins (the Fusion Lab's price); false when there are not enough. */
  spendSparkles(n: number): boolean {
    const w = this.get();
    if (w.sparkles < n) return false;
    return this.save({ ...w, sparkles: w.sparkles - n });
  }

  refundSparkles(n: number): boolean {
    const w = this.get();
    return this.save({ ...w, sparkles: w.sparkles + n });
  }

  refundGem(): boolean {
    const w = this.get();
    return this.save({ ...w, gems: w.gems + 1 });
  }

  rewardAdventure(seeds = 1, gems = 1, sparkles = 20): { seeds: number; gems: number; sparkles: number } {
    const w = this.get();
    if (!this.save({
      ...w,
      seeds: w.seeds + seeds,
      gems: w.gems + gems,
      sparkles: w.sparkles + sparkles
    })) throw new Error('Could not save the reward. Free device space and try again.');
    return { seeds, gems, sparkles };
  }

  checksLeft(): number {
    return checksLeft(this.get(), this.clock());
  }

  recordCheck(): boolean {
    const next = recordCheck(this.get(), this.clock());
    return !!next && this.save(next);
  }

  refundCheck(reservedDay?: string): boolean {
    const next = refundCheck(this.get(), this.clock(), reservedDay);
    return !!next && this.save(next);
  }

  rewardQuest(): { seeds: number; gems: number; sparkles: number } {
    const out = questReward(this.get());
    if (!this.save(out.wallet)) throw new Error("Could not save your reward. Free device space and try again.");
    return { seeds: out.seeds, gems: out.gems, sparkles: out.sparkles };
  }

  /** +1 Sparkle Coin for a care action; false once today's care coins are all earned. */
  rewardCare(): boolean {
    const next = careReward(this.get(), this.clock());
    return !!next && this.save(next);
  }

  /** Whether an item can be bought right now, and why not. */
  check(itemId: string): BuyResult {
    return buy(this.get(), itemId, this.clock());
  }

  buy(itemId: string): BuyResult {
    const out = buy(this.get(), itemId, this.clock());
    if (out.ok && !this.save(out.wallet)) return { ok: false, reason: "storage" };
    return out;
  }
}

export const walletBook = new WalletBook();
