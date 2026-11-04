/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CreatureDNA } from '../game/creatureTypes';
import { OddlingAvatar } from './OddlingAvatar';
import { fuseCreatures } from '../game/creatureRules';
import { sound } from '../game/soundSynth';
import { requestBasetenFusion, fetchBasetenStatus, getCachedBasetenStatus, BasetenStatus } from '../services/basetenClient';
import { drawFusionArt } from '../game/photoSprite';
import { walletBook, SPARKLE_ICON } from '../game/lifeSeeds';

const SPARKLE_NAME = 'Sparkles';

interface FusionLabProps {
  creatures: CreatureDNA[];
  onFusionComplete: (hybrid: CreatureDNA) => boolean;
  onClose: () => void;
}

/** What one fusion costs in Sparkle Coins (refunded if Meta cannot finish it). */
export const FUSION_SPARKLES = 20;

const PIXEL_FONT = { fontFamily: '"Pixelify Sans", "Press Start 2P", ui-monospace, monospace' };
// Chunky pixel frames: a dark outline, a light inner edge and a hard drop shadow, no rounded corners
const frame = (bg: string, edge: string) => ({
  background: bg,
  border: '4px solid #1b1033',
  boxShadow: `inset 0 0 0 3px ${edge}, 0 5px 0 0 rgba(0,0,0,0.45)`
});

type Step = 'idle' | 'genes' | 'drawing' | 'done';

