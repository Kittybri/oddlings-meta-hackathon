/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * GardenAdventureModal: Interactive, cute, cozy pixel UI for the First Garden Adventure.
 * Displays progress, starter resident guide, DNA trait & effect reveals, and one-time reward claim.
 */

import React, { useState, useEffect, useRef } from 'react';
import { CreatureDNA } from '../game/creatureTypes';
import { BiomeWorldState } from '../game/biomeWorldTypes';
import {
  GardenAdventureState,
  gardenAdventure,
  deriveCreatureReveal,
  CreatureTraitReveal
} from '../game/gardenAdventure';
import { sound } from '../game/soundSynth';
import { OddlingAvatar } from './OddlingAvatar';

const PIXEL_FONT = '"Pixelify Sans", "Press Start 2P", ui-monospace, monospace';
const INK = '#2b1b4d';

/** A chunky pixel frame: the outline skips the corners so they look notched, like 8-bit windows */
const pixelFrame = (fill: string, ink = INK, drop = true): React.CSSProperties => ({
  background: fill,
  boxShadow: outline(ink) + (drop ? ', 0 7px 0 0 rgba(43,27,77,0.22)' : ''),
  margin: 3
});

function outline(ink: string): string {
  return ['0 -3px', '0 3px', '-3px 0', '3px 0'].map((o) => o + ' 0 0 ' + ink).join(', ');
}

/** A pixel button with a light top-left and a shaded bottom-right */
const pixelButton = (fill: string): React.CSSProperties => ({
  ...pixelFrame(fill),
  boxShadow:
    'inset -3px -4px 0 0 rgba(0,0,0,0.18), inset 3px 3px 0 0 rgba(255,255,255,0.55), ' + outline(INK) + ', 0 6px 0 0 rgba(43,27,77,0.25)',
  fontFamily: PIXEL_FONT,
  color: INK,
  cursor: 'pointer'
});

const STEPS = [
  { icon: '📜', label: 'Accept' },
  { icon: '🌱', label: 'Plant' },
  { icon: '💧', label: 'Water' },
  { icon: '💖', label: 'Cheer' },
  { icon: '🌸', label: 'Bloom' }
];

const ADVENTURE_CSS = [
  '@keyframes oddlings-step-hop { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }',
  '.adv-step-now { animation: oddlings-step-hop 0.9s steps(2, end) infinite; }',
  '@media (prefers-reduced-motion: reduce) { .adv-step-now { animation: none; } }'
].join('\n');

interface GardenAdventureModalProps {
  creatures: CreatureDNA[];
  world: BiomeWorldState;
  onClose: () => void;
  onUpdateCreatures: (updated: CreatureDNA[]) => void;
  onPlantSeedDirectly?: () => void;
  onOpenDiary?: (creature: CreatureDNA) => void;
  /** Opens a photo check: a photo of something that holds water waters the seed */
  onWaterWithPhoto?: () => void;
}

