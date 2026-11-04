/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { CreatureDNA, ElementType } from '../game/creatureTypes';
import { OddlingAvatar } from './OddlingAvatar';
import { sound } from '../game/soundSynth';
import { getCustomBiomesList } from '../game/customBiomeStorage';
import { repairObjectVisualPlan } from '../game/creatureRules';
import { DiaryBook } from './DiaryBook';
import { HeartMeter } from './HeartMeter';

const MEMORY_ICON = (type: string) => (type === 'pet' ? '❤️' : type === 'feed' ? '🍪' : type === 'fuse' ? '🧬' : '✨');
const MEMORY_PAGE = 4;
const MEMORY_FONT = '"Press Start 2P", ui-monospace, "JetBrains Mono", monospace';

const MemoriesPopup: React.FC<{ name: string; memories: { text: string; type?: string; timestamp?: number }[]; onClose: () => void }> = ({ name, memories, onClose }) => {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(memories.length / MEMORY_PAGE));
  const shown = memories.slice(page * MEMORY_PAGE, page * MEMORY_PAGE + MEMORY_PAGE);
  useEffect(() => {
    if (!document.getElementById('oddlings-pixel-font')) {
      const link = document.createElement('link');
      link.id = 'oddlings-pixel-font';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap';
      document.head.appendChild(link);
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setPage((p) => Math.min(pages - 1, p + 1));
      if (e.key === 'ArrowLeft') setPage((p) => Math.max(0, p - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, pages]);
  const btn = (disabled: boolean): React.CSSProperties => ({
    background: disabled ? '#c9b8d9' : '#ffe066', border: '3px solid #1b1033', color: '#1b1033',
    padding: '6px 10px', fontFamily: MEMORY_FONT, fontSize: 10, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1
  });
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ background: 'rgba(11,6,25,0.8)' }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 440, background: '#fff3d6', border: '4px solid #1b1033', boxShadow: '8px 8px 0 #1b1033', fontFamily: MEMORY_FONT, color: '#1b1033', imageRendering: 'pixelated' }}
      >
        <div className="flex items-center gap-3 p-3" style={{ background: '#ffb3d1', borderBottom: '4px solid #1b1033' }}>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] leading-4 truncate">{name.toUpperCase()}'S MEMORIES</div>
            <div className="text-[8px] leading-4" style={{ color: '#7a3b5a' }}>{memories.length} TOTAL</div>
          </div>
          <button onClick={onClose} aria-label="Close memories" style={{ background: '#fff3d6', border: '3px solid #1b1033', padding: '4px 8px', fontFamily: MEMORY_FONT, fontSize: 10, cursor: 'pointer' }}>X</button>
        </div>
        <div className="p-3 space-y-2" style={{ minHeight: 250 }}>
          {shown.map((mem, i) => (
            <div key={page * MEMORY_PAGE + i} style={{ background: '#fffaf0', border: '3px solid #1b1033', padding: 8 }}>
              <div className="flex items-start gap-2 text-[9px] leading-4">
                <span>{MEMORY_ICON(mem.type || '')}</span>
                <span className="flex-1">{mem.text}</span>
              </div>
              {mem.timestamp ? (
                <div className="text-[7px] mt-1" style={{ color: '#7a3b5a' }}>
                  {new Date(mem.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </div>
              ) : null}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between p-3" style={{ borderTop: '4px solid #1b1033', background: '#ffe9f2' }}>
          <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} style={btn(page === 0)}>◀ PREV</button>
          <span className="text-[8px]">PAGE {page + 1}/{pages}</span>
          <button disabled={page >= pages - 1} onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} style={btn(page >= pages - 1)}>NEXT ▶</button>
        </div>
      </div>
    </div>
  );
};

interface BestiaryJournalProps {
  creatures: CreatureDNA[];
  onSelectCreature: (creature: CreatureDNA) => void;
  onUpdateCreature?: (updated: CreatureDNA) => void;
  onOpenSaveRestore?: () => void;
  onClose: () => void;
}

export const BestiaryJournal: React.FC<BestiaryJournalProps> = ({
  creatures,
  onSelectCreature,
  onUpdateCreature,
  onOpenSaveRestore,
  onClose
}) => {
  const [selectedFilter, setSelectedFilter] = useState<string>('ALL');
  const [inspectCreatureId, setInspectCreatureId] = useState<string>(creatures[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [diaryOpen, setDiaryOpen] = useState(false);
  const [memoriesOpen, setMemoriesOpen] = useState(false);

  const activeInspect = creatures.find((c) => c.id === inspectCreatureId) || creatures[0];
  const activeVisualPlan = repairObjectVisualPlan(activeInspect?.appearance.visualPlan, activeInspect?.sourceObject.name || '');

  const filteredCreatures = creatures.filter((c) => {
    const matchesFilter = selectedFilter === 'ALL' || c.primaryElement === selectedFilter || c.secondaryElement === selectedFilter;
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.sourceObject.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.specialAbility.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const elementsList: ElementType[] = [
    'Ceramic', 'Botanical', 'Electric', 'Mechanical', 'Glass', 'Textile', 'Thermal', 'Sonic', 'Chrono', 'Crystalline'
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col p-4 md:p-8 overflow-y-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-xl text-amber-400">
            📖
          </div>
          <div>
            <h2 className="text-xl font-bold font-['Space_Grotesk'] text-slate-100 flex items-center gap-2">
              <span>DISCOVERY FIELD GUIDE</span>
              <span className="text-xs px-2 py-0.5 rounded bg-amber-950 text-amber-300 font-mono border border-amber-800">
                {creatures.length} SPECIES DISCOVERED
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Complete archive of discovered real-world specimens, genetic lineage trees, and interaction histories.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOpenSaveRestore && (
            <button
              onClick={() => {
                sound.playClick();
                onOpenSaveRestore();
              }}
              className="px-3 py-2 rounded-lg bg-cyan-950/90 border border-cyan-700 hover:border-cyan-500 text-cyan-300 hover:text-cyan-200 text-xs font-mono font-bold transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Export save file or restore from previous backup"
            >
              <span>💾</span>
              <span>SAVE & RESTORE</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-300 text-xs font-mono transition-colors cursor-pointer"
          >
            ESC / CLOSE ✕
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mt-4 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => { sound.playClick(); setSelectedFilter('ALL'); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              selectedFilter === 'ALL'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            ALL
          </button>
          {elementsList.map((elem) => (
            <button
              key={elem}
              onClick={() => { sound.playClick(); setSelectedFilter(elem); }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                selectedFilter === elem
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {elem}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name, object, or power..."
          className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500 w-full sm:w-64"
        />
      </div>

      {/* Journal Content Layout: Grid + Deep Inspector */}
      <div className="flex flex-col gap-6 mt-6 flex-1">
        {/* Left: Species Grid */}
        <div className="flex gap-3 overflow-x-auto pb-3">
          {filteredCreatures.map((creature) => {
            const isSelected = activeInspect?.id === creature.id;
            return (
              <div
                key={creature.id}
                onClick={() => {
                  sound.playClick();
                  setInspectCreatureId(creature.id);
                }}
                className={`shrink-0 w-40 p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col items-center text-center ${
                  isSelected
                    ? 'bg-slate-900 border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.25)] scale-[1.02]'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                <div className="w-24 h-24 flex items-center justify-center">
                  <OddlingAvatar creature={creature} size={90} mood="happy" showAura={false} />
                </div>

                <h4 className="font-bold text-slate-100 font-['Space_Grotesk'] text-sm mt-2">
                  {creature.name}
                </h4>

                <span className="text-[10px] text-amber-400 font-mono mt-0.5">
                  {creature.primaryElement} {creature.secondaryElement ? `/ ${creature.secondaryElement}` : ''}
                </span>

                <span className="text-[10px] text-slate-500 font-mono mt-1">
                  Gen {creature.stats.generation} · Trust {creature.stats.trust}%
                </span>

                <HeartMeter trust={creature.stats.trust} size={2} className="mt-1.5" />
              </div>
            );
          })}
        </div>

        {/* Right: Detailed Dossier & Lineage Tree */}
        <div className="bg-slate-900/90 rounded-2xl p-6 border border-slate-800 shadow-xl flex flex-col justify-between">
          {activeInspect ? (
            <div className="space-y-5">
              {/* Side-by-side Specimen to Living Creature Banner */}
              <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold flex items-center gap-1.5">
                    <span>🧬</span>
                    <span>Specimen Provenance & Transformation</span>
                  </span>
                  {(() => {
                    if (activeInspect.lineage) {
                      if (activeInspect.provenanceDetails?.provider === 'baseten' || activeInspect.provenance === 'ai_extracted') {
                        return (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded border bg-purple-950 text-purple-300 border-purple-800 flex items-center gap-1">
                            <span>✨</span>
                            <span>META MUSE SPARK (AI FUSION)</span>
                          </span>
                        );
                      }
                      return (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded border bg-pink-950 text-pink-300 border-pink-800 flex items-center gap-1">
                          <span>🧬</span>
                          <span>GENETIC HYBRID (ALGORITHMIC)</span>
                        </span>
                      );
                    }
                    if (activeInspect.provenance === 'user_upload_manual') {
                      return (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded border bg-cyan-950 text-cyan-300 border-cyan-800 flex items-center gap-1">
                          <span>📷</span>
                          <span>USER PHOTO SPECIMEN</span>
                        </span>
                      );
                    }
                    if (activeInspect.provenance === 'ai_extracted') {
                      return (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded border bg-purple-950 text-purple-300 border-purple-800 flex items-center gap-1">
                          <span>✨</span>
                          <span>META MUSE SPARK (AI SCAN)</span>
                        </span>
                      );
                    }
                    return (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded border bg-amber-950 text-amber-300 border-amber-800 flex items-center gap-1">
                        <span>📦</span>
                        <span>PRESET DEMO SPECIMEN</span>
                      </span>
                    );
                  })()}
                </div>

                <div className="grid grid-cols-11 items-center gap-2">
                  {/* Left: Source Object Card */}
                  <div className="col-span-5 flex flex-col items-center text-center p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                    <span className="text-[9px] font-mono uppercase tracking-wider text-slate-400 font-bold mb-1">
                      Origin Item
                    </span>
                    <div className="w-20 h-20 rounded-lg overflow-hidden border border-slate-700 shrink-0 bg-slate-950 flex items-center justify-center">
                      {activeInspect.sourceObject.userPhotoUrl ? (
                        <img
                          src={activeInspect.sourceObject.userPhotoUrl}
                          alt={activeInspect.sourceObject.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-3xl">
                          {activeInspect.primaryElement === 'Ceramic' ? '☕' : activeInspect.primaryElement === 'Botanical' ? '🌵' : activeInspect.primaryElement === 'Electric' ? '💡' : activeInspect.primaryElement === 'Sonic' ? '🎧' : '🏺'}
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-slate-200 mt-1 journal-label truncate max-w-full">
                      {activeInspect.sourceObject.name}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 journal-label truncate max-w-full">
                      {activeInspect.sourceObject.material}
                    </span>
                  </div>

                  {/* Center: Conduit Arrow */}
                  <div className="col-span-1 flex flex-col items-center justify-center text-amber-400">
                    <span className="text-base font-bold animate-pulse">➔</span>
                  </div>

                  {/* Right: Living Creature */}
                  <div className="col-span-5 flex flex-col items-center text-center p-2 rounded-lg bg-gradient-to-b from-amber-500/10 to-slate-900/80 border border-amber-500/30">
                    <div className="flex items-center justify-between w-full px-1">
                      <span className="text-[9px] font-mono uppercase tracking-wider text-amber-400 font-bold">
                        Living Oddling
                      </span>
                      <button
                        onClick={() => sound.playChirp(600)}
                        className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-slate-300 flex items-center gap-1 transition-colors"
                        title="Play Chirp"
                      >
                        <span>🔊</span>
                      </button>
                    </div>
                    <div className="w-20 h-20 flex items-center justify-center">
                      <OddlingAvatar creature={activeInspect} size={76} mood="happy" showAura={false} />
                    </div>
                    <span className="text-xs font-bold text-slate-100 font-['Space_Grotesk'] journal-label truncate max-w-full">
                      {activeInspect.name}
                    </span>
                    <span className="text-[10px] font-mono text-cyan-300 italic journal-label truncate max-w-full">
                      {activeInspect.speciesName}
                    </span>
                  </div>
                </div>

                {/* Compact Anatomy Pill Readout */}
                <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-slate-400 uppercase">Object-Grounded Anatomy:</span>
                    <span className="text-amber-400 font-bold uppercase">
                      {activeVisualPlan?.compositional?.category === 'computer_mouse'
                        ? 'ELECTRONICS ANATOMY'
                        : activeVisualPlan?.archetype === 'compositional'
                        ? `${(activeVisualPlan.compositional?.category || activeInspect.sourceObject.name).replace('_', ' ').toUpperCase()} ANATOMY`
                        : `${(activeVisualPlan?.archetype || 'Custom').replace('_', ' ').toUpperCase()} ANATOMY`}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {activeVisualPlan && (
                      <>
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[9px] font-mono text-slate-300">
                          Finish: {(activeVisualPlan.materialSurface?.finish || 'matte').replace('_', ' ')}
                        </span>
                        {activeVisualPlan.definingParts?.hasHandle && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-800 text-[9px] font-mono text-amber-300">
                            Handle
                          </span>
                        )}
                        {activeVisualPlan.definingParts?.hasRim && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-800 text-[9px] font-mono text-amber-300">
                            Open Rim
                          </span>
                        )}
                        {activeVisualPlan.definingParts?.hasSpines && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-800 text-[9px] font-mono text-emerald-300">
                            Spines
                          </span>
                        )}
                        {activeVisualPlan.definingParts?.hasSteam && (
                          <span className="px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-800 text-[9px] font-mono text-cyan-300">
                            Steam
                          </span>
                        )}
                        {activeVisualPlan.definingParts?.hasEarcups && (
                          <span className="px-1.5 py-0.5 rounded bg-indigo-950/60 border border-indigo-800 text-[9px] font-mono text-indigo-300">
                            Earcups
                          </span>
                        )}
                        {activeVisualPlan.definingParts?.hasClockHands && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-800 text-[9px] font-mono text-amber-300">
                            Clock Hands
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  <div className="pt-1 text-[9px] font-mono text-slate-500 border-t border-slate-800/60 flex items-center justify-between">
                    <span>Engine: Procedural 16-Bit Pixel Sprites</span>
                    <span className="text-slate-600">SAM / Muse Image unconfigured</span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 italic">
                  "{activeInspect.title}"
                </p>
              </div>

              {/* Special Ability & Stats */}
              <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <span>{activeInspect.specialAbility.icon}</span>
                    <span>{activeInspect.specialAbility.name}</span>
                  </span>
                  <span className="text-xs font-mono text-pink-400 font-bold">
                    {activeInspect.specialAbility.powerRating} PWR
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {activeInspect.specialAbility.description}
                </p>
              </div>

              {/* Genetic Lineage (if Hybrid) */}
              {activeInspect.lineage && (
                <div className="bg-slate-950/70 p-3.5 rounded-xl border border-pink-500/30 space-y-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-pink-400 font-bold block">
                    🧬 Traceable Genetic Lineage
                  </span>
                  <div className="flex items-center justify-between text-xs font-mono text-slate-300">
                    <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700">
                      {activeInspect.lineage.parentAName}
                    </span>
                    <span className="text-pink-400 font-bold">×</span>
                    <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700">
                      {activeInspect.lineage.parentBName}
                    </span>
                  </div>
                  <ul className="text-[11px] text-slate-400 space-y-1 list-disc list-inside mt-2">
                    {activeInspect.lineage.inheritedTraits.map((trait, idx) => (
                      <li key={idx}>{trait}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Resident Sanctuary Location & Relocation */}
              <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800/80 flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">
                    Resident Sanctuary
                  </span>
                  <span className="text-xs font-mono font-semibold text-cyan-300">
                    {(activeInspect.biomeId === 'greenhouse' || !activeInspect.biomeId)
                      ? '🌍 World'
                      : activeInspect.biomeId === 'desk'
                      ? '☕ Desk'
                      : activeInspect.biomeId === 'lab'
                      ? '⚡ Lab'
                      : getCustomBiomesList().find((b) => b.id === activeInspect.biomeId)?.name || 'Custom Biome'}
                  </span>
                </div>
                {onUpdateCreature && (
                  <select
                    value={activeInspect.biomeId || 'greenhouse'}
                    onChange={(e) => {
                      const newBiomeId = e.target.value;
                      sound.playClick();
                      onUpdateCreature({
                        ...activeInspect,
                        biomeId: newBiomeId,
                        worldRegion: 0,
                        memories: [
                          {
                            timestamp: Date.now(),
                            text: `Relocated from Field Guide to sanctuary.`,
                            type: 'nap' as const
                          },
                          ...activeInspect.memories
                        ].slice(0, 20)
                      });
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-slate-200 cursor-pointer focus:outline-none focus:border-cyan-400"
                  >
                    <option value="greenhouse">Move to 🌍 World</option>
                    {getCustomBiomesList().map((cb) => (
                      <option key={cb.id} value={cb.id}>
                        Move to 📷 {cb.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Creature diary, written by Meta Muse Spark */}
              <button
                onClick={() => {
                  sound.playClick();
                  setDiaryOpen(true);
                }}
                className="w-full px-3 py-2 rounded-lg border-2 border-pink-300 bg-pink-200 text-slate-900 text-[10px] font-mono font-bold uppercase tracking-wider cursor-pointer hover:bg-pink-100"
              >
                📖 Open {activeInspect.name}'s Diary
              </button>
              {diaryOpen && <DiaryBook creature={activeInspect} onClose={() => setDiaryOpen(false)} />}

              {/* Memory Log History */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold block">
                  Interaction Memories
                </span>
                <div className="space-y-1">
                  {[...activeInspect.memories].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 5).map((m, idx) => (
                    <div key={idx} className="text-[11px] text-slate-300 bg-slate-950/50 p-2 rounded-lg border border-slate-800/60 flex items-start gap-2">
                      <span className="text-xs">
                        {m.type === 'pet' ? '❤️' : m.type === 'feed' ? '🍪' : m.type === 'fuse' ? '🧬' : '✨'}
                      </span>
                      <span>{m.text}</span>
                    </div>
                  ))}
                </div>
                {activeInspect.memories.length > 5 && (
                  <button
                    onClick={() => {
                      sound.playClick();
                      setMemoriesOpen(true);
                    }}
                    className="w-full mt-1 px-3 py-2 rounded-lg border-2 border-amber-500/70 bg-slate-950 text-amber-300 text-[10px] font-mono font-bold uppercase tracking-wider cursor-pointer hover:bg-slate-900"
                  >
                    See more ({activeInspect.memories.length - 5} more)
                  </button>
                )}
                {memoriesOpen && (
                  <MemoriesPopup
                    name={activeInspect.name}
                    memories={[...activeInspect.memories].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))}
                    onClose={() => setMemoriesOpen(false)}
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="text-center text-slate-500 my-auto">
              Select a creature from the catalog to view details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
