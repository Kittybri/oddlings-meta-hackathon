import fs from 'fs';
import path from 'path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createPngBuffer } from './keyFixture';
import { createStarterWorld, GRID_WIDTH, GRID_HEIGHT, isWaterTile, isSolidTile } from '../src/game/biomeWorld';
import { INITIAL_ODDLINGS } from '../src/game/creatureCatalog';
import { OddlingAvatar } from '../src/components/OddlingAvatar';
import { CreatureDNA } from '../src/game/creatureTypes';
import { legacyClickerWhiskersRecord } from './renderGroundedPlayfield';
import { sanitizeCreature } from '../src/game/storage';

function hexToRgba(hex: string, alpha = 1): [number, number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const num = parseInt(h, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255, Math.round(alpha * 255)];
}

function parseSvgColor(fill?: string): [number, number, number, number] {
  if (!fill || fill === 'none') return [0, 0, 0, 0];
  if (fill.startsWith('#')) return hexToRgba(fill);
  if (fill.startsWith('rgba')) {
    const m = fill.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (m) return [parseInt(m[1]), parseInt(m[2]), parseInt(m[3]), Math.round(parseFloat(m[4] || '1') * 255)];
  }
  return [255, 255, 255, 255];
}

export function renderGreenhouseToPng(outputPath: string): void {
  const WIDTH = 988;
  const HEIGHT = 494;
  const TILE_WIDTH = WIDTH / GRID_WIDTH;   // ~20.5833
  const TILE_HEIGHT = HEIGHT / GRID_HEIGHT; // ~20.5833

  const canvas: [number, number, number, number][][] = Array.from({ length: HEIGHT }, () =>
    Array.from({ length: WIDTH }, () => [2, 132, 199, 255])
  );

  const setPixel = (x: number, y: number, r: number, g: number, b: number, a = 255) => {
    if (x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT) {
      if (a === 255) {
        canvas[y][x] = [r, g, b, 255];
      } else {
        const cur = canvas[y][x];
        const alpha = a / 255;
        canvas[y][x] = [
          Math.round(cur[0] * (1 - alpha) + r * alpha),
          Math.round(cur[1] * (1 - alpha) + g * alpha),
          Math.round(cur[2] * (1 - alpha) + b * alpha),
          255
        ];
      }
    }
  };

  const fillRect = (x: number, y: number, w: number, h: number, col: [number, number, number, number]) => {
    const xEnd = Math.min(WIDTH, Math.round(x + w));
    const yEnd = Math.min(HEIGHT, Math.round(y + h));
    const xStart = Math.max(0, Math.round(x));
    const yStart = Math.max(0, Math.round(y));
    for (let py = yStart; py < yEnd; py++) {
      for (let px = xStart; px < xEnd; px++) {
        if (col[3] === 255) {
          canvas[py][px] = col;
        } else {
          setPixel(px, py, col[0], col[1], col[2], col[3]);
        }
      }
    }
  };

  // 1. Sky Gradient: Luminous turquoise daylight sky (#0284c7 via #0ea5e9 to #a5f3fc)
  for (let y = 0; y < HEIGHT; y++) {
    const t = Math.min(1, y / 320);
    let r: number, g: number, b: number;
    if (t < 0.4) {
      const subT = t / 0.4;
      r = Math.round(2 * (1 - subT) + 14 * subT);
      g = Math.round(132 * (1 - subT) + 165 * subT);
      b = Math.round(199 * (1 - subT) + 233 * subT);
    } else {
      const subT = (t - 0.4) / 0.6;
      r = Math.round(14 * (1 - subT) + 165 * subT);
      g = Math.round(165 * (1 - subT) + 243 * subT);
      b = Math.round(233 * (1 - subT) + 252 * subT);
    }
    for (let x = 0; x < WIDTH; x++) {
      canvas[y][x] = [r, g, b, 255];
    }
  }

  // 2. Warm Stepped Pixel Sun with Subtle Glow (x=830, y=42)
  const sunX = 830;
  const sunY = 42;
  for (let y = 0; y < 100; y++) {
    for (let x = 740; x < 920; x++) {
      const dist = Math.hypot(x - sunX, y - sunY);
      if (dist < 13) {
        setPixel(x, y, 255, 255, 255); // Brilliant white core
      } else if (dist < 18) {
        setPixel(x, y, 254, 240, 138); // Warm yellow #fef08a
      } else if (dist < 26) {
        setPixel(x, y, 250, 204, 21, 230); // Golden corona #facc15
      } else if (dist < 45) {
        setPixel(x, y, 254, 240, 138, Math.round((1 - dist / 45) * 60)); // Soft halo
      }
    }
  }

  // Subtle Diagonal Sunbeams (Soft, low-contrast luminous dust shafts)
  for (let y = 0; y < 320; y++) {
    for (let x = 0; x < WIDTH; x++) {
      if ((x - y * 0.72 + 880) % 230 < 30 && y > 15) {
        setPixel(x, y, 255, 255, 220, 20);
      }
    }
  }

  // 3. Tiny Soft Stepped Pixel Clouds (Secondary, varied silhouettes)
  const clouds = [
    { x: 50, y: 26, w: 48, h: 14 },
    { x: 230, y: 44, w: 64, h: 16 },
    { x: 420, y: 22, w: 32, h: 10 },
    { x: 560, y: 38, w: 56, h: 14 },
    { x: 710, y: 28, w: 40, h: 12 },
    { x: 910, y: 36, w: 44, h: 12 }
  ];
  for (const c of clouds) {
    for (let y = c.y; y < c.y + c.h; y++) {
      const dy = y - c.y;
      const inset = dy < 4 ? Math.round((4 - dy) * 1.5) : 0;
      for (let x = c.x + inset; x < c.x + c.w - inset; x++) {
        if (dy < 4) {
          setPixel(x, y, 255, 255, 255, 230); // Crisp white top
        } else if (dy < c.h - 3) {
          setPixel(x, y, 240, 249, 255, 220); // #f0f9ff body
        } else {
          setPixel(x, y, 186, 230, 253, 200); // #bae6fd bottom shading
        }
      }
    }
  }

  // =========================================================================
  // PIXEL ART DRAWING HELPERS: FOLIAGE, STRATA, MOSS, AND ROCK PROFILES
  // =========================================================================

  // Multi-lobed organic pixel foliage crown
  const drawFoliageCluster = (
    centerX: number,
    centerY: number,
    radiusX: number,
    radiusY: number,
    baseColor: [number, number, number, number],
    midColor: [number, number, number, number],
    lightColor: [number, number, number, number],
    highlightColor: [number, number, number, number]
  ) => {
    const rx = Math.round(radiusX);
    const ry = Math.round(radiusY);
    for (let dy = -ry; dy <= ry; dy++) {
      for (let dx = -rx; dx <= rx; dx++) {
        const norm = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
        if (norm <= 1.0) {
          const px = centerX + dx;
          const py = centerY + dy;
          // Step-quantize coordinates for coarse 2px pixel feeling
          const steppedX = Math.floor(px / 2) * 2;
          const steppedY = Math.floor(py / 2) * 2;

          let col = midColor;
          if (dy > ry * 0.35 || (dx > rx * 0.35 && dy > 0)) {
            col = baseColor; // Underside/shadow
          } else if (dy < -ry * 0.35 && dx < 0) {
            col = highlightColor; // Sunlit crown top-left
          } else if (dy < 0 || dx < 0) {
            col = lightColor; // Sunny upper lobe
          }

          setPixel(steppedX, steppedY, col[0], col[1], col[2], col[3]);
          setPixel(steppedX + 1, steppedY, col[0], col[1], col[2], col[3]);
          setPixel(steppedX, steppedY + 1, col[0], col[1], col[2], col[3]);
          setPixel(steppedX + 1, steppedY + 1, col[0], col[1], col[2], col[3]);
        }
      }
    }
  };

  // Lush organic tree with branching gnarled trunk and overlapping foliage lobes
  const drawLushTree = (
    trunkX: number,
    groundY: number,
    height: number,
    canopyRadius: number,
    isDistant = false
  ) => {
    const branchTopY = groundY - height + Math.round(canopyRadius * 0.6);
    // Gnarled wood trunk
    const trunkCol: [number, number, number, number] = isDistant
      ? [50, 40, 35, 240]
      : [69, 35, 17, 255]; // #452311
    const barkShadow: [number, number, number, number] = isDistant
      ? [38, 30, 26, 240]
      : [42, 20, 8, 255];  // #2a1408

    // Trunk base with buttress
    const trunkW = isDistant ? 3 : 5;
    fillRect(trunkX - 1, branchTopY, trunkW, groundY - branchTopY, trunkCol);
    fillRect(trunkX + trunkW - 2, branchTopY, 2, groundY - branchTopY, barkShadow);
    fillRect(trunkX - 3, groundY - 4, 2, 4, trunkCol); // left root
    fillRect(trunkX + trunkW, groundY - 3, 2, 3, barkShadow); // right root

    // Branching limbs
    fillRect(trunkX - 6, branchTopY - 4, 6, 3, trunkCol);
    fillRect(trunkX + trunkW, branchTopY - 6, 7, 3, trunkCol);

    // Overlapping foliage lobes in 4-5 green shades
    const baseGreen: [number, number, number, number] = isDistant
      ? [15, 60, 45, 230]
      : [13, 58, 36, 255]; // #0d3a24
    const midGreen: [number, number, number, number] = isDistant
      ? [22, 85, 62, 230]
      : [22, 101, 52, 255]; // #166534
    const lightGreen: [number, number, number, number] = isDistant
      ? [38, 125, 90, 230]
      : [34, 197, 94, 255]; // #22c55e
    const highlightGreen: [number, number, number, number] = isDistant
      ? [70, 165, 120, 230]
      : [74, 222, 128, 255]; // #4ade80

    const r = canopyRadius;
    const cy = branchTopY - Math.round(r * 0.4);

    // Main central crown
    drawFoliageCluster(trunkX + 1, cy, r, Math.round(r * 0.85), baseGreen, midGreen, lightGreen, highlightGreen);
    // Left overlapping lobe
    drawFoliageCluster(trunkX - Math.round(r * 0.65), cy + 3, Math.round(r * 0.7), Math.round(r * 0.65), baseGreen, midGreen, lightGreen, highlightGreen);
    // Right overlapping lobe
    drawFoliageCluster(trunkX + Math.round(r * 0.7), cy + 2, Math.round(r * 0.7), Math.round(r * 0.65), baseGreen, midGreen, lightGreen, highlightGreen);
    // Top crest lobe
    drawFoliageCluster(trunkX - 1, cy - Math.round(r * 0.5), Math.round(r * 0.6), Math.round(r * 0.5), baseGreen, midGreen, lightGreen, highlightGreen);
  };

  // Trailing hanging moss drapes down a cliff edge
  const drawMossDrapes = (x: number, y: number, width: number, maxDrape: number) => {
    fillRect(x, y, width, 4, [21, 128, 61, 255]); // moss turf base #15803d
    fillRect(x + 2, y, width - 4, 2, [74, 222, 128, 255]); // sunlit moss edge #4ade80
    // Trailing tendril drips
    for (let i = 2; i < width - 2; i += 4) {
      const len = 3 + ((i * 7 + x) % (maxDrape - 2));
      fillRect(x + i, y + 2, 2, len, [21, 128, 61, 255]);
      setPixel(x + i, y + 2 + len, 34, 197, 94); // bright tip
    }
  };

  // =========================================================================
  // LAYER 0: FAR-DISTANT PALE WOODED MONOLITHS & VALLEY HORIZON (y=65..290)
  // Eliminates empty sky / blank blue in the center gap!
  // =========================================================================

  // Distant pale plateaus and wooded pillars in center valley
  // 1. Center-left distant monolith (x=330..430, rising up to y=70!)
  const distPillar1Left = (y: number) => {
    if (y < 70) return 350;
    if (y < 120) return 335;
    if (y < 180) return 330;
    return 320;
  };
  const distPillar1Right = (y: number) => {
    if (y < 70) return 420;
    if (y < 110) return 426;
    if (y < 170) return 435;
    return 445;
  };
  for (let y = 70; y < 270; y++) {
    const lx = distPillar1Left(y);
    const rx = distPillar1Right(y);
    for (let x = lx; x <= rx; x++) {
      const isEastShadow = x > (lx + rx) / 2 + 10;
      const isStrata = (Math.floor(y / 12) % 2 === 0);
      let col: [number, number, number, number] = isEastShadow
        ? [75, 125, 138, 240] // distant shadow stone
        : [98, 155, 168, 240]; // distant sunny stone
      if (isStrata) {
        col = isEastShadow ? [68, 116, 128, 240] : [90, 144, 156, 240];
      }
      setPixel(x, y, col[0], col[1], col[2], col[3]);
    }
  }
  // Distant Pillar 1 summit moss & grove
  fillRect(344, 68, 76, 4, [45, 115, 88, 230]);
  fillRect(350, 68, 64, 2, [75, 155, 120, 230]);
  drawLushTree(365, 68, 26, 16, true);
  drawLushTree(395, 68, 22, 14, true);

  // 2. Center-right distant monolith (x=460..550, rising up to y=80!)
  for (let y = 80; y < 270; y++) {
    const lx = 465 + Math.round(Math.sin(y * 0.05) * 4);
    const rx = 545 + Math.round(Math.cos(y * 0.04) * 6);
    for (let x = lx; x <= rx; x++) {
      const isEastShadow = x > (lx + rx) / 2 + 8;
      const isStrata = (Math.floor(y / 10) % 2 === 0);
      let col: [number, number, number, number] = isEastShadow
        ? [70, 118, 130, 240]
        : [92, 148, 160, 240];
      if (isStrata) {
        col = isEastShadow ? [64, 110, 122, 240] : [84, 138, 150, 240];
      }
      setPixel(x, y, col[0], col[1], col[2], col[3]);
    }
  }
  fillRect(472, 78, 68, 4, [45, 115, 88, 230]);
  fillRect(478, 78, 56, 2, [75, 155, 120, 230]);
  drawLushTree(490, 78, 24, 15, true);
  drawLushTree(520, 78, 20, 13, true);

  // 3. Far Distant Valley Forest Canopy across the central gap (y=180..260)
  for (let tree = 14; tree < 32; tree++) {
    const tx = tree * 26 + 8;
    const ty = 210 + ((tree * 7) % 20);
    drawFoliageCluster(tx, ty, 18, 14, [25, 80, 60, 220], [35, 105, 80, 220], [50, 135, 105, 220], [75, 165, 130, 220]);
  }

  // =========================================================================
  // LAYER 1: MIDGROUND WEATHERED CLIFFS & INTERMEDIATE PILLARS
  // =========================================================================

  // Far Left Midground Crag (x=0..200, y=90..320)
  for (let y = 96; y < 320; y++) {
    const rx = Math.min(WIDTH, Math.round(180 - (y - 96) * 0.15 + Math.sin(y * 0.08) * 8));
    for (let x = 0; x < rx; x++) {
      const isShadow = x > rx - 20;
      const isStrata = (Math.floor(y / 14) % 2 === 0);
      const baseR = isShadow ? 42 : 58;
      const baseG = isShadow ? 82 : 110;
      const baseB = isShadow ? 96 : 126;
      const mod = isStrata ? -8 : 6;
      setPixel(x, y, baseR + mod, baseG + mod, baseB + mod, 245);
    }
  }

  // Far Right Midground Bluff (x=760..WIDTH, y=86..320)
  for (let y = 86; y < 320; y++) {
    const lx = Math.max(0, Math.round(770 + (y - 86) * 0.12 - Math.sin(y * 0.07) * 8));
    for (let x = lx; x < WIDTH; x++) {
      const isShadow = x > lx + 45;
      const isStrata = (Math.floor(y / 13) % 2 === 0);
      const baseR = isShadow ? 40 : 56;
      const baseG = isShadow ? 80 : 108;
      const baseB = isShadow ? 94 : 124;
      const mod = isStrata ? -8 : 6;
      setPixel(x, y, baseR + mod, baseG + mod, baseB + mod, 245);
    }
  }

  // =========================================================================
  // LAYER 2: FOREGROUND MAIN WEATHERED STONE PILLARS (Irregular, organic, 5 shades)
  // =========================================================================

  // Procedural Geological Pillar Renderer with irregular stepped contours & strata
  const drawGeologicalPillar = (
    topY: number,
    baseY: number,
    leftProfile: (y: number) => number,
    rightProfile: (y: number) => number,
    fissures: number[],
    mossShelves: { y: number; x: number; w: number; drape: number }[]
  ) => {
    // 5 stone shades:
    // [1] Highlight crest: [107, 163, 178, 255] #6ba3b4
    // [2] Sunlit face:     [73, 129, 146, 255]  #498192
    // [3] Mid stone:       [51, 99, 114, 255]   #336372
    // [4] Shadow stone:    [33, 70, 82, 255]    #214652
    // [5] Crevice shadow:  [17, 39, 48, 255]    #112730

    for (let y = topY; y <= baseY; y++) {
      const lx = Math.max(0, leftProfile(y));
      const rx = Math.min(WIDTH - 1, rightProfile(y));
      if (rx <= lx) continue;

      const pillarWidth = rx - lx;
      const sunThreshold = lx + pillarWidth * 0.52;

      // Sedimentary horizontal strata band (every 8 to 14px)
      const strataId = Math.floor(y / 8);
      const isDarkStrata = strataId % 3 === 0;
      const isLightStrata = strataId % 3 === 2;

      for (let x = lx; x <= rx; x++) {
        let col: [number, number, number, number];

        // Is this pixel close to a vertical fissure?
        let isFissure = false;
        for (const fx of fissures) {
          if (Math.abs(x - fx) <= 2 && y > topY + 12) {
            isFissure = true;
            break;
          }
        }

        if (isFissure) {
          col = [17, 39, 48, 255]; // Crevice fissure shadow
        } else if (x > sunThreshold) {
          // East shadow facet
          col = isDarkStrata ? [26, 56, 66, 255] : isLightStrata ? [40, 82, 95, 255] : [33, 70, 82, 255];
        } else if (x === lx || y === topY) {
          // Sunlit edge highlight
          col = [107, 163, 178, 255];
        } else {
          // Sunny west stone face
          col = isDarkStrata ? [45, 88, 102, 255] : isLightStrata ? [85, 142, 158, 255] : [73, 129, 146, 255];
        }

        canvas[y][x] = col;
      }
    }

    // Flat broken summit cap & moss
    const summitLx = leftProfile(topY);
    const summitRx = rightProfile(topY);
    const summitW = summitRx - summitLx;
    drawMossDrapes(summitLx, topY, summitW, 10);

    // Interior moss shelves
    for (const s of mossShelves) {
      drawMossDrapes(s.x, s.y, s.w, s.drape);
    }
  };

  // -------------------------------------------------------------------------
  // PILLAR 1: LEFT MASSIVE MONOLITH (x=24..230, rises to y=48!)
  // Irregular profile with stepped cutouts, overhang at y=95, and jutting terrace at y=135
  // -------------------------------------------------------------------------
  const p1Left = (y: number) => {
    if (y < 48) return 50;
    if (y < 70) return 46;
    if (y < 95) return 34; // overhang steps out
    if (y < 135) return 42; // niche steps in
    if (y < 175) return 22; // lower shelf steps out
    if (y < 230) return 30;
    return 16; // buttress base
  };
  const p1Right = (y: number) => {
    if (y < 48) return 150;
    if (y < 85) return 158;
    if (y < 120) return 146; // niche
    if (y < 160) return 210; // prominent jutting shelf!
    if (y < 210) return 174;
    return 228; // base
  };

  drawGeologicalPillar(
    48,
    330,
    p1Left,
    p1Right,
    [84, 146],
    [
      { y: 135, x: 148, w: 60, drape: 12 },
      { y: 175, x: 22, w: 28, drape: 8 },
      { y: 225, x: 174, w: 45, drape: 10 }
    ]
  );

  // Rich Trees perched on Pillar 1
  drawLushTree(74, 48, 38, 24);   // Major summit oak
  drawLushTree(118, 52, 32, 20);  // Secondary summit pine/oak
  drawLushTree(175, 135, 30, 20); // Tree on right jutting terrace
  drawLushTree(28, 175, 22, 14);  // Bushy tree on left shelf

  // -------------------------------------------------------------------------
  // PILLAR 2: LEFT-CENTER WEATHERED COLUMN (x=244..322, rises to y=102!)
  // -------------------------------------------------------------------------
  const p2Left = (y: number) => {
    if (y < 102) return 254;
    if (y < 150) return 248;
    if (y < 220) return 244;
    return 240;
  };
  const p2Right = (y: number) => {
    if (y < 102) return 308;
    if (y < 140) return 312;
    if (y < 200) return 302;
    return 322;
  };

  drawGeologicalPillar(
    102,
    330,
    p2Left,
    p2Right,
    [278],
    [{ y: 180, x: 246, w: 32, drape: 8 }]
  );

  drawLushTree(274, 102, 30, 18);

  // -------------------------------------------------------------------------
  // PILLAR 3: RIGHT MASSIVE CLIFF COMPLEX (x=584..774, rises to y=52!)
  // -------------------------------------------------------------------------
  const p3Left = (y: number) => {
    if (y < 52) return 620;
    if (y < 90) return 612;
    if (y < 140) return 590; // steps out
    if (y < 210) return 604;
    return 584;
  };
  const p3Right = (y: number) => {
    if (y < 52) return 722;
    if (y < 85) return 730;
    if (y < 130) return 712;
    if (y < 170) return 766; // prominent terrace shelf!
    if (y < 240) return 736;
    return 774;
  };

  drawGeologicalPillar(
    52,
    330,
    p3Left,
    p3Right,
    [662, 712],
    [
      { y: 130, x: 712, w: 54, drape: 14 },
      { y: 195, x: 594, w: 36, drape: 8 }
    ]
  );

  // Rich Trees perched on Pillar 3
  drawLushTree(644, 52, 36, 22);
  drawLushTree(686, 56, 32, 20);
  drawLushTree(734, 130, 28, 18); // Shelf tree

  // -------------------------------------------------------------------------
  // PILLAR 4: FAR-RIGHT WOODED BLUFF (x=804..WIDTH, rises to y=76!)
  // -------------------------------------------------------------------------
  const p4Left = (y: number) => {
    if (y < 76) return 824;
    if (y < 120) return 814;
    if (y < 180) return 804;
    return 796;
  };
  const p4Right = (y: number) => WIDTH;

  drawGeologicalPillar(
    76,
    330,
    p4Left,
    p4Right,
    [874],
    [{ y: 150, x: 810, w: 50, drape: 10 }]
  );

  drawLushTree(838, 76, 34, 22);
  drawLushTree(894, 80, 30, 18);
  drawLushTree(945, 84, 28, 16);

  // =========================================================================
  // LAYER 3: NEAR HORIZON FOREST CANOPY (y=240..340)
  // Continuous rich forest canopy lining the valley floor
  // =========================================================================
  for (let tree = 0; tree < 52; tree++) {
    const tx = tree * 19 + 6;
    const h = 26 + ((tree * 13) % 24);
    const cy = 330 - h;
    const rad = 14 + ((tree * 7) % 8);
    drawFoliageCluster(
      tx,
      cy,
      rad,
      Math.round(rad * 0.8),
      [10, 48, 30, 255],
      [18, 86, 48, 255],
      [22, 138, 70, 255],
      [74, 222, 128, 255]
    );
  }

  // =========================================================================
  // LAYER 4: DELICATE VALLEY AERIAL HAZE (y=210..340)
  // Keeps foreground creatures, bridge, and terrain tiles completely readable
  // =========================================================================
  for (let y = 210; y < 340; y++) {
    const hazeAlpha = Math.min(0.44, (y - 210) / 240);
    for (let x = 0; x < WIDTH; x++) {
      const cur = canvas[y][x];
      canvas[y][x] = [
        Math.round(cur[0] * (1 - hazeAlpha) + 165 * hazeAlpha),
        Math.round(cur[1] * (1 - hazeAlpha) + 243 * hazeAlpha),
        Math.round(cur[2] * (1 - hazeAlpha) + 252 * hazeAlpha),
        255
      ];
    }
  }

  // =========================================================================
  // 5. FOREGROUND: LIVING GARDEN BIOME WORLD TILES & FLORA
  // =========================================================================
  const world = createStarterWorld('greenhouse', 'living_garden');

  for (let gy = 0; gy < GRID_HEIGHT; gy++) {
    for (let gx = 0; gx < GRID_WIDTH; gx++) {
      const mat = world.tiles[gy][gx];
      if (mat === 'air') continue;

      const pxStart = Math.round(gx * TILE_WIDTH);
      const pxEnd = Math.round((gx + 1) * TILE_WIDTH);
      const pyStart = Math.round(gy * TILE_HEIGHT);
      const pyEnd = Math.round((gy + 1) * TILE_HEIGHT);

      for (let py = pyStart; py < pyEnd; py++) {
        for (let px = pxStart; px < pxEnd; px++) {
          if (py >= HEIGHT || px >= WIDTH) continue;

          const localX = px - pxStart;
          const localY = py - pyStart;

          if (mat === 'grass') {
            if (localY < 4) {
              canvas[py][px] = (localX % 4 === 1 && localY === 0) ? [16, 185, 129, 255] : [5, 150, 105, 255];
            } else if (localY < 8) {
              canvas[py][px] = [4, 120, 87, 255];
            } else {
              canvas[py][px] = [6, 78, 59, 255];
            }
          } else if (mat === 'dirt') {
            if ((px * 7 + py * 13) % 29 === 0) {
              canvas[py][px] = [120, 113, 108, 255]; // pebble
            } else {
              canvas[py][px] = [69, 39, 19, 255];
            }
          } else if (mat === 'stone') {
            if (localY === 0 || localX === 0 || localY === Math.round(TILE_HEIGHT) - 1) {
              canvas[py][px] = [30, 41, 59, 255];
            } else {
              canvas[py][px] = [71, 85, 105, 255];
            }
          } else if (mat === 'wood') {
            if (localY === 0 || localY === 10) {
              canvas[py][px] = [69, 26, 3, 255];
            } else {
              canvas[py][px] = [154, 52, 18, 255];
            }
          } else if (mat === 'water') {
            if (localY <= 2) {
              canvas[py][px] = [165, 243, 252, 220]; // white/cyan foam ripple
            } else {
              canvas[py][px] = [6, 182, 212, 190]; // clear pond water
            }
          }
        }
      }
    }
  }

  // 6. RENDER DECORATIONS & GROUNDED CREATURES
  for (const decor of world.decorations) {
    const rx = Math.round(decor.gridX * TILE_WIDTH + 10);
    const ry = Math.round(decor.gridY * TILE_HEIGHT);

    if (decor.type === 'shelter') {
      for (let y = ry - 40; y < ry; y++) {
        for (let x = rx - 35; x <= rx + 35; x++) {
          if (x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT) {
            const dy = y - (ry - 40);
            if (dy < 14 && Math.abs(x - rx) <= 35 - dy * 0.8) {
              canvas[y][x] = [180, 83, 9, 255]; // thatch
            } else if (dy >= 14 && Math.abs(x - rx) <= 25) {
              if (Math.abs(x - rx) <= 8 && dy >= 20) {
                canvas[y][x] = [253, 224, 71, 255]; // cozy warm lantern glow
              } else {
                canvas[y][x] = [92, 58, 33, 255]; // wooden wall
              }
            }
          }
        }
      }
    } else if (decor.type === 'seed') {
      for (let y = ry - 22; y < ry; y++) {
        for (let x = rx - 8; x <= rx + 8; x++) {
          if (x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT) {
            const dy = y - (ry - 22);
            if (dy > 16) {
              canvas[y][x] = [69, 39, 19, 255];
            } else if (Math.abs(x - rx) <= 1 && dy >= 6) {
              canvas[y][x] = [22, 163, 74, 255];
            } else if (Math.abs(x - rx) <= 4 && dy >= 8 && dy <= 12) {
              canvas[y][x] = [74, 222, 128, 255];
            } else if (Math.abs(x - rx) <= 3 && dy < 6) {
              canvas[y][x] = [244, 63, 94, 255];
            }
          }
        }
      }
    } else if (decor.type === 'flower') {
      for (let y = ry - 18; y < ry; y++) {
        for (let x = rx - 6; x <= rx + 6; x++) {
          if (x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT) {
            const dy = y - (ry - 18);
            if (Math.abs(x - rx) <= 1 && dy >= 5) {
              canvas[y][x] = [22, 163, 74, 255];
            } else if (Math.abs(x - rx) <= 5 && dy < 5) {
              canvas[y][x] = [251, 191, 36, 255];
            }
          }
        }
      }
    }
  }

  // 7. Render Creatures with Proven Grounding
  const muggle = INITIAL_ODDLINGS[0]; // Coffee mug
  const clickerWhiskers = sanitizeCreature(legacyClickerWhiskersRecord); // Computer mouse
  const tinefang = INITIAL_ODDLINGS[2] || INITIAL_ODDLINGS[1]; // Fork

  const testCreatures = [
    { dna: muggle, gridX: 11, gridY: 12 },            // Elevated terrace
    { dna: clickerWhiskers!, gridX: 22, gridY: 15 }, // Footbridge above pond
    { dna: tinefang, gridX: 27, gridY: 16 }           // Knoll bank
  ];

  for (const c of testCreatures) {
    if (!c.dna) continue;
    const feetX = Math.round(c.gridX * TILE_WIDTH + 10);
    const feetY = Math.round(c.gridY * TILE_HEIGHT);

    const svgMarkup = renderToStaticMarkup(
      React.createElement(OddlingAvatar, {
        creature: c.dna,
        size: 72,
        mood: 'happy'
      })
    );

    const rectMatches = [...svgMarkup.matchAll(/<rect\s+([^>]+)>/g)];
    for (const m of rectMatches) {
      const attrs = m[1];
      const xMatch = attrs.match(/x="([\d.]+)"/);
      const yMatch = attrs.match(/y="([\d.]+)"/);
      const wMatch = attrs.match(/width="([\d.]+)"/);
      const hMatch = attrs.match(/height="([\d.]+)"/);
      const fillMatch = attrs.match(/fill="([^"]+)"/);

      if (xMatch && yMatch && wMatch && hMatch && fillMatch) {
        const svgX = parseFloat(xMatch[1]);
        const svgY = parseFloat(yMatch[1]);
        const svgW = parseFloat(wMatch[1]);
        const svgH = parseFloat(hMatch[1]);
        const fillColor = parseSvgColor(fillMatch[1]);

        if (fillColor[3] === 0) continue;

        const scale = 72 / 36; // 2
        const localPixelX = Math.round(svgX * scale);
        const localPixelY = Math.round(svgY * scale);
        const localPixelW = Math.max(1, Math.round(svgW * scale));
        const localPixelH = Math.max(1, Math.round(svgH * scale));

        const destX = feetX - 36 + localPixelX;
        const destY = feetY - 62 + localPixelY;

        for (let py = destY; py < destY + localPixelH; py++) {
          for (let px = destX; px < destX + localPixelW; px++) {
            if (px >= 0 && px < WIDTH && py >= 0 && py < HEIGHT) {
              setPixel(px, py, fillColor[0], fillColor[1], fillColor[2], fillColor[3]);
            }
          }
        }
      }
    }
  }

  const pngBuffer = createPngBuffer(WIDTH, HEIGHT, (x, y) => canvas[y][x]);
  fs.writeFileSync(outputPath, pngBuffer);
  console.log(`Successfully generated Greenhouse verification screenshot at: ${outputPath}`);
}

const targetPath = path.join(process.cwd(), 'public', 'greenhouse_verification.png');
renderGreenhouseToPng(targetPath);
