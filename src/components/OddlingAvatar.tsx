/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useId } from 'react';
import { peekPhotoSprite, watchPhotoSprite, PhotoSprite } from '../game/photoSprite';
import { CreatureDNA, MoodType, ObjectArchetype, VisualPlan } from '../game/creatureTypes';
import { 
  deriveArchetypeFromObject, 
  createCompositionalSilhouette, 
  normalizeAndCenterCompositional,
  collectCreatureSemanticText,
  repairObjectVisualPlan
} from '../game/creatureRules';

interface OddlingAvatarProps {
  creature: CreatureDNA;
  size?: number; // size in px, default 160
  mood?: MoodType;
  isInteracting?: boolean;
  className?: string;
  onClick?: () => void;
  showAura?: boolean;
  faceCrop?: boolean; // zoom the viewBox onto the face (used for portraits)
}

// Color utility to darken or lighten hex colors for 16-bit pixel shading
function adjustBrightness(hex: string, percent: number): string {
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

const OddlingAvatarView: React.FC<OddlingAvatarProps> = ({
  creature,
  size = 160,
  mood = 'happy',
  isInteracting = false,
  className = '',
  onClick,
  showAura = true,
  faceCrop = false
}) => {
  const [isBlinking, setIsBlinking] = useState(false);
  const outlineId = 'art-outline-' + useId().replace(/:/g, '');
  const [bounceStep, setBounceStep] = useState(0);

  // Creatures made from a photo are drawn from that photo once it is converted
  const photoUrl = creature.sourceObject?.spritePhotoUrl || creature.sourceObject?.userPhotoUrl;
  const objectName = creature.sourceObject?.name || '';
  const [photoSprite, setPhotoSprite] = useState<PhotoSprite | null | undefined>(() => peekPhotoSprite(photoUrl));
  useEffect(() => {
    setPhotoSprite(peekPhotoSprite(photoUrl));
    return watchPhotoSprite(photoUrl, objectName, setPhotoSprite);
  }, [photoUrl, objectName]);

  // Periodic random blinking
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 130);
    }, 2600 + Math.random() * 2200);

    return () => clearInterval(blinkInterval);
  }, []);

  // Micro 16-bit walking/breathing bounce animation (2-frame cycle)
  useEffect(() => {
    const animInterval = setInterval(() => {
      setBounceStep((prev) => (prev === 0 ? 1 : 0));
    }, isInteracting ? 220 : 600);

    return () => clearInterval(animInterval);
  }, [isInteracting]);

  const {
    primaryColor,
    secondaryColor,
    accentColor,
    eyeStyle
  } = creature.appearance;

  // Derive palette tones
  const mainCol = primaryColor || '#e07a5f';
  const lightCol = secondaryColor || adjustBrightness(mainCol, 35);
  const shadowCol = adjustBrightness(mainCol, -45);
  const outlineCol = adjustBrightness(mainCol, -80);
  const highlightCol = accentColor || '#ffffff';

  // Resolve visual plan and archetype
  const visualPlan: VisualPlan = repairObjectVisualPlan(creature.appearance.visualPlan, creature.sourceObject.name) || {
    version: 1,
    archetype: deriveArchetypeFromObject(
      creature.sourceObject.name,
      creature.sourceObject.category,
      creature.sourceObject.material
    ),
    proportions: { widthScale: 1.0, heightScale: 1.0 },
    definingParts: {
      hasHandle: true,
      hasRim: true,
      hasSteam: true
    },
    materialSurface: {
      finish: 'glazed_ceramic',
      pattern: 'speckled',
      glazeColor: mainCol,
      highlightColor: highlightCol
    },
    facePlacement: {
      surfaceRegion: 'vessel_front',
      yOffset: 0
    }
  };

  const archetype: ObjectArchetype = visualPlan.archetype;
  const parts = visualPlan.definingParts || {};

  // Render pixel eyes based on mood and blinking
  const renderPixelEyes = (eyeLeftX: number, eyeRightX: number, eyeY: number) => {
    if (isBlinking || mood === 'sleepy') {
      // Horizontal closed pixel lines (2x1)
      return (
        <g fill={outlineCol}>
          <rect x={eyeLeftX} y={eyeY + 1} width="3" height="1" />
          <rect x={eyeRightX} y={eyeY + 1} width="3" height="1" />
        </g>
      );
    }

    if (mood === 'loving') {
      // Pink heart pixel eyes
      return (
        <g fill="#ec4899">
          <rect x={eyeLeftX} y={eyeY} width="1" height="1" />
          <rect x={eyeLeftX + 2} y={eyeY} width="1" height="1" />
          <rect x={eyeLeftX} y={eyeY + 1} width="3" height="1" />
          <rect x={eyeLeftX + 1} y={eyeY + 2} width="1" height="1" />

          <rect x={eyeRightX} y={eyeY} width="1" height="1" />
          <rect x={eyeRightX + 2} y={eyeY} width="1" height="1" />
          <rect x={eyeRightX} y={eyeY + 1} width="3" height="1" />
          <rect x={eyeRightX + 1} y={eyeY + 2} width="1" height="1" />
        </g>
      );
    }

    if (mood === 'excited') {
      // Sparkle eyes (cross shape)
      return (
        <g fill="#fbbf24">
          <rect x={eyeLeftX + 1} y={eyeY - 1} width="1" height="3" />
          <rect x={eyeLeftX} y={eyeY} width="3" height="1" />
          <rect x={eyeLeftX + 1} y={eyeY} width="1" height="1" fill="#ffffff" />

          <rect x={eyeRightX + 1} y={eyeY - 1} width="1" height="3" />
          <rect x={eyeRightX} y={eyeY} width="3" height="1" />
          <rect x={eyeRightX + 1} y={eyeY} width="1" height="1" fill="#ffffff" />
        </g>
      );
    }

    // Default 16-bit cute round eyes (2x3 with white specular pixel highlight)
    return (
      <g>
        {/* Left eye */}
        <rect x={eyeLeftX} y={eyeY} width="2" height="3" fill={outlineCol} />
        <rect x={eyeLeftX} y={eyeY} width="1" height="1" fill="#ffffff" />
        {/* Right eye */}
        <rect x={eyeRightX} y={eyeY} width="2" height="3" fill={outlineCol} />
        <rect x={eyeRightX} y={eyeY} width="1" height="1" fill="#ffffff" />
      </g>
    );
  };

  // Render cute pixel mouth & cheeks
  const renderPixelMouth = (centerX: number, mouthY: number) => {
    return (
      <g>
        {/* Rosy Cheeks (2x1 pink pixels) */}
        <rect x={centerX - 6} y={mouthY - 1} width="2" height="1" fill="#f43f5e" opacity="0.8" />
        <rect x={centerX + 4} y={mouthY - 1} width="2" height="1" fill="#f43f5e" opacity="0.8" />

        {/* Mouth */}
        {mood === 'happy' || mood === 'excited' ? (
          // Cute smile
          <g fill={outlineCol}>
            <rect x={centerX - 1} y={mouthY + 1} width="2" height="1" />
            <rect x={centerX - 2} y={mouthY} width="1" height="1" />
            <rect x={centerX + 1} y={mouthY} width="1" height="1" />
          </g>
        ) : mood === 'hungry' ? (
          // Open 'o' mouth
          <rect x={centerX - 1} y={mouthY} width="2" height="2" fill={outlineCol} />
        ) : (
          // Neutral cute line
          <rect x={centerX - 1} y={mouthY} width="2" height="1" fill={outlineCol} />
        )}
      </g>
    );
  };

  // Render rising steam particles
  const renderPixelSteam = (x: number, y: number) => {
    return (
      <g fill="#ffffff" opacity="0.75">
        <rect x={x - 2} y={y - 2 - bounceStep} width="2" height="2" />
        <rect x={x - 3} y={y - 5 - bounceStep * 2} width="2" height="2" opacity="0.6" />
        <rect x={x + 3} y={y - 3 + bounceStep} width="2" height="2" />
        <rect x={x + 4} y={y - 6 + bounceStep * 2} width="2" height="2" opacity="0.5" />
      </g>
    );
  };

  // Render spines (if archetype is cactus or hybrid inherited spines)
  const renderSpineNeedles = (spineCoords: Array<{ x: number; y: number; dir: 'left' | 'right' | 'top' }>) => {
    return (
      <g fill="#fef08a">
        {spineCoords.map((s, idx) => (
          <rect
            key={idx}
            x={s.dir === 'left' ? s.x - 2 : s.x}
            y={s.y}
            width={s.dir === 'top' ? 1 : 2}
            height={s.dir === 'top' ? 2 : 1}
          />
        ))}
      </g>
    );
  };

  // Where the face sits in the 36x36 grid, so portraits can crop onto it
  const FACE_AT: Record<string, [number, number]> = {
    cup: [17, 20], cactus: [18, 17], lamp: [18, 11], headphones: [18, 19], teapot: [18, 20],
    honey_jar: [18, 20], pocket_watch: [18, 18], lemon: [18, 18]
  };
  const faceC = { x: (FACE_AT[archetype] || [18, 19])[0], y: (FACE_AT[archetype] || [18, 19])[1] };

  // Render archetype-specific 16-bit pixel sprite inside a 36x36 grid
  const renderSprite = () => {
    // Only apply whole-body hop during active interaction so idle creatures stay anchored to terrain
    const yOffset = isInteracting && bounceStep === 1 ? -1 : 0;

    if (photoSprite?.pending) {
      // Muse Image is still drawing this creature: a soft glowing egg-shaped shimmer with sparkles
      return (
        <g className="animate-pulse">
          <rect x="13" y="12" width="10" height="2" fill="#e9d5ff" opacity="0.55" />
          <rect x="11" y="14" width="14" height="12" fill="#e9d5ff" opacity="0.55" />
          <rect x="12" y="26" width="12" height="3" fill="#e9d5ff" opacity="0.55" />
          <rect x="15" y="16" width="2" height="2" fill="#ffffff" />
          <rect x="8" y="10" width="1" height="3" fill="#fff3ad" />
          <rect x="7" y="11" width="3" height="1" fill="#fff3ad" />
          <rect x="27" y="20" width="1" height="3" fill="#fff3ad" />
          <rect x="26" y="21" width="3" height="1" fill="#fff3ad" />
        </g>
      );
    }

    if (photoSprite?.art) {
      // Muse Image's drawing (drawn without a face), bottom-aligned so its feet stand on the baseline (y 31),
      // with the game's own eyes and mouth on top so every creature keeps the Oddlings look
      const aw = photoSprite.artW || 32;
      const ah = photoSprite.artH || 30;
      const s = Math.min(32 / aw, 30 / ah);
      const dw = aw * s;
      const dh = ah * s;
      const ax = 18 - dw / 2;
      const ay = 31 - dh;
      faceC.x = 18;
      faceC.y = Math.round(ay + dh * 0.42);
      return (
        <g transform={`translate(0, ${yOffset})`}>
          {/* A thin dark pixel outline keeps the drawing readable on busy scenery, and a soft squash-and-stretch
              (feet planted) makes it breathe; it hops happily while someone plays with it */}
          <defs>
            <style>{`@keyframes oddling-art-breathe{0%,100%{transform:scale(1,1)}50%{transform:scale(1.035,.955)}}
@keyframes oddling-art-hop{0%,100%{transform:translateY(0) scale(1.06,.92)}35%{transform:translateY(-3px) scale(.95,1.06)}65%{transform:translateY(-2px) scale(.98,1.02)}}
.oddling-art{transform-box:view-box;transform-origin:18px 31px;animation:oddling-art-breathe 1.6s steps(3) infinite}
.oddling-art.hop{animation:oddling-art-hop .44s steps(4) infinite}
@media (prefers-reduced-motion: reduce){.oddling-art,.oddling-art.hop{animation:none}}`}</style>
            <filter id={outlineId} x="-25%" y="-25%" width="150%" height="150%">
              <feMorphology in="SourceAlpha" operator="dilate" radius="0.6" result="grown" />
              <feFlood floodColor="#1b1428" floodOpacity="0.9" />
              <feComposite in2="grown" operator="in" result="outline" />
              <feMerge>
                <feMergeNode in="outline" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <g className={'oddling-art' + (isInteracting ? ' hop' : '')}>
            <image href={photoSprite.art} x={ax} y={ay} width={dw} height={dh} preserveAspectRatio="none" filter={`url(#${outlineId})`} style={{ imageRendering: 'pixelated' }} />
            {renderPixelEyes(faceC.x - 3, faceC.x + 2, faceC.y - 1)}
            {renderPixelMouth(faceC.x, faceC.y + 3)}
          </g>
        </g>
      );
    }

    if (photoSprite) {
      // Photo pixels stand on the same baseline as drawn sprites (feet at y 29..31)
      const ox = Math.round(18 - photoSprite.w / 2);
      const oy = 29 - photoSprite.h;
      faceC.x = ox + photoSprite.faceX;
      faceC.y = oy + photoSprite.faceY;
      const footX = ox + Math.round(photoSprite.w / 2);
      return (
        <g transform={`translate(0, ${yOffset})`}>
          {photoSprite.pixels.map((p, i) =>
            p ? <rect key={i} x={ox + (i % photoSprite.w)} y={oy + Math.floor(i / photoSprite.w)} width="1" height="1" fill={p} /> : null
          )}
          {!photoSprite.drawnFace && renderPixelEyes(faceC.x - 3, faceC.x + 2, faceC.y - 1)}
          {!photoSprite.drawnFace && renderPixelMouth(faceC.x, faceC.y + 3)}
          <g fill={photoSprite.outline}>
            <rect x={footX - 4} y={29} width="3" height="2" />
            <rect x={footX + 1} y={29} width="3" height="2" />
          </g>
        </g>
      );
    }

    switch (archetype) {
      case 'cup':
        return (
          <g transform={`translate(0, ${yOffset})`}>
            {/* Steam rising */}
            {parts.hasSteam && renderPixelSteam(17, 10)}

            {/* Handle on right */}
            {parts.hasHandle && (
              <g>
                <rect x="25" y="16" width="5" height="2" fill={outlineCol} />
                <rect x="28" y="18" width="2" height="6" fill={outlineCol} />
                <rect x="25" y="23" width="5" height="2" fill={outlineCol} />
                <rect x="26" y="18" width="2" height="5" fill={lightCol} />
              </g>
            )}

            {/* Cup Vessel Body (16x14 pixels) */}
            {/* Dark outline */}
            <rect x="9" y="12" width="17" height="15" fill={outlineCol} />
            <rect x="10" y="27" width="15" height="2" fill={outlineCol} />

            {/* Glazed body fill */}
            <rect x="10" y="14" width="15" height="13" fill={mainCol} />
            {/* Highlights on left */}
            <rect x="11" y="15" width="2" height="11" fill={lightCol} />
            {/* Shadow on right */}
            <rect x="22" y="15" width="2" height="11" fill={shadowCol} />

            {/* Open Elliptical Rim & Liquid Cavity */}
            {parts.hasRim && (
              <g>
                {/* Rim rim-lip */}
                <rect x="9" y="11" width="17" height="3" fill={outlineCol} />
                <rect x="10" y="12" width="15" height="2" fill={lightCol} />
                {/* Dark coffee/tea liquid cavity */}
                <rect x="11" y="12" width="13" height="2" fill={parts.liquidFillColor || '#361b0a'} />
                <rect x="12" y="12" width="4" height="1" fill="#5c2e12" />
              </g>
            )}

            {/* Defensive Spines if hybrid */}
            {parts.hasSpines &&
              renderSpineNeedles([
                { x: 9, y: 16, dir: 'left' },
                { x: 9, y: 22, dir: 'left' },
                { x: 26, y: 14, dir: 'right' }
              ])}

            {/* Face on the vessel surface */}
            {renderPixelEyes(13, 19, 18)}
            {renderPixelMouth(17, 22)}

            {/* Little pixel feet */}
            <rect x="12" y="29" width="3" height="2" fill={shadowCol} />
            <rect x="19" y="29" width="3" height="2" fill={shadowCol} />
          </g>
        );

      case 'cactus':
        return (
          <g transform={`translate(0, ${yOffset})`}>
            {/* Flower bud on top */}
            <rect x="16" y="6" width="4" height="2" fill="#ec4899" />
            <rect x="17" y="5" width="2" height="1" fill="#fef08a" />

            {/* Main Saguaro Trunk */}
            <rect x="14" y="8" width="8" height="22" fill={outlineCol} />
            <rect x="15" y="9" width="6" height="20" fill={mainCol} />
            {/* Vertical ribbed stripes */}
            <rect x="16" y="9" width="1" height="20" fill={lightCol} />
            <rect x="19" y="9" width="1" height="20" fill={shadowCol} />

            {/* Left Branch Arm */}
            <rect x="8" y="14" width="7" height="3" fill={outlineCol} />
            <rect x="8" y="11" width="3" height="6" fill={outlineCol} />
            <rect x="9" y="12" width="2" height="4" fill={mainCol} />
            <rect x="11" y="15" width="4" height="1" fill={mainCol} />

            {/* Right Branch Arm */}
            <rect x="21" y="16" width="7" height="3" fill={outlineCol} />
            <rect x="25" y="13" width="3" height="6" fill={outlineCol} />
            <rect x="26" y="14" width="2" height="4" fill={mainCol} />
            <rect x="22" y="17" width="4" height="1" fill={mainCol} />

            {/* Yellow Spine Needles */}
            {renderSpineNeedles([
              { x: 14, y: 11, dir: 'left' },
              { x: 14, y: 17, dir: 'left' },
              { x: 14, y: 23, dir: 'left' },
              { x: 22, y: 12, dir: 'right' },
              { x: 22, y: 22, dir: 'right' },
              { x: 7, y: 13, dir: 'left' },
              { x: 28, y: 15, dir: 'right' }
            ])}

            {/* Face on main stem */}
            {renderPixelEyes(15, 19, 15)}
            {renderPixelMouth(18, 19)}

            {/* Little pixel root feet */}
            <rect x="14" y="29" width="3" height="2" fill={shadowCol} />
            <rect x="19" y="29" width="3" height="2" fill={shadowCol} />
          </g>
        );

      case 'lamp':
        return (
          <g transform={`translate(0, ${yOffset})`}>
            {/* Stepped base */}
            <rect x="12" y="27" width="12" height="2" fill={outlineCol} />
            <rect x="13" y="27" width="10" height="1" fill={lightCol} />
            <rect x="10" y="29" width="16" height="2" fill={outlineCol} />
            <rect x="11" y="29" width="14" height="1" fill={shadowCol} />

            {/* Articulated Brass Stem */}
            <rect x="17" y="15" width="2" height="12" fill={outlineCol} />
            <rect x="17" y="15" width="1" height="12" fill={lightCol} />
            <rect x="15" y="13" width="5" height="2" fill={outlineCol} />

            {/* Angled Pixel Shade */}
            <rect x="9" y="6" width="18" height="8" fill={outlineCol} />
            <rect x="10" y="7" width="16" height="6" fill={mainCol} />
            <rect x="11" y="7" width="3" height="6" fill={lightCol} />
            <rect x="22" y="7" width="3" height="6" fill={shadowCol} />

            {/* Glowing Filament & downward light */}
            <rect x="16" y="14" width="4" height="2" fill="#fde047" />
            <rect x="14" y="16" width="8" height="2" fill="#fde047" opacity="0.3" />

            {/* Hybrid spines on lamp */}
            {parts.hasSpines &&
              renderSpineNeedles([
                { x: 17, y: 18, dir: 'left' },
                { x: 19, y: 22, dir: 'right' }
              ])}

            {/* Face on the shade */}
            {renderPixelEyes(13, 19, 9)}
            {renderPixelMouth(17, 12)}
          </g>
        );

      case 'headphones':
        return (
          <g transform={`translate(0, ${yOffset})`}>
            {/* Arched Headband */}
            <rect x="11" y="7" width="14" height="3" fill={outlineCol} />
            <rect x="12" y="8" width="12" height="1" fill={lightCol} />
            <rect x="8" y="9" width="3" height="6" fill={outlineCol} />
            <rect x="25" y="9" width="3" height="6" fill={outlineCol} />

            {/* Central bouncy core */}
            <rect x="13" y="15" width="10" height="11" fill={outlineCol} />
            <rect x="14" y="16" width="8" height="9" fill={mainCol} />
            <rect x="15" y="17" width="2" height="7" fill={lightCol} />

            {/* Left Padded Earcup */}
            <rect x="6" y="14" width="4" height="12" fill={outlineCol} />
            <rect x="7" y="15" width="2" height="10" fill={shadowCol} />

            {/* Right Padded Earcup */}
            <rect x="26" y="14" width="4" height="12" fill={outlineCol} />
            <rect x="27" y="15" width="2" height="10" fill={shadowCol} />

            {/* Face on central core */}
            {renderPixelEyes(15, 19, 18)}
            {renderPixelMouth(18, 22)}

            {/* Little feet */}
            <rect x="14" y="27" width="2" height="2" fill={outlineCol} />
            <rect x="20" y="27" width="2" height="2" fill={outlineCol} />
          </g>
        );

      case 'teapot':
        return (
          <g transform={`translate(0, ${yOffset})`}>
            {/* Steam rising */}
            {parts.hasSteam && renderPixelSteam(18, 9)}

            {/* Lid Finial */}
            <rect x="17" y="10" width="2" height="2" fill="#fbbf24" />
            <rect x="14" y="12" width="8" height="2" fill={outlineCol} />
            <rect x="15" y="12" width="6" height="1" fill={lightCol} />

            {/* Handle on right */}
            <rect x="25" y="16" width="5" height="2" fill={outlineCol} />
            <rect x="28" y="18" width="2" height="7" fill={outlineCol} />
            <rect x="25" y="24" width="5" height="2" fill={outlineCol} />

            {/* Spout on left */}
            <rect x="6" y="16" width="4" height="3" fill={outlineCol} />
            <rect x="7" y="19" width="4" height="4" fill={outlineCol} />
            <rect x="8" y="17" width="2" height="2" fill={lightCol} />

            {/* Round Pot Belly */}
            <rect x="10" y="14" width="16" height="13" fill={outlineCol} />
            <rect x="11" y="15" width="14" height="11" fill={mainCol} />
            <rect x="12" y="16" width="2" height="9" fill={lightCol} />
            <rect x="22" y="16" width="2" height="9" fill={shadowCol} />

            {/* Face on teapot belly */}
            {renderPixelEyes(14, 20, 18)}
            {renderPixelMouth(18, 22)}

            {/* Feet */}
            <rect x="13" y="28" width="3" height="2" fill={shadowCol} />
            <rect x="20" y="28" width="3" height="2" fill={shadowCol} />
          </g>
        );

      case 'honey_jar':
        return (
          <g transform={`translate(0, ${yOffset})`}>
            {/* Jar Gingham Lid */}
            <rect x="12" y="10" width="12" height="3" fill="#ef4444" />
            <rect x="13" y="10" width="2" height="3" fill="#ffffff" />
            <rect x="17" y="10" width="2" height="3" fill="#ffffff" />
            <rect x="21" y="10" width="2" height="3" fill="#ffffff" />
            <rect x="11" y="13" width="14" height="1" fill="#78350f" />

            {/* Honey Dipper Stick angled out */}
            <rect x="23" y="7" width="2" height="6" fill="#d97706" />
            <rect x="22" y="5" width="4" height="3" fill="#f59e0b" />

            {/* Glass Jar Body */}
            <rect x="11" y="14" width="14" height="14" fill={outlineCol} />
            <rect x="12" y="15" width="12" height="12" fill="#fef3c7" opacity="0.6" />
            {/* Honey fill */}
            <rect x="12" y="18" width="12" height="9" fill="#f59e0b" />
            <rect x="13" y="19" width="3" height="7" fill="#fbbf24" />

            {/* Face */}
            {renderPixelEyes(14, 20, 18)}
            {renderPixelMouth(18, 22)}

            {/* Jar base */}
            <rect x="13" y="28" width="10" height="2" fill={outlineCol} />
          </g>
        );

      case 'pocket_watch':
        return (
          <g transform={`translate(0, ${yOffset})`}>
            {/* Top Winding Crown Ring */}
            <rect x="16" y="5" width="4" height="2" fill="#fbbf24" />
            <rect x="17" y="7" width="2" height="2" fill="#d97706" />

            {/* Pocket Watch Round Case */}
            <rect x="9" y="9" width="18" height="18" fill={outlineCol} />
            <rect x="10" y="10" width="16" height="16" fill="#fbbf24" />
            {/* Watch Dial */}
            <rect x="12" y="12" width="12" height="12" fill="#ffffff" />
            {/* Dial Tick marks */}
            <rect x="17" y="13" width="2" height="1" fill={outlineCol} />
            <rect x="17" y="22" width="2" height="1" fill={outlineCol} />
            <rect x="13" y="17" width="1" height="2" fill={outlineCol} />
            <rect x="22" y="17" width="1" height="2" fill={outlineCol} />

            {/* Clock Hands pointing at 10 and 2 */}
            <rect x="17" y="16" width="1" height="3" fill={outlineCol} />
            <rect x="15" y="15" width="3" height="1" fill={outlineCol} />

            {/* Face */}
            {renderPixelEyes(15, 19, 17)}
            {renderPixelMouth(18, 20)}

            {/* Feet */}
            <rect x="13" y="28" width="3" height="2" fill={outlineCol} />
            <rect x="20" y="28" width="3" height="2" fill={outlineCol} />
          </g>
        );

      case 'lemon':
        return (
          <g transform={`translate(0, ${yOffset})`}>
            {/* Citrus Leaf & Stem on top */}
            <rect x="17" y="7" width="2" height="3" fill="#15803d" />
            <rect x="19" y="6" width="4" height="2" fill="#22c55e" />
            <rect x="20" y="5" width="2" height="1" fill="#4ade80" />

            {/* Tapered Lemon Body */}
            <rect x="7" y="18" width="3" height="2" fill={outlineCol} />
            <rect x="26" y="18" width="3" height="2" fill={outlineCol} />

            <rect x="9" y="13" width="18" height="12" fill={outlineCol} />
            <rect x="10" y="14" width="16" height="10" fill={mainCol} />
            <rect x="11" y="15" width="4" height="8" fill={lightCol} />
            <rect x="22" y="15" width="3" height="8" fill={shadowCol} />

            {/* Pitted peel flecks */}
            <rect x="13" y="16" width="1" height="1" fill="#ca8a04" />
            <rect x="21" y="21" width="1" height="1" fill="#ca8a04" />

            {/* Face */}
            {renderPixelEyes(14, 20, 16)}
            {renderPixelMouth(18, 20)}

            {/* Feet */}
            <rect x="13" y="26" width="3" height="2" fill={shadowCol} />
            <rect x="20" y="26" width="3" height="2" fill={shadowCol} />
          </g>
        );

      case 'compositional': {
        const rawComp = visualPlan.compositional || createCompositionalSilhouette(
          creature.sourceObject.name,
          creature.sourceObject.category,
          creature.sourceObject.material,
          { primary: mainCol, secondary: lightCol, accent: highlightCol }
        );

        const semanticText = collectCreatureSemanticText(creature);
        const comp = normalizeAndCenterCompositional(
          rawComp,
          semanticText,
          { primary: mainCol, secondary: lightCol, accent: highlightCol }
        );

        const bodyBlocks = comp.bodyBlocks || [];
        const featureAccents = comp.featureAccents || [];
        const faceX = comp.faceX ?? 18;
        const faceY = comp.faceY ?? 13;
        faceC.x = faceX;
        faceC.y = faceY + 1;

        // Dynamic bounds for grounded feet and cute side arms
        const maxY = Math.max(...bodyBlocks.map((b) => b.y + b.h), 28);
        // Feet baseline: feet rectangle is 2px tall. feetY=29 places bottom at exactly y=31 (31/36 baseline)
        const feetY = Math.min(29, Math.max(26, maxY - 1));
        const armY = Math.min(maxY - 5, Math.max(faceY + 5, 19));

        // Find blocks directly at armY to attach arms directly to the body/handle
        const blocksAtArm = bodyBlocks.filter((b) => b.y <= armY + 1 && b.y + b.h >= armY);
        const armMinX = blocksAtArm.length > 0 ? Math.min(...blocksAtArm.map((b) => b.x)) : (bodyBlocks.length > 0 ? Math.min(...bodyBlocks.map((b) => b.x)) : 10);
        const armMaxX = blocksAtArm.length > 0 ? Math.max(...blocksAtArm.map((b) => b.x + b.w)) : (bodyBlocks.length > 0 ? Math.max(...bodyBlocks.map((b) => b.x + b.w)) : 26);
        const leftArmX = Math.max(2, armMinX - 2);
        const rightArmX = Math.min(32, armMaxX);

        // Find blocks directly at base of body to attach feet
        const blocksAtFeet = bodyBlocks.filter((b) => b.y + b.h >= maxY - 2);
        const baseCenterX = blocksAtFeet.length > 0
          ? Math.round((Math.min(...blocksAtFeet.map((b) => b.x)) + Math.max(...blocksAtFeet.map((b) => b.x + b.w))) / 2)
          : faceX;
        const leftFootX = baseCenterX - 4;
        const rightFootX = baseCenterX + 1;

        // Subtle alternating footstep during walking, never lifting both feet off the floor
        const isStepFrame = bounceStep === 1;

        return (
          <g transform={`translate(0, ${yOffset})`}>
            {/* If pixelRows is provided (e.g. 16x16 pixel matrix) */}
            {comp.pixelRows && comp.pixelRows.length > 0 ? (
              <g>
                {comp.pixelRows.map((row, rIdx) =>
                  row.split('').map((char, cIdx) => {
                    if (char === '.' || char === ' ') return null;
                    let fill = outlineCol;
                    if (char === 'P' || char === 'p') fill = mainCol;
                    else if (char === 'S' || char === 's') fill = lightCol;
                    else if (char === 'A' || char === 'a') fill = highlightCol;
                    else if (char === 'D' || char === 'd') fill = shadowCol;
                    else if (char === 'L' || char === 'l') fill = '#ffffff';
                    return (
                      <rect
                        key={`${rIdx}-${cIdx}`}
                        x={10 + cIdx}
                        y={8 + rIdx}
                        width="1"
                        height="1"
                        fill={fill}
                      />
                    );
                  })
                )}
              </g>
            ) : (
              <g>
                {/* 1. Outlines of body blocks */}
                {bodyBlocks.map((b, i) => (
                  <rect
                    key={`out-${i}`}
                    x={b.x - 1}
                    y={b.y - 1}
                    width={b.w + 2}
                    height={b.h + 2}
                    fill={outlineCol}
                  />
                ))}

                {/* 2. Fill of body blocks */}
                {bodyBlocks.map((b, i) => {
                  let fill = mainCol;
                  if (b.role === 'secondary') fill = lightCol;
                  else if (b.role === 'accent') fill = highlightCol;
                  else if (b.role === 'shadow') fill = shadowCol;
                  return (
                    <rect
                      key={`fill-${i}`}
                      x={b.x}
                      y={b.y}
                      width={b.w}
                      height={b.h}
                      fill={fill}
                    />
                  );
                })}

                {/* 3. Surface texture / Bevel glint */}
                {bodyBlocks.length > 0 && (
                  <rect
                    x={bodyBlocks[0].x + 1}
                    y={bodyBlocks[0].y + 1}
                    width={Math.max(1, Math.floor(bodyBlocks[0].w / 3))}
                    height="1"
                    fill="#ffffff"
                    opacity="0.8"
                  />
                )}

                {/* 4. Feature Accents (e.g. fork prongs, computer mouse wheel/cord, laces, blades, etc.) */}
                {featureAccents.map((feat, i) => {
                  let fill = highlightCol;
                  if (feat.fillRole === 'primary') fill = mainCol;
                  else if (feat.fillRole === 'secondary') fill = lightCol;
                  else if (feat.fillRole === 'dark') fill = outlineCol;
                  else if (feat.fillRole === 'light') fill = '#ffffff';

                  return (
                    <g key={`feat-${i}`}>
                      <rect
                        x={feat.x}
                        y={feat.y}
                        width={feat.width}
                        height={feat.height}
                        fill={fill}
                      />
                      {feat.type === 'laces' && (
                        <g fill={outlineCol}>
                          <rect x={feat.x + 1} y={feat.y + 1} width="1" height="1" />
                          <rect x={feat.x + feat.width - 2} y={feat.y + 1} width="1" height="1" />
                          <rect x={feat.x + 1} y={feat.y + feat.height - 2} width="1" height="1" />
                          <rect x={feat.x + feat.width - 2} y={feat.y + feat.height - 2} width="1" height="1" />
                        </g>
                      )}
                      {feat.type === 'lens' && (
                        <rect
                          x={feat.x + 1}
                          y={feat.y + 1}
                          width="2"
                          height="2"
                          fill="#38bdf8"
                          opacity="0.9"
                        />
                      )}
                      {feat.type === 'wheel' && (
                        <g fill="#ffffff" opacity="0.75">
                          <rect x={feat.x} y={feat.y + 1} width={feat.width} height="1" />
                          <rect x={feat.x} y={feat.y + 3} width={feat.width} height="1" />
                        </g>
                      )}
                      {feat.type === 'seam' && (
                        <rect
                          x={feat.x}
                          y={feat.y}
                          width={feat.width}
                          height={feat.height}
                          fill={outlineCol}
                          opacity="0.85"
                        />
                      )}
                    </g>
                  );
                })}
              </g>
            )}

            {comp.category === 'apple' && <g fill="#65a30d"><rect x="20" y="5" width="6" height="2" /><rect x="19" y="7" width="5" height="2" /></g>}
            {/* Cute Pixel Monster Face centered on object */}
            {renderPixelEyes(faceX - 3, faceX + 2, faceY - 1)}
            {renderPixelMouth(faceX, faceY + 3)}

            {/* Tiny Cute Pixel Monster Arms anchored on sides of handle/body */}
            <g fill={outlineCol}>
              <rect x={leftArmX} y={armY} width="2" height="2" />
              <rect x={rightArmX} y={armY} width="2" height="2" />
            </g>
            <g fill={lightCol}>
              <rect x={leftArmX} y={armY} width="2" height="1" />
              <rect x={rightArmX} y={armY} width="2" height="1" />
            </g>

            {/* Micro Little Pixel Monster Feet grounded at bottom of body */}
            <g fill={outlineCol}>
              <rect x={leftFootX} y={feetY} width="3" height="2" />
              <rect x={rightFootX} y={feetY} width="3" height="2" />
            </g>
            <g fill={shadowCol}>
              <rect x={leftFootX} y={feetY + 1} width="3" height="1" />
              <rect x={rightFootX} y={feetY + 1} width="3" height="1" />
            </g>
          </g>
        );
      }

      default:
        // Curio / Crystal Relic
        return (
          <g transform={`translate(0, ${yOffset})`}>
            {/* Prismatic Shimmer glints */}
            <rect x="12" y="8" width="1" height="1" fill="#ffffff" />
            <rect x="23" y="10" width="1" height="1" fill="#ffffff" />

            {/* Diamond / Faceted Crystal Prism */}
            <rect x="11" y="11" width="14" height="16" fill={outlineCol} />
            <rect x="12" y="12" width="12" height="14" fill={mainCol} />
            {/* Crystal Facets */}
            <rect x="13" y="13" width="4" height="12" fill={lightCol} />
            <rect x="19" y="13" width="4" height="12" fill={shadowCol} />

            {/* Face */}
            {renderPixelEyes(14, 20, 17)}
            {renderPixelMouth(18, 21)}

            {/* Pedestal / Feet */}
            <rect x="13" y="28" width="3" height="2" fill={outlineCol} />
            <rect x="20" y="28" width="3" height="2" fill={outlineCol} />
          </g>
        );
    }
  };

  const sprite = renderSprite();

  return (
    <div
      onClick={onClick}
      className={`relative inline-flex items-center justify-center transition-transform ${
        isInteracting ? 'scale-110' : ''
      } ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Elemental Aura Halo (Subtle retro glow behind the sprite) */}
      {showAura && (
        <div
          className="absolute inset-2 rounded-full blur-md opacity-35 pointer-events-none transition-all duration-500 animate-pulse"
          style={{ backgroundColor: lightCol }}
        />
      )}

      {/* 16-Bit Pixel Art SVG Sprite (36x36 grid with crisp edges and pixelated rendering) */}
      <svg
        viewBox={faceCrop ? `${Math.max(0, Math.min(20, faceC.x - 8))} ${Math.max(0, Math.min(20, faceC.y - 8))} 16 16` : '0 0 36 36'}
        className="w-full h-full select-none"
        style={{
          imageRendering: 'pixelated',
          shapeRendering: 'crispEdges',
          // Hops and squash-and-stretch can lift a tall drawing (a hat, ears) past the top edge: let it show
          overflow: faceCrop ? 'hidden' : 'visible'
        }}
      >
        {sprite}
      </svg>
    </div>
  );
};

// Redraws only when its creature, size or mood changes, not every time the habitat animates its position
export const OddlingAvatar = React.memo(OddlingAvatarView);
