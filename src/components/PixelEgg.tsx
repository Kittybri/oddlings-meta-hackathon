/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface PixelEggProps {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  pattern?: 'stripes' | 'spots' | 'zigzag' | 'cosmic' | 'cracked';
  size?: number;
  wobble?: boolean;
  isReadyToHatch?: boolean;
  crackStage?: number; // 0: intact, 1: slight crack, 2: heavy cracks with light, 3: hatching burst
  className?: string;
  onClick?: () => void;
}

// Color utility to adjust brightness for pixel shading
function adjustColor(hex: string, percent: number): string {
  let num = parseInt(hex.replace('#', ''), 16);
  if (isNaN(num)) num = 0x888888;
  let r = (num >> 16) + percent;
  let g = ((num >> 8) & 0x00ff) + percent;
  let b = (num & 0x0000ff) + percent;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export const PixelEgg: React.FC<PixelEggProps> = ({
  primaryColor = '#38bdf8',
  secondaryColor = '#facc15',
  accentColor = '#f472b6',
  pattern = 'stripes',
  size = 140,
  wobble = false,
  isReadyToHatch = false,
  crackStage = 0,
  className = '',
  onClick
}) => {
  const mainCol = primaryColor.startsWith('#') ? primaryColor : '#38bdf8';
  const lightCol = adjustColor(mainCol, 40);
  const shadowCol = adjustColor(mainCol, -45);
  const outlineCol = adjustColor(mainCol, -85);

  const secCol = secondaryColor.startsWith('#') ? secondaryColor : '#facc15';
  const accCol = accentColor.startsWith('#') ? accentColor : '#f472b6';

  const effectiveCrackStage = isReadyToHatch ? Math.max(1, crackStage) : crackStage;

  return (
    <div
      onClick={onClick}
      className={`relative inline-flex items-center justify-center select-none transition-transform ${
        wobble ? 'animate-bounce' : ''
      } ${isReadyToHatch ? 'cursor-pointer hover:scale-105' : ''} ${className}`}
      style={{ width: size, height: size * 1.15 }}
    >
      {/* Radiant Glow behind ready egg */}
      {isReadyToHatch && (
        <div
          className="absolute inset-0 rounded-full blur-xl opacity-60 pointer-events-none animate-pulse"
          style={{ backgroundColor: secCol }}
        />
      )}

      {/* 16-Bit Crisp Pixel Egg SVG inside a 24x28 coordinate grid */}
      <svg
        viewBox="0 0 24 28"
        className="w-full h-full"
        style={{
          imageRendering: 'pixelated',
          shapeRendering: 'crispEdges'
        }}
      >
        <g>
          {/* Egg Shadow on base */}
          <rect x="7" y="26" width="10" height="2" fill="#020617" opacity="0.45" />

          {/* 1. Dark Pixel Outline (Egg silhouette) */}
          <rect x="9" y="2" width="6" height="1" fill={outlineCol} />
          <rect x="7" y="3" width="10" height="1" fill={outlineCol} />
          <rect x="6" y="4" width="12" height="2" fill={outlineCol} />
          <rect x="5" y="6" width="14" height="2" fill={outlineCol} />
          <rect x="4" y="8" width="16" height="5" fill={outlineCol} />
          <rect x="3" y="13" width="18" height="8" fill={outlineCol} />
          <rect x="4" y="21" width="16" height="2" fill={outlineCol} />
          <rect x="5" y="23" width="14" height="2" fill={outlineCol} />
          <rect x="7" y="25" width="10" height="1" fill={outlineCol} />

          {/* 2. Main Shell Fill */}
          <rect x="9" y="3" width="6" height="1" fill={mainCol} />
          <rect x="7" y="4" width="10" height="2" fill={mainCol} />
          <rect x="6" y="6" width="12" height="2" fill={mainCol} />
          <rect x="5" y="8" width="14" height="5" fill={mainCol} />
          <rect x="4" y="13" width="16" height="8" fill={mainCol} />
          <rect x="5" y="21" width="14" height="2" fill={mainCol} />
          <rect x="6" y="23" width="12" height="1" fill={mainCol} />
          <rect x="7" y="24" width="10" height="1" fill={mainCol} />

          {/* 3. Pixel Shading & Specular Highlight */}
          {/* Left light bevel */}
          <rect x="9" y="3" width="2" height="1" fill={lightCol} />
          <rect x="7" y="4" width="2" height="2" fill={lightCol} />
          <rect x="6" y="6" width="2" height="2" fill={lightCol} />
          <rect x="5" y="8" width="2" height="5" fill={lightCol} />
          <rect x="4" y="13" width="2" height="7" fill={lightCol} />
          {/* Specular White Pixel Glint */}
          <rect x="8" y="5" width="2" height="2" fill="#ffffff" opacity="0.85" />
          <rect x="10" y="6" width="1" height="1" fill="#ffffff" opacity="0.85" />

          {/* Right Shadow Curve */}
          <rect x="15" y="7" width="2" height="3" fill={shadowCol} />
          <rect x="16" y="10" width="2" height="5" fill={shadowCol} />
          <rect x="17" y="13" width="2" height="7" fill={shadowCol} />
          <rect x="14" y="22" width="4" height="2" fill={shadowCol} />
          <rect x="10" y="24" width="6" height="1" fill={shadowCol} />

          {/* 4. Pattern Decor */}
          {pattern === 'stripes' && (
            <g fill={secCol}>
              {/* Top angled stripe */}
              <rect x="8" y="9" width="3" height="2" />
              <rect x="11" y="8" width="3" height="2" />
              <rect x="14" y="9" width="2" height="2" />
              {/* Lower bold stripe */}
              <rect x="5" y="16" width="4" height="2" />
              <rect x="9" y="15" width="5" height="2" />
              <rect x="14" y="16" width="4" height="2" />
            </g>
          )}

          {pattern === 'spots' && (
            <g fill={secCol}>
              <rect x="8" y="8" width="3" height="3" />
              <rect x="14" y="11" width="3" height="3" />
              <rect x="7" y="15" width="3" height="3" />
              <rect x="13" y="18" width="3" height="2" />
              <rect x="10" y="21" width="2" height="2" fill={accCol} />
            </g>
          )}

          {pattern === 'zigzag' && (
            <g fill={secCol}>
              <polygon points="5,15 7,13 9,15 11,13 13,15 15,13 17,15 18,16 16,18 14,16 12,18 10,16 8,18 6,16" />
              <rect x="9" y="9" width="5" height="1" fill={accCol} />
              <rect x="8" y="21" width="6" height="1" fill={accCol} />
            </g>
          )}

          {pattern === 'cosmic' && (
            <g>
              <rect x="10" y="8" width="2" height="2" fill={secCol} />
              <rect x="7" y="12" width="1" height="1" fill="#ffffff" />
              <rect x="15" y="14" width="2" height="2" fill={accCol} />
              <rect x="9" y="17" width="3" height="2" fill={secCol} />
              <rect x="14" y="20" width="1" height="1" fill="#ffffff" />
            </g>
          )}

          {pattern === 'cracked' && (
            <g fill={secCol}>
              <rect x="9" y="10" width="1" height="3" />
              <rect x="10" y="12" width="2" height="1" />
              <rect x="12" y="13" width="1" height="4" />
              <rect x="13" y="16" width="3" height="1" />
            </g>
          )}

          {/* 5. Cracks & Radiant Light Fissures (when ready or hatching) */}
          {effectiveCrackStage >= 1 && (
            <g>
              {/* Shell fissure lines */}
              <rect x="11" y="8" width="1" height="3" fill="#000000" opacity="0.85" />
              <rect x="12" y="10" width="2" height="1" fill="#000000" opacity="0.85" />
              <rect x="14" y="11" width="1" height="3" fill="#000000" opacity="0.85" />
              <rect x="10" y="15" width="2" height="1" fill="#000000" opacity="0.85" />
              <rect x="12" y="16" width="1" height="3" fill="#000000" opacity="0.85" />
              <rect x="13" y="18" width="3" height="1" fill="#000000" opacity="0.85" />
              {/* Leaking light */}
              <rect x="12" y="10" width="1" height="1" fill="#ffffff" />
              <rect x="14" y="12" width="1" height="1" fill="#fef08a" />
              <rect x="12" y="17" width="1" height="1" fill="#fef08a" />
            </g>
          )}

          {effectiveCrackStage >= 2 && (
            <g>
              {/* Heavy radiating crack fractures */}
              <rect x="8" y="12" width="3" height="1" fill="#000000" />
              <rect x="7" y="13" width="1" height="2" fill="#000000" />
              <rect x="15" y="14" width="2" height="1" fill="#000000" />
              <rect x="17" y="15" width="1" height="3" fill="#000000" />
              {/* Intense golden light leaking from interior */}
              <rect x="11" y="9" width="1" height="2" fill="#fef08a" />
              <rect x="12" y="16" width="1" height="2" fill="#ffffff" />
              <rect x="14" y="11" width="1" height="2" fill="#ffffff" />
              <rect x="8" y="12" width="2" height="1" fill="#fef08a" />
            </g>
          )}

          {effectiveCrackStage >= 3 && (
            <g>
              {/* Bursting cracks splitting shell apart */}
              <rect x="6" y="11" width="12" height="2" fill="#fef08a" />
              <rect x="8" y="10" width="8" height="4" fill="#ffffff" opacity="0.8" />
            </g>
          )}
        </g>
      </svg>
    </div>
  );
};
