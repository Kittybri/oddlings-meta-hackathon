/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { OddlingAvatar } from './OddlingAvatar';
import { getCustomBiomesList } from '../game/customBiomeStorage';
import { normalizeHome } from '../game/worldRegions';
import { sound } from '../game/soundSynth';
import { CustomBiomeRecord } from '../game/biomeWorldTypes';
import { CreatureDNA } from '../game/creatureTypes';
import { renameCustomBiome, safelyDeleteCustomBiome } from '../game/customBiomeStorage';

interface ManageBiomeModalProps {
  biome: CustomBiomeRecord;
  residentCount: number;
  creatures: CreatureDNA[];
  onUpdateCreatures: (updated: CreatureDNA[]) => void;
  onBiomeRenamed: (biomeId: string, newName: string) => void;
  onBiomeDeleted: (biomeId: string) => void;
  onClose: () => void;
}

export const ManageBiomeModal: React.FC<ManageBiomeModalProps> = ({
  biome,
  residentCount,
  creatures,
  onUpdateCreatures,
  onBiomeRenamed,
  onBiomeDeleted,
  onClose
}) => {
  const [selected, setSelected] = useState(() => new Set(creatures.filter(c => normalizeHome(c.biomeId) === biome.id).map(c => c.id)));
  const [residentMessage, setResidentMessage] = useState('');
  const [name, setName] = useState(biome.name);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleRename = () => {
    const trimmed = name.trim().slice(0, 32);
    if (!trimmed || trimmed === biome.name) return;
    sound.playClick();
    const success = renameCustomBiome(biome.id, trimmed);
    if (success) {
      onBiomeRenamed(biome.id, trimmed);
      onClose();
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    sound.playBounce();
    try {
      await safelyDeleteCustomBiome(biome.id, creatures, onUpdateCreatures);
      onBiomeDeleted(biome.id);
      onClose();
    } catch (err) {
      console.error('Failed to delete biome:', err);
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
      <div 
        onClick={(e) => e.stopPropagation()}
        role="dialog" aria-modal="true" aria-label="Manage biome" className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-700/80 rounded-2xl p-5 shadow-2xl font-sans"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚙️</span>
            <h3 className="text-base font-bold text-slate-100 font-['Space_Grotesk']">
              Manage Custom Biome
            </h3>
          </div>
          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-xs"
          >
            ✕
          </button>
        </div>

        {!isConfirmingDelete ? (
          <div className="py-4 space-y-4">
            {/* Rename Input */}
            <div>
              <label className="block text-xs font-mono font-semibold text-slate-300 mb-1.5 uppercase">
                Rename Biome
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={name}
                  maxLength={32}
                  onChange={(e) => setName(e.target.value)}
                  className="flex-1 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-sm font-medium focus:outline-none focus:border-cyan-400"
                />
                <button
                  disabled={!name.trim() || name.trim() === biome.name}
                  onClick={handleRename}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-mono text-xs font-bold transition-all cursor-pointer disabled:cursor-not-allowed"
                >
                  Save
                </button>
              </div>
            </div>

            {/* Resident Information */}
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs font-mono text-slate-300 flex items-center justify-between">
              <span>Current Residents:</span>
              <span className="px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-700 text-cyan-300 font-bold">
                {residentCount} Oddling{residentCount === 1 ? '' : 's'}
              </span>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-bold text-cyan-200">Choose residents</legend>
              <p className="text-xs text-slate-400">Checked companions move here. Unchecked current residents return to World.</p>
              <div className="max-h-60 overflow-y-auto space-y-1">
                {creatures.map(c => <label key={c.id} className="flex items-center gap-2 p-2 rounded-xl bg-slate-950 cursor-pointer">
                  <input type="checkbox" checked={selected.has(c.id)} onChange={e => { setResidentMessage(''); setSelected(prev => { const next = new Set(prev); e.target.checked ? next.add(c.id) : next.delete(c.id); return next; }); }} />
                  <OddlingAvatar creature={c} size={40} />
                  <span className="text-xs text-slate-200">{c.name}<span className="block text-[10px] text-slate-400">{normalizeHome(c.biomeId) === 'greenhouse' ? 'World' : getCustomBiomesList().find(b => b.id === c.biomeId)?.name || 'Another biome'}</span></span>
                </label>)}
              </div>
              <button onClick={() => { onUpdateCreatures(creatures.map(c => selected.has(c.id) ? { ...c, biomeId: biome.id, worldRegion: 0 } : normalizeHome(c.biomeId) === biome.id ? { ...c, biomeId: 'greenhouse', worldRegion: 0 } : c)); setResidentMessage('Residents updated.'); }} className="w-full rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs py-2">Apply Residents ({selected.size})</button>
              <p role="status" className="text-xs text-emerald-300">{residentMessage}</p>
            </fieldset>
            {/* Delete Trigger */}
            <div className="pt-2 border-t border-slate-800/80">
              <button
                onClick={() => {
                  sound.playClick();
                  setIsConfirmingDelete(true);
                }}
                className="w-full py-2 px-3 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800/60 text-rose-300 text-xs font-mono font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>🗑️</span>
                <span>Remove Biome...</span>
              </button>
            </div>
          </div>
        ) : (
          /* Safe Removal Confirmation View */
          <div className="py-4 space-y-4">
            <div className="p-3.5 rounded-xl bg-amber-950/60 border border-amber-600/70 text-amber-200 text-xs font-mono space-y-2">
              <div className="font-bold flex items-center gap-1.5 text-amber-300">
                <span>⚠️</span>
                <span>Safe Removal Guarantee</span>
              </div>
              <p>
                Are you sure you want to remove <span className="font-bold text-white">"{biome.name}"</span>?
              </p>
              <p className="text-[11px] text-amber-300/90 leading-relaxed">
                {residentCount > 0 ? (
                  <>
                    All <span className="font-bold text-white">{residentCount} resident Oddlings</span> will safely return home to the <span className="font-bold text-white">World</span> biome. No creatures will ever be deleted.
                  </>
                ) : (
                  <>This biome currently has no residents. Its terrain and background will be safely purged.</>
                )}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                disabled={isDeleting}
                onClick={() => setIsConfirmingDelete(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={isDeleting}
                onClick={handleDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <span>{isDeleting ? '⏳' : '🗑️'}</span>
                <span>{isDeleting ? 'Removing...' : 'Confirm Safe Removal'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
