import { MusicToggle } from './MusicToggle';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { OddlingAvatar } from './OddlingAvatar';
import { INITIAL_ODDLINGS } from '../game/creatureCatalog';
import { sound } from '../game/soundSynth';
import { fetchBasetenStatus, getCachedBasetenStatus, BasetenStatus } from '../services/basetenClient';
import { SparkleShop } from './SparkleShop';

interface TitleScreenProps {
  onStart: () => void;
  onOpenIncubator?: () => void;
  onOpenScanner?: () => void;
  onOpenFusion: () => void;
  basetenStatus?: BasetenStatus | null;
}


// The ODDLINGS logo drawn from chunky pixels: a 5x7 pixel font, sunset color bands (one color per pixel row),
// a dark pixel outline, a hard drop shadow, and two little sparkle pixels
const LOGO_GLYPHS: Record<string, string[]> = {
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  N: ['#...#', '##..#', '#.#.#', '#.#.#', '#..##', '#...#', '#...#'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.']
};
const LOGO_ROWS = ['#ffd23f', '#ffb13b', '#ff8a4c', '#ff5f7e', '#ec4899', '#b65cff', '#7c8cff'];

function PixelLogo() {
  const word = 'ODDLINGS';
  const cells: { x: number; y: number }[] = [];
  let cx = 1;
  for (const ch of word) {
    const g = LOGO_GLYPHS[ch];
    g.forEach((row, y) => [...row].forEach((c, x) => c === '#' && cells.push({ x: cx + x, y: y + 1 })));
    cx += g[0].length + 1;
  }
  const W = cx + 1;
  const H = 10;
  const filled = new Set(cells.map((c) => c.x + ',' + c.y));
  // Outline: every empty pixel touching a letter pixel (including diagonals)
  const outline: { x: number; y: number }[] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (filled.has(x + ',' + y)) continue;
    let near = false;
    for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) if (filled.has(x + dx + ',' + (y + dy))) near = true;
    if (near) outline.push({ x, y });
  }
  return (
    <svg
      className="w-72 sm:w-96 md:w-[460px] h-auto"
      viewBox={`0 0 ${W} ${H + 1}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label="Oddlings"
      style={{ imageRendering: 'pixelated' }}
    >
      {/* Hard drop shadow, one pixel down */}
      {[...outline, ...cells].map((c, i) => <rect key={'s' + i} x={c.x} y={c.y + 1} width="1" height="1" fill="#120a26" />)}
      {outline.map((c, i) => <rect key={'o' + i} x={c.x} y={c.y} width="1" height="1" fill="#2a1450" />)}
      {cells.map((c, i) => <rect key={'c' + i} x={c.x} y={c.y} width="1" height="1" fill={LOGO_ROWS[c.y - 1]} />)}
      {/* A glossy highlight pixel on the top of each letter's first column */}
      {cells.filter((c) => c.y === 1 || (c.y === 2 && !filled.has(c.x + ',1'))).map((c, i) => <rect key={'h' + i} x={c.x} y={c.y} width="0.5" height="0.5" fill="#fff7d6" opacity="0.85" />)}
      {/* Sparkles */}
      <g className="animate-pulse">
        <rect x={W - 1.5} y="0" width="1" height="1" fill="#fde68a" />
        <rect x="0" y={H - 2} width="0.7" height="0.7" fill="#67e8f9" />
      </g>
    </svg>
  );
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  onStart,
  onOpenIncubator,
  onOpenScanner,
  onOpenFusion,
  basetenStatus: initialStatus
}) => {
  const cachedStatus = initialStatus || getCachedBasetenStatus();
  const [basetenStatus, setBasetenStatus] = useState<BasetenStatus | null>(cachedStatus);
  const [isChecking, setIsChecking] = useState<boolean>(!cachedStatus);
  const [shopOpen, setShopOpen] = useState(false);
  // Muse Image and Fireworks keys: shown as set or not set (the server never sends the keys)
  const [metaKeys, setMetaKeys] = useState<{ museImage: boolean; fireworks: boolean } | null>(null);
  useEffect(() => {
    fetch('/api/meta/status')
      .then((r) => r.json())
      .then((s) => setMetaKeys({ museImage: !!s?.museImage, fireworks: !!s?.fireworks }))
      .catch(() => setMetaKeys(null));
  }, []);

  useEffect(() => {
    setIsChecking(true);
    fetchBasetenStatus()
      .then((st) => {
        setBasetenStatus(st);
        setIsChecking(false);
      })
      .catch(() => {
        setBasetenStatus((prev) => prev || {
          provider: 'baseten',
          model: 'meta-models/muse-spark-open-1026',
          status: 'not_configured',
          hasKey: false,
          lastVerifiedAt: null,
          message: 'Backend server unavailable.'
        });
        setIsChecking(false);
      });
  }, []);

  // Enter and Space key handler for seamless start handshake
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('button, input, select, textarea, [role=button]')) return;
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        sound.playFanfare();
        onStart();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onStart]);

  const featuredCreature = INITIAL_ODDLINGS[0]; // Thornbrew
  const secondaryCreature = INITIAL_ODDLINGS[1]; // Luxacanth

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-between p-6 md:p-10 z-20 select-none overflow-y-auto">
      {/* Background Ambient Atmosphere */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-950/30 via-slate-950 to-slate-950 -z-10" />

      {/* Grid line accents */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,#000_70%,transparent_100%)] pointer-events-none -z-10" />

      {/* Top Meta Hackathon Badge */}
      <div className="w-full flex flex-wrap items-center justify-between gap-2 max-w-5xl">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 text-slate-300 text-xs font-mono tracking-wider">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          META GLOBAL AI DEV HACKATHON · INDIE TRACK
        </div>

        {/* Real-time Status Readout */}
        <div className="flex items-center gap-2.5 text-xs font-mono text-slate-300 flex-wrap">
          <span className="text-amber-400 font-bold">16-BIT PIXEL SPRITES</span>
          <span className="text-slate-600">·</span>
          {isChecking && !basetenStatus ? (
            <span className="text-amber-300 font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              CHECKING STATUS…
            </span>
          ) : basetenStatus?.status === 'verified_live' ? (
            <span className="text-emerald-400 font-bold flex items-center gap-1.5" title="Live verified via Baseten">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              MUSE SPARK LIVE VERIFIED
            </span>
          ) : basetenStatus?.status === 'configured_unverified' ? (
            <span className="text-cyan-300 font-bold flex items-center gap-1.5" title="Server key configured; ready for live calls">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              MUSE SPARK CONFIGURED
            </span>
          ) : basetenStatus?.status === 'not_configured' ? (
            <span className="text-slate-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-500" />
              MODELS NOT CONFIGURED
            </span>
          ) : (
            <span className="text-rose-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              BACKEND UNAVAILABLE
            </span>
          )}
          <span className="text-slate-600">·</span>
          <span className={metaKeys?.museImage ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
            {metaKeys?.museImage ? 'MUSE IMAGE READY' : 'MUSE IMAGE OFF'}
          </span>
          <span className="text-slate-600">·</span>
          <span className={metaKeys?.fireworks ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
            {metaKeys?.fireworks ? 'CHAT & QUESTS READY' : 'CHAT & QUESTS OFF'}
          </span>
        </div>
      </div>

      {/* Center Hero Lockup & Interactive Creatures */}
      <div className="flex flex-col items-center justify-center my-auto text-center max-w-3xl">
        {/* Bespoke inline SVG Title Lockup */}
        <div className="relative mt-4 mb-4 flex items-center justify-center">
          <PixelLogo />
        </div>

        <p className="text-base sm:text-lg text-slate-300 font-medium max-w-xl mx-auto leading-relaxed mb-6">
          Photograph everyday items and transform them into living creatures with personalities, habitats, abilities, and genetic fusion.
        </p>

        {/* Hero Interactive Showcase - Two sample Oddlings basking */}
        <div className="flex items-center justify-center gap-6 sm:gap-12 mb-8">
          <div className="flex flex-col items-center group">
            <OddlingAvatar
              creature={featuredCreature}
              size={130}
              mood="happy"
              onClick={() => sound.playChirp(520)}
            />
            <span className="text-xs font-mono text-amber-400 mt-2 font-semibold tracking-wide">
              ☕🌵 THORNBREW (Gen 2)
            </span>
            <span className="text-[11px] text-slate-400">Coffee Mug × Cactus</span>
          </div>

          <div className="text-slate-600 font-bold text-xl select-none">
            +
          </div>

          <div className="flex flex-col items-center group">
            <OddlingAvatar
              creature={secondaryCreature}
              size={130}
              mood="excited"
              onClick={() => sound.playChirp(720)}
            />
            <span className="text-xs font-mono text-cyan-400 mt-2 font-semibold tracking-wide">
              💡🌵 LUXACANTH (Gen 2)
            </span>
            <span className="text-[11px] text-slate-400">Brass Lamp × Cactus</span>
          </div>
        </div>

        {/* Primary CTA Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4">
          <button
            data-start="true"
            onClick={() => {
              sound.playFanfare();
              onStart();
            }}
            className="group relative px-8 py-4 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-pink-500 text-slate-950 font-bold text-base shadow-[0_0_30px_rgba(245,158,11,0.35)] hover:shadow-[0_0_40px_rgba(245,158,11,0.55)] transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-3"
          >
            <span className="text-lg">🌿</span>
            <span>ENTER HABITAT</span>
            <span className="text-xs bg-slate-950/20 px-2 py-0.5 rounded font-mono font-normal">
              Space / Enter
            </span>
          </button>

          <button
            onClick={() => {
              sound.playClick();
              if (onOpenIncubator) onOpenIncubator();
              else if (onOpenScanner) onOpenScanner();
            }}
            className="px-6 py-4 rounded-xl bg-slate-900 border border-slate-700/80 hover:border-amber-500 text-slate-200 font-semibold text-base transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-2.5"
          >
            <span>🥚</span>
            <span>Incubator Chamber</span>
          </button>

          <button
            onClick={() => {
              sound.playClick();
              onOpenFusion();
            }}
            className="px-6 py-4 rounded-xl bg-slate-900 border border-pink-500/40 hover:border-pink-500 text-pink-300 font-semibold text-base transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-2.5"
          >
            <span>🧬</span>
            <span>Fusion Lab</span>
          </button>

          <button
            onClick={() => {
              sound.playClick();
              setShopOpen(true);
            }}
            className="px-6 py-4 rounded-xl bg-slate-900 border border-yellow-400/40 hover:border-yellow-400 text-yellow-200 font-semibold text-base transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-2.5"
          >
            <span>🛍️</span>
            <span>Sparkle Shop</span>
          </button>
        </div>
      </div>

      {shopOpen && <SparkleShop onClose={() => setShopOpen(false)} />}

      <div className="pt-3"><MusicToggle /></div>

      {/* Bottom Flat Control Hint Line */}
      <div className="w-full text-center py-2 text-slate-500 text-xs font-mono tracking-wider">
        <span>Space / Enter Start · Drag & Drop Treats · Click to Pet · [M] Mute Sound · Esc Pause</span>
      </div>
    </div>
  );
};
