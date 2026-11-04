/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { sound } from '../game/soundSynth';
import { FirstRunGoals, IncubatorEgg } from '../game/creatureTypes';
import { walletBook, GEM_ICON, GEM_NAME, SEED_ICON, SEED_NAME, SPARKLE_ICON, SPARKLE_NAME } from '../game/lifeSeeds';
import { SparkleShop } from './SparkleShop';

/** Life Seeds, Craft Gems and Sparkle Coins left, kept current; clicking opens the Sparkle Shop. */
const WalletBadge: React.FC = () => {
  const [wallet, setWallet] = useState(() => walletBook.get());
  const [shopOpen, setShopOpen] = useState(false);
  useEffect(() => walletBook.subscribe(() => setWallet(walletBook.get())), []);
  return (
    <>
    <button
      onClick={() => {
        sound.playClick();
        setShopOpen(true);
      }}
      className="flex items-center gap-2 text-xs font-mono font-bold text-slate-200 whitespace-nowrap cursor-pointer hover:text-amber-300"
      title={SEED_NAME + 's hatch new creatures, ' + GEM_NAME + 's make new items. Open the Sparkle Shop to trade ' + SPARKLE_NAME + 's.'}
    >
      <span>
        {SEED_ICON} <span className="tabular-nums text-emerald-300">{wallet.seeds}</span>
      </span>
      <span>
        {GEM_ICON} <span className="tabular-nums text-fuchsia-300">{wallet.gems}</span>
      </span>
      <span>
        {SPARKLE_ICON} <span className="tabular-nums text-yellow-300">{wallet.sparkles}</span>
      </span>
      <span aria-hidden>🛍️</span>
    </button>
    {shopOpen && <SparkleShop onClose={() => setShopOpen(false)} />}
    </>
  );
};

interface HUDProps {
  creatureCount: number;
  goals: FirstRunGoals;
  isMuted: boolean;
  onToggleMute: () => void;
  onOpenIncubator: () => void;
  onOpenScanner?: () => void;
  activeEgg?: IncubatorEgg | null;
  onOpenFusion: () => void;
  onOpenBestiary: () => void;
  onOpenGoals: () => void;
  onOpenStatus: () => void;
  onOpenSaveRestore?: () => void;
  onReturnTitle: () => void;
}

