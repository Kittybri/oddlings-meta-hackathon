import { createSpeech, speechIsVisible, canSpeak, loadWorldEpoch, WORLD_DAY_MS } from '../game/worldAtmosphere';
import { creatureVoice, phaseFromClock, SpeechTopic } from '../game/creatureVoice';
import { tasteBook, tasteOf, reactionLine, giftMemory, clampTrust, TASTE_TRUST, TASTE_ICON } from '../game/gifts';
import { weatherBus } from '../game/weatherBus';
import { nextWeatherTalk, weatherLine, TalkMemo } from '../game/weatherTalk';

// Photo-based speech: Muse Spark lines for this creature, or the default line until they arrive
const voiceLine = (creatureId: string, topic: SpeechTopic, fallback: string) =>
  creatureVoice.photoLine(creatureId, topic, fallback, { phase: phaseFromClock(Date.now(), loadWorldEpoch(), WORLD_DAY_MS) });
import { loadWorldRegion, saveWorldRegion, normalizeHome, createWorldRegion } from '../game/worldRegions';
import { WorldViewport } from './WorldViewport';
import { CreatureChat } from './CreatureChat';
import { PhotoQuest } from './PhotoQuest';
import { walletBook } from '../game/lifeSeeds';
import { gardenAdventure, GardenAdventureState } from '../game/gardenAdventure';
import { GardenAdventureModal } from './GardenAdventureModal';
import { DiaryBook } from './DiaryBook';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { CreatureDNA, FoodTreat, MoodType } from '../game/creatureTypes';
import { OddlingAvatar } from './OddlingAvatar';
import { FOOD_TREATS } from '../game/creatureCatalog';
import { calculateInteractionResult, determineCreatureMood, getAbilityEffect, activateCreatureAbility } from '../game/creatureRules';
import { sound } from '../game/soundSynth';
import {
  BiomeWorldState,
  DecorationType,
  EditorTool,
  HabitatThemeId,
  StarterTemplateId,
  GardenTasksState,
  CustomBiomeRecord
} from '../game/biomeWorldTypes';
import { getCustomBiomesList, loadCustomBiomeBackground } from '../game/customBiomeStorage';
import { CreateBiomeModal } from './CreateBiomeModal';
import { ManageBiomeModal } from './ManageBiomeModal';
import {
  GRID_WIDTH,
  GRID_HEIGHT,
  DEFAULT_GROUND_ROW,
  isSolidTile,
  isWaterTile,
  loadBiomeWorldFromStorage,
  saveBiomeWorldToStorage,
  resetBiomeWorldStorage,
  createStarterWorld,
  paintTiles,
  eraseTiles,
  addDecoration,
  removeDecoration,
  canPlaceDecoration,
  computeSeedGrowth,
  findSupportedSurfaceY,
  findSafeSpawnPosition,
  canStepTo,
  BiomeHistoryManager,
  areBiomeWorldsEqual
} from '../game/biomeWorld';
import { loadGardenTasksFromStorage, saveGardenTasksToStorage } from '../game/storage';
import { BiomeWorldRenderer } from './BiomeWorldRenderer';
import { BiomeEditorToolbar } from './BiomeEditorToolbar';

interface HabitatCanvasProps {
  creatures: CreatureDNA[];
  onUpdateCreature: (updated: CreatureDNA) => void;
  onPlayerCareAction?: () => void;
  onBiomeCustomized?: () => void;
  activeHabitatTheme: HabitatThemeId;
  onChangeTheme: (theme: HabitatThemeId) => void;
  restoreEpoch?: number;
}

interface CreatureSimState {
  gridX: number; // grid column 0..47
  gridY: number; // grid row 0..23
  xPct: number; // 0..100%
  yPct: number; // 0..100%
  vx: number;
  vy: number;
  targetGridX: number;
  direction: 1 | -1;
  mood: MoodType;
  isInteracting: boolean;
  isInWater: boolean;
  bubbleText?: string;
  bubbleExpiresAt?: number;
  nextSpeechAt?: number;
}

interface ActiveTreat {
  id: string;
  treat: FoodTreat;
  gridX: number;
  xPct: number;
  yPct: number;
  timeRemaining: number;
}

// The toy ball, drawn as pixels: o outline, y ball, w seam stripe
const TOY_BALL_PIXELS = ['..oooo..', '.oyyyyo.', 'oyywyyyo', 'oyyyyyyo', 'owwwwwwo', 'oyyyyyyo', '.oyyyyo.', '..oooo..'];
const TOY_BALL_COLORS: Record<string, string> = { o: '#5a3d00', y: '#d7f43a', w: '#ffffff' };

// How tall a creature's sprite box is, in world tiles (its body fills about two thirds of it)
const CREATURE_TILES = 3;

interface ActiveToy {
  xPct: number;
  yPct: number;
  vx: number;
  vy: number;
}