export const GardenAdventureModal: React.FC<GardenAdventureModalProps> = ({
  creatures,
  world,
  onClose,
  onUpdateCreatures,
  onPlantSeedDirectly,
  onOpenDiary,
  onWaterWithPhoto
}) => {
  const [adv, setAdv] = useState<GardenAdventureState>(() => gardenAdventure.get());
  const [claimStatus, setClaimStatus] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const isClaimingRef = useRef(false);

  useEffect(() => {
    return gardenAdventure.subscribe(() => {
      setAdv(gardenAdventure.get());
    });
  }, []);

  // Save previous active element and set initial focus on mount; restore on unmount
  useEffect(() => {
    previousActiveElement.current = document.activeElement as HTMLElement | null;
    closeBtnRef.current?.focus();
    return () => {
      previousActiveElement.current?.focus();
    };
  }, []);

  // Keyboard navigation: Escape closes modal without bubbling to game; Tab traps focus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        sound.playClick();
        onClose();
        return;
      }
      if (e.key === 'Tab') {
        const dialog = modalRef.current;
        if (!dialog) return;
        const focusable = dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [onClose]);

  const hasSeedInWorld = world.decorations.some((d) => d.type === 'seed');

  // Find starter residents
  const thornbrew = creatures.find((c) => c.id === 'oddling-thornbrew') || creatures.find((c) => c.primaryElement === 'Ceramic' || c.primaryElement === 'Botanical');
  const luxacanth = creatures.find((c) => c.id === 'oddling-luxacanth') || creatures.find((c) => c.id !== thornbrew?.id);

  const thornbrewReveal: CreatureTraitReveal | null = thornbrew ? deriveCreatureReveal(thornbrew) : null;
  const luxacanthReveal: CreatureTraitReveal | null = luxacanth ? deriveCreatureReveal(luxacanth) : null;

  const handleAccept = () => {
    sound.playClick();
    const updated = gardenAdventure.accept(world.biome, world);
    setAdv(updated);
  };

  const handleClaim = () => {
    if (isClaimingRef.current) return;
    isClaimingRef.current = true;
    sound.playFanfare();
    const result = gardenAdventure.claimReward(creatures, world.name || world.biome);
    setClaimStatus(result.message);
    if (result.ok && result.updatedCreatures) {
      onUpdateCreatures(result.updatedCreatures);
    }
    setTimeout(() => {
      isClaimingRef.current = false;
    }, 1000);
  };

  const stepIndex = {
    not_started: 0,
    accepted: 1,
    seed_planted: 2,
    watered: 3,
    encouraged: 4,
    bloomed: 4,
    completed: 5
  }[adv.step];

  const helpers = [
    thornbrew && thornbrewReveal && { creature: thornbrew, reveal: thornbrewReveal, role: 'Waters the seed', icon: '💧', color: '#bfe9ff' },
    luxacanth && luxacanthReveal && { creature: luxacanth, reveal: luxacanthReveal, role: 'Cheers it to bloom', icon: '✨', color: '#ffe3f1' }
  ].filter(Boolean) as { creature: CreatureDNA; reveal: CreatureTraitReveal; role: string; icon: string; color: string }[];

  const tip = (text: React.ReactNode, fill: string) => (
    <div className="text-[11px] leading-snug p-2 flex gap-1.5" style={pixelFrame(fill, INK, false)}>
      <span aria-hidden="true">💡</span>
      <span>{text}</span>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-3 sm:p-4 select-none animate-in fade-in duration-150"
      onClick={onClose}
    >
      <style>{ADVENTURE_CSS}</style>
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="garden-adventure-title"
        aria-describedby="garden-adventure-desc"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl max-h-[92vh] overflow-y-auto flex flex-col outline-none"
        style={{ ...pixelFrame('#fff6dc'), color: INK, fontFamily: PIXEL_FONT }}
      >
        {/* Header: a little sky with a strip of pixel grass */}
        <div className="relative" style={{ background: '#bfe9ff' }}>
          <div className="flex items-center justify-between gap-2 px-3 pt-3 pb-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex items-center justify-center w-10 h-10 text-2xl shrink-0" style={pixelFrame('#ffd36b', INK, false)} aria-hidden="true">
                🌱
              </span>
              <div className="min-w-0">
                <h2 id="garden-adventure-title" className="text-[15px] sm:text-[17px] font-bold leading-tight tracking-wide">
                  FIRST GARDEN ADVENTURE
                </h2>
                <p id="garden-adventure-desc" className="text-[11px] opacity-80 leading-tight mt-0.5">
                  Grow a flower together with your Oddlings!
                </p>
              </div>
            </div>
            <button
              ref={closeBtnRef}
              onClick={() => {
                sound.playClick();
                onClose();
              }}
              aria-label="Close Adventure Window"
              className="w-8 h-8 shrink-0 text-[14px] font-bold active:translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2b1b4d]"
              style={pixelButton('#ff9ecb')}
            >
              ✕
            </button>
          </div>
          <div
            aria-hidden="true"
            className="h-3"
            style={{
              background: 'repeating-linear-gradient(90deg, #7ed957 0 6px, #5cc145 6px 12px)',
              borderTop: '3px solid ' + INK,
              borderBottom: '3px solid ' + INK
            }}
          />
        </div>

        <div className="flex flex-col gap-4 p-3 sm:p-4">
          {/* Journey: five pixel tiles joined by a vine */}
          <div className="px-3 pt-2.5 pb-3" style={pixelFrame('#e9f8dc')}>
            <div className="flex justify-between items-center text-[12px] font-bold mb-2.5 text-[#2f6b2a]">
              <span>🗺️ YOUR JOURNEY</span>
              <span className="px-2 py-0.5 text-[11px]" style={pixelFrame('#fff6dc', INK, false)}>
                {Math.min(5, stepIndex)} / 5
              </span>
            </div>
            <ol className="relative grid grid-cols-5 gap-1">
              <div aria-hidden="true" className="absolute left-[10%] right-[10%] top-[19px] h-[4px]" style={{ background: 'repeating-linear-gradient(90deg, #4fae3c 0 6px, transparent 6px 10px)' }} />
              {STEPS.map((s, i) => {
                const done = stepIndex > i;
                const now = stepIndex === i && adv.step !== 'completed';
                return (
                  <li key={s.label} className="relative flex flex-col items-center gap-1" aria-current={now ? 'step' : undefined}>
                    <span
                      className={'relative flex items-center justify-center w-9 h-9 text-lg ' + (now ? 'adv-step-now' : '')}
                      style={pixelFrame(done ? (i === 4 ? '#ffd36b' : '#9be37c') : now ? '#fff1a8' : '#fffdf5', done || now ? INK : '#b8aed0', false)}
                    >
                      <span style={{ filter: done || now ? 'none' : 'grayscale(1) opacity(0.45)' }} aria-hidden="true">
                        {s.icon}
                      </span>
                      {done && (
                        <span className="absolute -right-2 -bottom-2 w-4 h-4 flex items-center justify-center text-[10px] font-bold text-white" style={{ background: '#3f8f3a', boxShadow: '0 0 0 2px ' + INK }} aria-hidden="true">
                          ✓
                        </span>
                      )}
                    </span>
                    <span className={'text-[10px] sm:text-[11px] ' + (done || now ? 'font-bold' : 'opacity-50')}>
                      {i + 1}. {s.label}
                      <span className="sr-only">{done ? ' (done)' : now ? ' (now)' : ''}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* What to do now */}
          <div className="p-3 flex flex-col gap-2.5" style={pixelFrame('#ffffff')}>
            <div className="text-[12px] font-bold text-[#8a3fc4] flex items-center gap-1.5">
              <span aria-hidden="true">🎯</span> WHAT TO DO NOW
            </div>

            {adv.step === 'not_started' && (
              <>
                <p className="text-[12px] leading-relaxed">
                  Let&apos;s grow a flower together! It&apos;s free, and your two starter friends can do every step. Creatures you hatch from your own photos can help too.
                </p>
                <button onClick={handleAccept} className="w-full py-2.5 text-[13px] font-bold active:translate-y-0.5" style={pixelButton('#8fe07a')}>
                  🌱 START THE ADVENTURE
                </button>
              </>
            )}

            {adv.step === 'accepted' && (
              <>
                <p className="text-[12px] leading-relaxed">Plant a seed in this garden. Use the build tools, or tap below to plant one right away.</p>
                {!hasSeedInWorld && onPlantSeedDirectly && (
                  <button
                    onClick={() => {
                      sound.playClick();
                      onPlantSeedDirectly();
                    }}
                    className="w-full py-2.5 text-[13px] font-bold active:translate-y-0.5"
                    style={pixelButton('#9fe8f2')}
                  >
                    🌱 PLANT A SEED NOW
                  </button>
                )}
              </>
            )}

            {adv.step === 'seed_planted' && (
              <>
                <p className="text-[12px] leading-relaxed">
                  The seed is snuggled in the soil! Give it water: use a creature&apos;s water power (like <b className="text-[#c4511a]">Thornbrew&apos;s Steam Spines</b>), wait for rain, or show Meta Muse Spark a photo of something that holds water.
                </p>
                {onWaterWithPhoto && (
                  <button
                    onClick={() => {
                      sound.playClick();
                      onWaterWithPhoto();
                    }}
                    className="w-full py-2.5 text-[13px] font-bold active:translate-y-0.5"
                    style={pixelButton('#ffd36b')}
                  >
                    📸 WATER IT WITH A PHOTO
                  </button>
                )}
                {tip(<>Tap Thornbrew in the garden, then their power button [☕ Water seeds].</>, '#e3f6ff')}
              </>
            )}

            {adv.step === 'watered' && (
              <>
                <p className="text-[12px] leading-relaxed">
                  Sparkly and watered! Now a <b className="text-[#c4511a]">different friend</b> (like <b className="text-[#c4511a]">Luxacanth</b>, or a creature from your photos) needs to cheer the sprout on.
                </p>
                {tip(<>Tap Luxacanth (or another friend) and use their power [💡 Restore energy] to make it bloom!</>, '#fff4d6')}
              </>
            )}

            {adv.step === 'bloomed' && !adv.rewardClaimed && (
              <>
                <p className="text-[12px] leading-relaxed font-bold text-[#2f6b2a]">🌸 Hooray! Your seed bloomed into a big shiny flower! Grab your one-time reward.</p>
                <button onClick={handleClaim} className="w-full py-2.5 text-[13px] font-bold active:translate-y-0.5" style={pixelButton('#ffd36b')}>
                  🎁 CLAIM REWARD · +1 🌱 +1 🔮 +20 ✨
                </button>
              </>
            )}

            {adv.step === 'completed' && (
              <>
                <p className="text-[12px] leading-relaxed font-bold text-[#2f6b2a]">
                  🌟 Adventure complete! Your flower is blooming in the garden, and your friends wrote about it in their diaries.
                </p>
                {claimStatus && (
                  <div className="text-[11px] p-2" style={pixelFrame('#e9f8dc', INK, false)}>
                    {claimStatus}
                  </div>
                )}
              </>
            )}
          </div>

          {/* The two starter helpers */}
          <div className="p-3 flex flex-col gap-2.5" style={pixelFrame('#fff1c9')}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[12px] font-bold text-[#b0590e]">⭐ YOUR GARDEN HELPERS</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 text-[#2f6b2a]" style={pixelFrame('#e9f8dc', INK, false)}>
                FREE · NO PHOTO NEEDED
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {helpers.map(({ creature, reveal, role, icon, color }) => (
                <div key={creature.id} className="p-2 flex flex-col gap-1.5" style={pixelFrame('#fffdf5', INK, false)}>
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-12 shrink-0 flex items-center justify-center overflow-hidden" style={pixelFrame(color, INK, false)}>
                      <OddlingAvatar creature={creature} size={44} faceCrop showAura={false} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13px] font-bold leading-tight">{reveal.name}</div>
                      <div className="text-[10px] opacity-70 leading-tight">
                        {reveal.objectName} · {reveal.material}
                      </div>
                    </div>
                  </div>
                  <div className="text-[10.5px] italic leading-snug opacity-85">&ldquo;{reveal.inheritedTrait}&rdquo;</div>
                  <div className="mt-auto flex items-center justify-between gap-1 px-1.5 py-1 text-[10.5px] font-bold" style={{ background: color }}>
                    <span>{role}</span>
                    <span>
                      {icon} {reveal.effectLabel}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10.5px] leading-snug opacity-75">Any Oddling can join in: even a creature from a very odd photo knows how to cheer!</p>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-2 pt-1">
            {adv.step === 'completed' && thornbrew && onOpenDiary && (
              <button
                onClick={() => {
                  sound.playClick();
                  onOpenDiary(thornbrew);
                }}
                className="text-[12px] px-3 py-1.5 font-bold active:translate-y-0.5"
                style={pixelButton('#dcb8ff')}
              >
                📖 SEE THE DIARY
              </button>
            )}
            <button
              onClick={() => {
                sound.playClick();
                onClose();
              }}
              className="ml-auto text-[12px] px-3 py-1.5 font-bold active:translate-y-0.5"
              style={pixelButton('#fffdf5')}
            >
              BACK TO GARDEN
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
