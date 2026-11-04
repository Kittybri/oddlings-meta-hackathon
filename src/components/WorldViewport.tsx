import {WindVisuals} from './WindVisuals';
import { getWorldAtmosphere, loadWorldEpoch, WORLD_DAY_MS } from '../game/worldAtmosphere';
import { WorldSky } from './WorldSky';
import { RainLayer } from './RainLayer';
import { groundColumns } from '../game/rain';
import { weatherBus } from '../game/weatherBus';
import { CLEAR_SKY, Weather, WeatherOverride, getWeather, loadOverride, nextOverride, saveOverride, smoothWeather, weatherLabel } from '../game/weather';
import { pickMood } from '../game/moodMusic';
import { moodMusic } from '../game/moodMusicStore';
import React, { useLayoutEffect, useEffect, useMemo, useRef, useState } from 'react';
import { BiomeWorldState } from '../game/biomeWorldTypes';
import { BiomeWorldRenderer } from './BiomeWorldRenderer';

const noop = () => {};
const browserStorage = () => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};
const previewTool = { type: 'brush' as const, material: 'grass' as const };
export function WorldViewport({ enabled, editMode, region, neighbors, world, onTravel, children, buildExplore = false, onBuildExplore }: {
  enabled: boolean; editMode: boolean; region: number; neighbors: [BiomeWorldState, BiomeWorldState]; world?: BiomeWorldState;
  onTravel: (direction: number) => boolean; children: React.ReactNode;
  /** Build mode's Drag to explore switch, owned by the habitat so picking a build tool can turn it off (and the reverse) */
  buildExplore?: boolean; onBuildExplore?: (on: boolean) => void;
}) {
  const [epoch] = useState(() => loadWorldEpoch());
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setClock(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const atmosphere = getWorldAtmosphere(clock - epoch + WORLD_DAY_MS * .18);
  const [weatherOverride, setWeatherOverride] = useState<WeatherOverride>(() => loadOverride(browserStorage()));
  const weatherTarget = enabled ? getWeather(clock, epoch, weatherOverride) : CLEAR_SKY;
  const shownWeather = useRef<Weather | null>(null);
  const shownAt = useRef(clock);
  shownWeather.current = shownWeather.current ? smoothWeather(shownWeather.current, weatherTarget, (clock - shownAt.current) / 1000) : weatherTarget;
  shownAt.current = clock;
  const weather = shownWeather.current;
  const raining = weather.cloud > 0.02 || weather.rain > 0;
  useEffect(() => { weatherBus.set(weather); });
  useEffect(() => () => weatherBus.set(CLEAR_SKY), []);
  const mood = enabled ? pickMood(atmosphere.light, weather) : 'day';
  const cycleWeather = () => {
    const next = nextOverride(weatherOverride, Date.now(), getWeather(Date.now(), epoch, null));
    saveOverride(browserStorage(), next);
    setWeatherOverride(next);
  };
  const cycleRef = useRef(cycleWeather);
  cycleRef.current = cycleWeather;
  useEffect(() => { moodMusic.attach(); }, []);
  useEffect(() => { moodMusic.setMood(mood); }, [mood]);
  useEffect(() => () => moodMusic.setMood('day'), []);
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (e.key === 'w' || e.key === 'W') cycleRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
  const scroller = useRef<HTMLDivElement>(null);
  // Ground height per tile column of each region, so rain lands on the terrain under it
  const grounds = useMemo(
    () => [groundColumns(neighbors[0]?.tiles), groundColumns(world?.tiles), groundColumns(neighbors[1]?.tiles)],
    [neighbors[0], world, neighbors[1]]
  );
  const offset = useRef<number | null>(null);
  const moving = useRef(false);
  const drag = useRef<{ x: number; scroll: number; on: boolean } | null>(null);
  const dragged = useRef(false);
  // Drag to explore is on from the start. In build mode it starts off (dragging builds) and has its own switch,
  // so a builder can scroll to another World area without leaving build mode
  const [panChoice, setPan] = useState(true);
  const editPan = buildExplore;
  const setEditPan = (on: boolean) => onBuildExplore?.(on);
  const pan = editMode ? editPan : panChoice;
  // The explore bar starts folded on phone-width screens, where it would cover the habitat's own buttons
  const roomy = () => typeof window === 'undefined' || window.innerWidth >= 640;
  const [barOpen, setBarOpen] = useState(() => roomy());
  useEffect(() => setBarOpen(roomy()), [editMode]);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollLeft = offset.current ?? el.clientWidth;
    offset.current = null;
    moving.current = false;
    let previousWidth = el.clientWidth;
    const observer = new ResizeObserver(() => { if (el.clientWidth !== previousWidth && !moving.current) { previousWidth = el.clientWidth; el.scrollLeft = el.clientWidth; } });
    observer.observe(el);
    return () => observer.disconnect();
  }, [region, enabled]);
  useLayoutEffect(() => { if (enabled && scroller.current) scroller.current.scrollLeft = scroller.current.clientWidth; }, [editMode]);
  const travelScroll = () => {
    const el = scroller.current;
    if (!el || moving.current || drag.current) return;
    const w = el.clientWidth;
    const direction = el.scrollLeft < w * .5 ? -1 : el.scrollLeft > w * 1.5 ? 1 : 0;
    if (!direction) return;
    moving.current = true;
    el.scrollTo({ left: el.scrollLeft, behavior: 'instant' });
    offset.current = el.scrollLeft - direction * w;
    if (!onTravel(direction)) { offset.current = null; el.scrollLeft = w; moving.current = false; }
  };
  const scroll = (n: number) => scroller.current?.scrollBy({ left: n * scroller.current.clientWidth * .75, behavior: 'instant' });
  if (!enabled) return <div className="relative flex-1 min-h-0 w-full">{children}</div>;
  return <div className="relative flex-1 min-h-0 w-full">
    <WorldSky atmosphere={atmosphere} weather={weather} />
    <WindVisuals strength={weather.wind ?? 0} windy={weather.state === 'windy'} />
    {!barOpen ? (
      <button onClick={() => setBarOpen(true)} title="Show explore and weather controls" aria-label="Show explore and weather controls" className="absolute top-2 left-2 z-40 px-2 py-1 rounded-lg bg-slate-950/80 border border-emerald-500/50 text-xs text-emerald-100 shadow-lg">🧭</button>
    ) : (
    <div className="absolute top-2 left-2 z-40 flex flex-wrap items-center gap-1 rounded-xl bg-slate-950/90 border border-emerald-500/50 p-1 text-xs text-emerald-100 shadow-lg">
      <button aria-label="Explore World left" onClick={() => scroll(-1)} className="px-3 py-2 rounded-lg hover:bg-emerald-900">←</button>
      <button aria-pressed={pan} onClick={() => (editMode ? setEditPan(!editPan) : setPan(!panChoice))} title={editMode ? 'While this is on, dragging scrolls the World instead of building' : undefined} className={'px-2 py-2 rounded-lg hover:bg-emerald-900 ' + (editMode && pan ? 'bg-emerald-800' : '')}>{pan ? '✋ Drag to explore' : '✋ Explore'}</button>
      <button aria-label="Explore World right" onClick={() => scroll(1)} className="px-3 py-2 rounded-lg hover:bg-emerald-900">→</button>
      <button onClick={() => { if (region === 0) scroller.current?.scrollTo({ left: scroller.current.clientWidth }); else { offset.current = null; onTravel(-region); } }} title="Jump back to Home" aria-label="Jump back to Home" className="px-2 py-2 rounded-lg hover:bg-emerald-900">⌂</button>
      <span title="20-minute day, sunset, night and dawn cycle" className="px-2 text-[10px] text-sky-200">{atmosphere.label}</span>
      <button onClick={cycleWeather} title="Cycle weather: storm → wind → clear → automatic (W)" aria-label="Change the weather" className="px-2 py-1 rounded-lg hover:bg-emerald-900 text-[10px] text-sky-200">{weatherLabel(weather) || '☀ Weather'}</button>
      {(editMode || !roomy()) && <button onClick={() => setBarOpen(false)} title="Hide these controls" aria-label="Hide explore and weather controls" className="px-2 py-1 rounded-lg hover:bg-emerald-900">✕</button>}
    </div>
    )}
    <div ref={scroller} tabIndex={0} aria-label="Scrollable World" onScroll={travelScroll}
      onKeyDown={e => { if (e.target === e.currentTarget && ['ArrowLeft', 'ArrowRight'].includes(e.key)) { e.preventDefault(); scroll(e.key === 'ArrowLeft' ? -1 : 1); } }}
      // A press only becomes a drag once it slides a few pixels, so tapping creatures, buttons and items still works;
      // presses on buttons, fields and anything grabbable keep their own drag
      // In build mode with Drag to explore on, the press is taken before it reaches the builder, so it scrolls and never paints
      onPointerDownCapture={e => { if (!editMode || !pan || e.button !== 0) return; const own = (e.target as HTMLElement).closest('button, a, input, select, textarea'); if (own) return; e.stopPropagation(); dragged.current = false; drag.current = { x: e.clientX, scroll: e.currentTarget.scrollLeft, on: false }; }}
      onPointerDown={e => { if (editMode) return; dragged.current = false; if (!pan || e.button !== 0) return; const own = (e.target as HTMLElement).closest('button, a, input, select, textarea, [role="button"], [draggable="true"], .cursor-grab, .cursor-pointer, [data-creature-id]'); if (own && own !== e.currentTarget) return; drag.current = { x: e.clientX, scroll: e.currentTarget.scrollLeft, on: false }; }}
      onPointerMove={e => { const d = drag.current; if (!d) return; if (!d.on) { if (Math.abs(e.clientX - d.x) < 8) return; d.on = true; dragged.current = true; try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* the press may already be over */ } } e.currentTarget.scrollLeft = d.scroll + d.x - e.clientX; }}
      onClickCapture={e => { if (dragged.current) { e.stopPropagation(); e.preventDefault(); dragged.current = false; } }}
      onPointerUp={() => { const was = drag.current?.on; drag.current = null; if (was) travelScroll(); }} onPointerCancel={() => { const was = drag.current?.on; drag.current = null; if (was) travelScroll(); }}
      className={`absolute inset-0 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${pan ? 'cursor-grab' : ''}`} style={{ // Darkness follows the sun's light (0 in full day, 1 at night); the scenery glides between updates
 // Background trees sway harder as the weather's wind picks up (0 calm to 1 storm)
 '--wind': Math.max(0, Math.min(1, weather.wind ?? 0)), '--night-dark': Math.max(0, Math.min(1, (1 - atmosphere.light) / .85)), '--night-glow': Math.max(0, Math.min(1, Math.max((1 - atmosphere.light) / .65, weather.cloud * .9))), touchAction: pan ? 'pan-y' : 'pan-x', filter: `brightness(${(.5 + atmosphere.light * .5) * (1 - weather.cloud * .22)}) saturate(${1 - weather.cloud * .4})`, transition: 'filter 1s linear' } as React.CSSProperties}>
      <div className="flex h-full" style={{ width: '300%', pointerEvents: drag.current?.on ? 'none' : undefined }}>
        {[0, 1, 2].map(i => <div key={i} className="relative h-full shrink-0" style={{ width: '33.333333%' }}>
          {i === 1 ? children : <BiomeWorldRenderer sharedSky region={region + (i === 0 ? -1 : 1)} world={neighbors[i === 0 ? 0 : 1]} theme="greenhouse" isEditMode={false} activeTool={previewTool} brushSize={1} onPaintStroke={noop} onStrokeStart={noop} onStrokeEnd={noop} onPlaceDecoration={noop} onRemoveDecoration={noop} />}
          {raining && <RainLayer rain={weather.rain} ground={grounds[i]} />}
        </div>)}
      </div>
    </div>
  </div>;
}
