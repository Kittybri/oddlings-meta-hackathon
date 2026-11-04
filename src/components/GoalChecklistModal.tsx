/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { FirstRunGoals, CreatureDNA } from '../game/creatureTypes';

interface GoalChecklistModalProps {
  goals: FirstRunGoals;
  creatures: CreatureDNA[];
  onClose: () => void;
  onNavigate: (mode: 'incubator' | 'scanner' | 'fusion' | 'habitat') => void;
}

export const GoalChecklistModal: React.FC<GoalChecklistModalProps> = ({
  goals,
  creatures,
  onClose,
  onNavigate
}) => {
  const completedCount =
    (goals.discoveredTwo ? 1 : 0) +
    (goals.caredForOddling ? 1 : 0) +
    (goals.fusedSpecies ? 1 : 0) +
    (goals.builtBiomeHome ? 1 : 0);
  const allComplete = completedCount === 4;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-xl text-amber-400">
              🎯
            </div>
            <div>
              <h3 className="text-lg font-bold font-['Space_Grotesk'] text-slate-100 flex items-center gap-2">
                <span>FIRST-RUN GOALS</span>
                <span className="text-xs px-2 py-0.5 rounded bg-amber-950 text-amber-300 font-mono border border-amber-800">
                  {completedCount} / 4 COMPLETED
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Master the core vertical slice of ODDLINGS: Scan, Care, Fuse, and Sandbox Biome Building.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition-colors"
          >
            ✕ CLOSE
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800">
          <div
            className="h-full bg-gradient-to-r from-amber-400 via-pink-500 to-cyan-400 transition-all duration-500"
            style={{ width: `${(completedCount / 4) * 100}%` }}
          />
        </div>

        {/* Goals Checklist Items */}
        <div className="space-y-3">
          {/* Goal 1 */}
          <div className={`p-4 rounded-xl border transition-all flex items-start gap-3.5 ${
            goals.discoveredTwo
              ? 'bg-emerald-950/30 border-emerald-500/40 text-slate-200'
              : 'bg-slate-950/60 border-slate-800 text-slate-400'
          }`}>
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
              goals.discoveredTwo ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-500'
            }`}>
              {goals.discoveredTwo ? '✓' : '1'}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-200">1. Discover Two Everyday Objects</span>
                {goals.discoveredTwo ? (
                  <span className="text-[11px] font-mono text-emerald-400 font-bold">COMPLETED</span>
                ) : (
                  <button
                    onClick={() => { onClose(); onNavigate('incubator'); }}
                    className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-300 hover:bg-amber-900 border border-amber-800 cursor-pointer"
                  >
                    Open Incubator →
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                Photograph everyday items and incubate eggs to discover 2 new specimens (seed demo creatures do not count).
              </p>
            </div>
          </div>

          {/* Goal 2 */}
          <div className={`p-4 rounded-xl border transition-all flex items-start gap-3.5 ${
            goals.caredForOddling
              ? 'bg-emerald-950/30 border-emerald-500/40 text-slate-200'
              : 'bg-slate-950/60 border-slate-800 text-slate-400'
          }`}>
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
              goals.caredForOddling ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-500'
            }`}>
              {goals.caredForOddling ? '✓' : '2'}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-200">2. Care for an Oddling</span>
                {goals.caredForOddling ? (
                  <span className="text-[11px] font-mono text-emerald-400 font-bold">COMPLETED</span>
                ) : (
                  <button
                    onClick={() => { onClose(); onNavigate('habitat'); }}
                    className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-300 hover:bg-amber-900 border border-amber-800 cursor-pointer"
                  >
                    Enter Habitat →
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                Pet, drop a treat, fling the toy, or rest an Oddling in the habitat.
              </p>
            </div>
          </div>

          {/* Goal 3 */}
          <div className={`p-4 rounded-xl border transition-all flex items-start gap-3.5 ${
            goals.fusedSpecies
              ? 'bg-emerald-950/30 border-emerald-500/40 text-slate-200'
              : 'bg-slate-950/60 border-slate-800 text-slate-400'
          }`}>
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
              goals.fusedSpecies ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-500'
            }`}>
              {goals.fusedSpecies ? '✓' : '3'}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-200">3. Fuse a New Species</span>
                {goals.fusedSpecies ? (
                  <span className="text-[11px] font-mono text-emerald-400 font-bold">COMPLETED</span>
                ) : (
                  <button
                    onClick={() => { onClose(); onNavigate('fusion'); }}
                    className="text-[11px] font-mono px-2 py-0.5 rounded bg-pink-950 text-pink-300 hover:bg-pink-900 border border-pink-800 cursor-pointer"
                  >
                    Open Fusion Lab →
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                Combine two parent specimens in the Creature Fusion Lab to synthesize a Generation 2+ hybrid.
              </p>
            </div>
          </div>

          {/* Goal 4: Build a home for your Oddlings */}
          <div className={`p-4 rounded-xl border transition-all flex items-start gap-3.5 ${
            goals.builtBiomeHome
              ? 'bg-emerald-950/30 border-emerald-500/40 text-slate-200'
              : 'bg-slate-950/60 border-slate-800 text-slate-400'
          }`}>
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
              goals.builtBiomeHome ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-500'
            }`}>
              {goals.builtBiomeHome ? '✓' : '4'}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-200">4. Build a Home for your Oddlings</span>
                {goals.builtBiomeHome ? (
                  <span className="text-[11px] font-mono text-emerald-400 font-bold">COMPLETED</span>
                ) : (
                  <button
                    onClick={() => { onClose(); onNavigate('habitat'); }}
                    className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-300 hover:bg-amber-900 border border-amber-800 cursor-pointer"
                  >
                    Open Biome Editor →
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                Use the 2D Sandbox Editor to paint blocks, pool shallow water, or place cozy shelters, then save your habitat.
              </p>
            </div>
          </div>
        </div>

        {allComplete && (
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-pink-500/20 border border-amber-500/40 text-center">
            <span className="text-sm font-bold text-amber-300 block">🎉 ALL FIRST-RUN GOALS COMPLETE!</span>
            <span className="text-xs text-slate-300">You have verified the complete core gameplay loop of ODDLINGS.</span>
          </div>
        )}

        {/* Bottom CTA */}
        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs font-mono transition-colors"
        >
          CONTINUE EXPLORING
        </button>
      </div>
    </div>
  );
};
