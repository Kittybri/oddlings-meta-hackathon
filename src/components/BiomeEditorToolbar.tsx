/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BUILD_ITEMS, TREE_TYPES } from '../game/buildCatalog';
import React, { useState, useEffect } from 'react';
import {
  CustomBiomeRecord,
  DecorationType,
  EditorTool,
  EditorToolTab,
  HabitatThemeId,
  StarterTemplateId,
  TileMaterial
} from '../game/biomeWorldTypes';
import { sound } from '../game/soundSynth';
import { customItemLibrary } from '../game/customItemStore';
import { PhotoItemModal } from './PhotoItemModal';

interface BiomeEditorToolbarProps {
  isEditMode: boolean;
  onToggleEditMode: () => void;
  activeTool: EditorTool;
  onSelectTool: (tool: EditorTool) => void;
  brushSize: 1 | 2 | 3;
  onSetBrushSize: (size: 1 | 2 | 3) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  isDirty: boolean;
  onSave: () => boolean | undefined;
  onCancel: () => void;
  onResetBiome: () => void;
  onApplyTemplate: (templateId: StarterTemplateId) => void;
  activeHabitatTheme: HabitatThemeId;
  onChangeTheme: (theme: HabitatThemeId) => void;
  customBiomes?: CustomBiomeRecord[];
  onOpenCreateBiome?: () => void;
  onOpenManageBiome?: (biome: CustomBiomeRecord) => void;
}