export const HUD: React.FC<HUDProps> = ({
  creatureCount,
  goals,
  isMuted,
  onToggleMute,
  onOpenIncubator,
  onOpenScanner,
  activeEgg,
  onOpenFusion,
  onOpenBestiary,
  onOpenGoals,
  onOpenStatus,
  onOpenSaveRestore,
  onReturnTitle
}) => {
  const [menu, setMenu] = useState<"Labs" | "Menu" | null>(null);
  useEffect(() => {
    if (!menu) return;
    const dismiss = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('.phone-nav,.hud-tools')) setMenu(null);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [menu]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!activeEgg) return;
    const interval = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(interval);
  }, [activeEgg]);

  const handleOpenIncubator = onOpenIncubator || onOpenScanner || (() => {});

  const remainingMs = activeEgg ? Math.max(0, activeEgg.hatchAt - now) : 0;
  const isEggReady = activeEgg ? remainingMs === 0 : false;
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const countdownFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const completedGoalsCount =
    (goals.discoveredTwo ? 1 : 0) +
    (goals.caredForOddling ? 1 : 0) +
    (goals.fusedSpecies ? 1 : 0) +
    (goals.builtBiomeHome ? 1 : 0);

  // The bar wraps onto more rows on narrow screens; its real height is shared as --hud-h so the
  // biome bar below always starts just under it
  const headerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = headerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const report = () => document.documentElement.style.setProperty('--hud-h', Math.ceil(el.getBoundingClientRect().bottom) + 'px');
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <header ref={headerRef} className="fixed top-3 left-3 right-3 z-[45] pointer-events-none flex flex-wrap items-center justify-between gap-2">
      {/* Top Left: Title Lockup, Bestiary Count & Goals Trigger */}
      <div className="pointer-events-auto flex flex-wrap items-center gap-1.5 sm:gap-2 bg-slate-950/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700 shadow-2xl">
        <button
          onClick={() => {
            sound.playClick();
            onReturnTitle();
          }}
          className="flex items-center gap-1.5 group cursor-pointer hover:opacity-80 transition-opacity whitespace-nowrap"
          title="Back to main screen"
        >
          <span aria-hidden="true" className="text-base">←</span>
          <span className="font-extrabold text-sm font-['Space_Grotesk'] tracking-wider bg-gradient-to-r from-amber-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
            Back
          </span>
        </button>

        <span className="w-1 h-3 bg-slate-700 rounded-full mx-0.5" />

        <button
          onClick={() => {
            sound.playClick();
            onOpenBestiary();
          }}
          className="flex items-center gap-1 text-xs font-mono font-bold text-slate-200 hover:text-amber-400 transition-colors cursor-pointer"
          title="Open Collection"
        >
          <span>📖</span>
          <span className="tabular-nums font-bold text-amber-400">{creatureCount}</span>
          <span className="hidden md:inline text-slate-300">Discovered</span>
        </button>

        <span className="w-1 h-3 bg-slate-700 rounded-full mx-0.5" />

        <WalletBadge />

        <span className="w-1 h-3 bg-slate-700 rounded-full mx-0.5" />

        {/* Goals Checklist Trigger */}
        <button
          onClick={() => {
            sound.playClick();
            onOpenGoals();
          }}
          className={`flex items-center gap-1 text-xs font-mono font-bold px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
            completedGoalsCount === 4
              ? 'bg-emerald-950 text-emerald-300 border-emerald-600 shadow-sm'
              : 'bg-amber-950/80 text-amber-300 border-amber-700 hover:bg-amber-900'
          }`}
          title="View First-Run Goals Checklist"
        >
          <span>🎯</span>
          <span className="font-bold">{completedGoalsCount}/4</span>
          <span className="hidden sm:inline text-slate-200 habitat-goals">Goals</span>
        </button>
      </div>

      {/* Top Right: Core Action Clusters (Active Egg, Incubator, Fusion, Guide, Status, Sound) */}
      <div className="phone-nav pointer-events-auto">{(['Labs','Menu'] as const).map(label => <button key={label} aria-expanded={menu === label} onClick={() => setMenu(menu === label ? null : label)}>{label}</button>)}</div>
      <div data-phone-menu={menu || ''} onClick={() => setMenu(null)} className="hud-tools pointer-events-auto flex flex-wrap items-center gap-1.5 sm:gap-2">
        {/* Active Egg Countdown Widget */}
        {activeEgg && (
          <button
            aria-label="Open incubator"
          onClick={() => {
              sound.playClick();
              handleOpenIncubator();
            }}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-mono font-bold transition-all hover:scale-105 active:scale-95 shadow-md cursor-pointer ${
              isEggReady
                ? 'bg-emerald-950/90 border-emerald-500 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.4)] animate-pulse'
                : 'bg-amber-950/90 border-amber-500/80 text-amber-300'
            }`}
            title="Open Active Egg Incubator"
          >
            <span>{isEggReady ? '🐣' : '🥚'}</span>
            <span className="tabular-nums tracking-wider">{isEggReady ? 'HATCH!' : countdownFormatted}</span>
          </button>
        )}

        <button
          aria-label="Open incubator"
          onClick={() => {
            sound.playClick();
            handleOpenIncubator();
          }}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-amber-950/80 hover:bg-amber-900 border border-amber-700 text-amber-300 text-xs font-mono font-bold transition-all hover:scale-105 active:scale-95 shadow-md cursor-pointer"
        >
          <span>🥚</span>
          <span className="hidden lg:inline">INCUBATOR</span>
        </button>

        <button
          aria-label="Open Fusion Lab"
          onClick={() => {
            sound.playClick();
            onOpenFusion();
          }}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-pink-950/80 hover:bg-pink-900 border border-pink-800 text-pink-300 text-xs font-mono font-bold transition-all hover:scale-105 active:scale-95 shadow-md cursor-pointer"
        >
          <span>🧬</span>
          <span className="hidden lg:inline">FUSION</span>
        </button>

        <button
          onClick={() => {
            sound.playClick();
            onOpenBestiary();
          }}
          className="hidden sm:flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-mono font-bold transition-all hover:scale-105 active:scale-95 shadow-md cursor-pointer"
        >
          <span>📖</span>
          <span className="hidden lg:inline">COLLECTION</span>
        </button>

        {/* Integration Status Modal Trigger */}
        <button
          onClick={() => {
            sound.playClick();
            onOpenStatus();
          }}
          className="px-2 sm:px-2.5 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 text-xs font-mono transition-all hover:scale-105 active:scale-95 shadow-md cursor-pointer flex items-center gap-1"
          title="View System & Model Integration Status"
        >
          <span>⚙️</span>
          <span className="hidden md:inline text-[11px]">Audit</span>
        </button>

        {/* Save & Restore Trigger */}
        {onOpenSaveRestore && (
          <button
            onClick={() => {
              sound.playClick();
              onOpenSaveRestore();
            }}
            className="px-2 sm:px-2.5 py-1.5 rounded-xl bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-800 text-cyan-300 text-xs font-mono font-semibold transition-all hover:scale-105 active:scale-95 shadow-md cursor-pointer flex items-center gap-1"
            title="Portable Save & Restore (Transfer between devices)"
          >
            <span>💾</span>
            <span className="hidden lg:inline text-[11px]">Save</span>
          </button>
        )}

        {/* Audio Mute Toggle [M] */}
        <button
          onClick={onToggleMute}
          className="w-8 h-8 rounded-xl bg-slate-900/90 border border-slate-700 hover:border-slate-500 text-slate-300 flex items-center justify-center text-xs font-mono transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-md"
          title={`Audio Sound [M]: ${isMuted ? 'Muted' : 'Active'}`}
        >
          {isMuted ? '🔇' : '🔊'}
        </button>
      </div>
    </header>
  );
};
