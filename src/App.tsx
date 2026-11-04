import { gameMusic } from './game/gameMusic';

/* 8-bit scrollbars: dark green track, light green blocky thumb */
if (typeof document !== 'undefined' && !document.getElementById('oddlings-scrollbars')) {
  const style = document.createElement('style');
  style.id = 'oddlings-scrollbars';
  style.textContent = `
    ::-webkit-scrollbar { width: 14px; height: 14px; background: #0b2914; }
    ::-webkit-scrollbar-track { background: #0b2914; border: 2px solid #06170b; border-radius: 0; }
    ::-webkit-scrollbar-thumb { background: #8be28b; border: 2px solid #1f6b35; border-radius: 0; box-shadow: inset 2px 2px 0 #c9f7c0, inset -2px -2px 0 #4fae5f; }
    ::-webkit-scrollbar-thumb:hover { background: #a8f2a0; }
    ::-webkit-scrollbar-button { display: none; width: 0; height: 0; }
    ::-webkit-scrollbar-corner { background: #0b2914; }
    @supports not selector(::-webkit-scrollbar) { * { scrollbar-color: #8be28b #0b2914; } }
  `;
  document.head.appendChild(style);
}

// 8-bit look for the whole UI: pixel font, square corners, hard shadows, stepped motion
if (typeof document !== 'undefined' && !document.getElementById('oddlings-pixel-ui')) {
  const font = document.createElement('link');
  font.rel = 'stylesheet';
  font.href = 'https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400;500;600;700&display=swap';
  document.head.appendChild(font);
  const ui = document.createElement('style');
  ui.id = 'oddlings-pixel-ui';
  ui.textContent = `
    body, body *:not([style*="Press Start"]):not(svg):not(svg *) { font-family: 'Pixelify Sans', ui-monospace, monospace !important; letter-spacing: 0.02em; -webkit-font-smoothing: none; }
    body *:not(svg):not(svg *) { border-radius: 0 !important; }
    body [class*="shadow"] { box-shadow: 3px 3px 0 rgba(0,0,0,0.55) !important; }
    body [class*="backdrop-blur"] { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
    body .border, body .border-2 { border-width: 2px !important; }
    body button, body [role="button"] { transition-timing-function: steps(3) !important; }
    body button:active { transform: translate(2px, 2px); }
    body input, body select, body textarea { border-width: 2px !important; }
    img, canvas { image-rendering: pixelated; }
  `;
  document.head.appendChild(ui);
}
import { normalizeHome } from './game/worldRegions';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { CreatureDNA, IncubatorEgg } from './game/creatureTypes';
import { 
  loadCreaturesFromStorage, 
  saveCreaturesToStorage, 
  loadOnboardingActions, 
  saveOnboardingActions, 
  computeFirstRunGoals,
  loadActiveEggFromStorage,
  saveActiveEggToStorage,
  claimActiveEgg,
  PlayerOnboardingActions,
  OddlingsSaveBundleV1
} from './game/storage';
import { HabitatThemeId } from './game/biomeWorldTypes';
import { TitleScreen } from './components/TitleScreen';
const HabitatCanvas = lazy(() => import('./components/HabitatCanvas').then(m => ({default:m.HabitatCanvas})));
const IncubatorLab = lazy(() => import('./components/IncubatorLab').then(m => ({default:m.IncubatorLab})));
const FusionLab = lazy(() => import('./components/FusionLab').then(m => ({default:m.FusionLab})));
const BestiaryJournal = lazy(() => import('./components/BestiaryJournal').then(m => ({default:m.BestiaryJournal})));
import { AwakenModal } from './components/AwakenModal';
import { GoalChecklistModal } from './components/GoalChecklistModal';
import { IntegrationStatusModal } from './components/IntegrationStatusModal';
import { SaveRestoreModal } from './components/SaveRestoreModal';
import { HUD } from './components/HUD';
import { sound } from './game/soundSynth';
import { creatureVoice, phaseFromClock, toVoiceCreature } from './game/creatureVoice';
import { HeartTracker } from './game/friendship';
import { loadWorldEpoch, WORLD_DAY_MS } from './game/worldAtmosphere';
import { gardenAdventure } from './game/gardenAdventure';
import { walletBook } from './game/lifeSeeds';

type GameMode = 'title' | 'habitat' | 'incubator' | 'scanner' | 'fusion' | 'bestiary';

