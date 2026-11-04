/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { IncubatorEgg } from '../game/creatureTypes';
import { PixelEgg } from './PixelEgg';
import { OddlingAvatar } from './OddlingAvatar';

interface IncubatorMachineProps {
  activeEgg: IncubatorEgg | null;
  isReadyToHatch: boolean;
  hatchStep: number;
  isHatchedLocal: boolean;
  isWobbling: boolean;
  onMachineClick: () => void;
  onEggClick?: () => void;
  className?: string;
}

export const IncubatorMachine: React.FC<IncubatorMachineProps> = ({
  activeEgg,
  isReadyToHatch,
  hatchStep,
  isHatchedLocal,
  isWobbling,
  onMachineClick,
  onEggClick,
  className = ''
}) => {
  const isEmpty = !activeEgg;

  return (
    <div
      className={`relative flex flex-col items-center justify-center select-none ${className}`}
    >
      {/* Interactive Machine Wrapper */}
      <div
        onClick={isEmpty ? onMachineClick : undefined}
        role={isEmpty ? 'button' : undefined}
        tabIndex={isEmpty ? 0 : undefined}
        onKeyDown={(e) => {
          if (isEmpty && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onMachineClick();
          }
        }}
        aria-label={isEmpty ? 'Incubator machine. Click to add a photo.' : 'Incubator machine.'}
        className={`relative group transition-all duration-300 focus:outline-none ${
          isEmpty ? 'cursor-pointer hover:scale-[1.02] active:scale-[0.99] focus-visible:ring-4 focus-visible:ring-amber-400 rounded-3xl' : ''
        }`}
        style={{ width: '100%', maxWidth: '360px' }}
      >
        {/* Soft Ambient Heat Aura */}
        <div
          className={`absolute inset-x-8 top-12 bottom-20 rounded-full blur-2xl pointer-events-none transition-all duration-700 ${
            isReadyToHatch
              ? 'bg-amber-400/40 animate-pulse'
              : !isEmpty
              ? 'bg-amber-500/25 animate-pulse'
              : 'bg-amber-500/15 group-hover:bg-amber-500/30'
          }`}
        />

        {/* 16-Bit Crisp Pixel Machine SVG */}
        <svg
          viewBox="0 0 280 340"
          className="w-full h-auto drop-shadow-2xl"
          style={{
            imageRendering: 'pixelated',
            shapeRendering: 'crispEdges'
          }}
        >
          <defs>
            {/* Soft glass reflection linear gradient */}
            <linearGradient id="glassSheen" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#bae6fd" stopOpacity="0.4" />
              <stop offset="35%" stopColor="#38bdf8" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="amberGlow" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* ================= BACKGROUND: LAB SHELF & COZY PLANTS ================= */}
          {/* Wood Workshop Shelf Beam */}
          <rect x="0" y="316" width="280" height="24" fill="#451a03" />
          <rect x="0" y="316" width="280" height="4" fill="#78350f" />
          <rect x="0" y="338" width="280" height="2" fill="#1c0a00" />
          {/* Wood grain pixels */}
          <rect x="24" y="322" width="40" height="2" fill="#5c2406" />
          <rect x="180" y="324" width="60" height="2" fill="#5c2406" />

          {/* Left Potted Succulent Plant */}
          <g transform="translate(6, 252)">
            {/* Terracotta pot */}
            <polygon points="4,42 24,42 21,64 7,64" fill="#c2410c" />
            <rect x="2" y="39" width="24" height="4" fill="#ea580c" />
            <rect x="4" y="43" width="20" height="2" fill="#7c2d12" />
            {/* Soil */}
            <rect x="6" y="38" width="16" height="2" fill="#291206" />
            {/* Leaves */}
            <rect x="11" y="24" width="6" height="15" fill="#15803d" />
            <rect x="12" y="22" width="4" height="3" fill="#22c55e" />
            <rect x="4" y="28" width="8" height="6" fill="#16a34a" />
            <rect x="16" y="27" width="8" height="7" fill="#16a34a" />
            <rect x="14" y="16" width="3" height="7" fill="#4ade80" />
            <rect x="6" y="34" width="4" height="2" fill="#14532d" />
          </g>

          {/* Right Alchemy Flasks */}
          <g transform="translate(244, 274)">
            {/* Little teal vial */}
            <rect x="2" y="14" width="8" height="28" fill="#0f172a" />
            <rect x="3" y="15" width="6" height="26" fill="#0284c7" opacity="0.8" />
            <rect x="4" y="22" width="4" height="18" fill="#38bdf8" />
            <rect x="3" y="12" width="6" height="3" fill="#78350f" />
            {/* Little amber jar */}
            <rect x="14" y="24" width="14" height="18" fill="#78350f" />
            <rect x="15" y="25" width="12" height="16" fill="#f59e0b" opacity="0.8" />
            <rect x="17" y="29" width="8" height="10" fill="#fde047" />
            <rect x="16" y="21" width="10" height="4" fill="#b45309" />
          </g>

          {/* ================= MACHINE: HEAVY CABLE & FEET ================= */}
          {/* Heavy ribbed cable from back */}
          <path
            d="M 12 300 Q 28 322 48 318"
            fill="none"
            stroke="#0f172a"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <path
            d="M 12 300 Q 28 322 48 318"
            fill="none"
            stroke="#334155"
            strokeWidth="5"
            strokeLinecap="round"
          />
          {/* Cable ribbed rings */}
          <rect x="18" y="304" width="3" height="5" fill="#64748b" />
          <rect x="26" y="311" width="3" height="5" fill="#64748b" />
          <rect x="36" y="315" width="3" height="5" fill="#64748b" />

          {/* Left Foot */}
          <rect x="46" y="305" width="34" height="13" fill="#0f172a" />
          <rect x="48" y="306" width="30" height="10" fill="#78350f" />
          <rect x="50" y="307" width="26" height="3" fill="#b45309" />
          <rect x="52" y="314" width="22" height="2" fill="#451a03" />

          {/* Right Foot */}
          <rect x="200" y="305" width="34" height="13" fill="#0f172a" />
          <rect x="202" y="306" width="30" height="10" fill="#78350f" />
          <rect x="204" y="307" width="26" height="3" fill="#b45309" />
          <rect x="206" y="314" width="22" height="2" fill="#451a03" />

          {/* ================= MACHINE: CHUNKY SIDE COILS ================= */}
          {/* Left Copper Coil Assembly */}
          <g transform="translate(18, 76)">
            {/* Top & Bottom Brackets */}
            <rect x="18" y="0" width="20" height="8" fill="#0f172a" />
            <rect x="20" y="1" width="16" height="6" fill="#b45309" />
            <rect x="18" y="104" width="20" height="8" fill="#0f172a" />
            <rect x="20" y="105" width="16" height="6" fill="#b45309" />
            {/* Glass Vacuum Cylinder */}
            <rect x="2" y="8" width="30" height="96" fill="#0f172a" />
            <rect x="4" y="10" width="26" height="92" fill="#0284c7" opacity="0.25" />
            <rect x="5" y="10" width="4" height="92" fill="#bae6fd" opacity="0.4" />
            {/* Copper Coils */}
            {[18, 36, 54, 72, 90].map((y) => (
              <g key={y}>
                <rect x="3" y={y} width="28" height="6" fill="#0f172a" />
                <rect x="4" y={y + 1} width="26" height="4" fill="#d97706" />
                <rect x="6" y={y + 1} width="16" height="2" fill="#fef08a" />
              </g>
            ))}
            {/* Glowing Amber Filament */}
            <rect
              x="15"
              y="12"
              width="4"
              height="88"
              fill={!isEmpty ? '#fde047' : '#f59e0b'}
              opacity={!isEmpty ? 0.9 : 0.6}
            />
          </g>

          {/* Right Copper Coil Assembly */}
          <g transform="translate(226, 76)">
            {/* Top & Bottom Brackets */}
            <rect x="0" y="0" width="20" height="8" fill="#0f172a" />
            <rect x="2" y="1" width="16" height="6" fill="#b45309" />
            <rect x="0" y="104" width="20" height="8" fill="#0f172a" />
            <rect x="2" y="105" width="16" height="6" fill="#b45309" />
            {/* Glass Vacuum Cylinder */}
            <rect x="6" y="8" width="30" height="96" fill="#0f172a" />
            <rect x="8" y="10" width="26" height="92" fill="#0284c7" opacity="0.25" />
            <rect x="9" y="10" width="4" height="92" fill="#bae6fd" opacity="0.4" />
            {/* Copper Coils */}
            {[18, 36, 54, 72, 90].map((y) => (
              <g key={y}>
                <rect x="7" y={y} width="28" height="6" fill="#0f172a" />
                <rect x="8" y={y + 1} width="26" height="4" fill="#d97706" />
                <rect x="10" y={y + 1} width="16" height="2" fill="#fef08a" />
              </g>
            ))}
            {/* Glowing Amber Filament */}
            <rect
              x="19"
              y="12"
              width="4"
              height="88"
              fill={!isEmpty ? '#fde047' : '#f59e0b'}
              opacity={!isEmpty ? 0.9 : 0.6}
            />
          </g>

          {/* ================= MACHINE: LOWER CREAM / BRASS CABINET ================= */}
          {/* Main Ivory/Cream Stepped Body */}
          <rect x="42" y="196" width="196" height="112" fill="#0f172a" />
          <rect x="44" y="198" width="192" height="108" fill="#fef3c7" />
          {/* Shading on right & bottom */}
          <rect x="230" y="198" width="6" height="108" fill="#fde68a" />
          <rect x="44" y="302" width="192" height="4" fill="#d97706" />

          {/* Heavy Brass Collar Band on Top of Cabinet */}
          <rect x="40" y="184" width="200" height="14" fill="#0f172a" />
          <rect x="42" y="185" width="196" height="11" fill="#b45309" />
          <rect x="44" y="186" width="192" height="4" fill="#f59e0b" />
          <rect x="44" y="194" width="192" height="2" fill="#78350f" />
          {/* Brass Rivets */}
          {[52, 78, 104, 130, 150, 176, 202, 226].map((x) => (
            <rect key={x} x={x} y="188" width="4" height="4" fill="#fef3c7" />
          ))}

          {/* Central Analog Gauge */}
          <g transform="translate(140, 246)">
            {/* Bezel */}
            <circle cx="0" cy="0" r="26" fill="#0f172a" />
            <circle cx="0" cy="0" r="24" fill="#b45309" />
            <circle cx="0" cy="0" r="22" fill="#f59e0b" />
            <circle cx="0" cy="0" r="19" fill="#fffbeb" />
            {/* Tick marks */}
            <line x1="0" y1="-16" x2="0" y2="-12" stroke="#78350f" strokeWidth="2" />
            <line x1="-12" y1="-10" x2="-9" y2="-7" stroke="#78350f" strokeWidth="2" />
            <line x1="12" y1="-10" x2="9" y2="-7" stroke="#78350f" strokeWidth="2" />
            <line x1="-15" y1="0" x2="-11" y2="0" stroke="#78350f" strokeWidth="2" />
            <line x1="15" y1="0" x2="11" y2="0" stroke="#78350f" strokeWidth="2" />
            {/* Gauge Needle */}
            <line
              x1="0"
              y1="0"
              x2={!isEmpty ? 10 : -8}
              y2={!isEmpty ? -12 : -11}
              stroke="#ef4444"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <circle cx="0" cy="0" r="3.5" fill="#78350f" />
          </g>

          {/* Left Control Column: Indicator LEDs */}
          <g transform="translate(68, 226)">
            {/* Indicator 1: Power/Ready (Green) */}
            <rect x="0" y="0" width="16" height="16" fill="#0f172a" />
            <rect x="2" y="2" width="12" height="12" fill="#14532d" />
            <rect x="4" y="4" width="8" height="8" fill="#22c55e" className="animate-pulse" />
            <rect x="5" y="5" width="2" height="2" fill="#ffffff" />
            {/* Indicator 2: Heat/Life (Amber) */}
            <rect x="0" y="24" width="16" height="16" fill="#0f172a" />
            <rect x="2" y="26" width="12" height="12" fill="#78350f" />
            <rect
              x="4"
              y="28"
              width="8"
              height="8"
              fill={!isEmpty ? '#f59e0b' : '#b45309'}
              className={!isEmpty ? 'animate-pulse' : ''}
            />
            <rect x="5" y="29" width="2" height="2" fill="#ffffff" />
          </g>

          {/* Right Control Column: Chunky Switches / Buttons */}
          <g transform="translate(196, 226)">
            {/* Red Punch Button */}
            <rect x="0" y="0" width="18" height="18" fill="#0f172a" />
            <rect x="2" y="2" width="14" height="14" fill="#991b1b" />
            <rect x="4" y="4" width="10" height="10" fill="#ef4444" />
            <rect x="5" y="5" width="3" height="3" fill="#fca5a5" />
            {/* Brass Toggle Switch */}
            <rect x="2" y="26" width="14" height="18" fill="#0f172a" />
            <rect x="4" y="28" width="10" height="14" fill="#78350f" />
            <rect x="6" y={!isEmpty ? 30 : 36} width="6" height="8" fill="#f59e0b" />
          </g>

          {/* Lower Vent Louvers */}
          <g transform="translate(100, 282)">
            {[0, 6, 12].map((y) => (
              <g key={y}>
                <rect x="0" y={y} width="80" height="3" fill="#0f172a" />
                <rect x="2" y={y + 1} width="76" height="1" fill="#78350f" />
              </g>
            ))}
          </g>

          {/* ================= MACHINE: GLASS BELL CHAMBER & CONTENTS ================= */}
          {/* Chamber Backplate / Interior Dark Space */}
          <path
            d="M 64 60 C 64 26, 88 16, 140 16 C 192 16, 216 26, 216 60 L 216 184 L 64 184 Z"
            fill="#090d16"
          />

          {/* Chamber Warmth Backlight Halo */}
          <path
            d="M 66 60 C 66 30, 90 20, 140 20 C 190 20, 214 30, 214 60 L 214 182 L 66 182 Z"
            fill="url(#amberGlow)"
          />

          {/* Warmed Stepped Pedestal Base */}
          <g transform="translate(90, 148)">
            {/* Stepped brass plinth */}
            <rect x="0" y="16" width="100" height="20" fill="#0f172a" />
            <rect x="2" y="18" width="96" height="16" fill="#78350f" />
            <rect x="4" y="19" width="92" height="4" fill="#b45309" />
            {/* Middle tier */}
            <rect x="10" y="8" width="80" height="10" fill="#0f172a" />
            <rect x="12" y="9" width="76" height="8" fill="#b45309" />
            <rect x="14" y="10" width="72" height="3" fill="#f59e0b" />
            {/* Velvet & Moss Cushion / Nest */}
            <rect x="18" y="0" width="64" height="10" fill="#0f172a" />
            <rect x="20" y="1" width="60" height="8" fill="#14532d" />
            <rect x="22" y="2" width="56" height="6" fill="#15803d" />
            {/* Gold braid rim on cushion */}
            <rect x="22" y="7" width="56" height="1.5" fill="#facc15" />
          </g>

          {/* Floating Warmth / Bubble Particles inside Glass */}
          {!isEmpty && (
            <g fill="#fef08a" opacity="0.6">
              <rect x="96" y="90" width="2" height="2" className="animate-ping" />
              <rect x="180" y="110" width="2" height="2" className="animate-pulse" />
              <rect x="110" y="55" width="2" height="2" className="animate-pulse" />
              <rect x="165" y="70" width="2" height="2" className="animate-ping" />
            </g>
          )}

          {/* Glass Bell Outer Wall (Dark Outline) */}
          <path
            d="M 64 60 C 64 24, 88 14, 140 14 C 192 14, 216 24, 216 60 L 216 184 L 64 184 Z"
            fill="none"
            stroke="#0f172a"
            strokeWidth="5"
          />

          {/* Glass Teal Tint & Sheen */}
          <path
            d="M 66 60 C 66 26, 90 16, 140 16 C 190 16, 214 26, 214 60 L 214 182 L 66 182 Z"
            fill="url(#glassSheen)"
          />

          {/* Left Glass Specular Reflection Streak */}
          <path
            d="M 76 68 C 76 40, 94 30, 126 24 L 132 26 C 104 32, 84 44, 84 68 L 84 176 L 76 176 Z"
            fill="#ffffff"
            opacity="0.25"
          />
          <rect x="88" y="74" width="3" height="96" fill="#ffffff" opacity="0.18" />

          {/* Right Glass Subtle Rim Glint */}
          <rect x="206" y="60" width="3" height="114" fill="#38bdf8" opacity="0.25" />

          {/* Top Brass Valve Knob & Finial */}
          <g transform="translate(130, 2)">
            <rect x="4" y="0" width="12" height="6" fill="#0f172a" />
            <rect x="5" y="1" width="10" height="4" fill="#f59e0b" />
            <rect x="7" y="6" width="6" height="8" fill="#0f172a" />
            <rect x="8" y="7" width="4" height="6" fill="#b45309" />
          </g>

          {/* ================= CHAMBER CONTENTS: EMPTY / EGG / HATCHED ================= */}
          {/* 1. Empty Waiting State */}
          {isEmpty && (
            <g transform="translate(140, 110)">
              {/* Soft pulsating glow beacon */}
              <circle cx="0" cy="0" r="16" fill="#f59e0b" opacity="0.2" className="animate-ping" />
              <circle cx="0" cy="0" r="10" fill="#fde047" opacity="0.4" className="animate-pulse" />
              {/* Cute 16-bit glowing star / question mark */}
              <rect x="-1" y="-6" width="2" height="12" fill="#fef08a" />
              <rect x="-6" y="-1" width="12" height="2" fill="#fef08a" />
              <rect x="-3" y="-3" width="6" height="6" fill="#ffffff" />
            </g>
          )}
        </svg>

        {/* Real Live React Interactive Elements Positioned on Pedestal */}
        {/* Active Incubating Egg */}
        {!isEmpty && !isHatchedLocal && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              if (onEggClick) onEggClick();
            }}
            className="absolute left-1/2 -translate-x-1/2 top-[78px] flex flex-col items-center cursor-pointer group"
            title={isReadyToHatch ? 'Click to Crack Open Egg!' : 'Click to gently tap the glass'}
          >
            <PixelEgg
              primaryColor={activeEgg.primaryColor}
              secondaryColor={activeEgg.secondaryColor}
              accentColor={activeEgg.accentColor}
              pattern={activeEgg.pattern}
              size={110}
              wobble={isWobbling || isReadyToHatch}
              isReadyToHatch={isReadyToHatch}
              crackStage={hatchStep}
            />
          </div>
        )}

        {/* Hatched Living Oddling Creature */}
        {!isEmpty && isHatchedLocal && (
          <div className="absolute left-1/2 -translate-x-1/2 top-[68px] flex flex-col items-center animate-in zoom-in-75 duration-500">
            <OddlingAvatar
              creature={activeEgg.creature}
              size={120}
              mood="excited"
              showAura={true}
            />
          </div>
        )}

        {/* Empty State Overlay Prompt on Hover */}
        {isEmpty && (
          <div className="absolute top-[85px] left-1/2 -translate-x-1/2 bg-slate-950/90 text-amber-300 border border-amber-500/50 px-3 py-1.5 rounded-xl shadow-lg font-mono text-xs flex items-center gap-1.5 whitespace-nowrap pointer-events-none group-hover:scale-105 transition-transform">
            <span>✨</span>
            <span className="font-bold">Click to Place Object</span>
          </div>
        )}
      </div>
    </div>
  );
};
