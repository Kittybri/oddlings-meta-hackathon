/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CreatureDNA } from '../game/creatureTypes';
import { OddlingAvatar } from './OddlingAvatar';
import { sound } from '../game/soundSynth';
import { collectCreatureSemanticText, detectUtensilOrToolType, repairObjectVisualPlan } from '../game/creatureRules';

interface AwakenModalProps {
  creature: CreatureDNA;
  onConfirm: () => void;
}

export const AwakenModal: React.FC<AwakenModalProps> = ({
  creature,
  onConfirm
}) => {
  const plan = repairObjectVisualPlan(creature.appearance.visualPlan, creature.sourceObject.name);
  const semanticText = collectCreatureSemanticText(creature);
  const detectedUtensil = detectUtensilOrToolType(semanticText);

  const anatomyParts: string[] = [];
  if (plan) {
    if (plan.archetype === 'cup') anatomyParts.push('Vessel Chassis');
    else if (plan.archetype === 'cactus') anatomyParts.push('Segmented Stem');
    else if (plan.archetype === 'lamp') anatomyParts.push('Articulated Stem & Shade');
    else if (plan.archetype === 'headphones') anatomyParts.push('Padded Earcups');
    else if (plan.archetype === 'teapot') anatomyParts.push('Spout & Pot');
    else if (plan.archetype === 'honey_jar') anatomyParts.push('Glass Jar');
    else if (plan.archetype === 'pocket_watch') anatomyParts.push('Clockwork Dial');
    else if (plan.archetype === 'lemon') anatomyParts.push('Citrus Rind');
    else if (plan.archetype === 'compositional') {
      if (detectedUtensil === 'computer_mouse') {
        anatomyParts.push('Dual-Click Buttons & Tactile Scroll Wheel');
        anatomyParts.push('Ergonomic Domed Chassis & USB Cord');
      } else if (detectedUtensil === 'fork') {
        anatomyParts.push('Four-Prong Fork Head & Silver Handle');
      } else if (detectedUtensil === 'spoon') {
        anatomyParts.push('Curved Spoon Bowl & Ergonomic Grip');
      } else if (detectedUtensil === 'knife') {
        anatomyParts.push('Beveled Cutting Blade & Bolster');
      } else if (detectedUtensil === 'keys') {
        anatomyParts.push('Brass Bow Ring & Notched Tines');
      } else if (detectedUtensil === 'footwear') {
        anatomyParts.push('Cushioned Sole & Tied Laces');
      } else if (detectedUtensil === 'bag') {
        anatomyParts.push('Durable Pouch & Shoulder Straps');
      } else {
        const cat = plan.compositional?.category || creature.sourceObject.name;
        anatomyParts.push(`${cat.replace('_', ' ')} Anatomy`);
      }
    } else {
      anatomyParts.push('Curio Relic');
    }

    if (plan.definingParts?.hasHandle) anatomyParts.push('Curved Handle');
    if (plan.definingParts?.hasRim) anatomyParts.push('Open Rim');
    if (plan.definingParts?.hasSpines) anatomyParts.push('Defensive Spines');
    if (plan.definingParts?.hasSteam) anatomyParts.push('Aromatic Steam');
    if (plan.definingParts?.hasLid) anatomyParts.push('Removable Lid');
  }

  const categoryName = detectedUtensil === 'computer_mouse'
    ? 'ELECTRONICS'
    : detectedUtensil === 'fork'
    ? 'FORK'
    : plan?.compositional?.category || creature.sourceObject.name || 'Object';
  const archetypeLabel = detectedUtensil === 'computer_mouse'
    ? 'ELECTRONICS ANATOMY'
    : plan?.archetype === 'compositional'
    ? `${categoryName.replace('_', ' ').toUpperCase()} ANATOMY`
    : plan?.archetype
    ? `${plan.archetype.replace('_', ' ').toUpperCase()} ANATOMY`
    : 'OBJECT-GROUNDED ANATOMY';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 select-none overflow-y-auto">
      <div className="relative w-full max-w-lg bg-gradient-to-b from-slate-900 to-slate-950 border border-amber-500/50 rounded-3xl p-6 sm:p-7 shadow-[0_0_60px_rgba(245,158,11,0.3)] text-center flex flex-col items-center animate-in fade-in zoom-in-95 duration-300">
        {/* Glow halo */}
        <div className="absolute -top-12 w-28 h-28 bg-amber-500/20 rounded-full blur-2xl pointer-events-none" />

        <span className="text-xs font-mono uppercase tracking-widest text-amber-400 font-bold mb-1">
          ✨ SPECIES AWAKENED ✨
        </span>

        {/* Side-by-Side: Source Object -> Living Creature */}
        <div className="w-full my-4 p-4 rounded-2xl bg-slate-950/80 border border-slate-800 grid grid-cols-11 items-center gap-2">
          {/* Left: Source Object */}
          <div className="col-span-5 flex flex-col items-center text-center p-2 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold mb-2">
              Source Object
            </span>
            <div className="w-24 h-24 rounded-xl overflow-hidden bg-slate-950 border border-slate-700/80 flex items-center justify-center shadow-inner">
              {creature.sourceObject.userPhotoUrl ? (
                <img
                  src={creature.sourceObject.userPhotoUrl}
                  alt={creature.sourceObject.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-300 text-xs p-2">
                  <span className="text-3xl mb-1">
                    {creature.primaryElement === 'Ceramic' ? '☕' : creature.primaryElement === 'Botanical' ? '🌵' : creature.primaryElement === 'Electric' ? '💡' : creature.primaryElement === 'Sonic' ? '🎧' : '🏺'}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 truncate max-w-[80px]">
                    {creature.sourceObject.category}
                  </span>
                </div>
              )}
            </div>
            <span className="text-xs font-bold text-slate-200 mt-2 truncate max-w-full">
              {creature.sourceObject.name}
            </span>
            <span className="text-[10px] font-mono text-slate-400 truncate max-w-full">
              {creature.sourceObject.material}
            </span>
          </div>

          {/* Center: Conduit Arrow */}
          <div className="col-span-1 flex flex-col items-center justify-center text-amber-400">
            <span className="text-sm font-bold animate-pulse">➔</span>
            <span className="text-[9px] font-mono text-amber-500/80 mt-1">GEN</span>
          </div>

          {/* Right: Living Oddling */}
          <div className="col-span-5 flex flex-col items-center text-center p-2 rounded-xl bg-gradient-to-b from-amber-500/10 to-slate-900/60 border border-amber-500/30">
            <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold mb-2">
              Living Oddling
            </span>
            <div className="w-24 h-24 flex items-center justify-center cursor-pointer" onClick={() => sound.playChirp(700)}>
              <OddlingAvatar
                creature={creature}
                size={100}
                mood="excited"
                showAura={false}
              />
            </div>
            <span className="text-xs font-bold text-amber-300 mt-2 truncate max-w-full font-['Space_Grotesk']">
              {creature.name}
            </span>
            <span className="text-[10px] font-mono text-cyan-300 truncate max-w-full">
              {creature.speciesName}
            </span>
          </div>
        </div>

        {/* Compact Anatomy & Provenance Readout */}
        <div className="w-full bg-slate-950/60 px-3.5 py-2.5 rounded-xl border border-slate-800 text-left space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-amber-400 font-bold flex items-center gap-1.5">
              <span>🧬</span>
              <span>{archetypeLabel}</span>
            </span>
            <span className="text-slate-400">
              {creature.provenance === 'user_upload_manual'
                ? 'Direct Object Selection'
                : creature.provenance === 'ai_extracted'
                ? 'Meta Muse Spark Vision'
                : 'Living Preset Specimen'}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {anatomyParts.map((part, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded-md bg-slate-800/90 border border-slate-700 text-[10px] text-slate-300 font-mono"
              >
                {part}
              </span>
            ))}
            <span className="px-2 py-0.5 rounded-md bg-amber-950/40 border border-amber-800/60 text-[10px] text-amber-300 font-mono">
              Surface: {plan?.materialSurface.finish || creature.sourceObject.material}
            </span>
          </div>
        </div>

        {/* Name and Title */}
        <div className="mt-3">
          <h3 className="text-xl font-extrabold text-slate-100 font-['Space_Grotesk'] tracking-tight">
            {creature.name}
          </h3>
          <p className="text-xs text-slate-300 font-medium mt-0.5 max-w-sm">
            {creature.title}
          </p>
        </div>

        {/* Ability Badge */}
        <div className="w-full bg-slate-950/80 p-3 rounded-xl border border-slate-800 mt-3 text-left">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-bold text-amber-400 flex items-center gap-1.5">
              <span>{creature.specialAbility.icon}</span>
              <span>{creature.specialAbility.name}</span>
            </span>
            <span className="font-mono text-pink-400 font-bold">
              {creature.specialAbility.powerRating} PWR
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            {creature.specialAbility.description}
          </p>
        </div>

        {/* CTA Button */}
        <button
          onClick={() => {
            sound.playFanfare();
            onConfirm();
          }}
          className="w-full mt-4 py-3.5 px-6 rounded-xl bg-gradient-to-r from-amber-500 to-pink-500 hover:from-amber-400 hover:to-pink-400 text-slate-950 font-bold text-sm tracking-wide shadow-[0_0_30px_rgba(245,158,11,0.4)] transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center gap-2"
        >
          <span>🌿</span>
          <span>ENTER HABITAT WITH {creature.name.toUpperCase()}</span>
        </button>
      </div>
    </div>
  );
};