export default function App() {
  const [mode, setModeState] = useState<GameMode>('title');
  // Tools return to the root screen from which this visit began.
  const toolOrigin = useRef<'title' | 'habitat'>('title');
  const setMode = (next: GameMode) => {
    if (next === 'title' || next === 'habitat') toolOrigin.current = next;
    else if (mode === 'title' || mode === 'habitat') toolOrigin.current = mode;
    setModeState(next);
  };
  const closeTool = () => setMode(toolOrigin.current);
  const [isMuted, setIsMuted] = useState(sound.isMuted);
  const [habitatTheme, setHabitatTheme] = useState<HabitatThemeId>('greenhouse');
  const [restoreEpoch, setRestoreEpoch] = useState<number>(0);
  const [newlyAwakenedCreature, setNewlyAwakenedCreature] = useState<CreatureDNA | null>(null);
  const [showGoalsModal, setShowGoalsModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showSaveRestoreModal, setShowSaveRestoreModal] = useState(false);

  // Stored creatures list with corruption resilience
  const [creatures, setCreatures] = useState<CreatureDNA[]>(() => {
    return loadCreaturesFromStorage();
  });

  // Track single active egg safely (with absolute timestamps, survived reloads)
  const [activeEgg, setActiveEgg] = useState<IncubatorEgg | null>(() => {
    return loadActiveEggFromStorage();
  });

  // Track onboarding through persisted player actions (seed creatures never count)
  const [onboardingActions, setOnboardingActions] = useState<PlayerOnboardingActions>(() => {
    return loadOnboardingActions();
  });

  // Calculate live first-run goals strictly from real player actions
  const goals = computeFirstRunGoals(onboardingActions);

  const toggleAudio = () => {
    const muted = sound.toggleMute();
    gameMusic.setMuted(muted);
    setIsMuted(muted);
  };

  useEffect(() => {
    const resume = (event: Event) => {
      if ((event.target as HTMLElement | null)?.closest('[data-music-toggle]')) return;
      void gameMusic.resumeFromGesture();
    };
    window.addEventListener('pointerdown', resume);
    window.addEventListener('keydown', resume);
    return () => {
      window.removeEventListener('pointerdown', resume);
      window.removeEventListener('keydown', resume);
      gameMusic.stop();
    };
  }, []);

  useEffect(() => {
    gameMusic.setScene(mode === 'title' ? 'title' : mode === 'incubator' || mode === 'scanner' ? 'incubator' : mode === 'fusion' ? 'fusion' : 'world');
  }, [mode]);

  // Save creatures to storage whenever collection updates
  useEffect(() => {
    saveCreaturesToStorage(creatures);
  }, [creatures]);

  const heartTracker = useRef(new HeartTracker());
  const [heartToasts, setHeartToasts] = useState<Array<{ id: string; text: string }>>([]);

  // Creature diaries: Muse Spark writes an entry whenever a creature gains a new memory or a heart
  useEffect(() => {
    const voiceContext = {
      biome: habitatTheme === 'greenhouse' ? 'World' : undefined,
      phase: phaseFromClock(Date.now(), loadWorldEpoch(), WORLD_DAY_MS)
    };
    creatureVoice.setRoster(creatures);
    creatureVoice.observeCreatures(creatures, voiceContext);
    for (const up of heartTracker.current.update(creatures)) {
      const creature = creatures.find((c) => c.id === up.creatureId);
      if (creature) void creatureVoice.recordEvent(toVoiceCreature(creature), 'heart', voiceContext, `${up.hearts} hearts: ${up.title}`);
      const toastId = `${Date.now()}_${up.creatureId}`;
      setHeartToasts((prev) => [...prev, { id: toastId, text: `${up.name} reached ${up.hearts} hearts: ${up.title}!` }].slice(-3));
      window.setTimeout(() => setHeartToasts((prev) => prev.filter((t) => t.id !== toastId)), 4500);
    }
  }, [creatures]);

  // Save active egg whenever updated
  useEffect(() => {
    saveActiveEggToStorage(activeEgg);
  }, [activeEgg]);

  // Save onboarding actions whenever updated
  useEffect(() => {
    saveOnboardingActions(onboardingActions);
  }, [onboardingActions]);

  // Autostart query parameter support and sync dataset state
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      setMode('habitat');
      document.body.dataset.state = 'playing';
    } else {
      document.body.dataset.state = mode === 'title' ? 'title' : 'playing';
    }
  }, []);

  // Sync body dataset state on mode changes
  useEffect(() => {
    document.body.dataset.state = mode === 'title' ? 'title' : 'playing';
  }, [mode]);

  // Keyboard navigation shortcuts (scoped strictly away from text inputs)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      // Toggle Mute [M]
      if (e.key === 'm' || e.key === 'M') {
        toggleAudio();
      }
      // Escape returns to the tool's entry screen or closes the active modal
      if (e.key === 'Escape') {
        if (showGoalsModal) {
          setShowGoalsModal(false);
        } else if (showStatusModal) {
          setShowStatusModal(false);
        } else if (showSaveRestoreModal) {
          setShowSaveRestoreModal(false);
        } else if (newlyAwakenedCreature) {
          setNewlyAwakenedCreature(null);
        } else if (mode === 'incubator' || mode === 'scanner' || mode === 'fusion' || mode === 'bestiary') {
          closeTool();
        }
      }
      // Number keys 1-4 for quick mode switching when in game
      if (mode !== 'title') {
        if (e.key === '1') setMode('habitat');
        if (e.key === '2') setMode('incubator');
        if (e.key === '3') setMode('fusion');
        if (e.key === '4') setMode('bestiary');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, newlyAwakenedCreature, showGoalsModal, showStatusModal]);

  // Handle updated creature stats (from habitat interactions like pet/feed/rest)
  const handleUpdateCreature = (updated: CreatureDNA) => {
    setCreatures((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };

  // Add new creature (from Fusion or direct discovery)
  const handleCreatureDiscovered = (newCreature: CreatureDNA) => {
    const readyCreature: CreatureDNA = {
      ...newCreature,
      biomeId: newCreature.biomeId || 'greenhouse'
    };
    setCreatures((prev) => [readyCreature, ...prev]);
    setNewlyAwakenedCreature(readyCreature);
  };

  // Egg created in Incubator
  const handleEggCreated = (newEgg: IncubatorEgg) => {
    setActiveEgg(newEgg);
    saveActiveEggToStorage(newEgg);
  };

  // Egg claimed from Incubator (with exactly-once deduplicated guarantee)
  const handleEggClaimed = (egg: IncubatorEgg): { success: boolean; error?: string } => {
    const claimRes = claimActiveEgg(egg, creatures);
    if (!claimRes.success) {
      return { success: false, error: claimRes.error || 'Failed to save creature.' };
    }
    setCreatures(claimRes.updatedCreatures);
    setActiveEgg(null);
    // Bringing a new creature home always lands in the habitat, even when the incubator was opened from the title
    toolOrigin.current = 'habitat';

    if (claimRes.newCreature) {
      setOnboardingActions((prev) => {
        if (prev.discoveredObjectCreatureIds.includes(claimRes.newCreature!.id)) return prev;
        return {
          ...prev,
          discoveredObjectCreatureIds: [...prev.discoveredObjectCreatureIds, claimRes.newCreature!.id]
        };
      });
      setNewlyAwakenedCreature(claimRes.newCreature);
    }
    return { success: true };
  };

  return (
    <Suspense fallback={<div role="status" className="fixed inset-0 grid place-items-center bg-slate-950 text-white">Opening your Oddlings…</div>}><main className="oddlings-app relative w-screen h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans select-none">
      {/* Friendship heart celebrations */}
      {heartToasts.length > 0 && (
        <div aria-live="polite" className="fixed top-16 left-1/2 -translate-x-1/2 z-[80] flex flex-col items-center gap-2 pointer-events-none">
          {heartToasts.map((t) => (
            <div
              key={t.id}
              className="px-3 py-2 text-[10px] text-slate-900"
              style={{ background: '#ffb3d1', border: '4px solid #1b1033', boxShadow: '0 4px 0 0 rgba(0,0,0,0.4)', fontFamily: '"Press Start 2P", ui-monospace, monospace' }}
            >
              ♥ {t.text}
            </div>
          ))}
        </div>
      )}

      {/* Title Screen View */}
      {mode === 'title' && (
        <TitleScreen
          onStart={() => setMode('habitat')}
          onOpenIncubator={() => setMode('incubator')}
          onOpenScanner={() => setMode('incubator')}
          onOpenFusion={() => setMode('fusion')}
        />
      )}

      {/* In-Game Views */}
      {mode !== 'title' && (
        <>
          {/* Main Top HUD */}
          <HUD
            creatureCount={creatures.length}
            goals={goals}
            isMuted={isMuted}
            activeEgg={activeEgg}
            onToggleMute={toggleAudio}
            onOpenIncubator={() => setMode('incubator')}
            onOpenScanner={() => setMode('incubator')}
            onOpenFusion={() => setMode('fusion')}
            onOpenBestiary={() => setMode('bestiary')}
            onOpenGoals={() => setShowGoalsModal(true)}
            onOpenStatus={() => setShowStatusModal(true)}
            onOpenSaveRestore={() => setShowSaveRestoreModal(true)}
            onReturnTitle={() => setMode('title')}
          />

          {/* Living Habitat Canvas (Always running simulation in background) */}
          <HabitatCanvas
            creatures={creatures}
            onUpdateCreature={handleUpdateCreature}
            onPlayerCareAction={() => {
              setOnboardingActions((prev) => (prev.hasInteracted ? prev : { ...prev, hasInteracted: true }));
            }}
            onBiomeCustomized={() => {
              setOnboardingActions((prev) => (prev.hasCustomizedBiome ? prev : { ...prev, hasCustomizedBiome: true }));
            }}
            activeHabitatTheme={habitatTheme}
            onChangeTheme={(theme) => setHabitatTheme(normalizeHome(theme))}
            restoreEpoch={restoreEpoch}
          />

          {/* Cozy 16-Bit Pixel Incubator Lab Overlay Modal */}
          {(mode === 'incubator' || mode === 'scanner') && (
            <IncubatorLab
              activeEgg={activeEgg}
              onEggCreated={handleEggCreated}
              onEggClaimed={handleEggClaimed}
              onClose={closeTool}
            />
          )}

          {/* Fusion Lab Overlay Modal */}
          {mode === 'fusion' && (
            <FusionLab
              creatures={creatures}
              onFusionComplete={(hybrid) => {
                handleCreatureDiscovered(hybrid);
                setOnboardingActions((prev) => (prev.hasFused ? prev : { ...prev, hasFused: true }));
                setMode('habitat');
              }}
              onClose={closeTool}
            />
          )}

          {/* Bestiary Journal Overlay Modal */}
          {mode === 'bestiary' && (
            <BestiaryJournal
              creatures={creatures}
              onSelectCreature={(creature) => {
                if (creature.biomeId) {
                  setHabitatTheme(normalizeHome(creature.biomeId));
                }
                setMode('habitat');
              }}
              onUpdateCreature={handleUpdateCreature}
              onOpenSaveRestore={() => setShowSaveRestoreModal(true)}
              onClose={closeTool}
            />
          )}

          {/* Creature Awaken Celebration Modal */}
          {newlyAwakenedCreature && (
            <AwakenModal
              creature={newlyAwakenedCreature}
              onConfirm={() => setNewlyAwakenedCreature(null)}
            />
          )}

          {/* First-Run Goals Checklist Modal */}
          {showGoalsModal && (
            <GoalChecklistModal
              goals={goals}
              creatures={creatures}
              onClose={() => setShowGoalsModal(false)}
              onNavigate={(targetMode) => {
                if (targetMode === 'scanner') setMode('incubator');
                else setMode(targetMode);
              }}
            />
          )}

          {/* System & Integration Status Modal */}
          {showStatusModal && (
            <IntegrationStatusModal
              onClose={() => setShowStatusModal(false)}
            />
          )}

          {/* Portable Save & Restore Modal */}
          {showSaveRestoreModal && (
            <SaveRestoreModal
              creatures={creatures}
              activeEgg={activeEgg}
              onRestoreSuccess={(bundle) => {
                setCreatures(bundle.creatures);
                setActiveEgg(bundle.activeEgg);
                setOnboardingActions(bundle.onboarding);
                if (bundle.preferences?.habitatTheme) {
                  setHabitatTheme(normalizeHome(bundle.preferences.habitatTheme));
                }
                if (bundle.gardenAdventure) {
                  gardenAdventure.save(bundle.gardenAdventure);
                }
                if (bundle.wallet) {
                  walletBook.reload();
                }
                setRestoreEpoch(Date.now());
              }}
              onClose={() => setShowSaveRestoreModal(false)}
            />
          )}
        </>
      )}
    </main></Suspense>
  );
}