/** The parent as a picture for Muse Image: its sprite (drawn or Meta art) on white, 512 px. */
async function creaturePicture(c: CreatureDNA): Promise<string> {
  const markup = renderToStaticMarkup(<OddlingAvatar creature={c} size={512} mood="happy" showAura={false} />);
  const holder = document.createElement('div');
  holder.innerHTML = markup;
  const svg = holder.querySelector('svg');
  if (!svg) throw new Error('Could not draw ' + c.name + '.');
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.setAttribute('width', '512');
  svg.setAttribute('height', '512');
  svg.querySelectorAll('style').forEach((s) => s.remove());
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Could not draw ' + c.name + '.'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 512, 512);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, 512, 512);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}

function makeHybrid(result: any, parentA: CreatureDNA, parentB: CreatureDNA, preview: ReturnType<typeof fuseCreatures> | null): CreatureDNA {
    const dna = result.hybridDna;
    const hybridGen = Math.max(parentA.stats.generation, parentB.stats.generation) + 1;

    const liveHybrid: CreatureDNA = {
      id: `hybrid_meta_${Date.now()}`,
      name: dna.name || `${parentA.name}-${parentB.name}`,
      speciesName: dna.speciesName || `${parentA.speciesName.split(' ')[0]} ${parentB.speciesName.split(' ')[1] || 'Hybrida'}`,
      title: dna.title || `The ${dna.primaryElement} Synergy`,
      primaryElement: dna.primaryElement || parentA.primaryElement,
      secondaryElement: dna.secondaryElement || parentB.primaryElement,
      temperament: dna.temperament || 'Curious & Chirpy',
      provenance: 'ai_extracted',
      provenanceDetails: {
        provider: 'baseten',
        model: 'meta-models/muse-spark-open-1026',
        isLive: true,
        timestamp: Date.now(),
        sourceDescription: `Synthesized via Meta Muse Spark Open from ${parentA.name} and ${parentB.name}`
      },
      specialAbility: {
        name: dna.specialAbility?.name || 'Synergy Pulse',
        description: dna.specialAbility?.description || 'Channels combined elemental energies of both parent specimens.',
        powerRating: dna.specialAbility?.powerRating || 88,
        icon: dna.specialAbility?.icon || '✨'
      },
      sourceObject: {
        name: `${parentA.name} + ${parentB.name}`,
        category: 'Genetic Hybrid',
        material: dna.material || `${parentA.sourceObject.material} & ${parentB.sourceObject.material}`,
        description: dna.description || `Genetic synthesis of ${parentA.name} and ${parentB.name}.`,
        userPhotoUrl: parentA.sourceObject.userPhotoUrl || parentB.sourceObject.userPhotoUrl
      },
      appearance: {
        visualPlan: dna.visualPlan || preview?.hybrid.appearance.visualPlan,
        bodyShape: dna.appearance?.bodyShape || 'blob',
        primaryColor: dna.appearance?.primaryColor || parentA.appearance.primaryColor,
        secondaryColor: dna.appearance?.secondaryColor || parentB.appearance.secondaryColor,
        accentColor: dna.appearance?.accentColor || '#f4a261',
        eyeStyle: dna.appearance?.eyeStyle || 'sparkle',
        hornStyle: dna.appearance?.hornStyle || parentA.appearance.hornStyle,
        accessory: dna.appearance?.accessory || 'sparkles',
        pattern: dna.appearance?.pattern || 'glazed',
        size: dna.appearance?.size || 1.15
      },
      habitatPreference: parentA.habitatPreference,
      stats: {
        trust: 55,
        energy: 95,
        curiosity: 90,
        generation: hybridGen
      },
      lineage: {
        parentAId: parentA.id,
        parentAName: parentA.name,
        parentBId: parentB.id,
        parentBName: parentB.name,
        inheritedTraits: dna.inheritedTraits || [
          `Inherited from ${parentA.name}: ${parentA.specialAbility.name}`,
          `Inherited from ${parentB.name}: ${parentB.specialAbility.name}`
        ]
      },
      memories: [
        {
          timestamp: Date.now(),
          text: `Synthesized with Meta Muse Spark Open (meta-models/muse-spark-open-1026) via Baseten!`,
          type: 'fuse'
        },
        ...(dna.inheritedTraits || []).map((t: string) => ({
          timestamp: Date.now(),
          text: `Trait: ${t}`,
          type: 'fuse' as const
        }))
      ],
      discoveredAt: Date.now()
    };


  return liveHybrid;
}

export const FusionLab: React.FC<FusionLabProps> = ({ creatures, onFusionComplete, onClose }) => {
  const [parentAId, setParentAId] = useState<string>(creatures[0]?.id || '');
  const [parentBId, setParentBId] = useState<string>(creatures.length > 1 ? creatures[1]?.id : creatures[0]?.id || '');
  const [step, setStep] = useState<Step>(() => walletBook.get().fusion?.result ? 'done' : 'idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hybrid, setHybrid] = useState<CreatureDNA | null>(() => walletBook.get().fusion?.result || null);
  const [sparkles, setSparkles] = useState(() => walletBook.get().sparkles);
  useEffect(() => {
    const pending = walletBook.get().fusion;
    if (pending && !pending.result) {
      const restored = walletBook.refundFusion(pending.id);
      setSparkles(walletBook.get().sparkles);
      setErrorMessage(restored ? 'Fusion was interrupted. Your ' + pending.cost + ' Sparkles were refunded. You can try again.' : 'Free device space and reopen Fusion to restore your Sparkles.');
    }
  }, []);
  const cachedStatus = getCachedBasetenStatus();
  const [basetenStatus, setBasetenStatus] = useState<BasetenStatus | null>(cachedStatus);
  const [isChecking, setIsChecking] = useState<boolean>(!cachedStatus);

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && step !== 'genes' && step !== 'drawing') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, onClose]);

  const parentA = creatures.find((c) => c.id === parentAId) || creatures[0];
  const parentB = creatures.find((c) => c.id === parentBId) || creatures[1] || creatures[0];
  const canFuse = !!parentA && !!parentB && parentA.id !== parentB.id;
  const busy = step === 'genes' || step === 'drawing';
  const affordable = sparkles >= FUSION_SPARKLES;
  const preview = parentA && parentB ? fuseCreatures(parentA, parentB) : null;

  // Meta does the whole fusion: Muse Spark mixes the two creatures' traits into a new species,
  // then Muse Image sees both parents and draws the hybrid. Sparkles are paid up front and refunded on failure.
  const handleFuse = async () => {
    if (busy || !canFuse || !parentA || !parentB) return;
    setErrorMessage(null);
    const reservation = walletBook.beginFusion(FUSION_SPARKLES);
    if (!reservation) {
      setErrorMessage('Fusing costs ' + FUSION_SPARKLES + ' ' + SPARKLE_NAME + '. Care for your creatures and finish photo quests to earn more ' + SPARKLE_ICON);
      return;
    }
    setSparkles(walletBook.get().sparkles);
    sound.playFusionSurge();
    setStep('genes');
    try {
      const result = await requestBasetenFusion({
        parentA: { name: parentA.name, element: parentA.primaryElement, ability: parentA.specialAbility.name, material: parentA.sourceObject.material, traits: parentA.lineage?.inheritedTraits || [parentA.specialAbility.description] },
        parentB: { name: parentB.name, element: parentB.primaryElement, ability: parentB.specialAbility.name, material: parentB.sourceObject.material, traits: parentB.lineage?.inheritedTraits || [parentB.specialAbility.description] }
      });
      const made = makeHybrid(result, parentA, parentB, preview);
      setStep('drawing');
      const [picA, picB] = await Promise.all([creaturePicture(parentA), creaturePicture(parentB)]);
      const art = await drawFusionArt({ imageA: picA, imageB: picB, nameA: parentA.name, nameB: parentB.name, hybridName: made.name, traits: made.lineage?.inheritedTraits || [] });
      if (!art) throw new Error('Muse Image could not draw ' + made.name + ' this time.');
      made.sourceObject = { ...made.sourceObject, spritePhotoUrl: art, userPhotoUrl: art };
      made.provenanceDetails = { ...made.provenanceDetails, sourceDescription: 'Fused by Meta: Muse Spark mixed the traits of ' + parentA.name + ' and ' + parentB.name + ', Muse Image drew the hybrid from both' } as any;
      if (!walletBook.finishFusion(reservation, made)) throw new Error("Could not save fusion result.");
      setHybrid(made);
      setStep('done');
      sound.playFanfare();
    } catch (err: any) {
      const refunded = walletBook.refundFusion(reservation);
      setSparkles(walletBook.get().sparkles);
      setStep('idle');
      sound.playBounce();
      // Players get a friendly note; the technical reason stays in the console for debugging
      console.warn('Fusion failed:', err?.message || err);
      if (!refunded) { setErrorMessage('Could not restore Sparkles. Free device space and reopen Fusion to retry recovery.'); return; }
      setErrorMessage('Fusion couldn’t finish. Your ' + FUSION_SPARKLES + ' Sparkles were refunded. Try again when you’re ready.');
    }
  };

  const pick = (label: string, color: string, value: string, set: (id: string) => void, other: string, c: CreatureDNA | undefined) => (
    <div className="flex flex-col items-center gap-3 p-4 w-full max-w-[260px]" style={frame('#231541', color)}>
      <div className="text-xs tracking-wider" style={{ ...PIXEL_FONT, color }}>{label}</div>
      <div className="w-36 h-36 flex items-center justify-center" style={frame('#3a2a66', '#5b4a92')}>
        {c && <OddlingAvatar creature={c} size={128} mood="happy" />}
      </div>
      <select
        value={value}
        disabled={busy || step === 'done'}
        onChange={(e) => set(e.target.value)}
        className="w-full px-2 py-1.5 text-sm text-white outline-none"
        style={{ ...PIXEL_FONT, ...frame('#140b2a', '#3d2b6e') }}
      >
        {creatures.map((cr) => (
          <option key={cr.id} value={cr.id} disabled={cr.id === other}>
            {cr.name}
          </option>
        ))}
      </select>
      {c && (
        <div className="text-center leading-tight" style={PIXEL_FONT}>
          <div className="text-white text-base">{c.name}</div>
          <div className="text-[11px] text-violet-200">{c.primaryElement}{c.secondaryElement ? ' / ' + c.secondaryElement : ''}</div>
          <div className="text-[11px] text-pink-200 mt-1">✦ {c.specialAbility.name}</div>
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto select-none" style={{ background: 'radial-gradient(circle at 50% 30%, #3b1f6b 0%, #1a0f33 55%, #0d0820 100%)', imageRendering: 'pixelated' }}>
      {/* Twinkling pixel stars */}
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 24 }, (_, i) => (
          <span key={i} className="absolute animate-pulse" style={{ left: ((i * 37) % 100) + '%', top: ((i * 53) % 100) + '%', width: 3 + (i % 2) * 2, height: 3 + (i % 2) * 2, background: i % 3 ? '#fde68a' : '#f9a8d4', animationDelay: (i % 5) * 0.4 + 's' }} />
        ))}
      </div>

      <div className="relative max-w-5xl mx-auto p-4 md:p-6 flex flex-col gap-5">
        {step === "done" && errorMessage && <p role="alert" className="text-pink-200">{errorMessage}</p>}
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3" style={frame('#2a1850', '#ff8fc7')}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 flex items-center justify-center text-2xl" style={frame('#ff8fc7', '#ffd1e8')}>🧬</div>
            <div style={PIXEL_FONT}>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl md:text-2xl text-white leading-none">FUSION LAB</h2>
                {isChecking && !basetenStatus ? (
                  <span className="text-[10px] px-2 py-0.5 text-amber-300 animate-pulse" style={frame('#2a1850', '#f59e0b')}>
                    ⏳ CHECKING STATUS…
                  </span>
                ) : basetenStatus?.status === 'verified_live' ? (
                  <span className="text-[10px] px-2 py-0.5 text-emerald-300" style={frame('#132a20', '#10b981')} title="Live verified via Baseten">
                    ✨ MUSE SPARK LIVE VERIFIED
                  </span>
                ) : basetenStatus?.status === 'configured_unverified' ? (
                  <span className="text-[10px] px-2 py-0.5 text-cyan-300" style={frame('#102236', '#06b6d4')} title="API key configured; ready for live calls">
                    ⚡ MUSE SPARK CONFIGURED
                  </span>
                ) : basetenStatus?.status === 'not_configured' ? (
                  <span className="text-[10px] px-2 py-0.5 text-slate-300" style={frame('#1a1528', '#64748b')}>
                    🎲 LOCAL / DEMO MIX
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 text-rose-300" style={frame('#28151a', '#f43f5e')}>
                    ⚠️ SERVER OFFLINE
                  </span>
                )}
              </div>
              <p className="text-[11px] md:text-xs text-pink-100 mt-1">Pick two Oddlings. Meta mixes them into a brand-new creature!</p>
            </div>
          </div>
          <div className="flex items-center gap-2" style={PIXEL_FONT}>
            <div className="px-3 py-1.5 text-sm text-amber-200" style={frame('#140b2a', '#a16207')}>{SPARKLE_ICON} {sparkles}</div>
            <button onClick={onClose} disabled={busy} className="px-3 py-1.5 text-sm text-white disabled:opacity-50" style={frame('#3a2a66', '#7c6bc4')}>✕ CLOSE</button>
          </div>
        </div>

        {step === 'done' && hybrid ? (
          /* The new creature, before it goes home */
          <div className="flex flex-col items-center gap-4 p-6" style={frame('#231541', '#fde68a')}>
            <div className="text-sm text-amber-200 tracking-widest" style={PIXEL_FONT}>✨ A NEW ODDLING IS BORN! ✨</div>
            <div className="flex items-center gap-3 md:gap-6 flex-wrap justify-center">
              <div className="w-20 h-20 flex items-center justify-center" style={frame('#3a2a66', '#5b4a92')}><OddlingAvatar creature={parentA!} size={72} mood="happy" /></div>
              <span className="text-2xl text-pink-200" style={PIXEL_FONT}>+</span>
              <div className="w-20 h-20 flex items-center justify-center" style={frame('#3a2a66', '#5b4a92')}><OddlingAvatar creature={parentB!} size={72} mood="happy" /></div>
              <span className="text-2xl text-pink-200" style={PIXEL_FONT}>=</span>
              <div className="w-44 h-44 flex items-center justify-center" style={frame('#4c2a80', '#fde68a')}><OddlingAvatar creature={hybrid} size={160} mood="happy" isInteracting /></div>
            </div>
            <div className="text-center" style={PIXEL_FONT}>
              <div className="text-2xl text-white">{hybrid.name}</div>
              <div className="text-xs text-violet-200">{hybrid.speciesName} · Gen {hybrid.stats.generation} · {hybrid.primaryElement}{hybrid.secondaryElement ? ' / ' + hybrid.secondaryElement : ''}</div>
              <div className="text-sm text-pink-200 mt-2">✦ {hybrid.specialAbility.name}</div>
              <p className="text-xs text-slate-200 mt-1 max-w-md">{hybrid.specialAbility.description}</p>
              {(hybrid.lineage?.inheritedTraits || []).length > 0 && (
                <ul className="text-[11px] text-emerald-200 mt-2 space-y-0.5">
                  {(hybrid.lineage?.inheritedTraits || []).slice(0, 4).map((t, i) => <li key={i}>🧬 {t}</li>)}
                </ul>
              )}
              <div className="text-[10px] text-slate-400 mt-3">Traits by Meta Muse Spark · drawn by Meta Muse Image from both parents</div>
            </div>
            <button
              onClick={() => {
                if (!onFusionComplete(hybrid)) { setErrorMessage('Could not save your creature. Free device space and try again.'); return; }
                const pending = walletBook.get().fusion;
                if (pending) walletBook.claimFusion(pending.id);
              }}
              className="px-6 py-3 text-base text-slate-900"
              style={{ ...PIXEL_FONT, ...frame('#fde047', '#fff7ae') }}
            >
              🏡 WELCOME {hybrid.name.toUpperCase()} HOME
            </button>
          </div>
        ) : (
          <>
            {creatures.length < 2 ? (
              <div className="p-6 text-center text-white" style={{ ...PIXEL_FONT, ...frame('#231541', '#7c6bc4') }}>
                You need two Oddlings to fuse. Hatch another one in the Incubator first! 🥚
              </div>
            ) : (
              <div className="fusion-family flex flex-col md:flex-row items-center md:items-stretch justify-center gap-4">
                {pick('PARENT A', '#fbbf24', parentAId, setParentAId, parentBId, parentA)}

                {/* The fusion chamber */}
                <div className="flex flex-col items-center justify-center gap-3 p-4 w-full max-w-[280px]" style={frame('#2a1850', '#ff8fc7')}>
                  <div className="text-xs text-pink-200 tracking-wider" style={PIXEL_FONT}>FUSION CHAMBER</div>
                  <div className={'w-36 h-36 flex items-center justify-center text-5xl ' + (busy ? 'animate-pulse' : '')} style={frame('#4c2a80', busy ? '#fde68a' : '#8b5cf6')}>
                    {busy ? '🌀' : '❔'}
                  </div>
                  <div className="w-full space-y-1.5 text-[11px]" style={PIXEL_FONT}>
                    <div className={step === 'genes' ? 'text-amber-200' : step === 'drawing' ? 'text-emerald-300' : 'text-violet-200'}>
                      {step === 'drawing' ? '✔' : step === 'genes' ? '▶' : '1'} Muse Spark mixes their traits
                    </div>
                    <div className={step === 'drawing' ? 'text-amber-200' : 'text-violet-200'}>
                      {step === 'drawing' ? '▶' : '2'} Muse Image draws the hybrid
                    </div>
                  </div>
                  {busy && (
                    <div className="w-full h-3" style={frame('#140b2a', '#3d2b6e')}>
                      <div className="h-full bg-pink-400 animate-pulse" style={{ width: step === 'genes' ? '35%' : '80%', transition: 'width 1s steps(6)' }} />
                    </div>
                  )}
                  {busy && <div className="text-[10px] text-slate-300 text-center" style={PIXEL_FONT}>This takes about 30–40 seconds</div>}
                </div>

                {pick('PARENT B', '#67e8f9', parentBId, setParentBId, parentAId, parentB)}
              </div>
            )}

            {errorMessage && (
              <div role="alert" className="px-4 py-3 text-sm text-pink-100 max-w-2xl mx-auto" style={{ ...PIXEL_FONT, ...frame('#4a1030', '#f472b6') }}>
                {errorMessage}
              </div>
            )}

            <div className="flex flex-col items-center gap-2">
              <button
                onClick={handleFuse}
                disabled={busy || !canFuse || !affordable}
                className="px-8 py-3 text-lg text-white disabled:opacity-50 disabled:cursor-not-allowed active:translate-y-1"
                style={{ ...PIXEL_FONT, ...frame('#db2777', '#ff8fc7') }}
              >
                {busy ? 'FUSING…' : '⚡ FUSE! · ' + SPARKLE_ICON + ' ' + FUSION_SPARKLES}
              </button>
              <div className="text-[11px] text-violet-200 text-center" style={PIXEL_FONT}>
                {!affordable
                  ? 'You need ' + FUSION_SPARKLES + ' ' + SPARKLE_NAME + ' (you have ' + sparkles + '). Pet, feed and quest with your creatures to earn more.'
                  : 'Both parents stay with you. If Meta fails, your ' + SPARKLE_NAME + ' come back.'}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