export const HabitatCanvas: React.FC<HabitatCanvasProps> = ({
  creatures,
  onUpdateCreature,
  onPlayerCareAction,
  onBiomeCustomized,
  activeHabitatTheme,
  onChangeTheme,
  restoreEpoch
}) => {
  const [worldRegion, setWorldRegion] = useState(0);
  const [travelError, setTravelError] = useState('');
  // Bumped when an item is carried into a neighboring area, so the neighbors shown at the edges redraw
  const [neighborEpoch, setNeighborEpoch] = useState(0);
  const neighbors = useMemo(() => [loadWorldRegion(worldRegion - 1), loadWorldRegion(worldRegion + 1)] as [BiomeWorldState, BiomeWorldState], [worldRegion, neighborEpoch]);
  const loadActiveWorld = () => activeHabitatTheme === 'greenhouse' ? loadWorldRegion(worldRegion) : loadBiomeWorldFromStorage(activeHabitatTheme);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [abilityReadyAt, setAbilityReadyAt] = useState<Record<string, number>>({});
  const [abilityMessage, setAbilityMessage] = useState('');
  const [abilityNow, setAbilityNow] = useState(Date.now());
  // The cooldown clock only ticks while an ability is cooling down, so the habitat is not re-rendered every second for nothing
  const abilityCooling = Object.values(abilityReadyAt).some((readyAt) => readyAt > abilityNow);
  useEffect(() => {
    if (!abilityCooling) return;
    const timer = setInterval(() => setAbilityNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [abilityCooling]);

  // Editor State
  const [isEditMode, setIsEditMode] = useState(false);
  // Build mode's Drag to explore: scrolling the World instead of building; off whenever build mode opens or closes
  const [buildExplore, setBuildExplore] = useState(false);
  useEffect(() => setBuildExplore(false), [isEditMode]);
  const [activeTool, setActiveTool] = useState<EditorTool>({ type: 'grab' });
  const [brushSize, setBrushSize] = useState<1 | 2 | 3>(1);
  const [pendingExitTheme, setPendingExitTheme] = useState<HabitatThemeId | null>(null);
  const [isPendingExitEditMode, setIsPendingExitEditMode] = useState(false);

  // Custom Biomes Manifest State & Management Modals
  const [customBiomes, setCustomBiomes] = useState<CustomBiomeRecord[]>(() => getCustomBiomesList());
  const [isCreateBiomeOpen, setIsCreateBiomeOpen] = useState(false);
  const [manageBiomeTarget, setManageBiomeTarget] = useState<CustomBiomeRecord | null>(null);

  // Biome World State & Saved Baseline for Dirty Equality Tracking
  const [world, setWorld] = useState<BiomeWorldState>(() => loadActiveWorld());
  const [savedWorld, setSavedWorld] = useState<BiomeWorldState>(() => loadActiveWorld());
  const historyRef = useRef<BiomeHistoryManager>(new BiomeHistoryManager(30));
  const isStrokeActive = useRef(false);

  // Filter creatures that reside in this biome (defaults to 'greenhouse' = World)
  const residentCreatures = useMemo(() => {
    return creatures.filter((c) => {
      if (activeHabitatTheme === 'greenhouse') {
        // Each World creature lives in one area of the World; you can explore and build anywhere without them following
        return normalizeHome(c.biomeId) === 'greenhouse' && (c.worldRegion || 0) === worldRegion;
      }
      return c.biomeId === activeHabitatTheme;
    });
  }, [creatures, activeHabitatTheme, worldRegion]);

  // Derive dirty state dynamically through structural equality
  const isDirty = useMemo(() => {
    return !areBiomeWorldsEqual(world, savedWorld);
  }, [world, savedWorld]);

  const residentGrassIds = useMemo(() => residentCreatures.map(c => c.id), [residentCreatures]);

  // Selected Creature & Care Items (default to first resident or first overall)
  const [selectedCreatureId, setSelectedCreatureId] = useState<string>(
    () => residentCreatures[0]?.id || creatures[0]?.id || ''
  );
  const [activeTreats, setActiveTreats] = useState<ActiveTreat[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [questOpen, setQuestOpen] = useState(false);

  // Creatures are sized in world tiles so they stay in scale with houses and trees at any screen size
  const [tilePx, setTilePx] = useState(16);
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => setTilePx(el.clientWidth / GRID_WIDTH || 16);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const creaturePx = Math.max(36, Math.round(tilePx * CREATURE_TILES));

  // Picking creatures up: press and drag a creature, let go and it drops onto the ground below
  const dragRef = useRef<{ id: string; x: number; y: number; moved: boolean } | null>(null);
  const justDraggedRef = useRef(false);
  const [heldCreature, setHeldCreature] = useState<{ id: string; xPct: number; yPct: number } | null>(null);
  const pointerToWorld = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height) return null;
    return {
      xPct: Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)),
      yPct: Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100))
    };
  };
  const dropCreature = (id: string, xPct: number, yPct: number) => {
    const gridX = Math.max(0, Math.min(GRID_WIDTH - 1, Math.floor((xPct / 100) * GRID_WIDTH)));
    // Land on the first solid ground at or below where it was let go, like a falling shimeji
    const startRow = Math.max(0, Math.min(GRID_HEIGHT - 1, Math.floor((yPct / 100) * GRID_HEIGHT)));
    const surface = findSupportedSurfaceY(world, gridX, startRow);
    const spot = surface === -1 ? findSafeSpawnPosition(world, xPct) : { gridX, gridY: surface, xPct: ((gridX + 0.5) / GRID_WIDTH) * 100, yPct: (surface / GRID_HEIGHT) * 100 };
    setSimStates((prev) => {
      const s = prev[id];
      if (!s) return prev;
      return {
        ...prev,
        [id]: {
          ...s,
          gridX: spot.gridX,
          gridY: spot.gridY,
          xPct: spot.xPct,
          yPct: spot.yPct,
          vx: 0,
          vy: 0,
          targetGridX: spot.gridX,
          isInWater: spot.gridY < GRID_HEIGHT && isWaterTile(world.tiles[spot.gridY]?.[spot.gridX]),
          mood: 'excited',
          ...createSpeech(Math.random() < 0.5 ? 'Wheee! 🎈' : 'Boing! ✨')
        }
      };
    });
  };
  const [activeToy, setActiveToy] = useState<ActiveToy | null>({ xPct: 50, yPct: 55, vx: 0.6, vy: 0 });
  const [selectedTreat, setSelectedTreat] = useState<FoodTreat>(FOOD_TREATS[0]);
  const [, setTasteVersion] = useState(0);
  useEffect(() => tasteBook.subscribe(() => setTasteVersion((n) => n + 1)), []);
  // Name tags show only briefly after a creature is clicked
  const [nameTag, setNameTag] = useState<{ id: string; at: number } | null>(null);
  useEffect(() => {
    if (!nameTag) return;
    const timer = window.setTimeout(() => setNameTag(null), 3500);
    return () => window.clearTimeout(timer);
  }, [nameTag]);

  // Greenhouse Garden Tasks progression state
  const [gardenTasks, setGardenTasks] = useState<GardenTasksState>(() => loadGardenTasksFromStorage());
  const [isTasksPanelOpen, setIsTasksPanelOpen] = useState(false);
  const [claimedRewardSparkle, setClaimedRewardSparkle] = useState(false);
  const interactionCooldowns = useRef<Record<string, { pond?: number; flower?: number; shelter?: number }>>({});
  const weatherTalkMemos = useRef<Record<string, TalkMemo>>({});

  const [tray,setTray] = useState(false);
  const [gardenMenu,setGardenMenu] = useState(false);
  // First Garden Adventure state
  const [advState, setAdvState] = useState<GardenAdventureState>(() => gardenAdventure.get());
  const [isAdventureModalOpen, setIsAdventureModalOpen] = useState(false);
  const [diaryCreature, setDiaryCreature] = useState<CreatureDNA | null>(null);
  const [adventurePhotoOpen, setAdventurePhotoOpen] = useState(false);

  // On a player's first visit, a resident points them to the Garden Adventure once
  useEffect(() => {
    const NUDGE_KEY = 'oddlings_adventure_nudge_v1';
    try {
      if (localStorage.getItem(NUDGE_KEY) || gardenAdventure.get().step !== 'not_started') return;
    } catch {
      return;
    }
    const timer = window.setTimeout(() => {
      const guide = residentCreatures[0];
      if (!guide) return;
      try {
        localStorage.setItem(NUDGE_KEY, '1');
      } catch {
        /* blocked storage: the nudge may show again next visit */
      }
      setSimStates((prev) => (prev[guide.id] ? { ...prev, [guide.id]: { ...prev[guide.id], mood: 'excited', ...createSpeech('🌱 Psst! Tap Garden Adventure to grow a flower with me!') } } : prev));
    }, 4000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Short pixel effects that show an ability or bloom actually happened: droplets, a glow ring, a sparkle burst
  type WorldFx = { id: number; kind: 'water' | 'glow' | 'bloom'; xPct: number; yPct: number };
  const [worldFx, setWorldFx] = useState<WorldFx[]>([]);
  const playFx = (kind: WorldFx['kind'], xPct: number, yPct: number) => {
    const id = Date.now() + Math.random();
    setWorldFx((prev) => [...prev.slice(-12), { id, kind, xPct, yPct }]);
    window.setTimeout(() => setWorldFx((prev) => prev.filter((f) => f.id !== id)), kind === 'bloom' ? 2200 : 1600);
  };
  const seedSpots = (w: BiomeWorldState, onlyId?: string | null) =>
    w.decorations
      .filter((d) => d.type === 'seed' && (!onlyId || d.id === onlyId))
      .map((d) => ({ x: ((d.gridX + 0.5) / GRID_WIDTH) * 100, y: (d.gridY / GRID_HEIGHT) * 100 }));

  useEffect(() => {
    return gardenAdventure.subscribe(() => {
      setAdvState(gardenAdventure.get());
    });
  }, []);

  // Rain satisfies watering step once without terrain damage
  useEffect(() => {
    return weatherBus.subscribe(() => {
      const wState = weatherBus.get();
      if ((wState.rain > 0.01 || wState.state === 'rain') && !isEditMode) {
        const adv = gardenAdventure.get();
        if (adv.step === 'seed_planted' && adv.biomeId === world.biome) {
          const res = gardenAdventure.recordWatering({ isRain: true }, world);
          if (res.ok) {
            setWorld((prev) => {
              const updated = {
                ...prev,
                decorations: prev.decorations.map((d) => (d.type === 'seed' ? { ...d, wateredAt: Date.now() } : d)),
                updatedAt: Date.now()
              };
              saveBiomeWorldToStorage(updated);
              return updated;
            });
            setAbilityMessage('🌱 Gentle rain watered the garden seed!');
          }
        }
      }
    });
  }, [world, isEditMode]);

  // Auto-detect if world already has blooming flowers to update garden tasks
  useEffect(() => {
    if (activeHabitatTheme === 'greenhouse' && !gardenTasks.grownFlower) {
      const nowMs = Date.now();
      const hasBloom = world.decorations.some((d) => {
        if (d.type === 'flower') return true;
        if (d.type === 'seed') {
          return computeSeedGrowth(d, nowMs, world).stage === 3;
        }
        return false;
      });
      if (hasBloom) {
        setGardenTasks((prev) => {
          if (!prev.grownFlower) {
            const next = { ...prev, grownFlower: true };
            saveGardenTasksToStorage(next);
            return next;
          }
          return prev;
        });
      }
    }
  }, [world.decorations, activeHabitatTheme, gardenTasks.grownFlower]);

  // Load world when theme changes, and load high-res background from IndexedDB for custom biomes
  useEffect(() => {
    let isCurrent = true;
    const loaded = loadActiveWorld();
    setWorld(loaded);
    setSavedWorld(loaded);
    historyRef.current.clear();

    if (activeHabitatTheme.startsWith('custom_') || loaded.isCustom) {
      loadCustomBiomeBackground(activeHabitatTheme).then((asset) => {
        if (isCurrent && asset && asset.backgroundDataUrl) {
          setWorld((prev) => ({
            ...prev,
            customBackgroundUrl: asset.backgroundDataUrl,
            originalPhotoUrl: asset.originalPhotoDataUrl
          }));
          setSavedWorld((prev) => ({
            ...prev,
            customBackgroundUrl: asset.backgroundDataUrl,
            originalPhotoUrl: asset.originalPhotoDataUrl
          }));
        }
      });
    }

    return () => {
      isCurrent = false;
    };
  }, [activeHabitatTheme, worldRegion, restoreEpoch]);

  // Simulation state map keyed by creature id, placed on actual solid terrain
  const [simStates, setSimStatesReact] = useState<Record<string, CreatureSimState>>(() => {
    const initial: Record<string, CreatureSimState> = {};
    const loadedWorld = loadActiveWorld();

    creatures.forEach((c, idx) => {
      const preferredX = 20 + ((idx * 25) % 60);
      const spawn = findSafeSpawnPosition(loadedWorld, preferredX);
      initial[c.id] = {
        gridX: spawn.gridX,
        gridY: spawn.gridY,
        xPct: spawn.xPct,
        yPct: spawn.yPct,
        vx: 0,
        vy: 0,
        targetGridX: spawn.gridX,
        direction: idx % 2 === 0 ? 1 : -1,
        mood: determineCreatureMood(c),
        isInteracting: false,
        isInWater: false
      };
    });
    return initial;
  });

  // Creature movement runs every animation frame without re-rendering the whole habitat: the latest state lives
  // in simRef, positions are written straight to each creature's element, and React only re-renders when
  // something visible changes (a new tile, mood, speech, facing or water). Every other update goes through
  // setSimStates below, which keeps simRef and React in step.
  const simRef = useRef(simStates);
  const creatureEls = useRef<Record<string, HTMLDivElement | null>>({});
  // Speech bubbles and name tags live in their own layer above the front grass, and follow their creature
  const labelEls = useRef<Record<string, HTMLDivElement | null>>({});
  const cameraGeometry = useRef({ regionWidth: 0, viewportWidth: 0, regionLeft: 0 });
  React.useLayoutEffect(() => {
    const region = containerRef.current;
    const viewport = region?.closest('.world-viewport');
    if (!region || !viewport) return;
    const measure = () => {
      const bounds = viewport.getBoundingClientRect();
      const terrain = region.getBoundingClientRect();
      cameraGeometry.current = { regionWidth: terrain.width, viewportWidth: bounds.width, regionLeft: terrain.left - bounds.left };
    };
    const observer = new ResizeObserver(measure);
    observer.observe(region);
    observer.observe(viewport);
    viewport.addEventListener('scroll', measure, true);
    measure();
    return () => {
      observer.disconnect();
      viewport.removeEventListener('scroll', measure, true);
    };
  }, [activeHabitatTheme, worldRegion]);
  const committedSig = useRef('');
  const setSimStates = useCallback(
    (update: Record<string, CreatureSimState> | ((prev: Record<string, CreatureSimState>) => Record<string, CreatureSimState>)) => {
      const next = typeof update === 'function' ? update(simRef.current) : update;
      simRef.current = next;
      setSimStatesReact(next);
    },
    []
  );
  const stepSimFrame = useCallback((update: (prev: Record<string, CreatureSimState>) => Record<string, CreatureSimState>) => {
    const next = update(simRef.current);
    simRef.current = next;
    let sig = '';
    for (const id of Object.keys(next)) {
      const s = next[id];
      const el = creatureEls.current[id];
      if (el && !el.dataset.held) el.style.left = s.xPct + '%';
      const label = labelEls.current[id];
      if (label && !el?.dataset.held) {
        label.style.left = s.xPct + '%';
        if (s.bubbleText) {
          const { regionWidth, viewportWidth, regionLeft } = cameraGeometry.current;
          const x = regionLeft + regionWidth * s.xPct / 100;
          const half = Math.min(85, viewportWidth / 2);
          label.style.setProperty('--speech-offset', (Math.max(half, Math.min(viewportWidth - half, x)) - x) + 'px');
          label.style.visibility = x < 0 || x > viewportWidth ? 'hidden' : '';
        } else {
          label.style.visibility = '';
        }
      }
      sig += id + ':' + Math.round(s.gridX) + ',' + Math.round(s.gridY) + ',' + s.mood + ',' + s.direction + ',' + (s.bubbleText || '') + ',' + s.isInWater + ',' + s.isInteracting + ';';
    }
    if (sig !== committedSig.current) {
      committedSig.current = sig;
      setSimStatesReact({ ...next });
    }
  }, []);

  // Ensure new creatures are safely spawned on terrain
  useEffect(() => {
    setSimStates((prev) => {
      const next = { ...prev };
      creatures.forEach((c, idx) => {
        if (!next[c.id]) {
          const preferredX = 25 + ((idx * 20) % 50);
          const spawn = findSafeSpawnPosition(world, preferredX);
          next[c.id] = {
            gridX: spawn.gridX,
            gridY: spawn.gridY,
            xPct: spawn.xPct,
            yPct: spawn.yPct,
            vx: 0,
            vy: 0,
            targetGridX: spawn.gridX,
            direction: 1,
            mood: determineCreatureMood(c),
            isInteracting: false,
            isInWater: false
          };
        }
      });
      return next;
    });

    if (!selectedCreatureId && creatures.length > 0) {
      setSelectedCreatureId(creatures[0].id);
    }
  }, [creatures, selectedCreatureId, world]);

  // Reposition creatures onto valid solid ground if terrain was edited or loaded
  const groundAllCreatures = useCallback(() => {
    setSimStates((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((cId) => {
        const sim = next[cId];
        if (!sim) return;
        const currentGx = Math.max(0, Math.min(GRID_WIDTH - 1, Math.round(sim.gridX)));
        const groundRow = findSupportedSurfaceY(world, currentGx, 0);

        if (groundRow !== -1) {
          next[cId] = {
            ...sim,
            gridY: groundRow,
            yPct: (groundRow / GRID_HEIGHT) * 100
          };
        } else {
          // Relocate to safe spawn if column is empty air
          const safe = findSafeSpawnPosition(world, sim.xPct);
          next[cId] = {
            ...sim,
            gridX: safe.gridX,
            gridY: safe.gridY,
            xPct: safe.xPct,
            yPct: safe.yPct,
            targetGridX: safe.gridX
          };
        }
      });
      return next;
    });
  }, [world]);

  // Creatures wander between neighboring World areas on their own now and then. They like places people have built
  // up (houses, benches, lamps, built floors), so a creature in a cozy, built area mostly stays, and one in empty
  // wilderness drifts toward construction. A creature leaving the area you are looking at walks off the edge first.
  const creaturesRef = useRef(creatures);
  creaturesRef.current = creatures;
  const viewRef = useRef({ region: worldRegion, theme: activeHabitatTheme, edit: isEditMode });
  viewRef.current = { region: worldRegion, theme: activeHabitatTheme, edit: isEditMode };
  useEffect(() => {
    const BUILDINGS = /cottage|house|shelter|hut|cabin|tower|shop|barn|door|well|tent/;
    const FURNISHING = /bench|lamp|lantern|fence|campfire|pot|crystal|custom|sign|chair|table|bed|statue/;
    const BUILT_TILES = new Set(['brick', 'plaster', 'carpet', 'tile', 'glass', 'metal', 'wood']);
    const scoreOf = (w: BiomeWorldState) => {
      let s = 0;
      for (const d of w.decorations) s += BUILDINGS.test(d.type) ? 4 : FURNISHING.test(d.type) ? 1 : 0.2;
      let built = 0;
      for (const row of w.tiles) for (const tile of row) if (BUILT_TILES.has(tile)) built++;
      return s + built / 15;
    };
    const timer = window.setInterval(() => {
      const view = viewRef.current;
      if (view.edit || document.hidden) return;
      const world = creaturesRef.current.filter((c) => normalizeHome(c.biomeId) === 'greenhouse');
      if (!world.length) return;
      const c = world[Math.floor(Math.random() * world.length)];
      const from = c.worldRegion || 0;
      let here: number, left: number, right: number;
      try {
        here = scoreOf(loadWorldRegion(from));
        left = scoreOf(loadWorldRegion(from - 1));
        right = scoreOf(loadWorldRegion(from + 1));
      } catch {
        return;
      }
      const leaveChance = here >= 6 ? 0.04 : here >= 2 ? 0.12 : 0.35;
      if (Math.random() > leaveChance) return;
      const dir = Math.random() * (left + right + 0.6) < left + 0.3 ? -1 : 1;
      const there = dir < 0 ? left : right;
      // Rarely trades a built-up home for somewhere emptier
      if (there < here * 0.6 && Math.random() > 0.15) return;
      const move = () => {
        const latest = creaturesRef.current.find((x) => x.id === c.id);
        if (!latest || (latest.worldRegion || 0) !== from) return;
        onUpdateCreature({ ...latest, worldRegion: from + dir });
      };
      if (view.theme === 'greenhouse' && view.region === from) {
        // Seen leaving: it strolls to the edge it is heading for, then crosses over
        setSimStates((prev) => (prev[c.id] ? { ...prev, [c.id]: { ...prev[c.id], targetGridX: dir < 0 ? 0 : GRID_WIDTH - 1, direction: dir as 1 | -1 } } : prev));
        window.setTimeout(move, 7000);
      } else {
        move();
      }
    }, 45_000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Creatures follow you between World areas, keeping their spot on screen; each area's ground is a different
  // height, so on arrival they land on the new ground instead of floating in the air or sitting inside the blocks
  const groundedRegion = useRef(worldRegion);
  useEffect(() => {
    if (groundedRegion.current === worldRegion) return;
    groundedRegion.current = worldRegion;
    groundAllCreatures();
  }, [worldRegion, groundAllCreatures]);

  // When exiting edit mode, ensure all creatures land on reachable solid surfaces
  useEffect(() => {
    if (!isEditMode) {
      groundAllCreatures();
    }
  }, [isEditMode, groundAllCreatures]);

  // Absolute speech deadlines continue to expire while editing or when the simulation pauses.
  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      setSimStates(prev => {
        const expired = Object.entries(prev).filter(([, state]) => state.bubbleText && !speechIsVisible(state, now));
        if (!expired.length) return prev;
        const next = { ...prev };
        for (const [id, state] of expired) next[id] = { ...state, bubbleText: undefined };
        return next;
      });
    }, 100);
    return () => window.clearInterval(timer);
  }, []);

  // Main 60fps physics simulation loop (active in play mode)
  useEffect(() => {
    if (isEditMode) return; // Simulation pauses during editor mode for precise tile placement

    let animationFrameId: number;
    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      const rawDt = (currentTime - lastTime) / 1000;
      const dt = Math.min(rawDt, 0.05); // clamped dt
      lastTime = currentTime;

      // Update active treats countdown & consumption
      setActiveTreats((prevTreats) => {
        if (!prevTreats.length) return prevTreats; // nothing to count down: keep the same state so nothing re-renders
        return prevTreats.filter((t) => t.timeRemaining > 0).map((t) => ({
          ...t,
          timeRemaining: t.timeRemaining - dt
        }));
      });

      // Update toy physics bouncing off terrain boundaries
      setActiveToy((prevToy) => {
        if (!prevToy) return null;
        let nx = prevToy.xPct + prevToy.vx * dt * 25;
        let ny = prevToy.yPct + prevToy.vy * dt * 25;
        let nvx = prevToy.vx * 0.985;
        let nvy = prevToy.vy * 0.985;

        // Bounce on horizontal walls
        if (nx < 8) { nx = 8; nvx = Math.abs(nvx) * 0.8; }
        if (nx > 92) { nx = 92; nvx = -Math.abs(nvx) * 0.8; }

        // Terrain floor bounce
        const toyGridX = Math.max(0, Math.min(GRID_WIDTH - 1, Math.floor((nx / 100) * GRID_WIDTH)));
        const floorRow = findSupportedSurfaceY(world, toyGridX);
        const floorYPct = floorRow !== -1 ? (floorRow / GRID_HEIGHT) * 100 : 85;

        if (ny > floorYPct - 4) {
          ny = floorYPct - 4;
          nvy = -Math.abs(nvy) * 0.75;
          nvx = nvx * 0.9;
        }

        // A ball that has come to rest keeps its state, so a still toy does not re-render the habitat
        if (Math.abs(nx - prevToy.xPct) < 0.001 && Math.abs(ny - prevToy.yPct) < 0.001) return prevToy;
        return { xPct: nx, yPct: ny, vx: nvx, vy: nvy };
      });

      // Update creature roaming & behaviors across terrain
      stepSimFrame((prev) => {
        const next = { ...prev };

        Object.keys(next).forEach((cId) => {
          const state = next[cId];
          if (!state || state.isInteracting) return;

          // Check if creature is currently wading in water
          const curGx = Math.max(0, Math.min(GRID_WIDTH - 1, Math.round(state.gridX)));
          const curGy = Math.max(0, Math.min(GRID_HEIGHT - 1, Math.round(state.gridY)));
          const inWater = isWaterTile(world.tiles[curGy][curGx]) || (curGy > 0 && isWaterTile(world.tiles[curGy - 1][curGx]));
          state.isInWater = inWater;

          // Water splash speech
          if (inWater && canSpeak(state) && Math.random() < 0.005) {
            Object.assign(state, createSpeech(voiceLine(cId, 'water', 'Splish splash! 💧')));
          }

          // Check near decorations
          if (canSpeak(state) && Math.random() < 0.003) {
            const nearDecor = world.decorations.find(
              (d) => Math.abs(d.gridX - curGx) <= 2 && Math.abs(d.gridY - curGy) <= 2
            );
            if (nearDecor) {
              if (nearDecor.type === 'lantern') Object.assign(state, createSpeech(voiceLine(cId, 'light', 'So warm! 💡')));
              else if (nearDecor.type === 'shelter') Object.assign(state, createSpeech(voiceLine(cId, 'shelter', 'Cozy shelter! ⛺')));
              else if (nearDecor.type === 'flower') Object.assign(state, createSpeech(voiceLine(cId, 'flower', 'Sweet scent! 🌸')));
              else if (nearDecor.type === 'mushroom') Object.assign(state, createSpeech(voiceLine(cId, 'idle', 'Spotted cap! 🍄')));
            }
          }

          // If treat exists nearby on terrain, navigate towards it!
          const nearestTreat = activeTreats[0];
          if (nearestTreat) {
            const dx = nearestTreat.gridX - state.gridX;
            if (Math.abs(dx) < 1.0) {
              // Eat treat!
              sound.playNom();
              const c = creatures.find((item) => item.id === cId);
              if (c) {
                const res = calculateInteractionResult(c, 'feed', nearestTreat.treat.element);
                const taste = tasteOf(c, nearestTreat.treat.element, FOOD_TREATS.map((t) => t.element));
                tasteBook.reveal(c.id, nearestTreat.treat.id, taste);
                const updated: CreatureDNA = {
                  ...c,
                  stats: {
                    ...c.stats,
                    trust: clampTrust(c.stats.trust, TASTE_TRUST[taste]),
                    energy: Math.min(100, c.stats.energy + res.energyDelta)
                  },
                  memories: [
                    { timestamp: Date.now(), text: giftMemory(taste, nearestTreat.treat.name), type: 'feed' },
                    ...c.memories.slice(0, 15)
                  ]
                };
                onUpdateCreature(updated);
              }
              setActiveTreats((t) => t.filter((item) => item.id !== nearestTreat.id));
              Object.assign(state, createSpeech(reactionLine(c ? tasteOf(c, nearestTreat.treat.element, FOOD_TREATS.map((t) => t.element)) : 'neutral')));
            } else {
              // Move towards treat along walkable terrain
              const stepDir = dx > 0 ? 1 : -1;
              const nextGx = state.gridX + stepDir * dt * (inWater ? 2.5 : 4.0);
              const stepCheck = canStepTo(world, Math.round(state.gridX), Math.round(state.gridY), Math.round(nextGx));

              if (stepCheck.allowed) {
                state.gridX = nextGx;
                state.gridY = stepCheck.targetGy;
                state.xPct = ((state.gridX + 0.5) / GRID_WIDTH) * 100;
                state.yPct = (state.gridY / GRID_HEIGHT) * 100;
                state.direction = stepDir;
              }
              return;
            }
          }

          // Gentle idle roaming on terrain
          const distToTarget = Math.abs(state.targetGridX - state.gridX);

          if (distToTarget < 1.0) {
            // Pick new target column within reachable distance
            if (Math.random() < 0.02) {
              const delta = (Math.random() - 0.5) * 16;
              const newTarget = Math.max(3, Math.min(GRID_WIDTH - 4, state.gridX + delta));
              state.targetGridX = newTarget;
              state.direction = newTarget > state.gridX ? 1 : -1;
            }
          } else {
            const stepDir = state.targetGridX > state.gridX ? 1 : -1;
            const speed = inWater ? 1.5 : 2.8;
            const nextGx = state.gridX + stepDir * dt * speed;
            const stepCheck = canStepTo(world, Math.round(state.gridX), Math.round(state.gridY), Math.round(nextGx));

            if (stepCheck.allowed) {
              state.gridX = nextGx;
              state.gridY = stepCheck.targetGy;
              state.direction = stepDir;
            } else {
              // Obstacle / steep wall / cliff reached: reverse wandering direction
              state.targetGridX = state.gridX - stepDir * (3 + Math.random() * 8);
              state.direction = state.targetGridX > state.gridX ? 1 : -1;
            }
          }

          // Grounding & Gravity check: ensure creature stays supported if blocks underneath were altered
          const checkGx = Math.max(0, Math.min(GRID_WIDTH - 1, Math.round(state.gridX)));
          const supportedY = findSupportedSurfaceY(world, checkGx, Math.max(0, Math.round(state.gridY) - 1));
          if (supportedY !== -1) {
            if (state.gridY < supportedY) {
              state.gridY = Math.min(supportedY, state.gridY + dt * 14);
            } else if (state.gridY > supportedY) {
              state.gridY = supportedY;
            }
          } else {
            const safe = findSafeSpawnPosition(world, state.xPct);
            state.gridX += (safe.gridX - state.gridX) * dt * 4;
            state.gridY = safe.gridY;
          }
          state.xPct = ((state.gridX + 0.5) / GRID_WIDTH) * 100;
          state.yPct = (state.gridY / GRID_HEIGHT) * 100;

          // Proximity Interactions for Greenhouse & Biomes (Cooldown-protected)
          const nowTs = Date.now();
          if (!interactionCooldowns.current[cId]) {
            interactionCooldowns.current[cId] = {};
          }
          const creatureCooldowns = interactionCooldowns.current[cId];

          // Weather chatter: creatures react to gathering clouds, rain and clearing skies
          {
            const wx = weatherBus.get();
            const talk = nextWeatherTalk(weatherTalkMemos.current[cId], wx, nowTs, Math.random, canSpeak(state, nowTs));
            weatherTalkMemos.current[cId] = talk.memo;
            if (talk.phase) {
              const local = weatherLine(cId, talk.phase, Math.random);
              const line = talk.phase === 'rain' || talk.phase === 'rainLater' ? voiceLine(cId, 'rain', local) : local;
              Object.assign(state, createSpeech(line));
            }
          }

          // 1. Water / Pond proximity (in water or near pond basin)
          const nearWater = inWater || (
            state.gridX >= 18 && state.gridX <= 26 && state.gridY >= 16
          );
          if (canSpeak(state, nowTs) && nearWater && (!creatureCooldowns.pond || nowTs - creatureCooldowns.pond > 18000)) {
            creatureCooldowns.pond = nowTs;
            Object.assign(state, createSpeech(voiceLine(cId, 'water', Math.random() < 0.5 ? 'Sip! 🫧' : 'Splish splash! 💦')));
            state.mood = 'happy';
            setGardenTasks((prev) => {
              if (!prev.oddlingEnjoyedPond) {
                const next = { ...prev, oddlingEnjoyedPond: true };
                saveGardenTasksToStorage(next);
                return next;
              }
              return prev;
            });
          }

          // 2. Flower or Bloomed Seed proximity (within 1.8 tiles)
          const nearbyFlower = world.decorations.find((d) => {
            if (d.type === 'flower') {
              return Math.abs(d.gridX - state.gridX) <= 1.8 && Math.abs(d.gridY - state.gridY) <= 2;
            }
            if (d.type === 'seed') {
              const growth = computeSeedGrowth(d, nowTs, world);
              return growth.stage === 3 && Math.abs(d.gridX - state.gridX) <= 1.8 && Math.abs(d.gridY - state.gridY) <= 2;
            }
            return false;
          });

          if (canSpeak(state, nowTs) && nearbyFlower && (!creatureCooldowns.flower || nowTs - creatureCooldowns.flower > 18000)) {
            creatureCooldowns.flower = nowTs;
            Object.assign(state, createSpeech(voiceLine(cId, 'flower', Math.random() < 0.5 ? 'Sniff! 🌸' : 'Sweet blossom! ✨')));
            state.mood = 'happy';
            setGardenTasks((prev) => {
              if (!prev.grownFlower) {
                const next = { ...prev, grownFlower: true };
                saveGardenTasksToStorage(next);
                return next;
              }
              return prev;
            });
          }

          // 3. Rooted Shelter proximity (within 2.2 tiles)
          const nearbyShelter = world.decorations.find((d) =>
            d.type === 'shelter' && Math.abs(d.gridX - state.gridX) <= 2.2 && Math.abs(d.gridY - state.gridY) <= 2
          );
          if (canSpeak(state, nowTs) && nearbyShelter && (!creatureCooldowns.shelter || nowTs - creatureCooldowns.shelter > 22000)) {
            creatureCooldowns.shelter = nowTs;
            Object.assign(state, createSpeech(voiceLine(cId, 'shelter', Math.random() < 0.5 ? 'Cozy shade... 🍃' : 'Zzz... 💤')));
            state.mood = 'sleepy';
          }

          if (state.bubbleText && !speechIsVisible(state)) state.bubbleText = undefined;

        });

        return next;
      });

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [activeTreats, creatures, isEditMode, onUpdateCreature, world]);

  // Editor Actions
  const handleStrokeStart = () => {
    if (!isStrokeActive.current) {
      historyRef.current.pushSnapshot(world);
      isStrokeActive.current = true;
    }
  };

  const handleStrokeEnd = () => {
    isStrokeActive.current = false;
  };

  const handlePaintStroke = (gridX: number, gridY: number) => {
    handleStrokeStart();
    if (activeTool.type === 'brush') {
      sound.playPlaceTile();
      setWorld((prev) => paintTiles(prev, gridX, gridY, activeTool.material, brushSize));
    } else if (activeTool.type === 'eraser') {
      sound.playBreakTile();
      setWorld((prev) => eraseTiles(prev, gridX, gridY, brushSize));
    }
  };

  const handlePlaceDecoration = (decorType: DecorationType, gridX: number, gridY: number, customItemId?: string) => {
    const check = canPlaceDecoration(world, decorType, gridX, gridY);
    if (!check.allowed) {
      sound.playBreakTile();
      return;
    }
    historyRef.current.pushSnapshot(world);
    sound.playPlaceTile();
    const flowerVariant = gardenTasks.rewardClaimed ? 'starbloom' : undefined;
    const targetY = check.snappedY !== undefined ? check.snappedY : gridY;
    setWorld((prev) => addDecoration(prev, decorType, gridX, targetY, { flowerVariant, ...(customItemId ? { customItemId } : {}) }));

    if (decorType === 'seed') {
      const placedSeed = world.decorations.find((d) => d.type === 'seed' && d.gridX === gridX) || { id: `decor-seed-${Date.now()}` };
      gardenAdventure.linkSeed(placedSeed.id, world.biome);
      setGardenTasks((prev) => {
        if (!prev.plantedSeed) {
          const next = { ...prev, plantedSeed: true };
          saveGardenTasksToStorage(next);
          return next;
        }
        return prev;
      });
    }
  };

  const handleRemoveDecoration = (decorId: string) => {
    historyRef.current.pushSnapshot(world);
    sound.playBreakTile();
    setWorld((prev) => {
      const nextWorld = removeDecoration(prev, decorId);
      gardenAdventure.verifyTarget(nextWorld);
      return nextWorld;
    });
  };

  // Build mode: a grabbed ground block moves to an empty cell (or is deleted on the trash) as one undoable step
  const handleMoveTile = (fromX: number, fromY: number, toX: number | null, toY: number | null) => {
    const material = world.tiles[fromY]?.[fromX];
    if (!material || material === 'air') return;
    if (toX !== null && toY !== null && world.tiles[toY]?.[toX] !== 'air') {
      sound.playBreakTile();
      return;
    }
    historyRef.current.pushSnapshot(world);
    if (toX === null || toY === null) {
      sound.playBreakTile();
      setWorld((prev) => paintTiles(prev, fromX, fromY, 'air', 1));
      return;
    }
    sound.playPlaceTile();
    setWorld((prev) => paintTiles(paintTiles(prev, toX, toY, material, 1), fromX, fromY, 'air', 1));
  };

  // Build mode: a placed item dragged to a new spot moves there as one undoable step
  const handleMoveDecoration = (decorId: string, gridX: number, gridY: number) => {
    const decor = world.decorations.find((d) => d.id === decorId);
    if (!decor) return;
    // Past the left or right edge of this World area: the item moves into the neighboring area
    if (gridX < 0 || gridX >= GRID_WIDTH) {
      if (activeHabitatTheme !== 'greenhouse') {
        sound.playBreakTile();
        return;
      }
      const dir = gridX < 0 ? -1 : 1;
      const target = loadWorldRegion(worldRegion + dir);
      let x = dir < 0 ? gridX + GRID_WIDTH : gridX - GRID_WIDTH;
      let check = canPlaceDecoration(target, decor.type, x, gridY);
      // Slide inward from the shared edge until it finds ground it fits on
      for (let step = 1; !check.allowed && step <= 12; step++) {
        const tryX = dir < 0 ? x - step : x + step;
        const c = canPlaceDecoration(target, decor.type, tryX, gridY);
        if (c.allowed) { check = c; x = tryX; }
      }
      if (!check.allowed) {
        sound.playBreakTile();
        return;
      }
      const { id: _old, gridX: _gx, gridY: _gy, type: _type, ...extra } = decor;
      const moved = addDecoration(target, decor.type, x, check.snappedY !== undefined ? check.snappedY : gridY, extra);
      try {
        saveWorldRegion(moved);
      } catch {
        setTravelError('Could not save the next area. Export your save or free device space.');
        return;
      }
      // Both areas are saved at once (and undo history starts fresh), so Undo or Cancel can never leave the item in both
      const here = { ...world, decorations: world.decorations.filter((d) => d.id !== decorId), updatedAt: Date.now() };
      try {
        saveWorldRegion(here);
      } catch {
        setTravelError('Could not save this area. Export your save or free device space.');
        return;
      }
      historyRef.current.clear();
      sound.playPlaceTile();
      setWorld(here);
      setSavedWorld(here);
      setNeighborEpoch((n) => n + 1);
      return;
    }
    const others = { ...world, decorations: world.decorations.filter((d) => d.id !== decorId) };
    // A drop slightly off a valid spot (a big tree near an edge, say) slides to the nearest column where it fits
    let check = canPlaceDecoration(others, decor.type, gridX, gridY);
    for (let off = 1; !check.allowed && off <= 4; off++) {
      for (const dx of [-off, off]) {
        const c = canPlaceDecoration(others, decor.type, gridX + dx, gridY);
        if (c.allowed && !check.allowed) { check = c; gridX += dx; }
      }
    }
    if (!check.allowed) {
      sound.playBreakTile();
      return;
    }
    historyRef.current.pushSnapshot(world);
    sound.playPlaceTile();
    const targetY = check.snappedY !== undefined ? check.snappedY : gridY;
    setWorld((prev) => ({ ...prev, decorations: prev.decorations.map((d) => (d.id === decorId ? { ...d, gridX, gridY: targetY } : d)) }));
  };

  const handleUndo = () => {
    const previous = historyRef.current.undo(world);
    if (previous) {
      setWorld(previous);
    }
  };

  const handleRedo = () => {
    const next = historyRef.current.redo(world);
    if (next) {
      setWorld(next);
    }
  };

  const handleTravel = (direction: number) => {
    if (isStrokeActive.current || isCreateBiomeOpen || manageBiomeTarget) return false;
    try {
      if (isDirty) saveWorldRegion(world);
      const nextRegion = worldRegion + direction;
      const next = loadWorldRegion(nextRegion);
      setWorld(next); setSavedWorld(next); setWorldRegion(nextRegion);
      historyRef.current.clear(); setActiveTreats([]); setActiveToy(null); setTravelError('');
      return true;
    } catch { setTravelError('Could not save this area. Export your save or free device space before exploring further.'); return false; }
  };

  const handleSaveWorld = () => {
    try { saveWorldRegion(world); } catch { setTravelError('Your device is out of save space. Export your save before exploring further.'); return; }
    setSavedWorld(world);
    setIsEditMode(false);
    groundAllCreatures();
    onBiomeCustomized?.();
    return true;
  };

  const handleCancelEdits = () => {
    const reloaded = loadActiveWorld();
    setWorld(reloaded);
    setSavedWorld(reloaded);
    historyRef.current.clear();
    setIsEditMode(false);
    groundAllCreatures();
  };

  const handleResetBiome = () => {
    historyRef.current.pushSnapshot(world);
    const resetWorld = activeHabitatTheme === 'greenhouse' && worldRegion !== 0 ? createWorldRegion(worldRegion) : createStarterWorld(activeHabitatTheme, activeHabitatTheme === 'greenhouse' ? 'living_garden' : 'cozy_clearing');
    resetWorld.biome = world.biome;
    setWorld(resetWorld);

    groundAllCreatures();
  };

  const handleApplyTemplate = (templateId: StarterTemplateId) => {
    historyRef.current.pushSnapshot(world);
    const templateWorld = createStarterWorld(activeHabitatTheme, templateId);
    templateWorld.biome = world.biome;
    setWorld(templateWorld);
    groundAllCreatures();
  };

  // Keyboard shortcuts (B, E, Ctrl+Z, Ctrl+Y) scoped away from text inputs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is inside an input, textarea, or contentEditable
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (e.key === 'b' || e.key === 'B') {
        if (!e.ctrlKey && !e.metaKey) {
          setActiveTool({ type: 'brush', material: 'grass' });
        }
      } else if (e.key === 'e' || e.key === 'E') {
        if (!e.ctrlKey && !e.metaKey) {
          setActiveTool({ type: 'eraser' });
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        if (e.shiftKey) {
          if (historyRef.current.canRedo()) handleRedo();
        } else {
          if (historyRef.current.canUndo()) handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        if (historyRef.current.canRedo()) handleRedo();
      } else if (e.key === 'Escape' && isEditMode) {
        handleCancelEdits();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditMode, world]);

  // Care Interactions in Play Mode
  const handlePet = (creatureId: string) => {
    if (isEditMode) return;
    sound.playPurr();
    sound.playChirp(640);
    onPlayerCareAction?.();
    walletBook.rewardCare(); // care earns Sparkle Coins, up to a daily limit
    const target = creatures.find((c) => c.id === creatureId);
    if (!target) return;

    const res = calculateInteractionResult(target, 'pet');
    const updated: CreatureDNA = {
      ...target,
      stats: {
        ...target.stats,
        trust: Math.min(100, target.stats.trust + res.trustDelta),
        energy: Math.max(0, target.stats.energy + res.energyDelta)
      },
      memories: [
        { timestamp: Date.now(), text: res.memoryText, type: 'pet' },
        ...target.memories.slice(0, 15)
      ]
    };
    onUpdateCreature(updated);

    setSimStates((prev) => ({
      ...prev,
      [creatureId]: {
        ...prev[creatureId],
        isInteracting: true,
        mood: 'loving',
        ...createSpeech(voiceLine(creatureId, 'pet', 'Purr... ❤️'))
      }
    }));

    setTimeout(() => {
      setSimStates((prev) => ({
        ...prev,
        [creatureId]: {
          ...prev[creatureId],
          isInteracting: false,
          mood: determineCreatureMood(updated)
        }
      }));
    }, 1200);
  };

  // Drop treat onto terrain in Play Mode
  const handleDropTreatOnTerrain = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isEditMode || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = e.clientX;
    const clientY = e.clientY;

    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
      return;
    }

    const relX = (clientX - rect.left) / rect.width;
    const gridX = Math.max(0, Math.min(GRID_WIDTH - 1, Math.floor(relX * GRID_WIDTH)));

    // Find the highest solid tile in that column for the treat to rest on
    const floorRow = findSupportedSurfaceY(world, gridX);
    const targetGridY = floorRow !== -1 ? Math.max(0, floorRow - 1) : DEFAULT_GROUND_ROW;

    sound.playBounce();
    onPlayerCareAction?.();
    walletBook.rewardCare(); // care earns Sparkle Coins, up to a daily limit

    const newTreat: ActiveTreat = {
      id: `treat-${Date.now()}`,
      treat: selectedTreat,
      gridX,
      xPct: ((gridX + 0.5) / GRID_WIDTH) * 100,
      yPct: ((targetGridY + 0.5) / GRID_HEIGHT) * 100,
      timeRemaining: 12.0
    };

    setActiveTreats((prev) => [...prev.slice(-3), newTreat]);
  };

  // Play with toy ball
  const handleFlingToy = () => {
    sound.playBounce();
    onPlayerCareAction?.();
    walletBook.rewardCare(); // care earns Sparkle Coins, up to a daily limit
    setActiveToy({
      xPct: 20 + Math.random() * 60,
      yPct: 35 + Math.random() * 20,
      vx: (Math.random() - 0.5) * 8,
      vy: -Math.random() * 6
    });
  };

  const selectedCreature = creatures.find((c) => c.id === selectedCreatureId) || creatures[0];
  const selectedEffect = selectedCreature ? getAbilityEffect(selectedCreature) : null;
  const abilityWait = selectedCreature ? Math.max(0, Math.ceil(((abilityReadyAt[selectedCreature.id] || 0) - abilityNow) / 1000)) : 0;
  const handleAbility = () => {
    if (!selectedCreature || isEditMode) return;
    const result = activateCreatureAbility(selectedCreature, creatures, world, Date.now(), abilityReadyAt[selectedCreature.id] || 0);
    setAbilityMessage(result.message);
    if (!result.ok) return;
    result.creatures.forEach(onUpdateCreature);

    let finalWorld = result.world;
    // Garden Adventure Progress integration (only AFTER state change succeeds)
    const adv = gardenAdventure.get();
    if (adv.biomeId === world.biome) {
      if (adv.step === 'seed_planted' && selectedEffect?.kind === 'water') {
        const waterRes = gardenAdventure.recordWatering({ casterId: selectedCreature.id }, finalWorld);
        if (waterRes.ok) {
          setAbilityMessage(`${result.message} 🌱 Adventure: Seed watered!`);
        }
      } else if (adv.step === 'watered' || adv.step === 'encouraged') {
        // 'encouraged' happens when rain did the watering: one resident has helped and a second one is still needed
        const encRes = gardenAdventure.recordEncouragement(selectedCreature.id, finalWorld);
        if (encRes.ok) {
          finalWorld = encRes.updatedWorld;
          setAbilityMessage(`${result.message} 🌸 Adventure: The sprout bloomed!`);
          if (encRes.state.step === 'bloomed') {
            seedSpots(finalWorld, encRes.state.seedId).forEach((s) => playFx('bloom', s.x, s.y));
            void celebrateBloom(encRes.state.contributors);
          }
        } else if (encRes.message) {
          setAbilityMessage(`${result.message} (${encRes.message})`);
        }
      }
    }

    if (finalWorld !== world) {
      setWorld(finalWorld);
      setSavedWorld(finalWorld);
      saveBiomeWorldToStorage(finalWorld);
    }
    // Show the effect where it happened: droplets on the seeds for watering, a glow on the creature otherwise
    if (selectedEffect?.kind === 'water') {
      seedSpots(finalWorld).forEach((s) => playFx('water', s.x, s.y));
    } else {
      const s = simRef.current[selectedCreature.id];
      if (s) playFx('glow', s.xPct, (s.gridY / GRID_HEIGHT) * 100);
    }
    setAbilityReadyAt(prev => ({ ...prev, [selectedCreature.id]: result.readyAt }));
    setAbilityNow(Date.now());
    sound.playChirp(880);
    onPlayerCareAction?.();
    walletBook.rewardCare(); // care earns Sparkle Coins, up to a daily limit
  };

  // The two helpers celebrate the bloom in their own words, written by Muse Spark (Fireworks) about what they just did
  const celebrateBloom = async (contributorIds: string[]) => {
    const [a, b] = contributorIds.map((id) => creatures.find((c) => c.id === id)).filter((c): c is CreatureDNA => !!c);
    if (!a || !b) return;
    sound.playFanfare();
    const who = (c: CreatureDNA) => ({ name: c.name, objectName: c.sourceObject?.name, element: c.primaryElement, temperament: c.temperament });
    try {
      const start = await fetch('/api/fireworks/banter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ a: who(a), b: who(b), topic: 'bloomed their first garden flower: ' + a.name + ' watered the seed and ' + b.name + ' cheered it on' })
      }).then((res) => res.json()).catch(() => null);
      if (!start?.jobId) return;
      for (let k = 0; k < 30; k++) {
        await new Promise((res) => setTimeout(res, 2500));
        const job = await fetch('/api/fireworks/banter/' + start.jobId).then((res) => res.json()).catch(() => null);
        if (job?.status === 'pending') continue;
        const lines: Array<{ speaker: 'a' | 'b'; text: string }> = job?.status === 'done' ? job.result?.lines || [] : [];
        lines.forEach((line, i) => {
          setTimeout(() => {
            const id = line.speaker === 'a' ? a.id : b.id;
            setSimStates((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], mood: 'excited', ...createSpeech((i === 0 ? '🌸 ' : '') + line.text) } } : prev));
          }, i * 3600);
        });
        return;
      }
    } catch {
      // The bloom and reward do not depend on the celebration lines
    }
  };

  // A photo of something that holds water can water the adventure seed (checked by Muse Spark vision)
  const handleAdventurePhotoMatch = (seen: string) => {
    if (!selectedCreature) return;
    const res = gardenAdventure.recordWatering({ casterId: selectedCreature.id }, world);
    if (!res.ok) {
      setAbilityMessage(res.message);
      return;
    }
    const seedId = res.state.seedId;
    setWorld((prev) => {
      const updated = { ...prev, decorations: prev.decorations.map((d) => (d.id === seedId ? { ...d, wateredAt: Date.now() } : d)), updatedAt: Date.now() };
      saveBiomeWorldToStorage(updated);
      return updated;
    });
    seedSpots(world, seedId).forEach((s) => playFx('water', s.x, s.y));
    setAbilityMessage('📸 ' + selectedCreature.name + ' watered the seed using your photo of ' + (seen || 'something that holds water') + '!');
  };

  // One line telling the player what to do next in the adventure
  const adventureHint = (() => {
    if (activeHabitatTheme !== 'greenhouse') return '';
    const waterer = residentCreatures.find((c) => getAbilityEffect(c).kind === 'water');
    switch (advState.step) {
      case 'accepted':
        return 'Plant a seed in the garden (or use Plant Starter Seed in the adventure).';
      case 'seed_planted':
        return 'Water the seed: select ' + (waterer ? waterer.name : 'a creature with a water ability') + ' and use its ability, or water it with a photo in the adventure.';
      case 'watered':
      case 'encouraged':
        return 'Now select a different creature and use its ability to cheer the sprout on.';
      case 'bloomed':
        return 'Your flower bloomed! Open Garden Adventure to claim the reward.';
      default:
        return '';
    }
  })();

  const handlePlantStarterSeed = () => {
    const spawn = findSafeSpawnPosition(world);
    const flowerVariant = gardenTasks.rewardClaimed ? 'starbloom' : undefined;
    const nextWorld = addDecoration(world, 'seed', spawn.gridX, spawn.gridY, { flowerVariant });
    setWorld(nextWorld);
    setSavedWorld(nextWorld);
    saveBiomeWorldToStorage(nextWorld);
    const newSeed = nextWorld.decorations.find((d) => d.type === 'seed' && d.gridX === spawn.gridX);
    if (newSeed) {
      gardenAdventure.linkSeed(newSeed.id, nextWorld.biome);
    }
    sound.playPlaceTile();
  };

  // The world drawing only needs to redraw when the world changes, not on every animation frame.
  // Its handlers are passed as stable functions that call the latest version, so its memo holds.
  const worldActions = useRef({ handlePaintStroke, handleStrokeStart, handleStrokeEnd, handlePlaceDecoration, handleRemoveDecoration, handleMoveDecoration, handleMoveTile });
  worldActions.current = { handlePaintStroke, handleStrokeStart, handleStrokeEnd, handlePlaceDecoration, handleRemoveDecoration, handleMoveDecoration, handleMoveTile };
  const stableWorldActions = useMemo(
    () => ({
      onPaintStroke: (gridX: number, gridY: number) => worldActions.current.handlePaintStroke(gridX, gridY),
      onStrokeStart: () => worldActions.current.handleStrokeStart(),
      onStrokeEnd: () => worldActions.current.handleStrokeEnd(),
      onPlaceDecoration: (decorType: DecorationType, gridX: number, gridY: number, customItemId?: string) =>
        worldActions.current.handlePlaceDecoration(decorType, gridX, gridY, customItemId),
      onRemoveDecoration: (decorId: string) => worldActions.current.handleRemoveDecoration(decorId),
      onMoveDecoration: (decorId: string, gridX: number, gridY: number) => worldActions.current.handleMoveDecoration(decorId, gridX, gridY),
      onMoveTile: (fromX: number, fromY: number, toX: number | null, toY: number | null) => worldActions.current.handleMoveTile(fromX, fromY, toX, toY)
    }),
    []
  );

  // Creatures near each other sometimes talk: friends or rivals by material, lines written by Muse Spark on Fireworks
  const banterView = useRef({ sim: simStates, residents: residentCreatures, chatting: chatOpen });
  banterView.current = { sim: simStates, residents: residentCreatures, chatting: chatOpen || questOpen };
  const banterUpdate = useRef(onUpdateCreature);
  banterUpdate.current = onUpdateCreature;
  useEffect(() => {
    const BANTER_GAP_MS = 75_000; // at most one exchange this often
    const PAIR_GAP_MS = 10 * 60_000; // the same two creatures wait this long before talking again
    const NEAR_PCT = 16;
    const LINE_MS = 3600;
    const lastPair: Record<string, number> = {};
    let lastAt = Date.now() - BANTER_GAP_MS + 20_000; // first exchange about 20 seconds in
    let busy = false;
    let talked = false; // the first exchange, and any after a long quiet spell, does not need the pair to be close
    let alive = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const say = (id: string, text: string) =>
      setSimStates((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], ...createSpeech(text) } } : prev));
    const tick = async () => {
      const now = Date.now();
      const { sim, residents, chatting } = banterView.current;
      if (busy || chatting || document.hidden || now - lastAt < BANTER_GAP_MS || residents.length < 2) return;
      const anyDistance = !talked || now - lastAt > BANTER_GAP_MS * 2;
      let pair: [CreatureDNA, CreatureDNA] | null = null;
      for (let i = 0; i < residents.length && !pair; i++) {
        for (let j = i + 1; j < residents.length && !pair; j++) {
          const a = residents[i], b = residents[j];
          const sa = sim[a.id], sb = sim[b.id];
          const key = [a.id, b.id].sort().join('|');
          if (!sa || !sb || sa.isInteracting || sb.isInteracting) continue;
          if ((!anyDistance && Math.abs(sa.xPct - sb.xPct) > NEAR_PCT) || now - (lastPair[key] || 0) < PAIR_GAP_MS) continue;
          pair = Math.random() < 0.5 ? [a, b] : [b, a];
          lastPair[key] = now;
        }
      }
      if (!pair) return;
      busy = true;
      talked = true;
      lastAt = now;
      const [a, b] = pair;
      const who = (c: CreatureDNA) => ({ name: c.name, objectName: c.sourceObject?.name, element: c.primaryElement, temperament: c.temperament });
      try {
        const start = await fetch('/api/fireworks/banter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            a: who(a),
            b: who(b),
            weather: weatherBus.get().state,
            phase: phaseFromClock(Date.now(), loadWorldEpoch(), WORLD_DAY_MS)
          })
        }).then((r) => r.json()).catch(() => null);
        if (!start?.jobId) return;
        let job: any = null;
        for (let k = 0; k < 40 && alive; k++) {
          await new Promise((r) => setTimeout(r, 2500));
          job = await fetch('/api/fireworks/banter/' + start.jobId).then((r) => r.json()).catch(() => null);
          if (job?.status !== 'pending') break;
        }
        const lines: Array<{ speaker: 'a' | 'b'; text: string }> = job?.status === 'done' ? job.result?.lines || [] : [];
        if (!alive || !lines.length) return;
        const rel: string = job.result.relationship;
        const badge = rel === 'friends' ? '💚 ' : rel === 'rivals' ? '⚡ ' : '';
        lines.forEach((line, i) => {
          timers.push(setTimeout(() => say(line.speaker === 'a' ? a.id : b.id, (i === 0 ? badge : '') + line.text), i * LINE_MS));
        });
        const label = rel === 'friends' ? 'my friend' : rel === 'rivals' ? 'my rival' : 'a new neighbor';
        // Use the latest copy of each creature, since care actions may have changed it while the lines were written
        const remember = (c: CreatureDNA, other: CreatureDNA) => {
          const latest = banterView.current.residents.find((x) => x.id === c.id) || c;
          banterUpdate.current({
            ...latest,
            memories: [{ timestamp: Date.now(), text: 'Had a chat with ' + other.name + ', ' + label + '.', type: 'play' as const }, ...latest.memories.slice(0, 15)]
          });
        };
        remember(a, b);
        remember(b, a);
      } finally {
        busy = false;
      }
    };
    const interval = setInterval(tick, 5000);
    return () => {
      alive = false;
      clearInterval(interval);
      timers.forEach(clearTimeout);
    };
  }, []);

  return (
    <div className="habitat-layout relative w-full h-full flex flex-col justify-between overflow-hidden select-none">
      {/* Biome Switcher & Editor Toolbar Header */}
      <BiomeEditorToolbar
        isEditMode={isEditMode}
        onToggleEditMode={() => {
          if (isEditMode) {
            if (isDirty) {
              setIsPendingExitEditMode(true);
            } else {
              setIsEditMode(false);
            }
          } else {
            setActiveTool({ type: 'grab' }); // build mode opens with GRAB on; players pick a brush or item from there
            setIsEditMode(true);
          }
        }}
        // While Drag to explore is on in build mode, no build tool shows as picked; picking one turns exploring off
        activeTool={buildExplore ? ({ type: 'explore' } as unknown as EditorTool) : activeTool}
        onSelectTool={(tool) => { setBuildExplore(false); setActiveTool(tool); }}
        brushSize={brushSize}
        onSetBrushSize={setBrushSize}
        canUndo={historyRef.current.canUndo()}
        canRedo={historyRef.current.canRedo()}
        onUndo={handleUndo}
        onRedo={handleRedo}
        isDirty={isDirty}
        onSave={handleSaveWorld}
        onCancel={handleCancelEdits}
        onResetBiome={handleResetBiome}
        onApplyTemplate={handleApplyTemplate}
        activeHabitatTheme={activeHabitatTheme}
        onChangeTheme={(theme) => {
          if (theme === activeHabitatTheme) return;
          if (isDirty) {
            setPendingExitTheme(theme);
          } else {
            onChangeTheme(theme);
          }
        }}
        customBiomes={customBiomes}
        onOpenCreateBiome={() => setIsCreateBiomeOpen(true)}
        onOpenManageBiome={(b) => setManageBiomeTarget(b)}
      />

      {travelError && <p role="alert" className="px-4 py-2 text-xs bg-rose-950 text-rose-200">{travelError}</p>}
      <WorldViewport overlay={!isEditMode && (activeHabitatTheme !== "greenhouse" || worldRegion === 0) && (
          <div data-follow-view data-garden-open={gardenMenu} className="absolute top-3 right-3 z-30 flex flex-col items-end gap-2 pointer-events-auto">
            <button className="phone-control" aria-expanded={gardenMenu} onClick={() => setGardenMenu(!gardenMenu)}>🌱 Garden · {Number(!!gardenTasks.plantedSeed)+Number(!!gardenTasks.grownFlower)+Number(!!gardenTasks.oddlingEnjoyedPond)}/3</button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                sound.playClick();
                setIsAdventureModalOpen(true);
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono font-bold transition-all shadow-xl backdrop-blur-md cursor-pointer active:scale-95 hover:scale-105 ${
                advState.step === 'bloomed' && !advState.rewardClaimed
                  ? 'bg-amber-500 text-slate-950 border-amber-300 animate-pulse shadow-[0_0_15px_rgba(245,158,11,0.5)]'
                  : advState.step === 'completed'
                  ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/60'
                  : advState.step === 'not_started'
                  ? 'bg-purple-950/90 text-purple-200 border-purple-500/60'
                  : 'bg-slate-950/90 text-amber-300 border-amber-600/70'
              }`}
              title="Open First Garden Adventure"
            >
              <span>{advState.step === 'bloomed' ? '🌸' : advState.step === 'completed' ? '🌟' : '🌱'}</span>
              <span>
                {advState.step === 'not_started'
                  ? 'Garden Adventure'
                  : advState.step === 'accepted'
                  ? 'Adv: Plant Seed'
                  : advState.step === 'seed_planted'
                  ? 'Adv: Water Seed'
                  : advState.step === 'watered'
                  ? 'Adv: Encourage'
                  : advState.step === 'bloomed'
                  ? 'Claim Reward! 🎉'
                  : 'Adventure Done 🌟'}
              </span>
            </button>

            {/* Greenhouse Garden Tasks Widget */}
            {activeHabitatTheme === 'greenhouse' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsTasksPanelOpen((prev) => !prev);
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono font-semibold transition-all shadow-lg backdrop-blur-md ${
                  ((gardenTasks.plantedSeed ? 1 : 0) + (gardenTasks.grownFlower ? 1 : 0) + (gardenTasks.oddlingEnjoyedPond ? 1 : 0) === 3) && !gardenTasks.rewardClaimed
                    ? 'bg-amber-500/25 text-amber-200 border-amber-400/80 animate-pulse shadow-amber-500/20'
                    : 'bg-emerald-950/85 text-emerald-200 border-emerald-600/60 hover:bg-emerald-900/90'
                }`}
                title="View Garden Tasks"
              >
                <span>🌱</span>
                <span>
                  Garden Tasks ({(gardenTasks.plantedSeed ? 1 : 0) + (gardenTasks.grownFlower ? 1 : 0) + (gardenTasks.oddlingEnjoyedPond ? 1 : 0)}/3)
                </span>
                <span className="text-[10px] text-emerald-400">{isTasksPanelOpen ? '▲' : '▼'}</span>
              </button>
            )}

            {isTasksPanelOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="mt-2 w-72 rounded-xl bg-slate-950/95 border border-emerald-500/40 p-3.5 shadow-2xl backdrop-blur-md text-left z-40 animate-in fade-in zoom-in-95 duration-150"
              >
                <div className="flex items-center justify-between pb-2 border-b border-emerald-900/50 mb-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold font-mono text-emerald-300">
                    <span>🌿</span>
                    <span>GREENHOUSE GOALS</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-600/50 text-emerald-300">
                    {(gardenTasks.plantedSeed ? 1 : 0) + (gardenTasks.grownFlower ? 1 : 0) + (gardenTasks.oddlingEnjoyedPond ? 1 : 0)}/3 Done
                  </span>
                </div>

                <ul className="space-y-2 text-[11px] font-mono">
                  <li className={`flex items-start gap-2 ${gardenTasks.plantedSeed ? 'text-emerald-300 line-through opacity-85' : 'text-slate-300'}`}>
                    <span className={`mt-0.5 w-3.5 h-3.5 rounded flex items-center justify-center text-[9px] border ${
                      gardenTasks.plantedSeed ? 'bg-emerald-600 text-white border-emerald-500' : 'border-slate-600 bg-slate-900'
                    }`}>
                      {gardenTasks.plantedSeed ? '✓' : ''}
                    </span>
                    <div>
                      <div className="font-semibold">Plant a garden seed</div>
                      <div className="text-[10px] text-slate-400">Use the seed tool in Edit mode on solid soil.</div>
                    </div>
                  </li>

                  <li className={`flex items-start gap-2 ${gardenTasks.grownFlower ? 'text-emerald-300 line-through opacity-85' : 'text-slate-300'}`}>
                    <span className={`mt-0.5 w-3.5 h-3.5 rounded flex items-center justify-center text-[9px] border ${
                      gardenTasks.grownFlower ? 'bg-emerald-600 text-white border-emerald-500' : 'border-slate-600 bg-slate-900'
                    }`}>
                      {gardenTasks.grownFlower ? '✓' : ''}
                    </span>
                    <div>
                      <div className="font-semibold">Grow a blooming flower</div>
                      <div className="text-[10px] text-slate-400">Takes 60s (faster near pond!).</div>
                    </div>
                  </li>

                  <li className={`flex items-start gap-2 ${gardenTasks.oddlingEnjoyedPond ? 'text-emerald-300 line-through opacity-85' : 'text-slate-300'}`}>
                    <span className={`mt-0.5 w-3.5 h-3.5 rounded flex items-center justify-center text-[9px] border ${
                      gardenTasks.oddlingEnjoyedPond ? 'bg-emerald-600 text-white border-emerald-500' : 'border-slate-600 bg-slate-900'
                    }`}>
                      {gardenTasks.oddlingEnjoyedPond ? '✓' : ''}
                    </span>
                    <div>
                      <div className="font-semibold">Watch Oddling enjoy pond</div>
                      <div className="text-[10px] text-slate-400">Oddlings take sips or splash in shallow pond.</div>
                    </div>
                  </li>
                </ul>

                {/* Reward Section */}
                <div className="mt-3 pt-2.5 border-t border-emerald-900/50">
                  {gardenTasks.rewardClaimed ? (
                    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-700/50 text-[10px] font-mono text-emerald-300">
                      <span>✨</span>
                      <span>Gardener's Starbloom unlocked for all future planting!</span>
                    </div>
                  ) : (
                    <button
                      disabled={(gardenTasks.plantedSeed ? 1 : 0) + (gardenTasks.grownFlower ? 1 : 0) + (gardenTasks.oddlingEnjoyedPond ? 1 : 0) < 3}
                      onClick={() => {
                        if ((gardenTasks.plantedSeed ? 1 : 0) + (gardenTasks.grownFlower ? 1 : 0) + (gardenTasks.oddlingEnjoyedPond ? 1 : 0) < 3) return;
                        sound.playPlaceTile();
                        setClaimedRewardSparkle(true);
                        setTimeout(() => setClaimedRewardSparkle(false), 4000);
                        setGardenTasks((prev) => {
                          const next = { ...prev, rewardClaimed: true };
                          saveGardenTasksToStorage(next);
                          return next;
                        });
                      }}
                      className={`w-full py-1.5 px-3 rounded-lg text-[11px] font-mono font-bold transition-all flex items-center justify-center gap-1.5 ${
                        (gardenTasks.plantedSeed ? 1 : 0) + (gardenTasks.grownFlower ? 1 : 0) + (gardenTasks.oddlingEnjoyedPond ? 1 : 0) === 3
                          ? 'bg-gradient-to-r from-amber-500 to-emerald-500 text-slate-950 shadow-md hover:brightness-110 active:scale-95 cursor-pointer font-extrabold'
                          : 'bg-slate-800 text-slate-500 border border-slate-700/60 cursor-not-allowed'
                      }`}
                    >
                      <span>✨</span>
                      <span>
                        {(gardenTasks.plantedSeed ? 1 : 0) + (gardenTasks.grownFlower ? 1 : 0) + (gardenTasks.oddlingEnjoyedPond ? 1 : 0) === 3
                          ? "Claim Gardener's Starbloom!"
                          : 'Complete all 3 tasks to unlock'}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Sparkle banner toast when reward claimed */}
            {claimedRewardSparkle && (
              <div className="mt-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-400 via-pink-400 to-cyan-300 text-slate-950 text-xs font-mono font-black shadow-xl animate-bounce">
                🌟 Starbloom Variety Unlocked! 🌸
              </div>
            )}
          </div>
        )} editMode={isEditMode} enabled={activeHabitatTheme === 'greenhouse'} region={worldRegion} neighbors={neighbors} world={world} onTravel={handleTravel} buildExplore={buildExplore} onBuildExplore={setBuildExplore}>
      {/* Main Living Habitat Playfield Canvas */}
      <div
        ref={containerRef}
        onClick={handleDropTreatOnTerrain}
        className="relative h-full w-full overflow-hidden"
      >
        {/* Procedural 16-Bit Biome World (Grid Tiles, Water, Decorations, Parallax Backdrop) */}
        <BiomeWorldRenderer
          region={worldRegion}
          world={world}
          grassActors={simRef}
          grassResidents={residentGrassIds}
          heldCreatureId={heldCreature?.id}
          sharedSky={activeHabitatTheme === 'greenhouse'}
          theme={activeHabitatTheme}
          isEditMode={isEditMode}
          activeTool={activeTool}
          brushSize={brushSize}
          onPaintStroke={stableWorldActions.onPaintStroke}
          onStrokeStart={stableWorldActions.onStrokeStart}
          onStrokeEnd={stableWorldActions.onStrokeEnd}
          onPlaceDecoration={stableWorldActions.onPlaceDecoration}
          onRemoveDecoration={stableWorldActions.onRemoveDecoration}
          onMoveDecoration={stableWorldActions.onMoveDecoration}
          onMoveTile={stableWorldActions.onMoveTile}
        />

        {/* Dropped Food Treats on Playfield */}
        {!isEditMode &&
          activeTreats.map((t) => (
            <div
              key={t.id}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-all duration-300 animate-bounce z-[30]"
              style={{ left: `${t.xPct}%`, top: `${t.yPct}%` }}
            >
              <div className="flex flex-col items-center">
                <span className="text-2xl drop-shadow-md select-none">{t.treat.icon}</span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-950/80 text-amber-300 border border-amber-500/40 mt-0.5 whitespace-nowrap">
                  {t.treat.name}
                </span>
              </div>
            </div>
          ))}

        {/* Bouncing Toy Ball */}
        {!isEditMode && activeToy && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              handleFlingToy();
            }}
            className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-transform duration-75 hover:scale-125 z-[30] will-change-transform"
            style={{ left: `${activeToy.xPct}%`, top: `${activeToy.yPct}%` }}
            title="Click to fling toy!"
          >
            {/* 8x8 pixel-art ball: drawn in pixels so the pixel UI's square corners cannot turn it into a box */}
            <svg viewBox="0 0 8 8" className="w-7 h-7" style={{ imageRendering: 'pixelated', shapeRendering: 'crispEdges' }} aria-hidden>
              {TOY_BALL_PIXELS.map((row, y) =>
                row.split('').map((p, x) =>
                  p === '.' ? null : <rect key={x + '-' + y} x={x} y={y} width={1} height={1} fill={TOY_BALL_COLORS[p]} />
                )
              )}
            </svg>
          </div>
        )}

        {/* Ability and bloom effects */}
        {worldFx.map((f) => (
          <div
            key={f.id}
            aria-hidden
            className="absolute z-30 pointer-events-none"
            style={{ left: f.xPct + '%', top: f.yPct + '%', width: 0, height: 0 }}
          >
            {f.kind === 'water' &&
              [-14, -7, 0, 7, 14, -3, 10].map((dx, i) => (
                <span key={i} className="fx-drop" style={{ left: dx, animationDelay: i * 0.09 + 's' }} />
              ))}
            {f.kind === 'glow' && <span className="fx-glow" />}
            {f.kind === 'bloom' &&
              Array.from({ length: 12 }, (_, i) => {
                const a = (i / 12) * Math.PI * 2;
                return (
                  <span
                    key={i}
                    className="fx-spark"
                    style={{ '--dx': Math.round(Math.cos(a) * 46) + 'px', '--dy': Math.round(Math.sin(a) * 46 - 20) + 'px', animationDelay: (i % 3) * 0.08 + 's' } as React.CSSProperties}
                  />
                );
              })}
          </div>
        ))}

        {/* Living Oddling Sprites Roaming on Edited Terrain */}
        {residentCreatures.map((creature) => {
          const sim = simStates[creature.id];
          if (!sim) return null;
          const isSelected = selectedCreatureId === creature.id;
          // Exact top surface row percentage of solid block at sim.gridY
          const surfaceRowPct = (sim.gridY / GRID_HEIGHT) * 100;
          // Shallow wading offset if in water (0.35 tiles down)
          const waterWadePct = sim.isInWater ? (0.35 / GRID_HEIGHT) * 100 : 0;
          const groundYPct = surfaceRowPct + waterWadePct;
          const held = heldCreature?.id === creature.id ? heldCreature : null;

          return (
            <div
              key={creature.id}
              ref={(el) => {
                creatureEls.current[creature.id] = el;
              }}
              data-held={held ? '1' : undefined}
              onPointerDown={(e) => {
                e.stopPropagation(); // keep the world from panning while holding a creature
                dragRef.current = { id: creature.id, x: e.clientX, y: e.clientY, moved: false };
                e.currentTarget.setPointerCapture?.(e.pointerId);
              }}
              onPointerMove={(e) => {
                const d = dragRef.current;
                if (!d || d.id !== creature.id) return;
                if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6) return;
                d.moved = true;
                const p = pointerToWorld(e.clientX, e.clientY);
                if (p) setHeldCreature({ id: creature.id, ...p });
              }}
              onPointerUp={(e) => {
                const d = dragRef.current;
                dragRef.current = null;
                if (!d || d.id !== creature.id || !d.moved) return;
                justDraggedRef.current = true; // the click that follows a drag is not a pet
                const p = pointerToWorld(e.clientX, e.clientY);
                setHeldCreature(null);
                if (p) dropCreature(creature.id, p.xPct, p.yPct);
                sound.playBounce();
              }}
              onPointerCancel={() => {
                dragRef.current = null;
                setHeldCreature(null);
              }}
              onClick={(e) => {
                if (justDraggedRef.current) {
                  justDraggedRef.current = false;
                  e.stopPropagation();
                  return;
                }
                if (isEditMode) return; // Do not pet during edit mode
                e.stopPropagation();
                setSelectedCreatureId(creature.id);
                setNameTag({ id: creature.id, at: Date.now() });
                handlePet(creature.id);
              }}
              className={`absolute select-none touch-none will-change-transform ${held ? 'z-40 cursor-grabbing' : 'z-20'} ${
                isEditMode ? 'opacity-85 cursor-grab' : 'cursor-pointer hover:scale-105'
              }`}
              title={isEditMode ? 'Drag to move ' + creature.name + ' out of the way' : undefined}
              style={{
                left: `${held ? held.xPct : simRef.current[creature.id]?.xPct ?? sim.xPct}%`,
                top: `${held ? held.yPct : groundYPct}%`
              }}
            >
              {/* 16-Bit Pixel Art Oddling Avatar - Anchored at visible feet baseline (62px from top) */}
              <div
                className="transition-transform duration-100 flex items-center justify-center relative"
                style={{
                  // Held creatures dangle from the pointer; others stand with their feet on the ground
                  transform: held
                    ? `translate(-50%, -30%) rotate(${sim.direction * 8}deg) scaleX(${sim.direction})`
                    : `translate(-50%, -${Math.round((creaturePx * 62) / 72)}px) scaleX(${sim.direction})`,
                  width: creaturePx,
                  height: creaturePx
                }}
              >
                <OddlingAvatar
                  creature={creature}
                  size={creaturePx}
                  mood={held ? 'excited' : sim.mood}
                  isInteracting={sim.isInteracting || !!held}
                />
              </div>
            </div>
          );
        })}

        {/* Speech bubbles and name tags: above the front grass and the rain, anchored at each creature's feet.
            They wrap into a narrow bubble that grows upward instead of one long line. */}
        {residentCreatures.map((creature) => {
          const sim = simStates[creature.id];
          if (!sim) return null;
          const talking = speechIsVisible(sim);
          const tagged = nameTag?.id === creature.id;
          if (!talking && !tagged) return null;
          const held = heldCreature?.id === creature.id ? heldCreature : null;
          const feetYPct = ((sim.gridY + (sim.isInWater ? 0.35 : 0)) / GRID_HEIGHT) * 100;
          const headPx = Math.round(creaturePx * 0.75) + 4;
          return (
            <div
              key={creature.id}
              ref={(el) => {
                labelEls.current[creature.id] = el;
              }}
              aria-hidden={!talking}
              className="absolute pointer-events-none z-[35]"
              style={{
                left: `${held ? held.xPct : simRef.current[creature.id]?.xPct ?? sim.xPct}%`,
                top: `${held ? held.yPct : feetYPct}%`,
                width: 0,
                height: 0
              }}
            >
              {talking && (
                <div
                  style={{ bottom: headPx + (tagged ? 20 : 0), left: "var(--speech-offset, 0px)", width: 170 }}
                  onClick={() => setSimStates(prev => ({ ...prev, [creature.id]: { ...prev[creature.id], bubbleText: undefined } }))} className="speech-balloon pointer-events-auto absolute left-0 -translate-x-1/2 w-max max-w-[170px] whitespace-normal text-center leading-snug bg-slate-950/95 text-slate-100 text-[11px] font-mono font-bold px-2.5 py-1 rounded-md border border-pink-400 shadow-xl animate-bounce"
                >
                  {sim.bubbleText}
                  <span aria-hidden className="absolute left-1/2 -bottom-[5px] -translate-x-1/2 w-2 h-2 rotate-45 bg-slate-950 border-r border-b border-pink-400" />
                </div>
              )}
              {tagged && (
                <div style={{ bottom: headPx }} className="absolute left-0 -translate-x-1/2 whitespace-nowrap">
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-slate-950/90 text-slate-200 border border-slate-700/80 shadow-sm">
                    {creature.name}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      </WorldViewport>

      {/* Bottom Care & Interaction Dock (Active in Play Mode) */}
      {!isEditMode ? (
        <div data-tray={tray} className="pixel-dock relative z-30 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          {adventureHint && (
            <div role="status" className="pixel-note w-full">
              🌱 Garden Adventure: {adventureHint}
            </div>
          )}
          <button className="phone-control" aria-expanded={tray} onClick={() => setTray(!tray)}>{tray ? "Close treats" : "🍬 Treats"}</button>
          {selectedCreature && <strong className="phone-resident"><OddlingAvatar creature={selectedCreature} size={28} mood="happy" showAura={false} faceCrop />{selectedCreature.name}</strong>}
          <div className="food-picker flex items-center gap-2">
            <span className="pixel-label">
              🍬 TREATS
            </span>
            <div className="flex items-center gap-2 overflow-x-auto px-1.5 pt-1.5 pb-2.5">
              {FOOD_TREATS.map((treat) => (
                <button
                  key={treat.id}
                  onClick={() => {
                    sound.playClick();
                    setSelectedTreat(treat);
                  }}
                  aria-pressed={selectedTreat.id === treat.id}
                  className={'pixel-btn pixel-treat ' + (selectedTreat.id === treat.id ? 'pb-gold is-picked' : 'pb-cream')}
                  aria-label={treat.name}
                  title={treat.description}
                >
                  <span>{treat.icon}</span>
                  <span className="hidden sm:inline">{treat.name}</span>
                  <span className="pixel-taste" title="Taste: give this treat to find out">
                    {TASTE_ICON[tasteBook.known(selectedCreatureId)[treat.id]] || '?'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <details className="treat-description pixel-hint"><summary>{selectedTreat.name} · details</summary>{selectedTreat.description}</details>
          {/* Action Verbs */}
          {selectedCreature && selectedEffect && <div className="flex flex-col gap-1 max-w-xs">
            <button onClick={handleAbility} disabled={abilityWait > 0 || isEditMode || (selectedCreature.biomeId || 'greenhouse') !== activeHabitatTheme}
              title={selectedEffect.description}
              className="pixel-btn pb-sky w-full justify-center">
              {selectedCreature.specialAbility.icon} {selectedCreature.specialAbility.name} {abilityWait > 0 ? `(${abilityWait}s)` : '— USE ABILITY'}
            </button>
            <span className="desktop-ability pixel-hint">Game effect: {selectedEffect.description}</span><details className="ability-description pixel-hint"><summary>Ability details</summary>{selectedEffect.description}</details>
            <span role="status" aria-live="polite" className="pixel-hint text-[#9be37c]">{abilityMessage}</span>
          </div>}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => selectedCreature && setChatOpen(true)}
              disabled={!selectedCreature}
              className="pixel-btn pb-mint"
            >
              <span>💬</span>
              <span>TALK</span>
            </button>
            <button
              onClick={() => selectedCreature && setQuestOpen(true)}
              disabled={!selectedCreature}
              className="pixel-btn pb-gold"
            >
              <span>📸</span>
              <span className="original-quest">QUEST</span><span className="habitat-phone-only">Photo quest</span>
            </button>
            {questOpen && selectedCreature && (
              <PhotoQuest
                creature={selectedCreature}
                onClose={() => setQuestOpen(false)}
                onUpdateCreature={onUpdateCreature}
                onReply={(reply) =>
                  setSimStates((prev) => ({
                    ...prev,
                    [selectedCreature.id]: { ...prev[selectedCreature.id], ...createSpeech(reply) }
                  }))
                }
              />
            )}
            {chatOpen && selectedCreature && (
              <CreatureChat
                creature={selectedCreature}
                mood={simStates[selectedCreature.id]?.mood}
                onClose={() => setChatOpen(false)}
                onReply={(reply) =>
                  setSimStates((prev) => ({
                    ...prev,
                    [selectedCreature.id]: { ...prev[selectedCreature.id], ...createSpeech(reply) }
                  }))
                }
              />
            )}

            <button
              onClick={() => handlePet(selectedCreatureId)}
              className="pixel-btn pb-pink"
            >
              <span>❤️</span>
              <span>PET</span>
            </button>

            <button
              onClick={handleFlingToy}
              className="pixel-btn pb-lilac"
            >
              <span>🎾</span>
              <span>TOY</span>
            </button>

            <button
              onClick={() => {
                if (selectedCreature) {
                  sound.playPurr();
                  onPlayerCareAction?.();
                  walletBook.rewardCare(); // care earns Sparkle Coins, up to a daily limit
                  const res = calculateInteractionResult(selectedCreature, 'rest');
                  const updated: CreatureDNA = {
                    ...selectedCreature,
                    stats: {
                      ...selectedCreature.stats,
                      energy: Math.min(100, selectedCreature.stats.energy + res.energyDelta)
                    },
                    memories: [
                      { timestamp: Date.now(), text: res.memoryText, type: 'nap' },
                      ...selectedCreature.memories.slice(0, 15)
                    ]
                  };
                  onUpdateCreature(updated);
                  setSimStates((prev) => ({
                    ...prev,
                    [selectedCreature.id]: {
                      ...prev[selectedCreature.id],
                      mood: 'sleepy',
                      ...createSpeech(voiceLine(selectedCreature.id, 'sleep', 'Zzz... 💤'))
                    }
                  }));
                }
              }}
              className="pixel-btn pb-sky"
            >
              <span>🛌</span>
              <span>REST</span>
            </button>

            {/* Resident Sanctuary Selector & Move Action */}
            {selectedCreature && (
              <div className="pixel-home flex items-center gap-2 pl-3">
                <span className="pixel-label">
                  🏡 HOME
                </span>
                <select
                  value={selectedCreature.biomeId || 'greenhouse'}
                  onChange={(e) => {
                    const targetTheme = e.target.value;
                    sound.playClick();
                    const updated = {
                      ...selectedCreature,
                      biomeId: targetTheme,
                      worldRegion: targetTheme === 'greenhouse' ? worldRegion : 0,
                      memories: [
                        {
                          timestamp: Date.now(),
                          text: `Relocated to ${
                            targetTheme === 'greenhouse'
                              ? 'World'
                              : targetTheme === 'desk'
                              ? 'Desk'
                              : targetTheme === 'lab'
                              ? 'Lab'
                              : customBiomes.find((b) => b.id === targetTheme)?.name || 'Custom Biome'
                          }.`,
                          type: 'nap' as const
                        },
                        ...selectedCreature.memories
                      ].slice(0, 20)
                    };
                    onUpdateCreature(updated);
                  }}
                  className="pixel-select"
                >
                  <option value="greenhouse">🌍 World</option>
                  {customBiomes.map((cb) => (
                    <option key={cb.id} value={cb.id}>
                      📷 {cb.name}
                    </option>
                  ))}
                </select>

                {/* Quick button to move selected creature into the currently active biome */}
                {/* Moving is only between biomes; inside the World creatures already follow you */}
              {normalizeHome(selectedCreature.biomeId || 'greenhouse') !== normalizeHome(activeHabitatTheme) && (
                  <button
                    onClick={() => {
                      sound.playPlaceTile();
                      const updated = {
                        ...selectedCreature,
                        biomeId: activeHabitatTheme,
                        worldRegion: activeHabitatTheme === 'greenhouse' ? worldRegion : 0,
                        memories: [
                          {
                            timestamp: Date.now(),
                            text: `Relocated to current sanctuary.`,
                            type: 'nap' as const
                          },
                          ...selectedCreature.memories
                        ].slice(0, 20)
                      };
                      onUpdateCreature(updated);
                    }}
                    className="pixel-btn pb-mint"
                    title="Relocate this Oddling to the active biome"
                  >
                    Move Here
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="relative z-30 px-4 py-1.5 bg-slate-950/90 border-t border-amber-500/30 flex items-center justify-between text-[11px] font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-amber-300 font-bold">2D SANDBOX EDIT MODE:</span>
            <span>Painting on {activeHabitatTheme === 'greenhouse' ? 'World' : world.name || 'your biome'}</span>
          </div>
          <span className="text-slate-400">
            Click 'DONE' above when finished to resume creature simulation
          </span>
        </div>
      )}

      {/* Unsaved Changes Confirmation Modal */}
      {(isPendingExitEditMode || pendingExitTheme) && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/50 rounded-2xl p-6 max-w-sm text-center shadow-2xl space-y-4">
            <span className="text-3xl">💾</span>
            <h4 className="text-base font-bold text-slate-100 font-['Space_Grotesk']">
              Unsaved Biome Changes
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              You have unsaved edits on the {activeHabitatTheme.toUpperCase()} biome. Would you like to save them before {pendingExitTheme ? `switching to ${pendingExitTheme.toUpperCase()}` : 'returning to play mode'}?
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
              <button
                onClick={() => {
                  sound.playFanfare();
                  if (!handleSaveWorld()) return;
                  if (pendingExitTheme) {
                    onChangeTheme(pendingExitTheme);
                    setPendingExitTheme(null);
                  }
                  setIsPendingExitEditMode(false);
                }}
                className="w-full sm:w-auto px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs font-mono shadow-md cursor-pointer"
              >
                Save & Proceed
              </button>
              <button
                onClick={() => {
                  sound.playClick();
                  handleCancelEdits();
                  if (pendingExitTheme) {
                    onChangeTheme(pendingExitTheme);
                    setPendingExitTheme(null);
                  }
                  setIsPendingExitEditMode(false);
                }}
                className="w-full sm:w-auto px-3 py-2 rounded-lg bg-rose-900/60 hover:bg-rose-900 text-rose-200 border border-rose-700/60 text-xs font-mono cursor-pointer"
              >
                Discard Edits
              </button>
              <button
                onClick={() => {
                  setIsPendingExitEditMode(false);
                  setPendingExitTheme(null);
                }}
                className="w-full sm:w-auto px-3 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-mono hover:bg-slate-700 cursor-pointer"
              >
                Stay Here
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Custom Biome Modal */}
      {isCreateBiomeOpen && (
        <CreateBiomeModal
          onClose={() => setIsCreateBiomeOpen(false)}
          onBiomeCreated={(newBiomeId, newWorld) => {
            setCustomBiomes(getCustomBiomesList());
            onChangeTheme(newBiomeId);
            setWorld(newWorld);
            setSavedWorld(newWorld);
            setIsCreateBiomeOpen(false);
          }}
        />
      )}

      {/* Manage Custom Biome (Rename / Safe Removal) Modal */}
      {manageBiomeTarget && (
        <ManageBiomeModal
          biome={manageBiomeTarget}
          residentCount={creatures.filter((c) => (c.biomeId || 'greenhouse') === manageBiomeTarget.id).length}
          creatures={creatures}
          onUpdateCreatures={(updated) => {
            updated.forEach(onUpdateCreature);
          }}
          onBiomeRenamed={(biomeId, newName) => {
            setCustomBiomes(getCustomBiomesList());
            if (activeHabitatTheme === biomeId) {
              setWorld((prev) => ({ ...prev, name: newName }));
              setSavedWorld((prev) => ({ ...prev, name: newName }));
            }
          }}
          onBiomeDeleted={(deletedId) => {
            setCustomBiomes(getCustomBiomesList());
            if (activeHabitatTheme === deletedId) {
              onChangeTheme('greenhouse');
            }
            setManageBiomeTarget(null);
          }}
          onClose={() => setManageBiomeTarget(null)}
        />
      )}

      {/* First Garden Adventure Modal */}
      {isAdventureModalOpen && (
        <GardenAdventureModal
          creatures={creatures}
          world={world}
          onClose={() => setIsAdventureModalOpen(false)}
          onUpdateCreatures={(updated) => {
            updated.forEach(onUpdateCreature);
          }}
          onPlantSeedDirectly={handlePlantStarterSeed}
          onWaterWithPhoto={() => {
            setIsAdventureModalOpen(false);
            setAdventurePhotoOpen(true);
          }}
          onOpenDiary={(c) => {
            setIsAdventureModalOpen(false);
            setDiaryCreature(c);
          }}
        />
      )}

      {/* Garden Adventure photo step: Muse Spark checks for something that holds water */}
      {adventurePhotoOpen && selectedCreature && (
        <PhotoQuest
          creature={selectedCreature}
          fixedQuest="something that holds water"
          onMatch={handleAdventurePhotoMatch}
          onClose={() => setAdventurePhotoOpen(false)}
          onUpdateCreature={onUpdateCreature}
          onReply={(reply) =>
            setSimStates((prev) => ({
              ...prev,
              [selectedCreature.id]: { ...prev[selectedCreature.id], ...createSpeech(reply) }
            }))
          }
        />
      )}

      {/* Diary Keepsake Modal */}
      {diaryCreature && (
        <DiaryBook
          creature={diaryCreature}
          onClose={() => setDiaryCreature(null)}
        />
      )}
    </div>
  );
};
