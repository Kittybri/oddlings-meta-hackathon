/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  createSaveBundle, 
  validateAndParseSaveBundle, 
  applySaveBundle, 
  downloadSaveBundle, 
  restorePreviousSnapshot, 
  hasPreRestoreSnapshot, 
  getPreRestoreSnapshotTimestamp,
  OddlingsSaveBundleV1, 
  SaveBundlePreview 
} from '../game/storage';
import { CreatureDNA, IncubatorEgg } from '../game/creatureTypes';
import { sound } from '../game/soundSynth';

interface SaveRestoreModalProps {
  creatures: CreatureDNA[];
  activeEgg: IncubatorEgg | null;
  onRestoreSuccess: (bundle: OddlingsSaveBundleV1) => void;
  onClose: () => void;
}

export const SaveRestoreModal: React.FC<SaveRestoreModalProps> = ({
  creatures,
  activeEgg,
  onRestoreSuccess,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'download' | 'restore'>('download');
  const [autoBackupBeforeRestore, setAutoBackupBeforeRestore] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Parsed candidate bundle and preview state
  const [candidateFile, setCandidateFile] = useState<File | null>(null);
  const [candidateBundle, setCandidateBundle] = useState<OddlingsSaveBundleV1 | null>(null);
  const [candidatePreview, setCandidatePreview] = useState<SaveBundlePreview | null>(null);

  // Undo snapshot state
  const [hasSnapshot, setHasSnapshot] = useState(() => hasPreRestoreSnapshot());
  const [snapshotTimestamp, setSnapshotTimestamp] = useState<number | null>(() => getPreRestoreSnapshotTimestamp());

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generate current local save preview for download tab
  const currentBundle = createSaveBundle({ creatures, activeEgg });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleDownloadCurrent = () => {
    sound.playClick();
    downloadSaveBundle(currentBundle);
    setSuccessMessage('Save file downloaded! Keep it safe for moving between devices or accounts.');
    setTimeout(() => setSuccessMessage(null), 6000);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setCandidateBundle(null);
    setCandidatePreview(null);

    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json') && file.type !== 'application/json' && file.type !== '') {
      setErrorMessage('Please select a valid .json save file.');
      return;
    }

    setCandidateFile(file);
    const reader = new FileReader();

    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text !== 'string') {
        setErrorMessage('Failed to read file contents.');
        return;
      }

      const result = validateAndParseSaveBundle(text);
      if (!result.success) {
        sound.playBreakTile();
        setErrorMessage(result.error);
        setCandidateBundle(null);
        setCandidatePreview(null);
      } else {
        sound.playChirp();
        setCandidateBundle(result.bundle);
        setCandidatePreview(result.preview);
      }
    };

    reader.onerror = () => {
      sound.playBreakTile();
      setErrorMessage('Failed to read file from disk.');
    };

    reader.readAsText(file);
  };

  const handleConfirmRestore = () => {
    if (!candidateBundle) return;
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      // 1. Optional automatic backup download of current save before replacing
      if (autoBackupBeforeRestore) {
        const dateStr = new Date().toISOString().split('T')[0];
        downloadSaveBundle(currentBundle, `oddlings-pre-restore-backup-${dateStr}.json`);
      }

      // 2. Atomically apply the validated save bundle
      const result = applySaveBundle(candidateBundle);
      if (!result.success) {
        sound.playBreakTile();
        setErrorMessage(result.error);
        setIsProcessing(false);
        return;
      }

      // 3. Play success fanfare, update undo snapshot state, and sync parent state
      sound.playFanfare();
      setHasSnapshot(true);
      setSnapshotTimestamp(Date.now());
      setSuccessMessage('Save restored successfully! All creatures, biomes, and progression are loaded.');

      onRestoreSuccess(candidateBundle);
      setIsProcessing(false);
    } catch (err: any) {
      sound.playBreakTile();
      setErrorMessage(err?.message || 'An unexpected error occurred during restore.');
      setIsProcessing(false);
    }
  };

  const handleUndoRestore = () => {
    setIsProcessing(true);
    setErrorMessage(null);

    const result = restorePreviousSnapshot();
    if (!result.success) {
      sound.playBreakTile();
      setErrorMessage(result.error);
      setIsProcessing(false);
      return;
    }

    sound.playFanfare();
    setHasSnapshot(false);
    setSnapshotTimestamp(null);
    setSuccessMessage('Rollback complete! Your previous game save has been restored.');

    if (result.restoredBundle) {
      onRestoreSuccess(result.restoredBundle);
    }
    setIsProcessing(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border-2 border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden font-sans">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-950/80 border border-cyan-500/50 flex items-center justify-center text-xl text-cyan-300 shadow-inner">
              💾
            </div>
            <div>
              <h2 className="text-lg font-bold font-['Space_Grotesk'] text-slate-100 flex items-center gap-2">
                <span>PORTABLE SAVE & RESTORE</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 font-mono border border-cyan-800">
                  V1 BUNDLE
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Safely transfer your discovered Oddlings, custom biomes, and progression across browsers.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 transition-colors cursor-pointer text-sm font-mono"
            title="Close [ESC]"
          >
            ✕
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center gap-2 px-6 pt-4 bg-slate-900/90 border-b border-slate-800">
          <button
            onClick={() => {
              sound.playClick();
              setActiveTab('download');
              setErrorMessage(null);
            }}
            className={`px-4 py-2 text-xs font-mono font-bold rounded-t-xl transition-all cursor-pointer flex items-center gap-2 border-t border-x ${
              activeTab === 'download'
                ? 'bg-slate-950 text-cyan-300 border-slate-700 -mb-[1px] pb-2.5 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-800/50'
            }`}
          >
            <span>📥</span>
            <span>DOWNLOAD SAVE</span>
          </button>

          <button
            onClick={() => {
              sound.playClick();
              setActiveTab('restore');
              setErrorMessage(null);
            }}
            className={`px-4 py-2 text-xs font-mono font-bold rounded-t-xl transition-all cursor-pointer flex items-center gap-2 border-t border-x ${
              activeTab === 'restore'
                ? 'bg-slate-950 text-cyan-300 border-slate-700 -mb-[1px] pb-2.5 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-800/50'
            }`}
          >
            <span>📤</span>
            <span>RESTORE FROM FILE</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 bg-slate-950">
          {/* Notification Banners */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-700 text-red-200 text-xs font-mono flex items-start gap-2.5 shadow-md">
              <span className="text-sm">⚠️</span>
              <div className="flex-1 leading-relaxed">{errorMessage}</div>
              <button 
                onClick={() => setErrorMessage(null)} 
                className="text-red-400 hover:text-red-100 font-bold ml-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-600 text-emerald-200 text-xs font-mono flex items-start gap-2.5 shadow-md animate-in fade-in">
              <span className="text-sm">✅</span>
              <div className="flex-1 leading-relaxed">{successMessage}</div>
              <button 
                onClick={() => setSuccessMessage(null)} 
                className="text-emerald-400 hover:text-emerald-100 font-bold ml-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* TAB 1: DOWNLOAD SAVE */}
          {activeTab === 'download' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
                <div className="text-xs font-mono text-cyan-400 font-semibold uppercase tracking-wider flex items-center gap-2">
                  <span>📦</span>
                  <span>CURRENT BROWSER SAVE CONTENTS</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-center">
                    <div className="text-lg font-bold font-mono text-amber-400 tabular-nums">
                      {creatures.length}
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 mt-0.5">Creatures</div>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-center">
                    <div className="text-lg font-bold font-mono text-emerald-400 tabular-nums">
                      {Object.keys(currentBundle.biomeWorlds).length || 3}
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 mt-0.5">Biomes</div>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-center">
                    <div className="text-lg font-bold font-mono text-pink-400">
                      {activeEgg ? (activeEgg.hatchAt <= Date.now() ? 'READY' : 'ACTIVE') : 'NONE'}
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 mt-0.5">Incubator Egg</div>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-center">
                    <div className="text-lg font-bold font-mono text-cyan-400 tabular-nums">
                      {currentBundle.onboarding.discoveredObjectCreatureIds.length}
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 mt-0.5">Real Discoveries</div>
                  </div>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed pt-1">
                  Exports a self-contained JSON archive with your complete bestiary (custom silhouettes, visual plans, original photos, genetic lineages, and memories), world editor tiles, active incubator timer, and checklist progress.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <button
                  onClick={handleDownloadCurrent}
                  className="w-full sm:w-auto flex-1 py-3 px-6 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold font-mono text-xs uppercase tracking-wider shadow-lg hover:shadow-cyan-500/20 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>💾</span>
                  <span>DOWNLOAD SAVE (.JSON)</span>
                </button>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/80 text-[11px] font-mono text-slate-400 flex items-start gap-2">
                <span className="text-xs">🔒</span>
                <span>
                  Privacy guarantee: Exports only explicit ODDLINGS game keys. Never inspects or includes API keys, server secrets, credentials, or unrelated browser storage.
                </span>
              </div>
            </div>
          )}

          {/* TAB 2: RESTORE FROM FILE */}
          {activeTab === 'restore' && (
            <div className="space-y-4">
              {/* File Input Box */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-cyan-500 rounded-xl p-6 text-center cursor-pointer transition-colors bg-slate-900/40 hover:bg-slate-900/80 group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">📂</div>
                <div className="text-xs font-mono font-semibold text-slate-200">
                  {candidateFile ? candidateFile.name : 'Click to select or drop an ODDLINGS save file'}
                </div>
                <div className="text-[11px] font-mono text-slate-500 mt-1">
                  Supports versioned .json save files (Max 10MB)
                </div>
              </div>

              {/* Restore Candidate Preview */}
              {candidatePreview && candidateBundle && (
                <div className="p-4 rounded-xl bg-slate-900/90 border border-cyan-800/50 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="text-xs font-mono text-cyan-300 font-bold uppercase tracking-wider flex items-center gap-2">
                      <span>🔍</span>
                      <span>SAVE FILE PREVIEW</span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-400">
                      Exported: {candidatePreview.exportedAtFormatted}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-center">
                      <div className="text-base font-bold font-mono text-amber-400 tabular-nums">
                        {candidatePreview.creatureCount}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">Species Discovered</div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-center">
                      <div className="text-base font-bold font-mono text-emerald-400 tabular-nums">
                        {candidatePreview.biomeCount}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">Custom Biomes</div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-center">
                      <div className="text-base font-bold font-mono text-pink-400 uppercase">
                        {candidatePreview.eggStatus}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">
                        {candidatePreview.eggTimeRemainingFormatted || 'No Egg'}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-center">
                      <div className="text-base font-bold font-mono text-cyan-400 tabular-nums">
                        {candidatePreview.completedGoalsCount}/4
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">Goals Completed</div>
                    </div>
                  </div>

                  {/* Wallet, adventure and diary, so players can see their progress before replacing it */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px] font-mono">
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                      <div className="text-slate-400">Wallet</div>
                      <div className="text-emerald-300 font-bold">{candidatePreview.walletSummary || 'Not in this save'}</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                      <div className="text-slate-400">Garden Adventure</div>
                      <div className="text-amber-300 font-bold">
                        {candidatePreview.adventureRewardClaimed
                          ? 'Completed, reward claimed'
                          : candidatePreview.adventureStep
                          ? candidatePreview.adventureStep.replace(/_/g, ' ')
                          : 'Not in this save'}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                      <div className="text-slate-400">Diary</div>
                      <div className="text-pink-300 font-bold">{(candidatePreview.diaryCount ?? 0) + ' pages'}</div>
                    </div>
                  </div>
                  {candidatePreview.missingParts && candidatePreview.missingParts.length > 0 && (
                    <div className="text-[11px] font-mono text-amber-300/90">
                      This is an older save without {candidatePreview.missingParts.join(', ')}. Restoring keeps a fresh start for those.
                    </div>
                  )}

                  {candidatePreview.creatureNames.length > 0 && (
                    <div className="text-[11px] font-mono text-slate-400">
                      <span className="text-slate-300 font-bold">Includes: </span>
                      {candidatePreview.creatureNames.join(', ')}
                      {candidatePreview.creatureCount > candidatePreview.creatureNames.length && ' ...'}
                    </div>
                  )}

                  {/* Warning & Safety Controls */}
                  <div className="pt-2 border-t border-slate-800/80 space-y-2.5">
                    <div className="text-[11px] font-mono text-amber-300/90 flex items-start gap-2">
                      <span className="text-xs">⚠️</span>
                      <span>
                        Restoring will replace this browser's current game save with the contents of this file.
                      </span>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer text-xs font-mono text-slate-300 hover:text-slate-100 select-none">
                      <input
                        type="checkbox"
                        checked={autoBackupBeforeRestore}
                        onChange={(e) => setAutoBackupBeforeRestore(e.target.checked)}
                        className="rounded border-slate-700 text-cyan-500 focus:ring-0 bg-slate-950"
                      />
                      <span>Automatically download current save backup before replacing</span>
                    </label>

                    <button
                      onClick={handleConfirmRestore}
                      disabled={isProcessing}
                      className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-slate-950 font-bold font-mono text-xs uppercase tracking-wider shadow-lg hover:shadow-emerald-500/20 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <span>🔄</span>
                      <span>{isProcessing ? 'RESTORING GAME...' : 'CONFIRM & RESTORE GAME'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Undo Restore Recovery Section */}
              {hasSnapshot && (
                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="text-xs font-mono text-amber-400 font-bold flex items-center gap-1.5">
                      <span>⏪</span>
                      <span>PREVIOUS SAVE SNAPSHOT AVAILABLE</span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-400">
                      {snapshotTimestamp ? `Backed up on ${new Date(snapshotTimestamp).toLocaleTimeString()}` : 'Cached pre-restore snapshot'}
                    </div>
                  </div>

                  <button
                    onClick={handleUndoRestore}
                    disabled={isProcessing}
                    className="py-1.5 px-3 rounded-lg bg-amber-950 hover:bg-amber-900 border border-amber-700 text-amber-300 text-xs font-mono font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-50"
                    title="Revert to state before last restore"
                  >
                    UNDO RESTORE
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 bg-slate-950 text-[11px] font-mono text-slate-500">
          <div>ODDLINGS SAVE PROTOCOL V1</div>
          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            Close [ESC]
          </button>
        </div>

      </div>
    </div>
  );
};