export const BiomeEditorToolbar: React.FC<BiomeEditorToolbarProps> = ({
  isEditMode,
  onToggleEditMode,
  activeTool,
  onSelectTool,
  brushSize,
  onSetBrushSize,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  isDirty,
  onSave,
  onCancel,
  onResetBiome,
  onApplyTemplate,
  activeHabitatTheme,
  onChangeTheme,
  customBiomes = [],
  onOpenCreateBiome,
  onOpenManageBiome
}) => {
  const [more, setMore] = useState(false);
  useEffect(() => { if (!isEditMode) setMore(false); }, [isEditMode]);
  const [activeTab, setActiveTab] = useState<EditorToolTab>('terrain');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<{ id: StarterTemplateId; label: string; desc: string; icon: string } | null>(null);
  const [isToolboxCollapsed, setIsToolboxCollapsed] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640);
  const pickTool = (tool: EditorTool) => {
    onSelectTool(tool);
    if (window.matchMedia("(max-width:639px), (max-height:450px) and (orientation:landscape)").matches) setIsToolboxCollapsed(true);
  };
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showSaveToast, setShowSaveToast] = useState(false);

  const naturalMaterials: Array<{ material: TileMaterial; label: string; icon: string }> = [
    { material: 'grass', label: 'Grass', icon: '🟩' },
    { material: 'dirt', label: 'Dirt', icon: '🟫' },
    { material: 'stone', label: 'Stone', icon: '🪨' },
    { material: 'sand', label: 'Sand', icon: '🏜️' },
    { material: 'wood', label: 'Wood', icon: '🪵' },
    { material: 'moss', label: 'Moss', icon: '🌿' },
    { material: 'snow', label: 'Snow', icon: '❄️' }
  ];

  const architecturalMaterials: Array<{ material: TileMaterial; label: string; icon: string }> = [
    { material: 'brick', label: 'Brick', icon: '🧱' },
    { material: 'plaster', label: 'Plaster', icon: '🏛️' },
    { material: 'carpet', label: 'Carpet', icon: '🧶' },
    { material: 'tile', label: 'Tile', icon: '🏁' },
    { material: 'glass', label: 'Glass', icon: '🪟' },
    { material: 'metal', label: 'Metal', icon: '⚙️' }
  ];

  const [showPhotoItem, setShowPhotoItem] = useState(false);
  const [myItems, setMyItems] = useState(() => customItemLibrary.list());
  useEffect(() => customItemLibrary.subscribe(() => setMyItems(customItemLibrary.list())), []);

  const decorationsList: Array<{ type: DecorationType; label: string; icon: string }> = [
    { type: 'tree', label: 'Big Oak', icon: '🌳' },
    ...BUILD_ITEMS.filter((item) => TREE_TYPES.includes(item.type)),
    { type: 'shrub', label: 'Berry Shrub', icon: '🫐' },
    { type: 'flower', label: 'Blossom', icon: '🌸' },
    { type: 'seed', label: 'Plant Seed', icon: '🌱' },
    { type: 'rock', label: 'Boulder', icon: '🗿' },
    { type: 'mushroom', label: 'Mushroom', icon: '🍄' },
    { type: 'lantern', label: 'Lantern', icon: '💡' },
    { type: 'shelter', label: 'Shelter', icon: '⛺' },
    { type: 'bench', label: 'Garden Bench', icon: '🪑' },
    { type: 'fence', label: 'Picket Fence', icon: '🪵' },
    { type: 'flowerpot', label: 'Flower Pot', icon: '🪴' },
    { type: 'campfire', label: 'Campfire', icon: '🔥' },
    { type: 'lamppost', label: 'Street Lamp', icon: '💡' },
    { type: 'crystal', label: 'Glow Crystal', icon: '💎' },
    { type: 'well', label: 'Wishing Well', icon: '🪣' },
    { type: 'cottage', label: 'Cozy Cottage', icon: '🏡' },
    ...BUILD_ITEMS.filter((item) => !TREE_TYPES.includes(item.type)),
  ];

  const templatesList: Array<{ id: StarterTemplateId; label: string; desc: string; icon: string }> = [
    { id: 'living_garden', label: 'Living Garden', desc: 'Lush terraced hills, shallow pond, footbridge & flora', icon: '🌿' },
    { id: 'cozy_clearing', label: 'Cozy Clearing', desc: 'Rolling hills, oak tree, flowers & bridge', icon: '🏡' },
    { id: 'floating_garden', label: 'Floating Garden', desc: 'Floating sky islands with lanterns & shrubs', icon: '🪶' },
    { id: 'rocky_pond', label: 'Rocky Pond', desc: 'Recessed shallow pool, stone banks & dock', icon: '💧' }
  ];

  return (
    <div data-more={more} data-editing={isEditMode} className="biome-toolbar relative z-30 select-none">
      {/* Top Habitat Switcher Bar + Mode Toggle */}
      <div
      className="flex flex-wrap items-center justify-between gap-2.5 px-4 pb-2 bg-gradient-to-b from-slate-950/95 via-slate-950/80 to-transparent"
      style={{ paddingTop: 'calc(var(--hud-h, 52px) + 8px)' }}
    >
        {/* Left: Biome Themes + Build/Edit Toggle Button */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          {!isEditMode && <select className="world-picker" aria-label="Choose or create a world" value={activeHabitatTheme}
            onChange={e => {
              const value = e.target.value;
              if (value === 'create') onOpenCreateBiome?.();
              else onChangeTheme(value);
            }}>
            <option value="greenhouse">🌍 World</option>
            {customBiomes.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            {onOpenCreateBiome && <option value="create">＋ Create biome</option>}
          </select>}
          <span className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider mr-1">
            BIOME:
          </span>

          <button
            onClick={() => { sound.playClick(); onChangeTheme('greenhouse'); }}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeHabitatTheme === 'greenhouse'
                ? 'bg-emerald-300 text-emerald-950 font-extrabold ring-2 ring-emerald-100 shadow-lg'
                : 'bg-slate-900/90 text-slate-300 hover:bg-slate-800 border border-slate-800'
            }`}
            aria-label="World — main endless world" aria-pressed={activeHabitatTheme === 'greenhouse'} title="Your main world · explore and build in both directions"
          >
            🌍 World <span className="ml-1 text-[9px] rounded-full px-1.5 py-0.5 bg-emerald-950 text-emerald-100">∞ MAIN</span>
          </button>

          {/* Desk and Lab were merged into the World (their saved layouts and residents live there now);
              extra rooms are made with Create Biome */}


          {/* Custom Biomes Tabs */}
          {customBiomes.map((cb) => {
            const isActive = activeHabitatTheme === cb.id;
            return (
              <div key={cb.id} className="flex items-center gap-0.5">
                <button
                  onClick={() => { sound.playClick(); onChangeTheme(cb.id); }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-950 font-bold shadow-md'
                      : 'bg-slate-900/90 text-slate-300 hover:bg-slate-800 border border-slate-800'
                  }`}
                  title={cb.name}
                >
                  <span>📷</span>
                  <span className="max-w-[90px] truncate">{cb.name}</span>
                </button>
                {onOpenManageBiome && (
                  <button
                    onClick={() => { sound.playClick(); onOpenManageBiome(cb); }}
                    className="p-1 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 text-[10px] cursor-pointer"
                    title={`Manage ${cb.name}`}
                  >
                    ⚙️
                  </button>
                )}
              </div>
            );
          })}

          {/* + Create Biome Button */}
          {onOpenCreateBiome && (
            <button
              onClick={() => {
                sound.playClick();
                onOpenCreateBiome();
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-600/60 shadow-sm transition-all cursor-pointer"
              aria-label="Create a new custom photo biome"
              title="Create a new custom photo biome"
            >
              <span>+</span>
              <span className="hidden sm:inline">Create Biome</span>
            </button>
          )}

          <span className="w-px h-5 bg-slate-800 mx-1" />

          {/* Visible "Build / Edit Biome" Mode Toggle */}
          <button
            onClick={() => {
              sound.playClick();
              onToggleEditMode();
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all shadow-md cursor-pointer ${
              isEditMode
                ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-400 animate-pulse'
                : 'bg-slate-900 hover:bg-slate-800 text-amber-400 border border-amber-500/50'
            }`}
            title="Toggle between Play simulation and 2D Sandbox Biome Editor"
          >
            <span>{isEditMode ? '🌱' : '🔨'}</span>
            <span className="hidden sm:inline">{isEditMode ? 'PLAY MODE' : 'BUILD / EDIT BIOME'}</span><span className="sm:hidden">{isEditMode ? 'PLAY' : 'BUILD'}</span>
          </button>
        </div>

        {/* Right: Save Status & Quick Actions in Edit Mode */}
        {isEditMode && (
          <div className="flex items-center gap-2">
            {/* Saved / Unsaved Indicator */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900/90 border border-slate-800 text-[11px] font-mono">
              <span
                className={`w-2 h-2 rounded-full ${
                  isDirty ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'
                }`}
              />
              <span className={isDirty ? 'text-amber-300' : 'text-emerald-300'}>
                {isDirty ? 'Unsaved' : 'Saved'}
              </span>
            </div>

            <button className="builder-more" aria-expanded={more} onClick={() => setMore(!more)}>••• More</button>
            {/* Undo */}
            <button
              disabled={!canUndo}
              onClick={() => { sound.playClick(); onUndo(); }}
              className={`px-2.5 py-1 rounded-md text-xs font-mono transition-all flex items-center gap-1 ${
                canUndo
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer'
                  : 'bg-slate-900/50 text-slate-600 cursor-not-allowed'
              }`}
              title="Undo stroke (Ctrl+Z)"
            >
              <span>↩️</span>
              <span className="hidden sm:inline">Undo</span>
            </button>

            {/* Redo */}
            <button
              disabled={!canRedo}
              onClick={() => { sound.playClick(); onRedo(); }}
              className={`px-2.5 py-1 rounded-md text-xs font-mono transition-all flex items-center gap-1 ${
                canRedo
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer'
                  : 'bg-slate-900/50 text-slate-600 cursor-not-allowed'
              }`}
              title="Redo (Ctrl+Y)"
            >
              <span>↪️</span>
              <span className="hidden sm:inline">Redo</span>
            </button>

            {/* Help Button */}
            <button
              onClick={() => { sound.playClick(); setShowHelpModal(true); }}
              className="w-7 h-7 rounded-md bg-slate-900 hover:bg-slate-800 text-amber-300 font-mono text-xs font-bold border border-slate-700 flex items-center justify-center cursor-pointer"
              title="Controls & Shortcuts Help"
            >
              ?
            </button>

            {/* Cancel Button */}
            <button
              onClick={() => { sound.playClick(); onCancel(); }}
              className="px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-mono border border-slate-700 cursor-pointer"
              title="Discard unsaved changes and return to play mode"
            >
              Cancel
            </button>

            {/* Save / Done Button */}
            <button
              onClick={() => {
                if (!onSave()) return;
                sound.playFanfare();
                setShowSaveToast(true);
                setTimeout(() => setShowSaveToast(false), 2400);
              }}
              className="px-3 py-1 rounded-md bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs font-mono shadow-md cursor-pointer flex items-center gap-1"
              title="Save biome world to storage and enter play mode"
            >
              <span>💾</span>
              <span className="desktop-done">DONE</span><span className="builder-word">Done ✓</span>
            </button>

            <button className="phone-control" aria-pressed={activeTool.type === 'grab'} onClick={() => pickTool({ type: 'grab' })}>Move</button>
            {isToolboxCollapsed && <div id="decor-trash" title="Drag here to delete" className="phone-control decor-trash">🗑️</div>}
            {/* Collapse/Expand Toolbox on small screens */}
            <button
              onClick={() => {
                sound.playClick();
                setIsToolboxCollapsed((prev) => !prev);
              }}
              className="px-2 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-mono border border-slate-800 cursor-pointer"
              title={isToolboxCollapsed ? 'Expand Toolbox' : 'Collapse Toolbox'}
            >
              <span className="builder-word">Tools · </span>{isToolboxCollapsed ? '▾ '  + (activeTool.type === 'brush' ? activeTool.material : activeTool.type === 'grab' ? 'Move' : activeTool.type) : '▴ Hide'}
            </button>
          </div>
        )}
      </div>

      {/* Floating Save Confirmation Toast */}
      {showSaveToast && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-emerald-950/95 text-emerald-200 border border-emerald-500/80 px-4 py-2 rounded-xl shadow-2xl font-mono text-xs font-bold flex items-center gap-2 animate-bounce">
          <span className="text-emerald-400">✓</span>
          <span>Biome World Layout Saved to Browser!</span>
        </div>
      )}

      {/* Expanded Sandbox Toolbox (Visible during Edit Mode) */}
      {isEditMode && !isToolboxCollapsed && (
        <div className="build-toolbox mx-4 mb-2 p-3 rounded-2xl bg-slate-950/95 border border-amber-500/40 shadow-2xl backdrop-blur-md space-y-2.5">
          {/* Top row: Tool Tabs & Brush Sizing */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
            {/* Category Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto">
              <button
                onClick={() => { sound.playClick(); setActiveTab('terrain'); }}
                className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                  activeTab === 'terrain'
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                🧱 TERRAIN
              </button>
              <button
                onClick={() => {
                  sound.playClick();
                  setActiveTab('water');
                  onSelectTool({ type: 'brush', material: 'water' });
                }}
                className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                  activeTab === 'water'
                    ? 'bg-cyan-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                💧 WATER
              </button>
              <button
                onClick={() => { sound.playClick(); setActiveTab('decorations'); }}
                className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                  activeTab === 'decorations'
                    ? 'bg-pink-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                🌸 DECORATIONS
              </button>
              <button
                onClick={() => { sound.playClick(); setActiveTab('photos'); }}
                className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                  activeTab === 'photos'
                    ? 'bg-amber-400 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                📷 PHOTO ITEMS
              </button>
              <button
                onClick={() => { sound.playClick(); setActiveTab('templates'); }}
                className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                  activeTab === 'templates'
                    ? 'bg-purple-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                🗺️ STARTERS
              </button>
            </div>

            {/* Eraser & Brush Size Cluster */}
            <div className="flex items-center gap-2">
              {/* Eraser Tool */}
              {/* Grab: pick up placed items without painting; drag to move, or onto the trash to delete */}
              <button
                onClick={() => {
                  sound.playClick();
                  pickTool({ type: 'grab' });
                }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold border transition-all ${
                  activeTool.type === 'grab'
                    ? 'bg-sky-400 text-slate-950 border-sky-300 shadow-md ring-2 ring-sky-300'
                    : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                }`}
                title="Grab items to move them, or drag them to the trash"
              >
                <span>✋</span>
                <span>GRAB</span>
              </button>

              <button
                onClick={() => {
                  sound.playClick();
                  pickTool({ type: 'eraser' });
                }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold border transition-all ${
                  activeTool.type === 'eraser'
                    ? 'bg-rose-500 text-slate-950 border-rose-400 shadow-md ring-2 ring-rose-400'
                    : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                }`}
                title="Erase terrain to air (E)"
              >
                <span>🧹</span>
                <span>ERASER</span>
              </button>

              {/* Brush Sizes 1, 2, 3 */}
              <div className="flex items-center bg-slate-900 rounded-lg p-0.5 border border-slate-800 text-xs font-mono">
                <span className="px-1.5 text-[10px] text-slate-400 font-bold">SIZE:</span>
                {[1, 2, 3].map((size) => (
                  <button
                    key={size}
                    onClick={() => {
                      sound.playClick();
                      onSetBrushSize(size as 1 | 2 | 3);
                    }}
                    className={`px-2 py-0.5 rounded text-xs transition-all ${
                      brushSize === size
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {size}x{size}
                  </button>
                ))}
              </div>

              {/* Reset Biome Trigger */}
              <button
                onClick={() => setShowResetConfirm(true)}
                className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-rose-950/60 text-rose-400 border border-rose-900/60 text-[11px] font-mono cursor-pointer transition-colors"
                title="Reset this biome to starter layout"
              >
                Reset
              </button>
            </div>


          </div>

            {/* Trash: drag a placed item here and let go to delete it */}
            <div
              id="decor-trash"
              className="decor-trash ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 border-dashed border-rose-500/50 text-rose-300 text-[11px] font-mono select-none"
              title="Drag a placed item here to delete it"
            >
              <span className="decor-trash-can text-base" aria-hidden="true">🗑️</span>
              <span>Drag here to delete</span>
            </div>
          {/* Bottom row: Tab specific tools */}
          <div className="flex items-center gap-2 overflow-x-auto py-1">
            {activeTab === 'terrain' && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-mono text-slate-500 font-bold uppercase mr-1">NATURAL:</span>
                {naturalMaterials.map((tm) => {
                  const isSelected = activeTool.type === 'brush' && activeTool.material === tm.material;
                  return (
                    <button
                      key={tm.material}
                      onClick={() => {
                        sound.playClick();
                        pickTool({ type: 'brush', material: tm.material });
                      }}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-all ${
                        isSelected
                          ? 'bg-amber-500 text-slate-950 font-bold shadow-md scale-105 ring-2 ring-amber-400'
                          : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                      }`}
                    >
                      <span>{tm.icon}</span>
                      <span>{tm.label}</span>
                    </button>
                  );
                })}

                <span className="w-px h-5 bg-slate-800 mx-1" />

                <span className="text-[10px] font-mono text-slate-500 font-bold uppercase mr-1">ARCHITECTURAL:</span>
                {architecturalMaterials.map((tm) => {
                  const isSelected = activeTool.type === 'brush' && activeTool.material === tm.material;
                  return (
                    <button
                      key={tm.material}
                      onClick={() => {
                        sound.playClick();
                        pickTool({ type: 'brush', material: tm.material });
                      }}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-all ${
                        isSelected
                          ? 'bg-amber-500 text-slate-950 font-bold shadow-md scale-105 ring-2 ring-amber-400'
                          : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                      }`}
                    >
                      <span>{tm.icon}</span>
                      <span>{tm.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {activeTab === 'water' && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    sound.playClick();
                    pickTool({ type: 'brush', material: 'water' });
                  }}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                    activeTool.type === 'brush' && activeTool.material === 'water'
                      ? 'bg-cyan-500 text-slate-950 shadow-md scale-105 ring-2 ring-cyan-400'
                      : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  <span>💧</span>
                  <span>Shallow Water Tile</span>
                </button>
                <span className="text-[11px] text-cyan-300/80 font-mono">
                  Creatures can wade and splash in shallow water pools!
                </span>
              </div>
            )}

            {activeTab === 'decorations' && (
              <div className="flex flex-wrap items-center gap-2 w-full min-w-0 max-h-36 overflow-y-auto p-1">
                {decorationsList.map((dec) => {
                  const isSelected = activeTool.type === 'decoration' && activeTool.decorType === dec.type;
                  return (
                    <button
                      key={dec.type}
                      onClick={() => {
                        sound.playClick();
                        pickTool({ type: 'decoration', decorType: dec.type });
                      }}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono font-medium whitespace-nowrap transition-all ${
                        isSelected
                          ? 'bg-pink-500 text-slate-950 font-bold shadow-md scale-105 ring-2 ring-pink-400'
                          : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                      }`}
                    >
                      <span>{dec.icon}</span>
                      <span>{dec.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* My photo items: things made from the player's own photos, kept apart from the built-in decorations */}
            {activeTab === 'photos' && (
              <div className="flex flex-wrap items-center gap-2 w-full min-w-0 max-h-36 overflow-y-auto p-1">
                {myItems.length === 0 && (
                  <span className="text-[11px] font-mono text-slate-400">No photo items yet. Snap something to turn it into a placeable item!</span>
                )}
                {myItems.map((item) => {
                  const isSelected = activeTool.type === 'decoration' && activeTool.decorType === 'custom' && activeTool.customItemId === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        sound.playClick();
                        pickTool({ type: 'decoration', decorType: 'custom', customItemId: item.id });
                      }}
                      title={item.description || item.name}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono font-medium whitespace-nowrap transition-all ${
                        isSelected
                          ? 'bg-pink-500 text-slate-950 font-bold shadow-md scale-105 ring-2 ring-pink-400'
                          : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                      }`}
                    >
                      <img src={item.sprite} alt="" width={18} height={18} style={{ imageRendering: 'pixelated' }} />
                      <span>{item.name}</span>
                    </button>
                  );
                })}
                <button
                  onClick={() => {
                    sound.playClick();
                    setShowPhotoItem(true);
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold whitespace-nowrap bg-pink-200 text-slate-900 border border-pink-300 hover:bg-pink-100"
                >
                  <span>📷</span>
                  <span>Capture</span>
                </button>
                {showPhotoItem && (
                  <PhotoItemModal
                    onClose={() => setShowPhotoItem(false)}
                    onSaved={(item) => {
                      pickTool({ type: 'decoration', decorType: 'custom', customItemId: item.id });
                      setShowPhotoItem(false);
                    }}
                  />
                )}
              </div>
            )}

            {activeTab === 'templates' && (
              <div className="flex items-center gap-2.5">
                {templatesList.map((tmpl) => (
                  <button
                    key={tmpl.id}
                    onClick={() => {
                      sound.playClick();
                      setPendingTemplate(tmpl);
                    }}
                    className="flex flex-col items-start px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-purple-500/40 text-left transition-all hover:scale-102 cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold font-mono text-purple-300">
                      <span>{tmpl.icon}</span>
                      <span>{tmpl.label}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {tmpl.desc}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick instructions bar */}
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-800/60">
            <span>
              💡 Click or drag to paint · 1 drag = 1 undo · Hotkeys: [B] Brush, [E] Erase, [Ctrl+Z] Undo
            </span>
            <span className="hidden sm:inline text-amber-400/80">
              Creatures interact with solid surfaces, water & shelters
            </span>
          </div>
        </div>
      )}

      {/* Starter Template Preview & Confirmation Modal */}
      {pendingTemplate && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-purple-500/50 rounded-2xl p-6 max-w-sm text-center shadow-2xl space-y-4">
            <span className="text-4xl">{pendingTemplate.icon}</span>
            <h4 className="text-base font-bold text-slate-100 font-['Space_Grotesk']">
              Load {pendingTemplate.label}?
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              {pendingTemplate.desc}
            </p>
            <div className="p-2.5 rounded-lg bg-purple-950/50 border border-purple-800/50 text-[11px] font-mono text-purple-300 text-left space-y-1">
              <div>• Replaces current blocks & decorations</div>
              <div>• Keeps all discovered Oddlings safe</div>
              <div>• You can undo (Ctrl+Z) if you change your mind</div>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setPendingTemplate(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-mono hover:bg-slate-700 cursor-pointer"
              >
                Keep Current
              </button>
              <button
                onClick={() => {
                  sound.playFanfare();
                  onApplyTemplate(pendingTemplate.id);
                  setPendingTemplate(null);
                }}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs font-mono shadow-md cursor-pointer"
              >
                Apply Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Controls & Help Cheat Sheet Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/50 rounded-2xl p-6 max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h4 className="text-sm font-bold text-amber-400 font-mono flex items-center gap-2">
                <span>🔨</span>
                <span>SANDBOX EDITOR CONTROLS</span>
              </h4>
              <button
                onClick={() => setShowHelpModal(false)}
                className="text-xs text-slate-400 hover:text-white font-mono px-2 py-0.5 rounded bg-slate-800 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3 text-xs text-slate-300">
              <div className="space-y-1">
                <span className="font-bold text-slate-100 uppercase tracking-wider text-[11px] font-mono text-cyan-400">
                  Painting & Building:
                </span>
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  Click or drag on the 48×24 grid to paint terrain tiles. Continuous drag actions are batched into a single Undo operation.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                  <span className="text-amber-300 block font-bold">[B] Key:</span>
                  <span className="text-slate-400">Switch to Brush</span>
                </div>
                <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                  <span className="text-rose-300 block font-bold">[E] Key:</span>
                  <span className="text-slate-400">Switch to Eraser</span>
                </div>
                <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                  <span className="text-emerald-300 block font-bold">[Ctrl+Z]:</span>
                  <span className="text-slate-400">Undo stroke</span>
                </div>
                <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                  <span className="text-emerald-300 block font-bold">[Ctrl+Y]:</span>
                  <span className="text-slate-400">Redo stroke</span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="font-bold text-slate-100 uppercase tracking-wider text-[11px] font-mono text-cyan-400">
                  Living Physics & Water:
                </span>
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  Oddlings roam across solid blocks, wade in shallow water, and express joy near placed blossoms, lanterns, and shelters.
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowHelpModal(false)}
                className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs font-mono cursor-pointer"
              >
                Got It!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/50 rounded-2xl p-6 max-w-sm text-center shadow-2xl space-y-4">
            <span className="text-3xl">⚠️</span>
            <h4 className="text-base font-bold text-slate-100 font-['Space_Grotesk']">
              Reset this Biome Layout?
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              This will restore the starter template for the {activeHabitatTheme.toUpperCase()} biome. All your discovered Oddlings will remain safe!
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-mono hover:bg-slate-700 cursor-pointer"
              >
                Keep Edits
              </button>
              <button
                onClick={() => {
                  sound.playNom();
                  onResetBiome();
                  setShowResetConfirm(false);
                }}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs font-mono shadow-md cursor-pointer"
              >
                Reset to Default
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
