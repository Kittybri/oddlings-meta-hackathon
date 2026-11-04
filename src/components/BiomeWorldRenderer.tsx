import { renderToStaticMarkup } from 'react-dom/server';
import {WindPlant,WindTree} from './WindPlant';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GrassLayer } from './GrassLayer';
import type { GrassWalker } from '../game/grassMotion';
import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  BiomeWorldState,
  DecorationInstance,
  DecorationType,
  EditorTool,
  HabitatThemeId,
  TileMaterial
} from '../game/biomeWorldTypes';
import {
  GRID_WIDTH,
  GRID_HEIGHT,
  isSolidTile,
  isWaterTile,
  computeSeedGrowth,
  canPlaceDecoration,
  findSupportingSurfaceForProp,
  DECOR_TILES
} from '../game/biomeWorld';


// Things that light up at night and in the rain: halo color, halo width (share of the prop) and height of its center
const DECOR_GLOW: Record<string, { color: string; size: number; top: number }> = {
  cottage: { color: '#ffc86b', size: 1.7, top: 55 },
  shelter: { color: '#ffc86b', size: 1.5, top: 55 },
  lantern: { color: '#ffd27a', size: 3.4, top: 35 },
  lamppost: { color: '#ffe7a2', size: 1.6, top: 18 },
  campfire: { color: '#ff8a3d', size: 2.4, top: 65 },
  crystal: { color: '#8ee9ff', size: 2.2, top: 55 }
};

import { GardenProp } from './GardenProp';
// The World's scenery is one long panorama, one picture per region from the coast on the left, through the
// home waterfalls, valleys and floating islands, out to open sea. Their skies are see-through, so the moving
// sun and clouds show behind them.
import sceneM2 from '../../peak-m2.webp';
import sceneM1 from '../../tb3-m1.webp';
import scene0 from '../../tb3-0.webp';
import scene1 from '../../tb3-1.webp';
import scene2 from '../../tb3-2.webp';
import scene3 from '../../tb3-3.webp';
import scene4 from '../../tb3-4.webp';
import scene5 from '../../tb3-5.webp';
import scene6 from '../../peak-6.webp';
import falls0 from '../../finfall-0.png';
import falls1 from '../../finfall-1b.png';
import falls2 from '../../finfall-2.png';
import falls3 from '../../finfall-3.png';
import falls4 from '../../finfall-4.png';
import falls5 from '../../finfall-5.png';
import bdSea from '../../fin-sea.webp';
// One long panorama (cut out by Codex) in equal pieces, so each region's edge continues exactly into its neighbor's
const REGION_BACKDROPS: Record<number, string> = { [-2]: sceneM2, [-1]: sceneM1, 0: scene0, 1: scene1, 2: scene2, 3: scene3, 4: scene4, 5: scene5, 6: scene6 };
// Where each piece's waterfalls are (marked by hand), for the moving pixel flow drawn over them
import leavesM2 from '../../leaves-m2.png';
import leavesM1 from '../../leaves-m1.png';
import leaves0 from '../../leaves-0.png';
import leaves1 from '../../leaves-1.png';
import leaves2 from '../../leaves-2.png';
import leaves3 from '../../leaves-3.png';
import leaves4 from '../../leaves-4.png';
import leaves5 from '../../leaves-5.png';
import leaves6 from '../../leaves-6.png';
// Where each piece's trees and greenery are, for the gentle wind sway drawn over them
const REGION_LEAVES: Record<number, string> = { [-2]: leavesM2, [-1]: leavesM1, 0: leaves0, 1: leaves1, 2: leaves2, 3: leaves3, 4: leaves4, 5: leaves5, 6: leaves6 };
import bgTree0 from '../../bgtree-m1-1.png';
import bgTree1 from '../../bgtree-0-1.png';
import bgTree2 from '../../bgtree-0-2.png';
import bgTree3 from '../../bgtree-0-3.png';
import bgTree4 from '../../bgtree-0-4.png';
import bgTree5 from '../../bgtree-0-5.png';
import bgTree6 from '../../bgtree-0-6.png';
import bgTree7 from '../../bgtree-0-7.png';
import bgTree8 from '../../bgtree-0-8.png';
import bgTree9 from '../../bgtree-0-9.png';
import bgTree10 from '../../bgtree-0-10.png';
import bgTree11 from '../../bgtree-0-11.png';
import bgTree12 from '../../bgtree-0-12.png';
import bgTree13 from '../../bgtree-0-13.png';
import bgTree14 from '../../bgtree-0-14.png';
import bgTree15 from '../../bgtree-0-15.png';
import bgTree16 from '../../bgtree-0-16.png';
import bgTree17 from '../../bgtree-0-18.png';
import bgTree18 from '../../bgtree-1-1.png';
import bgTree19 from '../../bgtree-1-2.png';
import bgTree20 from '../../bgtree-1-3.png';
import bgTree21 from '../../bgtree-1-4.png';
import bgTree22 from '../../bgtree-1-5.png';
import bgTree23 from '../../bgtree-1-6.png';
import bgTree24 from '../../bgtree-1-7.png';
import bgTree25 from '../../bgtree-1-8.png';
import bgTree26 from '../../bgtree-1-9.png';
import bgTree27 from '../../bgtree-1-10.png';
import bgTree28 from '../../bgtree-1-11.png';
import bgTree29 from '../../bgtree-1-12.png';
import bgTree30 from '../../bgtree-1-13.png';
import bgTree31 from '../../bgtree-1-14.png';
import bgTree32 from '../../bgtree-1-15.png';
import bgTree33 from '../../bgtree-1-16.png';
import bgTree34 from '../../bgtree-1-17.png';
import bgTree35 from '../../bgtree-1-18.png';
import bgTree36 from '../../bgtree-1-19.png';
import bgTree37 from '../../bgtree-1-20.png';
import bgTree38 from '../../bgtree-1-21.png';
import bgTree39 from '../../bgtree-1-22.png';
import bgTree40 from '../../bgtree-1-23.png';
import bgTree41 from '../../bgtree-2-1.png';
import bgTree42 from '../../bgtree-2-2.png';
import bgTree43 from '../../bgtree-2-3.png';
import bgTree44 from '../../bgtree-2-4.png';
import bgTree45 from '../../bgtree-2-5.png';
import bgTree46 from '../../bgtree-2-6.png';
import bgTree47 from '../../bgtree-2-7.png';
import bgTree48 from '../../bgtree-2-8.png';
import bgTree49 from '../../bgtree-2-9.png';
import bgTree50 from '../../bgtree-2-10.png';
import bgTree51 from '../../bgtree-2-11.png';
import bgTree52 from '../../bgtree-2-12.png';
import bgTree53 from '../../bgtree-2-13.png';
import bgTree54 from '../../bgtree-2-14.png';
import bgTree55 from '../../bgtree-2-15.png';
import bgTree56 from '../../bgtree-2-16.png';
import bgTree57 from '../../bgtree-2-17.png';
import bgTree58 from '../../bgtree-2-18.png';
import bgTree59 from '../../bgtree-2-19.png';
import bgTree60 from '../../bgtree-2-22.png';
import bgTree61 from '../../bgtree-3-1.png';
import bgTree62 from '../../bgtree-3-2.png';
import bgTree63 from '../../bgtree-3-3.png';
import bgTree64 from '../../bgtree-3-4.png';
import bgTree65 from '../../bgtree-3-5.png';
import bgTree66 from '../../bgtree-3-6.png';
import bgTree67 from '../../bgtree-3-7.png';
import bgTree68 from '../../bgtree-3-8.png';
import bgTree69 from '../../bgtree-3-9.png';
import bgTree70 from '../../bgtree-3-10.png';
import bgTree71 from '../../bgtree-3-11.png';
import bgTree72 from '../../bgtree-3-12.png';
import bgTree73 from '../../bgtree-3-13.png';
import bgTree74 from '../../bgtree-3-14.png';
import bgTree75 from '../../bgtree-3-15.png';
import bgTree76 from '../../bgtree-3-16.png';
import bgTree77 from '../../bgtree-4-1.png';
import bgTree78 from '../../bgtree-4-2.png';
import bgTree79 from '../../bgtree-4-3.png';
import bgTree80 from '../../bgtree-4-4.png';
import bgTree81 from '../../bgtree-4-5.png';
import bgTree82 from '../../bgtree-4-6.png';
import bgTree83 from '../../bgtree-4-7.png';
import bgTree84 from '../../bgtree-4-8.png';
import bgTree85 from '../../bgtree-4-9.png';
import bgTree86 from '../../bgtree-4-10.png';
import bgTree87 from '../../bgtree-4-11.png';
import bgTree88 from '../../bgtree-4-12.png';
import bgTree89 from '../../bgtree-4-13.png';
import bgTree90 from '../../bgtree-4-14.png';
import bgTree91 from '../../bgtree-4-15.png';
import bgTree92 from '../../bgtree-4-16.png';
import bgTree93 from '../../bgtree-4-17.png';
import bgTree94 from '../../bgtree-4-18.png';
import bgTree95 from '../../bgtree-4-19.png';
import bgTree96 from '../../bgtree-5-1.png';
import bgTree97 from '../../bgtree-5-2.png';
import bgTree98 from '../../bgtree-5-3.png';
import bgTree99 from '../../bgtree-5-4.png';
import bgTree100 from '../../bgtree-5-5.png';
import bgTree101 from '../../bgtree-5-6.png';
import bgTree102 from '../../bgtree-5-7.png';
import bgTree103 from '../../bgtree-5-8.png';
import bgTree104 from '../../bgtree-5-9.png';
import bgTree105 from '../../bgtree-5-10.png';
// Trees cut out of the scenery (by Codex) so they can sway on their own; x/y/w/h and the trunk pivot are in piece pixels (1282x512)
const REGION_TREES: Record<number, { src: string; x: number; y: number; w: number; h: number; px: number; py: number; d: number }[]> = {
  [-1]: [
    { src: bgTree0, x: 1253, y: 306, w: 41, h: 31, px: 21, py: 30, d: -0.9 }
  ],
  0: [
    { src: bgTree0, x: -27, y: 306, w: 41, h: 31, px: 21, py: 30, d: -0.9 },
    { src: bgTree1, x: 262, y: 65, w: 37, h: 40, px: 16, py: 37, d: -2.9 },
    { src: bgTree2, x: 73, y: 212, w: 49, h: 46, px: 25, py: 43, d: -2.7 },
    { src: bgTree3, x: 452, y: 266, w: 30, h: 32, px: 16, py: 28, d: -0.2 },
    { src: bgTree4, x: 520, y: 202, w: 48, h: 43, px: 23, py: 40, d: -0.6 },
    { src: bgTree5, x: 580, y: 127, w: 23, h: 32, px: 10, py: 29, d: -0.1 },
    { src: bgTree6, x: 705, y: 77, w: 48, h: 41, px: 24, py: 38, d: -0.6 },
    { src: bgTree7, x: 747, y: 65, w: 38, h: 44, px: 15, py: 41, d: -2.4 },
    { src: bgTree8, x: 761, y: 166, w: 36, h: 27, px: 16, py: 23, d: -2.5 },
    { src: bgTree9, x: 826, y: 198, w: 89, h: 72, px: 44, py: 68, d: -1.6 },
    { src: bgTree10, x: 918, y: 240, w: 36, h: 30, px: 16, py: 27, d: -2.6 },
    { src: bgTree11, x: 959, y: 299, w: 53, h: 43, px: 25, py: 42, d: -1.0 },
    { src: bgTree12, x: 1061, y: 197, w: 29, h: 29, px: 14, py: 27, d: -1.8 },
    { src: bgTree13, x: 1116, y: 240, w: 78, h: 66, px: 38, py: 60, d: -1.2 },
    { src: bgTree14, x: 1156, y: 107, w: 41, h: 42, px: 17, py: 39, d: -1.3 },
    { src: bgTree15, x: 1127, y: 134, w: 27, h: 28, px: 11, py: 27, d: -1.1 },
    { src: bgTree16, x: 1194, y: 125, w: 31, h: 23, px: 14, py: 22, d: -1.3 },
    { src: bgTree17, x: 554, y: 130, w: 26, h: 33, px: 14, py: 28, d: -2.8 }
  ],
  1: [
    { src: bgTree18, x: 205, y: 72, w: 44, h: 36, px: 17, py: 34, d: -1.1 },
    { src: bgTree19, x: 67, y: 132, w: 51, h: 44, px: 28, py: 41, d: -2.5 },
    { src: bgTree20, x: 13, y: 191, w: 32, h: 35, px: 17, py: 33, d: -2.4 },
    { src: bgTree21, x: 42, y: 253, w: 53, h: 47, px: 24, py: 43, d: -1.3 },
    { src: bgTree22, x: 204, y: 213, w: 100, h: 83, px: 50, py: 76, d: -2.7 },
    { src: bgTree23, x: 304, y: 193, w: 50, h: 40, px: 25, py: 37, d: -2.7 },
    { src: bgTree24, x: 396, y: 260, w: 50, h: 42, px: 23, py: 39, d: -3.2 },
    { src: bgTree25, x: 695, y: 178, w: 38, h: 30, px: 18, py: 27, d: -3.9 },
    { src: bgTree26, x: 759, y: 114, w: 38, h: 33, px: 20, py: 31, d: -1.5 },
    { src: bgTree27, x: 801, y: 84, w: 47, h: 45, px: 22, py: 42, d: -1.9 },
    { src: bgTree28, x: 881, y: 67, w: 29, h: 27, px: 17, py: 26, d: -0.8 },
    { src: bgTree29, x: 900, y: 45, w: 46, h: 45, px: 21, py: 42, d: -3.5 },
    { src: bgTree30, x: 1060, y: 145, w: 28, h: 30, px: 13, py: 26, d: -1.5 },
    { src: bgTree31, x: 1148, y: 81, w: 43, h: 37, px: 22, py: 36, d: -3.9 },
    { src: bgTree32, x: 1210, y: 87, w: 54, h: 48, px: 24, py: 47, d: -1.1 },
    { src: bgTree33, x: 808, y: 232, w: 147, h: 115, px: 70, py: 107, d: -3.2 },
    { src: bgTree34, x: 1111, y: 300, w: 64, h: 50, px: 33, py: 48, d: -3.7 },
    { src: bgTree35, x: 1017, y: 285, w: 41, h: 35, px: 20, py: 32, d: -1.4 },
    { src: bgTree36, x: 767, y: 296, w: 39, h: 32, px: 19, py: 30, d: -1.7 },
    { src: bgTree37, x: 774, y: 217, w: 43, h: 29, px: 23, py: 26, d: -2.9 },
    { src: bgTree38, x: 892, y: 172, w: 53, h: 31, px: 27, py: 30, d: 0.0 },
    { src: bgTree39, x: 54, y: 160, w: 31, h: 24, px: 16, py: 23, d: -1.8 },
    { src: bgTree40, x: 269, y: 149, w: 33, h: 31, px: 15, py: 30, d: -1.0 }
  ],
  2: [
    { src: bgTree41, x: 23, y: 145, w: 70, h: 60, px: 34, py: 58, d: -3.6 },
    { src: bgTree42, x: 90, y: 168, w: 37, h: 38, px: 19, py: 35, d: -1.4 },
    { src: bgTree43, x: 159, y: 191, w: 54, h: 38, px: 27, py: 37, d: -0.6 },
    { src: bgTree44, x: 281, y: 223, w: 56, h: 45, px: 27, py: 42, d: -3.6 },
    { src: bgTree45, x: 409, y: 255, w: 41, h: 40, px: 21, py: 39, d: -2.8 },
    { src: bgTree46, x: 465, y: 271, w: 37, h: 30, px: 17, py: 27, d: -2.8 },
    { src: bgTree47, x: 343, y: 266, w: 35, h: 26, px: 18, py: 23, d: -3.9 },
    { src: bgTree48, x: 72, y: 246, w: 155, h: 129, px: 73, py: 120, d: -0.2 },
    { src: bgTree49, x: 705, y: 277, w: 66, h: 64, px: 32, py: 62, d: -0.6 },
    { src: bgTree50, x: 699, y: 191, w: 36, h: 33, px: 18, py: 31, d: -2.6 },
    { src: bgTree51, x: 753, y: 110, w: 43, h: 36, px: 19, py: 34, d: -0.1 },
    { src: bgTree52, x: 881, y: 158, w: 46, h: 35, px: 23, py: 33, d: -0.1 },
    { src: bgTree53, x: 830, y: 177, w: 43, h: 35, px: 20, py: 32, d: -2.1 },
    { src: bgTree54, x: 956, y: 213, w: 47, h: 40, px: 23, py: 39, d: -1.1 },
    { src: bgTree55, x: 1046, y: 208, w: 40, h: 27, px: 20, py: 26, d: -2.6 },
    { src: bgTree56, x: 1091, y: 196, w: 59, h: 37, px: 28, py: 36, d: -2.5 },
    { src: bgTree57, x: 1214, y: 227, w: 52, h: 39, px: 25, py: 36, d: -1.9 },
    { src: bgTree58, x: 1045, y: 259, w: 137, h: 114, px: 65, py: 110, d: -1.2 },
    { src: bgTree59, x: 231, y: 237, w: 41, h: 26, px: 22, py: 25, d: -0.8 },
    { src: bgTree60, x: 828, y: 124, w: 27, h: 22, px: 9, py: 21, d: -0.8 }
  ],
  3: [
    { src: bgTree61, x: 112, y: 278, w: 73, h: 58, px: 36, py: 55, d: -1.8 },
    { src: bgTree62, x: 49, y: 233, w: 39, h: 28, px: 19, py: 25, d: -0.2 },
    { src: bgTree63, x: 199, y: 181, w: 49, h: 35, px: 23, py: 34, d: -1.6 },
    { src: bgTree64, x: 274, y: 173, w: 37, h: 24, px: 17, py: 23, d: -3.7 },
    { src: bgTree65, x: 355, y: 157, w: 70, h: 55, px: 35, py: 53, d: -3.6 },
    { src: bgTree66, x: 599, y: 110, w: 44, h: 35, px: 20, py: 34, d: -0.3 },
    { src: bgTree67, x: 715, y: 168, w: 46, h: 29, px: 23, py: 28, d: -2.9 },
    { src: bgTree68, x: 813, y: 203, w: 79, h: 51, px: 38, py: 48, d: -2.0 },
    { src: bgTree69, x: 969, y: 190, w: 51, h: 36, px: 27, py: 34, d: -3.3 },
    { src: bgTree70, x: 1040, y: 179, w: 90, h: 58, px: 44, py: 55, d: -1.7 },
    { src: bgTree71, x: 504, y: 243, w: 62, h: 48, px: 31, py: 47, d: -1.7 },
    { src: bgTree72, x: 555, y: 257, w: 148, h: 114, px: 76, py: 110, d: -1.6 },
    { src: bgTree73, x: 819, y: 291, w: 43, h: 30, px: 24, py: 27, d: -0.6 },
    { src: bgTree74, x: 1193, y: 336, w: 28, h: 21, px: 14, py: 18, d: -3.9 },
    { src: bgTree75, x: 1122, y: 228, w: 46, h: 39, px: 23, py: 32, d: -1.8 },
    { src: bgTree76, x: 1213, y: 105, w: 40, h: 27, px: 18, py: 26, d: -0.6 },
    { src: bgTree95, x: 1252, y: 79, w: 59, h: 43, px: 29, py: 39, d: -0.1 }
  ],
  4: [
    { src: bgTree77, x: 315, y: 57, w: 49, h: 35, px: 20, py: 32, d: -1.6 },
    { src: bgTree78, x: 353, y: 14, w: 119, h: 84, px: 59, py: 79, d: -3.3 },
    { src: bgTree79, x: 28, y: 183, w: 127, h: 95, px: 64, py: 88, d: -2.5 },
    { src: bgTree80, x: 245, y: 212, w: 45, h: 31, px: 23, py: 29, d: -3.1 },
    { src: bgTree81, x: 427, y: 224, w: 83, h: 59, px: 43, py: 54, d: -2.1 },
    { src: bgTree82, x: 639, y: 226, w: 82, h: 56, px: 40, py: 53, d: -3.1 },
    { src: bgTree83, x: 716, y: 72, w: 70, h: 53, px: 38, py: 48, d: -2.8 },
    { src: bgTree84, x: 812, y: 66, w: 61, h: 47, px: 31, py: 42, d: -0.2 },
    { src: bgTree85, x: 859, y: 8, w: 148, h: 109, px: 72, py: 103, d: -3.7 },
    { src: bgTree86, x: 1002, y: 75, w: 58, h: 48, px: 27, py: 44, d: -3.9 },
    { src: bgTree87, x: 1097, y: 222, w: 59, h: 46, px: 31, py: 41, d: -2.5 },
    { src: bgTree88, x: 1147, y: 168, w: 120, h: 93, px: 61, py: 88, d: -1.3 },
    { src: bgTree89, x: 212, y: 62, w: 75, h: 53, px: 39, py: 48, d: -3.0 },
    { src: bgTree90, x: 462, y: 69, w: 49, h: 34, px: 23, py: 29, d: -0.1 },
    { src: bgTree91, x: 284, y: 329, w: 75, h: 59, px: 38, py: 53, d: -1.5 },
    { src: bgTree92, x: 396, y: 261, w: 36, h: 26, px: 18, py: 25, d: -3.5 },
    { src: bgTree93, x: 606, y: 262, w: 38, h: 25, px: 18, py: 24, d: -2.8 },
    { src: bgTree94, x: 942, y: 344, w: 49, h: 36, px: 19, py: 35, d: -2.6 },
    { src: bgTree95, x: -28, y: 79, w: 59, h: 43, px: 29, py: 39, d: -0.1 },
    { src: bgTree105, x: 1263, y: 43, w: 65, h: 50, px: 30, py: 46, d: -1.0 }
  ],
  5: [
    { src: bgTree96, x: 202, y: 8, w: 150, h: 109, px: 76, py: 102, d: -3.8 },
    { src: bgTree97, x: 338, y: 61, w: 68, h: 56, px: 35, py: 51, d: -2.9 },
    { src: bgTree98, x: 487, y: 57, w: 52, h: 39, px: 22, py: 37, d: -2.0 },
    { src: bgTree99, x: 720, y: 99, w: 106, h: 86, px: 53, py: 79, d: -1.7 },
    { src: bgTree100, x: 126, y: 94, w: 57, h: 47, px: 29, py: 44, d: -0.4 },
    { src: bgTree101, x: 166, y: 66, w: 52, h: 44, px: 25, py: 41, d: 0.0 },
    { src: bgTree102, x: 439, y: 223, w: 78, h: 59, px: 40, py: 53, d: -2.2 },
    { src: bgTree103, x: 508, y: 257, w: 41, h: 33, px: 21, py: 30, d: -0.7 },
    { src: bgTree104, x: 112, y: 305, w: 56, h: 43, px: 27, py: 38, d: -1.9 },
    { src: bgTree105, x: -17, y: 43, w: 65, h: 50, px: 30, py: 46, d: -1.0 }
  ]
};
const REGION_FALLS: Record<number, string> = { 0: falls0, 1: falls1, 2: falls2, 3: falls3, 4: falls4, 5: falls5 };
const regionBackdrop = (region: number) => REGION_BACKDROPS[region] ?? bdSea;

interface BiomeWorldRendererProps {
  world: BiomeWorldState;
  sharedSky?: boolean;
  /** Which World region this is, so it gets its own part of the scenery panorama */
  region?: number;
  grassActors?: React.RefObject<Record<string, GrassWalker>>;
  grassResidents?: readonly string[];
  heldCreatureId?: string;
  theme: HabitatThemeId;
  isEditMode: boolean;
  activeTool: EditorTool;
  brushSize: 1 | 2 | 3;
  onPaintStroke: (gridX: number, gridY: number) => void;
  onStrokeStart: () => void;
  onStrokeEnd: () => void;
  onPlaceDecoration: (decorType: DecorationType, gridX: number, gridY: number, customItemId?: string) => void;
  onRemoveDecoration: (decorId: string) => void;
  /** Build mode: a placed item dragged to a new spot */
  /** Build mode: a ground block dragged to a new cell (or to the trash, with no target) */
  onMoveTile?: (fromX: number, fromY: number, toX: number | null, toY: number | null) => void;
  onMoveDecoration?: (decorId: string, gridX: number, gridY: number) => void;
}

import { customItemLibrary } from '../game/customItemStore';
import { itemTiles } from '../game/customItems';

export const BiomeWorldRenderer: React.FC<BiomeWorldRendererProps> = React.memo(({
  world,
  sharedSky = false,
  region = 0,
  grassActors, grassResidents, heldCreatureId,
  theme,
  isEditMode,
  activeTool,
  brushSize,
  onPaintStroke,
  onStrokeStart,
  onStrokeEnd,
  onPlaceDecoration,
  onRemoveDecoration,
  onMoveDecoration,
  onMoveTile
}: BiomeWorldRendererProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hoverGrid, setHoverGrid] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const lastPaintedCell = useRef<{ x: number; y: number } | null>(null);

  // Compute cell dimensions from container bounds
  const getGridCoordsFromEvent = (e: React.PointerEvent): { x: number; y: number } | null => {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = e.clientX;
    const clientY = e.clientY;

    if (
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom
    ) {
      return null;
    }

    const relX = (clientX - rect.left) / rect.width;
    const relY = (clientY - rect.top) / rect.height;

    const gridX = Math.max(0, Math.min(GRID_WIDTH - 1, Math.floor(relX * GRID_WIDTH)));
    const gridY = Math.max(0, Math.min(GRID_HEIGHT - 1, Math.floor(relY * GRID_HEIGHT)));

    return { x: gridX, y: gridY };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isEditMode) return;
    if (activeTool.type === 'grab') { startTileDrag(e); return; } // grabbing moves blocks and items, it never paints
    const coords = getGridCoordsFromEvent(e);
    if (!coords) return;

    e.preventDefault();
    try {
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch (_) {
      // Ignore if pointer capture fails
    }

    setIsDragging(true);
    onStrokeStart();

    if (activeTool.type === 'decoration') {
      const placementCheck = canPlaceDecoration(world, activeTool.decorType, coords.x, coords.y, { snapToGround: true });
      if (placementCheck.allowed && placementCheck.snappedY !== undefined) {
        onPlaceDecoration(activeTool.decorType, coords.x, placementCheck.snappedY, activeTool.customItemId);
      }
    } else {
      lastPaintedCell.current = coords;
      onPaintStroke(coords.x, coords.y);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isEditMode) return;
    const coords = getGridCoordsFromEvent(e);
    // Staying inside one cell must not rebuild the renderer on every pointer event.
    setHoverGrid(previous => previous?.x === coords?.x && previous?.y === coords?.y ? previous : coords);

    if (!isEditMode || !isDragging || !coords) return;

    if (activeTool.type === 'brush' || activeTool.type === 'eraser') {
      // Avoid re-triggering for identical cell
      if (
        !lastPaintedCell.current ||
        lastPaintedCell.current.x !== coords.x ||
        lastPaintedCell.current.y !== coords.y
      ) {
        lastPaintedCell.current = coords;
        onPaintStroke(coords.x, coords.y);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      try {
        (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      } catch (_) {
        // Ignore if pointer capture release fails
      }
      setIsDragging(false);
      lastPaintedCell.current = null;
      onStrokeEnd();
    }
  };

  // Background Sky styling per biome theme (Bright daytime pixel sandbox skies)
  const skyBackground = useMemo(() => {
    switch (theme) {
      case 'greenhouse':
        return 'from-[#0284c7] via-[#0ea5e9] to-[#a5f3fc]'; // Luminous turquoise daylight sky
      case 'desk':
        return 'from-[#0284c7] via-[#bae6fd] to-[#fef3c7]'; // Warm sunny morning daylight
      case 'lab':
        return 'from-[#0369a1] via-[#38bdf8] to-[#cffafe]'; // Crisp crystalline daylight valley
      default:
        return 'from-[#0284c7] via-[#0ea5e9] to-[#a5f3fc]';
    }
  }, [theme]);

  // 16-Bit Pixel Art Props & Tile Renderer (crispEdges, integer coordinates, no emojis)
  const renderTilePattern = (material: TileMaterial, x: number, y: number) => {
    if (material === 'air') return null;

    const isTopTile = y === 0 || !isSolidTile(world.tiles[y - 1][x]);
    const isLeftAir = x > 0 && !isSolidTile(world.tiles[y][x - 1]);
    const isRightAir = x < GRID_WIDTH - 1 && !isSolidTile(world.tiles[y][x + 1]);

    if (material === 'grass') {
      const isGreenhouse = theme === 'greenhouse';
      return (
        <svg viewBox="0 0 16 16" className="w-full h-full block" shapeRendering="crispEdges" preserveAspectRatio="none">
          {isTopTile ? (
            <>
              {/* Stepped pixel grass blades fringe on top */}
              <rect x={isLeftAir ? '2' : '0'} y="0" width="3" height="1" fill={isGreenhouse ? '#86efac' : '#a3e635'} />
              <rect x="4" y="0" width="3" height="1" fill={isGreenhouse ? '#4ade80' : '#84cc16'} />
              <rect x="9" y="0" width="2" height="1" fill={isGreenhouse ? '#86efac' : '#a3e635'} />
              <rect x="13" y="0" width={isRightAir ? '2' : '3'} height="1" fill={isGreenhouse ? '#4ade80' : '#84cc16'} />
              {/* Vibrant green turf band */}
              <rect x="0" y="1" width="16" height="2" fill={isGreenhouse ? '#22c55e' : '#65a30d'} />
              <rect x="1" y="2" width="4" height="1" fill={isGreenhouse ? '#4ade80' : '#84cc16'} />
              <rect x="7" y="2" width="3" height="1" fill={isGreenhouse ? '#86efac' : '#a3e635'} />
              <rect x="12" y="2" width="3" height="1" fill={isGreenhouse ? '#4ade80' : '#84cc16'} />
              <rect x="0" y="3" width="16" height="1" fill={isGreenhouse ? '#15803d' : '#3f6212'} />
              <rect x="3" y="4" width="2" height="1" fill={isGreenhouse ? '#15803d' : '#3f6212'} />
              <rect x="10" y="4" width="2" height="1" fill={isGreenhouse ? '#15803d' : '#3f6212'} />
              {/* Rich loamy chocolate earth underneath */}
              <rect x="0" y="4" width="16" height="12" fill={isGreenhouse ? '#381e0f' : '#5c3a21'} />
              <rect x="2" y="6" width="2" height="2" fill={isGreenhouse ? '#221107' : '#3d2314'} />
              <rect x="10" y="7" width="3" height="2" fill={isGreenhouse ? '#2c150a' : '#452717'} />
              <rect x="5" y="10" width="2" height="1" fill={isGreenhouse ? '#5c3a21' : '#784f2b'} />
              <rect x="12" y="12" width="2" height="2" fill={isGreenhouse ? '#1f0d04' : '#381e0f'} />
              <rect x="1" y="14" width="2" height="1" fill={isGreenhouse ? '#5c3a21' : '#784f2b'} />
              {/* Organic root strands in greenhouse loam */}
              {isGreenhouse && (
                <>
                  <rect x="6" y="5" width="1" height="3" fill="#784f2b" opacity="0.6" />
                  <rect x="13" y="8" width="1" height="3" fill="#784f2b" opacity="0.6" />
                </>
              )}
            </>
          ) : (
            <>
              {/* Subsurface turf/soil block */}
              <rect x="0" y="0" width="16" height="16" fill={isGreenhouse ? '#381e0f' : '#5c3a21'} />
              <rect x="0" y="0" width="8" height="2" fill={isGreenhouse ? '#15803d' : '#3f6212'} opacity="0.6" />
              <rect x="2" y="4" width="2" height="2" fill={isGreenhouse ? '#221107' : '#3d2314'} />
              <rect x="9" y="5" width="3" height="2" fill={isGreenhouse ? '#2c150a' : '#452717'} />
              <rect x="5" y="9" width="2" height="1" fill={isGreenhouse ? '#5c3a21' : '#784f2b'} />
              <rect x="11" y="12" width="2" height="2" fill={isGreenhouse ? '#1f0d04' : '#381e0f'} />
              <rect x="2" y="13" width="2" height="1" fill={isGreenhouse ? '#5c3a21' : '#784f2b'} />
            </>
          )}
        </svg>
      );
    }

    if (material === 'dirt') {
      const isGreenhouse = theme === 'greenhouse';
      const variant = (x * 17 + y * 31) % 4; // Deterministic variation for potting soil
      return (
        <svg viewBox="0 0 16 16" className="w-full h-full block" shapeRendering="crispEdges" preserveAspectRatio="none">
          <rect x="0" y="0" width="16" height="16" fill={isGreenhouse ? '#451a03' : '#6b4226'} />
          <rect x="1" y="2" width="2" height="1" fill={isGreenhouse ? '#78350f' : '#8b5a2b'} />
          <rect x="3" y="2" width="1" height="1" fill={isGreenhouse ? '#92400e' : '#a27035'} />
          <rect x="8" y="1" width="2" height="2" fill={isGreenhouse ? '#270e02' : '#4a2e1b'} />
          <rect x="13" y="3" width="2" height="1" fill={isGreenhouse ? '#78350f' : '#8b5a2b'} />
          <rect x="2" y="6" width="3" height="2" fill={isGreenhouse ? '#290f03' : '#432818'} />
          <rect x="10" y="6" width="2" height="2" fill={isGreenhouse ? '#78350f' : '#8b5a2b'} />
          <rect x="11" y="7" width="1" height="1" fill={isGreenhouse ? '#92400e' : '#a27035'} />
          <rect x="5" y="9" width="3" height="2" fill={isGreenhouse ? '#270e02' : '#4a2e1b'} />
          <rect x="1" y="11" width="2" height="2" fill={isGreenhouse ? '#78350f' : '#8b5a2b'} />
          <rect x="9" y="11" width="3" height="1" fill={isGreenhouse ? '#290f03' : '#432818'} />
          <rect x="13" y="12" width="2" height="2" fill={isGreenhouse ? '#1f0a02' : '#381e0f'} />
          <rect x="4" y="14" width="2" height="1" fill={isGreenhouse ? '#78350f' : '#8b5a2b'} />
          <rect x="10" y="14" width="2" height="1" fill={isGreenhouse ? '#270e02' : '#4a2e1b'} />
          {/* Subtle micro-pebble variations */}
          {variant === 1 && <rect x="7" y="4" width="2" height="1" fill="#64748b" />}
          {variant === 2 && <rect x="3" y="10" width="1" height="2" fill="#94a3b8" />}
          {variant === 3 && <rect x="12" y="8" width="2" height="1" fill="#78716c" />}
        </svg>
      );
    }

    if (material === 'stone') {
      const isGreenhouse = theme === 'greenhouse';
      const variant = (x * 13 + y * 29) % 3; // Deterministic stone variation
      return (
        <svg viewBox="0 0 16 16" className="w-full h-full block" shapeRendering="crispEdges" preserveAspectRatio="none">
          {/* Mortar seam */}
          <rect x="0" y="0" width="16" height="16" fill={isGreenhouse ? '#0f291e' : '#1e293b'} />
          {/* Top cobblestone block */}
          <rect x="1" y="1" width="14" height="6" fill="#64748b" />
          <rect x="1" y="1" width="14" height="1" fill="#94a3b8" />
          <rect x="1" y="1" width="1" height="6" fill="#94a3b8" />
          <rect x="1" y="6" width="14" height="1" fill="#334155" />
          <rect x="14" y="1" width="1" height="6" fill="#334155" />
          <rect x="4" y="3" width="2" height="1" fill="#cbd5e1" />
          <rect x="9" y="4" width="2" height="1" fill="#475569" />
          {/* Bottom left brick */}
          <rect x="1" y="8" width="6" height="7" fill="#64748b" />
          <rect x="1" y="8" width="6" height="1" fill="#94a3b8" />
          <rect x="1" y="8" width="1" height="7" fill="#94a3b8" />
          <rect x="1" y="14" width="6" height="1" fill="#334155" />
          <rect x="6" y="8" width="1" height="7" fill="#334155" />
          <rect x="3" y="11" width="1" height="1" fill="#cbd5e1" />
          {/* Bottom right brick */}
          <rect x="8" y="8" width="7" height="7" fill="#64748b" />
          <rect x="8" y="8" width="7" height="1" fill="#94a3b8" />
          <rect x="8" y="8" width="1" height="7" fill="#94a3b8" />
          <rect x="8" y="14" width="7" height="1" fill="#334155" />
          <rect x="14" y="8" width="1" height="7" fill="#334155" />
          <rect x="11" y="10" width="2" height="1" fill="#cbd5e1" />
          {/* Moss creep in greenhouse biome */}
          {isGreenhouse && (
            <>
              <rect x="0" y="7" width="16" height="1" fill="#15803d" />
              {variant === 0 && <rect x="2" y="1" width="3" height="2" fill="#22c55e" />}
              {variant === 1 && <rect x="10" y="8" width="3" height="2" fill="#22c55e" />}
              {variant === 2 && <rect x="12" y="2" width="2" height="3" fill="#16a34a" />}
            </>
          )}
        </svg>
      );
    }

    if (material === 'sand') {
      return (
        <svg viewBox="0 0 16 16" className="w-full h-full block" shapeRendering="crispEdges" preserveAspectRatio="none">
          <rect x="0" y="0" width="16" height="16" fill="#eab308" />
          <rect x="0" y="1" width="16" height="1" fill="#fde047" />
          <rect x="3" y="3" width="9" height="1" fill="#ca8a04" />
          <rect x="0" y="6" width="16" height="1" fill="#ca8a04" />
          <rect x="1" y="7" width="7" height="1" fill="#eab308" />
          <rect x="8" y="5" width="8" height="1" fill="#fde047" />
          <rect x="2" y="10" width="12" height="1" fill="#fde047" />
          <rect x="0" y="11" width="16" height="1" fill="#a16207" />
          <rect x="4" y="13" width="2" height="1" fill="#78350f" />
          <rect x="11" y="14" width="2" height="1" fill="#78350f" />
        </svg>
      );
    }

    if (material === 'wood') {
      const isGreenhouse = theme === 'greenhouse';
      return (
        <svg viewBox="0 0 16 16" className="w-full h-full block" shapeRendering="crispEdges" preserveAspectRatio="none">
          <rect x="0" y="0" width="16" height="16" fill={isGreenhouse ? '#381604' : '#271406'} />
          {/* Top Plank */}
          <rect x="0" y="1" width="16" height="6" fill={isGreenhouse ? '#9a3412' : '#92400e'} />
          <rect x="0" y="1" width="16" height="1" fill={isGreenhouse ? '#c2410c' : '#b45309'} />
          <rect x="5" y="3" width="6" height="1" fill="#78350f" />
          <rect x="0" y="6" width="16" height="1" fill="#451a03" />
          {/* Top plank rivet nails */}
          <rect x="2" y="3" width="2" height="2" fill="#1c0f05" />
          <rect x="2" y="3" width="1" height="1" fill="#451a03" />
          <rect x="12" y="3" width="2" height="2" fill="#1c0f05" />
          <rect x="12" y="3" width="1" height="1" fill="#451a03" />
          {/* Plank divider seam */}
          <rect x="0" y="7" width="16" height="1" fill="#1a0a03" />
          {/* Bottom Plank */}
          <rect x="0" y="8" width="16" height="6" fill={isGreenhouse ? '#88310c' : '#85380a'} />
          <rect x="0" y="8" width="16" height="1" fill={isGreenhouse ? '#b45309' : '#a1470c'} />
          <rect x="3" y="10" width="7" height="1" fill="#632705" />
          <rect x="0" y="13" width="16" height="1" fill="#451a03" />
          {/* Bottom plank rivet nails */}
          <rect x="3" y="11" width="2" height="2" fill="#1c0f05" />
          <rect x="3" y="11" width="1" height="1" fill="#451a03" />
          <rect x="13" y="11" width="2" height="2" fill="#1c0f05" />
          <rect x="13" y="11" width="1" height="1" fill="#451a03" />
          <rect x="0" y="15" width="16" height="1" fill="#1a0a03" />
        </svg>
      );
    }

    if (material === 'water') {
      const isGreenhouse = theme === 'greenhouse';
      return (
        <svg viewBox="0 0 16 16" className="w-full h-full block animate-pulse" shapeRendering="crispEdges" preserveAspectRatio="none">
          <rect x="0" y="0" width="16" height="16" fill={isGreenhouse ? '#0284c7' : '#0284c7'} opacity={isGreenhouse ? '0.75' : '0.65'} />
          {/* Surface foam and wave ripples */}
          <rect x="0" y="0" width="16" height="1" fill="#e0f2fe" opacity="0.95" />
          <rect x="2" y="1" width="4" height="1" fill="#bae6fd" />
          <rect x="9" y="1" width="5" height="1" fill="#bae6fd" />
          <rect x="0" y="2" width="16" height="1" fill="#38bdf8" opacity="0.8" />
          <rect x="4" y="6" width="3" height="1" fill="#7dd3fc" opacity="0.6" />
          <rect x="11" y="9" width="3" height="1" fill="#7dd3fc" opacity="0.6" />
          <rect x="2" y="12" width="4" height="1" fill="#38bdf8" opacity="0.5" />
          {/* Light aquatic caustics in greenhouse shallow pond */}
          {isGreenhouse && (
            <>
              <rect x="7" y="4" width="2" height="1" fill="#ffffff" opacity="0.4" />
              <rect x="12" y="13" width="2" height="1" fill="#ffffff" opacity="0.3" />
            </>
          )}
        </svg>
      );
    }

    if (material === 'brick') {
      return (
        <svg viewBox="0 0 16 16" className="w-full h-full block" shapeRendering="crispEdges" preserveAspectRatio="none">
          {/* Dark mortar joint foundation */}
          <rect x="0" y="0" width="16" height="16" fill="#3f0f0a" />
          {/* Top brick row: full brick (x=1..14, y=1..6) */}
          <rect x="1" y="1" width="14" height="6" fill="#b91c1c" />
          <rect x="1" y="1" width="14" height="1" fill="#ef4444" />
          <rect x="1" y="1" width="1" height="6" fill="#f87171" />
          <rect x="1" y="6" width="14" height="1" fill="#7f1d1d" />
          <rect x="14" y="1" width="1" height="6" fill="#7f1d1d" />
          <rect x="4" y="3" width="3" height="1" fill="#fca5a5" opacity="0.6" />
          {/* Mortar bed joint */}
          <rect x="0" y="7" width="16" height="1" fill="#450a0a" />
          {/* Bottom brick row: staggered bricks (x=1..6, y=8..14 and x=8..14, y=8..14) */}
          <rect x="0" y="8" width="6" height="6" fill="#991b1b" />
          <rect x="0" y="8" width="6" height="1" fill="#dc2626" />
          <rect x="0" y="13" width="6" height="1" fill="#7f1d1d" />
          <rect x="5" y="8" width="1" height="6" fill="#7f1d1d" />
          <rect x="8" y="8" width="7" height="6" fill="#b91c1c" />
          <rect x="8" y="8" width="7" height="1" fill="#ef4444" />
          <rect x="8" y="8" width="1" height="6" fill="#f87171" />
          <rect x="8" y="13" width="7" height="1" fill="#7f1d1d" />
          <rect x="14" y="8" width="1" height="6" fill="#7f1d1d" />
          <rect x="10" y="10" width="2" height="1" fill="#fca5a5" opacity="0.6" />
          <rect x="0" y="15" width="16" height="1" fill="#450a0a" />
        </svg>
      );
    }

    if (material === 'plaster') {
      return (
        <svg viewBox="0 0 16 16" className="w-full h-full block" shapeRendering="crispEdges" preserveAspectRatio="none">
          <rect x="0" y="0" width="16" height="16" fill="#f1f5f9" />
          <rect x="0" y="0" width="16" height="1" fill="#ffffff" />
          <rect x="0" y="0" width="1" height="16" fill="#ffffff" />
          {/* Soft stucco grain */}
          <rect x="3" y="3" width="2" height="1" fill="#e2e8f0" />
          <rect x="9" y="4" width="3" height="1" fill="#cbd5e1" />
          <rect x="5" y="8" width="2" height="2" fill="#e2e8f0" />
          <rect x="12" y="9" width="2" height="1" fill="#cbd5e1" />
          <rect x="2" y="12" width="3" height="1" fill="#e2e8f0" />
          <rect x="10" y="13" width="2" height="2" fill="#cbd5e1" />
          <rect x="0" y="15" width="16" height="1" fill="#94a3b8" opacity="0.4" />
          <rect x="15" y="0" width="1" height="16" fill="#94a3b8" opacity="0.4" />
        </svg>
      );
    }

    if (material === 'carpet') {
      return (
        <svg viewBox="0 0 16 16" className="w-full h-full block" shapeRendering="crispEdges" preserveAspectRatio="none">
          {/* Rich indigo textile field */}
          <rect x="0" y="0" width="16" height="16" fill="#1e1b4b" />
          {/* Crimson woven borders */}
          <rect x="0" y="1" width="16" height="2" fill="#be123c" />
          <rect x="0" y="13" width="16" height="2" fill="#be123c" />
          {/* Golden geometric medallion motif */}
          <rect x="7" y="5" width="2" height="6" fill="#f59e0b" />
          <rect x="5" y="7" width="6" height="2" fill="#f59e0b" />
          <rect x="6" y="6" width="4" height="4" fill="#fbbf24" />
          <rect x="7" y="7" width="2" height="2" fill="#fffbeb" />
          {/* Corner tuft accents */}
          <rect x="2" y="5" width="1" height="1" fill="#fbbf24" />
          <rect x="13" y="5" width="1" height="1" fill="#fbbf24" />
          <rect x="2" y="10" width="1" height="1" fill="#fbbf24" />
          <rect x="13" y="10" width="1" height="1" fill="#fbbf24" />
          {/* Soft fringe on top/bottom */}
          <rect x="0" y="0" width="16" height="1" fill="#312e81" />
          <rect x="0" y="15" width="16" height="1" fill="#0f172a" />
        </svg>
      );
    }

    if (material === 'tile') {
      return (
        <svg viewBox="0 0 16 16" className="w-full h-full block" shapeRendering="crispEdges" preserveAspectRatio="none">
          {/* Dark grout base */}
          <rect x="0" y="0" width="16" height="16" fill="#1e293b" />
          {/* Top-left paver (Warm ivory ceramic) */}
          <rect x="1" y="1" width="6" height="6" fill="#f8fafc" />
          <rect x="1" y="1" width="6" height="1" fill="#ffffff" />
          <rect x="1" y="1" width="1" height="6" fill="#ffffff" />
          <rect x="1" y="6" width="6" height="1" fill="#cbd5e1" />
          <rect x="6" y="1" width="1" height="6" fill="#cbd5e1" />
          <rect x="2" y="2" width="1" height="1" fill="#ffffff" />
          {/* Top-right paver (Muted cyan/slate) */}
          <rect x="9" y="1" width="6" height="6" fill="#64748b" />
          <rect x="9" y="1" width="6" height="1" fill="#94a3b8" />
          <rect x="9" y="1" width="1" height="6" fill="#94a3b8" />
          <rect x="9" y="6" width="6" height="1" fill="#475569" />
          <rect x="14" y="1" width="1" height="6" fill="#475569" />
          {/* Bottom-left paver (Muted cyan/slate) */}
          <rect x="1" y="9" width="6" height="6" fill="#64748b" />
          <rect x="1" y="9" width="6" height="1" fill="#94a3b8" />
          <rect x="1" y="9" width="1" height="6" fill="#94a3b8" />
          <rect x="1" y="14" width="6" height="1" fill="#475569" />
          <rect x="6" y="9" width="1" height="6" fill="#475569" />
          {/* Bottom-right paver (Warm ivory ceramic) */}
          <rect x="9" y="9" width="6" height="6" fill="#f8fafc" />
          <rect x="9" y="9" width="6" height="1" fill="#ffffff" />
          <rect x="9" y="9" width="1" height="6" fill="#ffffff" />
          <rect x="9" y="14" width="6" height="1" fill="#cbd5e1" />
          <rect x="14" y="9" width="1" height="6" fill="#cbd5e1" />
          <rect x="10" y="10" width="1" height="1" fill="#ffffff" />
        </svg>
      );
    }

    if (material === 'glass') {
      return (
        <svg viewBox="0 0 16 16" className="w-full h-full block" shapeRendering="crispEdges" preserveAspectRatio="none">
          {/* Translucent glass block body */}
          <rect x="0" y="0" width="16" height="16" fill="#38bdf8" opacity="0.45" />
          {/* Polished frame outline */}
          <rect x="0" y="0" width="16" height="1" fill="#bae6fd" opacity="0.85" />
          <rect x="0" y="0" width="1" height="16" fill="#bae6fd" opacity="0.85" />
          <rect x="0" y="15" width="16" height="1" fill="#0284c7" opacity="0.75" />
          <rect x="15" y="0" width="1" height="16" fill="#0284c7" opacity="0.75" />
          {/* Diagonal specular reflections */}
          <rect x="3" y="1" width="2" height="1" fill="#ffffff" opacity="0.8" />
          <rect x="4" y="2" width="2" height="1" fill="#ffffff" opacity="0.8" />
          <rect x="5" y="3" width="2" height="1" fill="#ffffff" opacity="0.8" />
          <rect x="6" y="4" width="2" height="1" fill="#ffffff" opacity="0.8" />
          <rect x="7" y="5" width="2" height="1" fill="#ffffff" opacity="0.8" />
          <rect x="8" y="6" width="2" height="1" fill="#ffffff" opacity="0.8" />
          {/* Second parallel glare line */}
          <rect x="9" y="8" width="2" height="1" fill="#ffffff" opacity="0.6" />
          <rect x="10" y="9" width="2" height="1" fill="#ffffff" opacity="0.6" />
          <rect x="11" y="10" width="2" height="1" fill="#ffffff" opacity="0.6" />
          <rect x="12" y="11" width="2" height="1" fill="#ffffff" opacity="0.6" />
        </svg>
      );
    }

    if (material === 'metal') {
      return (
        <svg viewBox="0 0 16 16" className="w-full h-full block" shapeRendering="crispEdges" preserveAspectRatio="none">
          {/* Steel plate base */}
          <rect x="0" y="0" width="16" height="16" fill="#475569" />
          {/* Metallic beveled edge */}
          <rect x="0" y="0" width="16" height="1" fill="#94a3b8" />
          <rect x="0" y="0" width="1" height="16" fill="#94a3b8" />
          <rect x="0" y="15" width="16" height="1" fill="#1e293b" />
          <rect x="15" y="0" width="1" height="16" fill="#1e293b" />
          {/* Brushed metal grain lines */}
          <rect x="2" y="5" width="12" height="1" fill="#64748b" />
          <rect x="2" y="10" width="12" height="1" fill="#334155" />
          {/* 4 Corner Bolt Rivets */}
          <rect x="2" y="2" width="2" height="2" fill="#0f172a" />
          <rect x="2" y="2" width="1" height="1" fill="#cbd5e1" />
          <rect x="12" y="2" width="2" height="2" fill="#0f172a" />
          <rect x="12" y="2" width="1" height="1" fill="#cbd5e1" />
          <rect x="2" y="12" width="2" height="2" fill="#0f172a" />
          <rect x="2" y="12" width="1" height="1" fill="#cbd5e1" />
          <rect x="12" y="12" width="2" height="2" fill="#0f172a" />
          <rect x="12" y="12" width="1" height="1" fill="#cbd5e1" />
        </svg>
      );
    }

    if (material === 'snow') {
      return (
        <svg viewBox="0 0 16 16" className="w-full h-full block" shapeRendering="crispEdges" preserveAspectRatio="none">
          {/* Subsurface glacial snow block */}
          <rect x="0" y="0" width="16" height="16" fill="#e0f2fe" />
          {/* Top pristine drift crest */}
          <rect x="0" y="0" width="16" height="3" fill="#ffffff" />
          <rect x="0" y="3" width="16" height="2" fill="#f0f9ff" />
          {/* Sparkling ice crystals */}
          <rect x="3" y="1" width="1" height="1" fill="#bae6fd" />
          <rect x="9" y="2" width="1" height="1" fill="#bae6fd" />
          <rect x="13" y="1" width="1" height="1" fill="#bae6fd" />
          {/* Soft blue shadow facets */}
          <rect x="1" y="7" width="5" height="2" fill="#bae6fd" />
          <rect x="8" y="9" width="6" height="2" fill="#7dd3fc" />
          <rect x="2" y="12" width="7" height="2" fill="#7dd3fc" />
          <rect x="0" y="14" width="16" height="2" fill="#38bdf8" opacity="0.6" />
        </svg>
      );
    }

    if (material === 'moss') {
      return (
        <svg viewBox="0 0 16 16" className="w-full h-full block" shapeRendering="crispEdges" preserveAspectRatio="none">
          {/* Deep organic peat base */}
          <rect x="0" y="0" width="16" height="16" fill="#14532d" />
          {/* Velvety emerald moss canopy */}
          <rect x="0" y="0" width="16" height="4" fill="#15803d" />
          {/* Clustered lime highlights */}
          <rect x="1" y="0" width="3" height="2" fill="#4ade80" />
          <rect x="2" y="0" width="1" height="1" fill="#86efac" />
          <rect x="6" y="1" width="4" height="2" fill="#22c55e" />
          <rect x="7" y="1" width="2" height="1" fill="#86efac" />
          <rect x="12" y="0" width="3" height="2" fill="#4ade80" />
          {/* Spreading moss tufts */}
          <rect x="3" y="6" width="4" height="3" fill="#16a34a" />
          <rect x="4" y="7" width="2" height="1" fill="#4ade80" />
          <rect x="9" y="8" width="5" height="3" fill="#16a34a" />
          <rect x="10" y="9" width="2" height="1" fill="#22c55e" />
          <rect x="1" y="11" width="4" height="3" fill="#15803d" />
          <rect x="6" y="13" width="5" height="2" fill="#16a34a" />
        </svg>
      );
    }

    return null;
  };

  // Render authentic 16-bit pixel art decoration icons anchored to terrain grid
  // Build mode: grab a placed item and drag it. Dropped on the trash in the build toolbar it is deleted,
  // dropped somewhere else in the garden it moves there (or slides back if it cannot go there).
  const dragLatest = useRef({ onRemoveDecoration, onMoveDecoration, onMoveTile });
  dragLatest.current = { onRemoveDecoration, onMoveDecoration, onMoveTile };
  // Only the visible part of an item can be grabbed: its empty box (around a tree's canopy, say) lets clicks through
  const alphaCache = useRef(new Map<string, { w: number; h: number; data: Uint8ClampedArray } | null>());
  const hitsVisiblePart = (e: React.PointerEvent<HTMLDivElement>): boolean => {
    // Item pictures ignore the pointer, so find them by position: a picture item is hit only on its visible pixels,
    // a drawn item anywhere on its drawing
    const at = (el: Element) => { const b = el.getBoundingClientRect(); return e.clientX >= b.left && e.clientX <= b.right && e.clientY >= b.top && e.clientY <= b.bottom; };
    const target = [...e.currentTarget.querySelectorAll('img')].find(at);
    if (!target) return [...e.currentTarget.querySelectorAll('svg')].some(at);
    const box = target.getBoundingClientRect();
    let alpha = alphaCache.current.get(target.src);
    if (alpha === undefined) {
      try {
        const c = document.createElement('canvas');
        c.width = target.naturalWidth;
        c.height = target.naturalHeight;
        const g = c.getContext('2d')!;
        g.drawImage(target, 0, 0);
        alpha = { w: c.width, h: c.height, data: g.getImageData(0, 0, c.width, c.height).data };
      } catch {
        alpha = null;
      }
      alphaCache.current.set(target.src, alpha);
    }
    if (!alpha) return true;
    // object-contain + object-bottom: the picture fills the box's width or height and sits at the bottom
    const scale = Math.min(box.width / alpha.w, box.height / alpha.h);
    const drawW = alpha.w * scale, drawH = alpha.h * scale;
    const left = box.left + (box.width - drawW) / 2, top = box.bottom - drawH;
    const px = Math.floor((e.clientX - left) / scale), py = Math.floor((e.clientY - top) / scale);
    if (px < 0 || py < 0 || px >= alpha.w || py >= alpha.h) return false;
    return alpha.data[(py * alpha.w + px) * 4 + 3] > 40;
  };

  const startDecorDrag = (decor: DecorationInstance, e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;

    if (!hitsVisiblePart(e)) return; // a click beside the item goes to the ground under it
    e.stopPropagation();
    e.preventDefault();
    const el = e.currentTarget;
    const startX = e.clientX;
    const startY = e.clientY;
    const trash = () => document.getElementById('decor-trash');
    const overTrash = (x: number, y: number) => {
      const box = trash()?.getBoundingClientRect();
      return !!box && x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
    };
    // The held item floats above everything (the build toolbar too) as a copy on the page; the original waits faded
    const box0 = el.getBoundingClientRect();
    const ghost = el.cloneNode(true) as HTMLElement;
    ghost.style.cssText = 'position:fixed;left:' + box0.left + 'px;top:' + box0.top + 'px;width:' + box0.width + 'px;height:' + box0.height + 'px;margin:0;transform:none;translate:none;scale:none;rotate:none;z-index:9999;pointer-events:none;opacity:1;filter:drop-shadow(0 4px 3px rgba(0,0,0,.5));';
    document.body.appendChild(ghost);
    el.style.opacity = '0.25';
    document.body.style.cursor = 'grabbing';
    trash()?.classList.add('trash-ready');
    const move = (ev: PointerEvent) => {
      ghost.style.left = box0.left + ev.clientX - startX + 'px';
      ghost.style.top = box0.top + ev.clientY - startY + 'px';
      const hot = overTrash(ev.clientX, ev.clientY);
      trash()?.classList.toggle('trash-hot', hot);
      ghost.style.filter = hot ? 'drop-shadow(0 0 6px #f43f5e)' : 'drop-shadow(0 4px 3px rgba(0,0,0,.5))';
    };
    const end = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      ghost.remove();
      el.style.opacity = '';
      document.body.style.cursor = '';
      trash()?.classList.remove('trash-ready', 'trash-hot');
      const { onRemoveDecoration: remove, onMoveDecoration: moveTo } = dragLatest.current;
      if (ev.type === 'pointerup' && overTrash(ev.clientX, ev.clientY)) {
        remove(decor.id);
        return;
      }
      const box = containerRef.current?.getBoundingClientRect();
      if (ev.type !== 'pointerup' || !box || !moveTo || Math.hypot(ev.clientX - startX, ev.clientY - startY) < 6) return;
      // The item lands where its base is drawn (the bottom middle of the held copy), not where the finger holds it
      const baseX = box0.left + box0.width / 2 + ev.clientX - startX;
      const baseY = box0.bottom + ev.clientY - startY;
      const gx = Math.floor(((baseX - box.left) / box.width) * GRID_WIDTH);
      const gy = Math.floor(((baseY - box.top) / box.height) * GRID_HEIGHT) - 1;
      // Dropped at (or past) the screen's left or right edge, it goes into the neighboring World area
      const edge = 18;
      const cross = ev.clientX <= box.left + edge ? -1 : ev.clientX >= box.right - edge ? 1 : 0;
      const targetX = cross < 0 ? Math.min(gx, -1) : cross > 0 ? Math.max(gx, GRID_WIDTH) : gx;
      if (targetX >= -GRID_WIDTH && targetX < GRID_WIDTH * 2) moveTo(decor.id, targetX, Math.max(0, Math.min(GRID_HEIGHT - 1, gy)));
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  };

  // Build mode: grab a ground block and drag it to an empty cell, or drop it on the trash to delete it
  const startTileDrag = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const from = getGridCoordsFromEvent(e);
    const box0 = containerRef.current?.getBoundingClientRect();
    if (!from || !box0 || world.tiles[from.y]?.[from.x] === 'air') return;
    e.preventDefault();
    const cw = box0.width / GRID_WIDTH;
    const ch = box0.height / GRID_HEIGHT;
    const startX = e.clientX;
    const startY = e.clientY;
    const trash = () => document.getElementById('decor-trash');
    const overTrash = (x: number, y: number) => {
      const b = trash()?.getBoundingClientRect();
      return !!b && x >= b.left && x <= b.right && y >= b.top && y <= b.bottom;
    };
    // The held block is drawn from the block's own pixel art, a little bigger so it stays visible over the toolbar
    const ghost = document.createElement('div');
    const art = renderTilePattern(world.tiles[from.y][from.x], from.x, from.y);
    if (art) ghost.innerHTML = renderToStaticMarkup(art);
    const gw = cw * 1.6;
    const gh = ch * 1.6;
    ghost.style.cssText = 'position:fixed;left:' + (startX - gw / 2) + 'px;top:' + (startY - gh / 2) + 'px;width:' + gw + 'px;height:' + gh + 'px;z-index:9999;pointer-events:none;outline:2px solid #fff;box-shadow:0 4px 0 3px rgba(0,0,0,.5);' + (art ? '' : 'background:#fff;');
    document.body.appendChild(ghost);
    document.body.style.cursor = 'grabbing';
    trash()?.classList.add('trash-ready');
    const move = (ev: PointerEvent) => {
      ghost.style.left = ev.clientX - gw / 2 + 'px';
      ghost.style.top = ev.clientY - gh / 2 + 'px';
      const hot = overTrash(ev.clientX, ev.clientY);
      trash()?.classList.toggle('trash-hot', hot);
      ghost.style.outlineColor = hot ? '#f43f5e' : '#fff';
    };
    const end = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      ghost.remove();
      document.body.style.cursor = '';
      trash()?.classList.remove('trash-ready', 'trash-hot');
      const moveTile = dragLatest.current.onMoveTile;
      if (ev.type !== 'pointerup' || !moveTile) return;
      if (overTrash(ev.clientX, ev.clientY)) { moveTile(from.x, from.y, null, null); return; }
      const box = containerRef.current?.getBoundingClientRect();
      if (!box) return;
      const gx = Math.floor(((ev.clientX - box.left) / box.width) * GRID_WIDTH);
      const gy = Math.floor(((ev.clientY - box.top) / box.height) * GRID_HEIGHT);
      if (gx >= 0 && gx < GRID_WIDTH && gy >= 0 && gy < GRID_HEIGHT && (gx !== from.x || gy !== from.y)) moveTile(from.x, from.y, gx, gy);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  };

  const renderDecoration = (decor: DecorationInstance) => {
    // Dynamically guarantee prop is grounded on valid supporting surface in the world. A wide prop near the World's
    // edge is drawn pulled inward (see the left clamp below), so its ground is read where it is drawn, not where it is stored
    const footW = decor.type === 'custom' ? itemTiles(customItemLibrary.get(decor.customItemId || '')?.heightCm) : DECOR_TILES[decor.type]?.[0] ?? 0;
    const drawCol = footW ? Math.max(0, Math.min(GRID_WIDTH - 1, Math.round(Math.min(Math.max(decor.gridX + 0.5, footW / 2), GRID_WIDTH - footW / 2) - 0.5))) : decor.gridX;
    const surfaceY = findSupportingSurfaceForProp(world, drawCol, decor.gridY);
    const renderGy = surfaceY !== -1 ? surfaceY : decor.gridY;

    // Centered horizontally on column, anchored vertically to top surface of solid tile
    const leftPct = ((decor.gridX + 0.5) / GRID_WIDTH) * 100;
    const topPct = (renderGy / GRID_HEIGHT) * 100;

    let decorVisual: React.ReactNode = null;
    let widthStyle = 'w-12 h-16';
    let offsetYStyle = '-translate-y-full';

    switch (decor.type) {
      case 'tree':
        widthStyle = 'w-20 h-28 -translate-x-1/2';
        decorVisual = <WindTree />;
        break;
      case 'shrub':
        widthStyle = 'w-14 h-10 -translate-x-1/2';
        decorVisual = (
          <svg viewBox="0 0 24 16" className="w-full h-full select-none" shapeRendering="crispEdges">
            {/* Shrub foliage and stems reaching baseline y=16 */}
            <rect x="3" y="8" width="18" height="8" fill="#14532d" />
            <rect x="2" y="4" width="20" height="10" fill="#15803d" />
            <rect x="5" y="2" width="14" height="11" fill="#16a34a" />
            <rect x="7" y="1" width="10" height="8" fill="#22c55e" />
            <rect x="9" y="2" width="6" height="3" fill="#86efac" />
            {/* Ground contact root shadow */}
            <rect x="5" y="15" width="14" height="1" fill="#052e16" />
            <rect x="9" y="15" width="6" height="1" fill="#3b2314" />
            {/* Sweet Berry Pixels */}
            <rect x="4" y="6" width="2" height="2" fill="#9333ea" />
            <rect x="5" y="6" width="1" height="1" fill="#f3e8ff" />
            <rect x="10" y="7" width="2" height="2" fill="#c084fc" />
            <rect x="11" y="7" width="1" height="1" fill="#ffffff" />
            <rect x="16" y="5" width="2" height="2" fill="#9333ea" />
            <rect x="17" y="5" width="1" height="1" fill="#f3e8ff" />
            <rect x="7" y="11" width="2" height="2" fill="#a855f7" />
            <rect x="14" y="10" width="2" height="2" fill="#9333ea" />
            <rect x="18" y="9" width="2" height="2" fill="#c084fc" />
          </svg>
        );
        break;
      case 'flower':
        widthStyle = 'w-8 h-10 -translate-x-1/2';
        decorVisual = (
          <svg viewBox="0 0 16 20" className="w-full h-full select-none" shapeRendering="crispEdges">
            {/* Stem and Rooted Grassy Base reaching baseline y=20 */}
            <rect x="7" y="8" width="2" height="12" fill="#15803d" />
            <rect x="5" y="18" width="6" height="2" fill="#14532d" />
            <rect x="4" y="19" width="8" height="1" fill="#052e16" />
            <rect x="4" y="13" width="3" height="2" fill="#22c55e" />
            <rect x="3" y="14" width="2" height="2" fill="#4ade80" />
            <rect x="9" y="11" width="3" height="2" fill="#22c55e" />
            <rect x="11" y="12" width="2" height="2" fill="#4ade80" />
            {/* Blossom Petals & Core */}
            <rect x="5" y="1" width="6" height="8" fill="#e11d48" />
            <rect x="3" y="3" width="10" height="4" fill="#f43f5e" />
            <rect x="4" y="2" width="8" height="6" fill="#fb7185" />
            <rect x="6" y="3" width="4" height="4" fill="#facc15" />
            <rect x="7" y="4" width="2" height="2" fill="#ffffff" />
          </svg>
        );
        break;
      case 'rock':
        widthStyle = 'w-12 h-9 -translate-x-1/2';
        decorVisual = (
          <svg viewBox="0 0 20 14" className="w-full h-full select-none" shapeRendering="crispEdges">
            {/* Boulder facets reaching baseline y=14 */}
            <rect x="1" y="4" width="18" height="10" fill="#1e293b" />
            <rect x="2" y="2" width="16" height="12" fill="#334155" />
            <rect x="4" y="1" width="12" height="11" fill="#475569" />
            <rect x="6" y="2" width="8" height="7" fill="#64748b" />
            <rect x="8" y="2" width="5" height="4" fill="#94a3b8" />
            <rect x="9" y="3" width="2" height="2" fill="#cbd5e1" />
            {/* Moss highlights */}
            <rect x="3" y="3" width="4" height="2" fill="#15803d" />
            <rect x="4" y="2" width="3" height="2" fill="#4ade80" />
            <rect x="5" y="4" width="2" height="1" fill="#22c55e" />
            {/* Ground contact shadow base */}
            <rect x="2" y="12" width="16" height="2" fill="#0f172a" />
            <rect x="4" y="13" width="12" height="1" fill="#020617" />
          </svg>
        );
        break;
      case 'mushroom':
        widthStyle = 'w-9 h-10 -translate-x-1/2';
        decorVisual = (
          <svg viewBox="0 0 18 20" className="w-full h-full select-none" shapeRendering="crispEdges">
            {/* Stalk and ground contact reaching baseline y=20 */}
            <rect x="7" y="10" width="4" height="10" fill="#fef08a" />
            <rect x="6" y="11" width="1" height="8" fill="#fef9c3" />
            <rect x="11" y="11" width="1" height="8" fill="#ca8a04" />
            <rect x="5" y="18" width="8" height="2" fill="#eab308" />
            <rect x="4" y="19" width="10" height="1" fill="#713f12" />
            {/* Cap */}
            <rect x="3" y="9" width="12" height="2" fill="#991b1b" />
            <rect x="2" y="3" width="14" height="7" fill="#dc2626" />
            <rect x="4" y="1" width="10" height="8" fill="#ef4444" />
            <rect x="6" y="0" width="6" height="3" fill="#f87171" />
            {/* White spots */}
            <rect x="4" y="4" width="2" height="2" fill="#ffffff" />
            <rect x="11" y="3" width="2" height="2" fill="#ffffff" />
            <rect x="8" y="6" width="2" height="2" fill="#ffffff" />
            <rect x="13" y="6" width="2" height="2" fill="#fee2e2" />
          </svg>
        );
        break;
      case 'custom': {
        const customItem = customItemLibrary.get(decor.customItemId || '');
        widthStyle = 'w-10 h-10 -translate-x-1/2';
        decorVisual = customItem ? (
          <img
            src={customItem.sprite}
            alt={customItem.name}
            title={customItem.name}
            draggable={false}
            className="w-full h-full select-none"
            style={{
              imageRendering: 'pixelated',
              filter: customItem.glow ? 'drop-shadow(0 0 6px rgba(255, 214, 102, 0.95))' : undefined
            }}
          />
        ) : null;
        break;
      }
      case 'lantern':
        widthStyle = 'w-9 h-[52px] -translate-x-1/2';
        decorVisual = (
          <svg viewBox="0 0 20 28" className="w-full h-full select-none" shapeRendering="crispEdges">
            {/* Warm light glow */}
            <rect x="2" y="4" width="16" height="16" fill="#f59e0b" opacity="0.15" />
            <rect x="4" y="2" width="12" height="20" fill="#f59e0b" opacity="0.15" />
            <rect x="5" y="5" width="10" height="13" fill="#fbbf24" opacity="0.25" />
            {/* Lantern top cap */}
            <rect x="9" y="0" width="2" height="2" fill="#1e293b" />
            <rect x="6" y="2" width="8" height="2" fill="#334155" />
            <rect x="5" y="3" width="10" height="2" fill="#1e293b" />
            <rect x="4" y="4" width="12" height="2" fill="#475569" />
            {/* Lamp glass & flame */}
            <rect x="5" y="6" width="10" height="9" fill="#fef08a" />
            <rect x="7" y="8" width="6" height="5" fill="#ffffff" />
            <rect x="8" y="9" width="4" height="3" fill="#fef9c3" />
            <rect x="4" y="6" width="1" height="9" fill="#1e293b" />
            <rect x="15" y="6" width="1" height="9" fill="#1e293b" />
            <rect x="9" y="6" width="2" height="9" fill="#92400e" opacity="0.4" />
            {/* Post & Foundation Base reaching baseline y=28 */}
            <rect x="4" y="15" width="12" height="2" fill="#334155" />
            <rect x="6" y="17" width="8" height="1" fill="#1e293b" />
            <rect x="9" y="18" width="2" height="8" fill="#334155" />
            <rect x="5" y="26" width="10" height="2" fill="#1e293b" />
            <rect x="4" y="27" width="12" height="1" fill="#0f172a" />
          </svg>
        );
        break;
      case 'shelter':
        widthStyle = 'w-36 h-28 -translate-x-1/2';
        decorVisual = (
          <svg viewBox="0 0 36 28" className="w-full h-full select-none" shapeRendering="crispEdges">
            {/* Thatched roof */}
            <rect x="16" y="0" width="4" height="2" fill="#b45309" />
            <rect x="13" y="2" width="10" height="2" fill="#d97706" />
            <rect x="10" y="4" width="16" height="2" fill="#b45309" />
            <rect x="7" y="6" width="22" height="2" fill="#92400e" />
            <rect x="4" y="8" width="28" height="2" fill="#78350f" />
            <rect x="2" y="10" width="32" height="2" fill="#451a03" />
            <rect x="3" y="10" width="30" height="1" fill="#f59e0b" opacity="0.6" />
            {/* Timber cabin walls & structural posts reaching baseline y=28 */}
            <rect x="5" y="12" width="26" height="16" fill="#5c3a21" />
            <rect x="5" y="15" width="26" height="1" fill="#382212" />
            <rect x="5" y="19" width="26" height="1" fill="#382212" />
            <rect x="5" y="23" width="26" height="1" fill="#382212" />
            <rect x="5" y="12" width="3" height="16" fill="#784f2b" />
            <rect x="28" y="12" width="3" height="16" fill="#3b2314" />
            {/* Window */}
            <rect x="22" y="14" width="4" height="4" fill="#91b3bd" /><rect className="night-window" x="22" y="14" width="4" height="4" fill="#fff3ad" />
            <rect x="23" y="14" width="1" height="4" fill="#78350f" />
            <rect x="22" y="15" width="4" height="1" fill="#78350f" />
            {/* Cozy illuminated doorway reaching baseline y=28 */}
            <rect x="12" y="15" width="8" height="13" fill="#180e06" />
            <rect x="13" y="16" width="6" height="11" fill="#f59e0b" opacity="0.9" />
            <rect x="14" y="18" width="4" height="9" fill="#fbbf24" />
            <rect x="15" y="20" width="2" height="7" fill="#fef08a" />
            <rect x="11" y="14" width="10" height="1" fill="#b45309" />
            <rect x="11" y="15" width="1" height="13" fill="#b45309" />
            <rect x="20" y="15" width="1" height="13" fill="#78350f" />
            {/* Ground sill foundation beam reaching baseline y=28 */}
            <rect x="4" y="26" width="28" height="2" fill="#291508" />
            <rect x="3" y="27" width="30" height="1" fill="#1c0f05" />
          </svg>
        );
        break;
      case 'seed': {
        const growth = computeSeedGrowth(decor, Date.now(), world);
        const stage = growth.stage;
        widthStyle = 'w-9 h-11 -translate-x-1/2';

        let seedInner: React.ReactNode = null;
        if (stage === 1) {
          // Stage 1: Burrowed Seed Kernel in soil mound with tiny green shoot pip
          seedInner = (
            <svg viewBox="0 0 18 22" className="w-full h-full select-none" shapeRendering="crispEdges">
              {/* Soil mound */}
              <rect x="2" y="16" width="14" height="6" fill="#3b2210" />
              <rect x="4" y="14" width="10" height="4" fill="#522e17" />
              <rect x="6" y="13" width="6" height="3" fill="#6b3e1f" />
              {/* Seed kernel */}
              <rect x="7" y="15" width="4" height="4" fill="#a16207" />
              <rect x="8" y="15" width="2" height="3" fill="#ca8a04" />
              {/* Emerging bright green shoot pip */}
              <rect x="8" y="11" width="2" height="3" fill="#84cc16" />
              <rect x="9" y="10" width="2" height="2" fill="#a3e635" />
              <rect x="7" y="12" width="2" height="1" fill="#4d7c0f" />
              {/* Sparkle glint on moist soil */}
              <rect x="5" y="15" width="1" height="1" fill="#93c5fd" opacity="0.8" />
            </svg>
          );
        } else if (stage === 2) {
          // Stage 2: Sproutling with leafy stem and floral bud
          seedInner = (
            <svg viewBox="0 0 18 22" className="w-full h-full select-none" shapeRendering="crispEdges">
              {/* Soil base */}
              <rect x="3" y="17" width="12" height="5" fill="#3b2210" />
              <rect x="5" y="16" width="8" height="3" fill="#522e17" />
              {/* Curved Stem */}
              <rect x="8" y="8" width="2" height="10" fill="#15803d" />
              <rect x="8" y="9" width="1" height="9" fill="#22c55e" />
              {/* Left Leaf */}
              <rect x="4" y="12" width="4" height="3" fill="#16a34a" />
              <rect x="5" y="11" width="3" height="2" fill="#4ade80" />
              <rect x="3" y="13" width="2" height="1" fill="#15803d" />
              {/* Right Leaf */}
              <rect x="10" y="10" width="4" height="3" fill="#16a34a" />
              <rect x="10" y="9" width="3" height="2" fill="#4ade80" />
              <rect x="13" y="11" width="2" height="1" fill="#15803d" />
              {/* Swelling Flower Bud at apex */}
              <rect x="7" y="5" width="4" height="4" fill="#15803d" />
              <rect x="7" y="4" width="4" height="3" fill="#f59e0b" />
              <rect x="8" y="3" width="2" height="2" fill="#fde047" />
            </svg>
          );
        } else {
          // Stage 3: Bloomed Flower with variant petals
          const variant = decor.flowerVariant || 'sunburst';
          let petalColor = '#fbbf24';
          let highlightColor = '#fef08a';
          let coreColor = '#b45309';
          if (variant === 'moonbell') {
            petalColor = '#a855f7';
            highlightColor = '#c084fc';
            coreColor = '#38bdf8';
          } else if (variant === 'starbloom') {
            petalColor = '#f43f5e';
            highlightColor = '#fda4af';
            coreColor = '#ffffff';
          }

          seedInner = (
            <svg viewBox="0 0 18 22" className="w-full h-full select-none" shapeRendering="crispEdges">
              {/* Soil mound */}
              <rect x="4" y="18" width="10" height="4" fill="#3b2210" />
              {/* Sturdy Stem & Leaves */}
              <rect x="8" y="7" width="2" height="12" fill="#15803d" />
              <rect x="4" y="13" width="4" height="3" fill="#22c55e" />
              <rect x="10" y="11" width="4" height="3" fill="#22c55e" />
              {/* Petal Crown */}
              <rect x="6" y="1" width="6" height="7" fill={petalColor} />
              <rect x="4" y="2" width="10" height="5" fill={petalColor} />
              <rect x="5" y="2" width="8" height="5" fill={highlightColor} />
              {/* Center Radiant Core */}
              <rect x="7" y="3" width="4" height="3" fill={coreColor} />
              <rect x="8" y="4" width="2" height="1" fill="#ffffff" />
            </svg>
          );
        }

        decorVisual = (
          <div className="relative group w-full h-full">
            {seedInner}
            {growth.isPondAccelerated && stage < 3 && (
              <span className="absolute -top-1 -right-1 text-[8px] animate-bounce pointer-events-none" title="Pond accelerated">
                💧
              </span>
            )}
            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-slate-900/90 text-[8px] font-mono text-emerald-300 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-20 border border-emerald-500/30">
              {stage === 1 ? 'Stage 1: Seed' : stage === 2 ? 'Stage 2: Sprout' : 'Stage 3: Bloom'} ({growth.progressPct}%)
            </div>
          </div>
        );
        break;
      }
      default:
        widthStyle = decor.type === 'cottage' ? 'w-28 h-28 -translate-x-1/2' : 'w-20 h-20 -translate-x-1/2';
        decorVisual = <GardenProp type={decor.type} />;
    }

    // Photo items are sized from the real height Muse Spark estimated (square sprite, so as wide as tall)
    const customTiles = decor.type === 'custom' ? itemTiles(customItemLibrary.get(decor.customItemId || '')?.heightCm) : 0;
    const tiles = customTiles ? ([customTiles, customTiles] as [number, number]) : DECOR_TILES[decor.type];
    const glow = DECOR_GLOW[decor.type] || (decor.type === 'custom' && customItemLibrary.get(decor.customItemId || '')?.glow ? { color: '#ffd666', size: 2.6, top: 50 } : null);

    return (
      <div
        key={decor.id}
        onPointerDown={isEditMode ? (e) => startDecorDrag(decor, e) : undefined}
        title={isEditMode ? 'Drag to move, or drop on the trash to delete' : undefined}
        // Placed items stand in front of the swaying grass (layer 21), so grass never covers a tree trunk or a lamp's base
        className={`absolute z-[22] ${isEditMode ? 'pointer-events-auto cursor-grab touch-none' : 'pointer-events-none'} ${tiles ? widthStyle.replace(/\b[wh]-\S+/g, '') : widthStyle} ${offsetYStyle}`}
        style={{
          // Wide props near the edge of the World shift inward so they are never cut off
          left: (tiles ? Math.min(Math.max(leftPct, (tiles[0] / GRID_WIDTH) * 50), 100 - (tiles[0] / GRID_WIDTH) * 50) : leftPct) + '%',
          top: `${topPct}%`,
          ...(tiles ? { width: `${(tiles[0] / GRID_WIDTH) * 100}%`, height: `${(tiles[1] / GRID_HEIGHT) * 100}%` } : {})
        }}
      >
        {glow && (
          <div
            aria-hidden="true"
            className="glow-halo"
            style={{
              '--glow': glow.color,
              width: `${glow.size * 100}%`,
              top: `${glow.top}%`,
              // Neighboring lights pulse out of step, like real flames and lamps
              animationDelay: `${-((decor.gridX * 7 + decor.gridY * 3) % 30) / 10}s`
            } as React.CSSProperties}
          />
        )}
        {['tree','cherrytree','autumntree','youngtree','sapling','pinetree','bamboo','shrub','flower','wheatpatch'].includes(decor.type) ? <WindPlant offset={decor.gridX} tall={['tree','cherrytree','autumntree','youngtree','pinetree','bamboo'].includes(decor.type)} paused={isEditMode}>{decorVisual}</WindPlant> : decorVisual}
      </div>
    );
  };

  // The world drawing (backdrop, tiles, decorations) is cached and only redrawn when the world itself changes.
  // Moving the pointer in build mode only updates the placement outline below it, which keeps building smooth.
  // Building stays smooth because a change only rebuilds what it touched:
  // - the backdrop is built once per biome;
  // - each tile cell is reused until it or a neighbor it is drawn against changes;
  // - each decoration is reused until that decoration changes.
  const backdrop = useMemo(
    () => (
      <>
      {world.customBackgroundUrl ? (
        <div className="absolute inset-0 pointer-events-none select-none overflow-hidden z-0">
          <img
            src={world.customBackgroundUrl}
            alt={world.name || "Custom Biome Background"}
            className="w-full h-full object-cover select-none pointer-events-none"
            style={{ imageRendering: 'pixelated' }}
          />
        </div>
      ) : (
        /* Lush Outdoor Pixel Sandbox World Backdrop (Weathered Stone Pillars, Strata & Forest Canopy) */
        <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
          {/* 1. Luminous Turquoise Sky Atmosphere & Warm Pixel Sun */}
        {!sharedSky && <><div data-testid="biome-sun" className="absolute top-4 right-16 sm:right-32 pointer-events-none select-none z-0">
          <div
            className="absolute -top-10 -left-10 w-44 h-44 rounded-full opacity-35 blur-xl pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(254, 240, 138, 0.7) 0%, rgba(250, 204, 21, 0.25) 45%, transparent 75%)'
            }}
          />
          {/* 16-bit stepped pixel sun corona & core */}
          <svg viewBox="0 0 24 24" width="48" height="48" shapeRendering="crispEdges" className="drop-shadow-[0_0_10px_rgba(253,224,71,0.5)]">
            <rect x="8" y="0" width="8" height="2" fill="#facc15" />
            <rect x="4" y="2" width="16" height="2" fill="#facc15" />
            <rect x="2" y="4" width="20" height="2" fill="#facc15" />
            <rect x="1" y="6" width="22" height="2" fill="#fde047" />
            <rect x="0" y="8" width="24" height="8" fill="#fde047" />
            <rect x="1" y="16" width="22" height="2" fill="#fde047" />
            <rect x="2" y="18" width="20" height="2" fill="#facc15" />
            <rect x="4" y="20" width="16" height="2" fill="#facc15" />
            <rect x="8" y="22" width="8" height="2" fill="#facc15" />
            <rect x="5" y="5" width="14" height="14" fill="#fef08a" />
            <rect x="7" y="7" width="10" height="10" fill="#ffffff" />
          </svg>
        </div>

        {/* Subtle Diagonal Sunbeams (Soft, low-contrast luminous dust shafts) */}
        <div className="absolute -top-12 right-52 w-24 h-[320px] opacity-[0.07] rotate-[24deg] bg-gradient-to-b from-amber-100 via-amber-200/20 to-transparent pointer-events-none" />
        <div className="absolute -top-10 right-28 w-28 h-[340px] opacity-[0.06] rotate-[20deg] bg-gradient-to-b from-amber-100 via-amber-200/20 to-transparent pointer-events-none" />
        <div className="absolute -top-8 right-6 w-20 h-[300px] opacity-[0.05] rotate-[16deg] bg-gradient-to-b from-amber-100 via-amber-200/20 to-transparent pointer-events-none" />

        </>}

        {/* 2. Track 1: Tiny Soft Stepped Pixel Clouds (Slow Smooth Infinite Wrap) */}
        <div className="absolute top-2 left-0 w-[200%] h-16 pointer-events-none opacity-80 animate-cloud-drift-slow flex">
          {[0, 1].map((half) => (
            <div key={`cloud-slow-${half}`} className="relative w-1/2 h-full">
              <div className="absolute top-2 left-[5%]">
                <svg viewBox="0 0 26 8" width="52" height="16" shapeRendering="crispEdges">
                  <rect x="8" y="0" width="8" height="2" fill="#ffffff" />
                  <rect x="4" y="2" width="16" height="2" fill="#ffffff" />
                  <rect x="0" y="4" width="26" height="3" fill="#ffffff" />
                  <rect x="2" y="6" width="22" height="2" fill="#e0f2fe" />
                </svg>
              </div>
              <div className="absolute top-5 left-[38%]">
                <svg viewBox="0 0 36 10" width="72" height="20" shapeRendering="crispEdges">
                  <rect x="12" y="0" width="12" height="2" fill="#ffffff" />
                  <rect x="6" y="2" width="24" height="3" fill="#ffffff" />
                  <rect x="0" y="5" width="36" height="3" fill="#ffffff" />
                  <rect x="2" y="7" width="32" height="2" fill="#e0f2fe" />
                  <rect x="6" y="9" width="24" height="1" fill="#bae6fd" />
                </svg>
              </div>
              <div className="absolute top-1 left-[72%]">
                <svg viewBox="0 0 18 6" width="36" height="12" shapeRendering="crispEdges">
                  <rect x="6" y="0" width="6" height="2" fill="#ffffff" />
                  <rect x="2" y="2" width="14" height="2" fill="#ffffff" />
                  <rect x="0" y="3" width="18" height="2" fill="#ffffff" />
                  <rect x="2" y="5" width="14" height="1" fill="#e0f2fe" />
                </svg>
              </div>
            </div>
          ))}
        </div>

        {/* 3. Track 2: Mid-Sky Delicate Stepped Cloud Whispers (Faster Smooth Infinite Wrap) */}
        <div className="absolute top-9 left-0 w-[200%] h-16 pointer-events-none opacity-85 animate-cloud-drift-fast flex">
          {[0, 1].map((half) => (
            <div key={`cloud-fast-${half}`} className="relative w-1/2 h-full">
              <div className="absolute top-1 left-[16%]">
                <svg viewBox="0 0 42 9" width="84" height="18" shapeRendering="crispEdges">
                  <rect x="14" y="0" width="14" height="2" fill="#ffffff" />
                  <rect x="6" y="2" width="30" height="3" fill="#ffffff" />
                  <rect x="0" y="5" width="42" height="2" fill="#ffffff" />
                  <rect x="3" y="6" width="36" height="2" fill="#e0f2fe" />
                  <rect x="10" y="8" width="22" height="1" fill="#bae6fd" />
                </svg>
              </div>
              <div className="absolute top-4 left-[56%]">
                <svg viewBox="0 0 28 7" width="56" height="14" shapeRendering="crispEdges">
                  <rect x="8" y="0" width="10" height="2" fill="#ffffff" />
                  <rect x="4" y="2" width="20" height="2" fill="#ffffff" />
                  <rect x="0" y="4" width="28" height="2" fill="#ffffff" />
                  <rect x="2" y="5" width="24" height="2" fill="#e0f2fe" />
                </svg>
              </div>
              <div className="absolute top-2 left-[88%]">
                <svg viewBox="0 0 16 5" width="32" height="10" shapeRendering="crispEdges">
                  <rect x="4" y="0" width="8" height="2" fill="#ffffff" />
                  <rect x="0" y="2" width="16" height="2" fill="#ffffff" />
                  <rect x="2" y="4" width="12" height="1" fill="#e0f2fe" />
                </svg>
              </div>
            </div>
          ))}
        </div>

        {/* Fitted to the full width (never cropped at the sides), so each region's edge meets its neighbor's exactly. */}
        {/* 4. Scenery: misty mountains, mossy cliffs with waterfalls and trees (the World's own painted backdrop).
            It fills the whole World, so low ground never shows an empty strip; its sky is see-through for the sun and clouds.
            It overlaps each neighbor by a pixel, so no faint line shows where two regions meet. */}
        <img
          src={regionBackdrop(region)}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="night-fade absolute bottom-0 max-w-none h-auto pointer-events-none select-none"
          // Each 1282-pixel piece carries one column of each neighbor; sized so those columns land exactly on the neighbors
         
          // The scenery fades to very dark as night falls (--night-dark goes from 0 by day to 1 at night)
          style={{ left: (-100 / 1280) + '%', width: (100 * 1282 / 1280) + '%', filter: 'brightness(calc(1 - var(--night-dark, 0) * 0.82)) saturate(calc(1 - var(--night-dark, 0) * 0.45))' }}
        />
        {/* Background trees sway in the wind, bending from the base of the trunk */}
        {REGION_TREES[region] && (
          <div aria-hidden="true" className="night-fade absolute bottom-0 pointer-events-none" style={{ left: (-100 / 1280) + '%', width: (100 * 1282 / 1280) + '%', aspectRatio: '1282 / 512', filter: 'brightness(calc(1 - var(--night-dark, 0) * 0.82)) saturate(calc(1 - var(--night-dark, 0) * 0.45))' }}>
            {REGION_TREES[region].map((t, i) => (
              <img
                key={i}
                src={t.src}
                alt=""
                draggable={false}
                className="bg-tree absolute select-none"
                style={{
                  left: (t.x / 12.82) + '%', top: (t.y / 5.12) + '%', width: (t.w / 12.82) + '%', height: (t.h / 5.12) + '%',
                  transformOrigin: (t.px / t.w) * 100 + '% ' + (t.py / t.h) * 100 + '%',
                  animationDelay: t.d + 's' // a tree shown in two regions (it crosses their edge) keeps one shared delay
                }}
              />
            ))}
          </div>
        )}
        {REGION_FALLS[region] && (
          <div
            aria-hidden="true"
            className="bg-falls"
            style={{ maskImage: 'url(' + REGION_FALLS[region] + ')', WebkitMaskImage: 'url(' + REGION_FALLS[region] + ')' }}
          />
        )}

        {/* 7. LAYER 4: Soft Lighter Aerial Haze for Visual Depth & Foreground Readability */}
        <div
          className="absolute inset-x-0 bottom-[6%] h-32 pointer-events-none"
          style={{
            background: 'linear-gradient(to top, rgba(165, 243, 252, 0.44) 0%, rgba(199, 243, 250, 0.22) 50%, transparent 100%)'
          }}
        />
      </div>
    )}

      </>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sharedSky, theme, world.customBackgroundUrl, world.name, region]
  );
  // Terrain is static between paint strokes. Keep its thousands of SVG pieces out of
  // the live DOM: one image per region preserves the existing pixel patterns while
  // creature physics and pointer hover no longer reconcile every terrain cell.
  const terrainCells = useRef(new Map<string, { sig: string; markup: string }>());
  const terrainImage = useMemo(() => {
    const tiles = world.tiles;
    const pieces: string[] = [];
    for (let y = 0; y < tiles.length; y++) {
      for (let x = 0; x < tiles[y].length; x++) {
        const material = tiles[y][x];
        if (material === 'air') continue;
        const key = x + '-' + y;
        const at = (cx: number, cy: number) => tiles[cy]?.[cx] ?? '-';
        const sig = material + '|' + at(x, y - 1) + '|' + at(x - 1, y) + '|' + at(x + 1, y) + '|' + at(x, y + 1) + '|' + theme;
        let hit = terrainCells.current.get(key);
        if (!hit || hit.sig !== sig) {
          const markup = renderToStaticMarkup(renderTilePattern(material, x, y) || <></>)
            .replace('<svg ', `<svg x="${x * 16}" y="${y * 16}" width="16" height="16" `);
          hit = { sig, markup };
          terrainCells.current.set(key, hit);
        }
        pieces.push(hit.markup);
      }
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRID_WIDTH * 16} ${GRID_HEIGHT * 16}" preserveAspectRatio="none" shape-rendering="crispEdges"><style>@keyframes pulse{50%{opacity:.5}}.animate-pulse{animation:pulse 2s cubic-bezier(.4,0,.6,1) infinite}</style>${pieces.join('')}</svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }, [world.tiles, theme]);
  const decorCache = useRef(new WeakMap<object, { edit: boolean; el: React.ReactNode }>());
  const decorElements = world.decorations.map((decor) => {
    const hit = decorCache.current.get(decor);
    // Seeds grow over time, so they are always rebuilt; other props only when they change
    if (hit && hit.edit === isEditMode && decor.type !== 'seed') return hit.el;
    const el = renderDecoration(decor);
    decorCache.current.set(decor, { edit: isEditMode, el });
    return el;
  });

  const worldLayers = useMemo(
    () => (
      <>
      {backdrop}

      {/* One terrain surface; the container's grid math still handles paint and grab. */}
      <img src={terrainImage} alt="" draggable={false} aria-hidden="true"
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ imageRendering: 'pixelated' }} />
      {isEditMode && <div aria-hidden="true" className="absolute inset-0 pointer-events-none"
        style={{ backgroundImage: 'linear-gradient(to right, #ffffff0a 1px, transparent 1px), linear-gradient(to bottom, #ffffff0a 1px, transparent 1px)', backgroundSize: `${100 / GRID_WIDTH}% ${100 / GRID_HEIGHT}%` }} />}

      {/* Decorations Layer */}
      {decorElements}

      {/* Brush / Placement Ghost Cursor in Edit Mode */}
      </>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [world, sharedSky, theme, isEditMode, onRemoveDecoration, terrainImage]
  );

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ touchAction: 'none' }}
      className={`absolute inset-0 w-full h-full overflow-hidden select-none ${
        world.customBackgroundUrl ? 'bg-slate-950' : sharedSky ? 'bg-transparent' : `bg-gradient-to-b ${skyBackground}`
      } ${
        isEditMode ? 'cursor-crosshair' : 'cursor-default'
      }`}
    >
      {worldLayers}
      <GrassLayer world={world} actors={grassActors} residents={grassResidents} heldId={heldCreatureId} paused={isEditMode} />

      {isEditMode && hoverGrid && activeTool.type !== 'grab' && (() => {
        let isValidPlacement = true;
        let statusLabel = '';
        let snappedGroundY: number | undefined = undefined;

        if (activeTool.type === 'brush') {
          statusLabel = `${activeTool.material.toUpperCase()} (${brushSize}x${brushSize})`;
        } else if (activeTool.type === 'eraser') {
          statusLabel = `ERASE (${brushSize}x${brushSize})`;
        } else if (activeTool.type === 'decoration') {
          const placementCheck = canPlaceDecoration(world, activeTool.decorType, hoverGrid.x, hoverGrid.y);
          isValidPlacement = placementCheck.allowed;
          snappedGroundY = placementCheck.snappedY;
          statusLabel = isValidPlacement
            ? `PLACE ${activeTool.decorType.toUpperCase()}`
            : (placementCheck.reason || 'INVALID PLACEMENT').toUpperCase();
        }

        const borderBgClass = isValidPlacement
          ? 'border-amber-400 bg-amber-400/20 shadow-[0_0_15px_rgba(245,158,11,0.5)]'
          : 'border-rose-500 bg-rose-500/25 shadow-[0_0_15px_rgba(244,63,94,0.6)]';

        const labelColorClass = isValidPlacement
          ? 'text-amber-300 border-amber-500/40'
          : 'text-rose-300 border-rose-500/50';

        const isHighAirClick = activeTool.type === 'decoration' && isValidPlacement && snappedGroundY !== undefined && hoverGrid.y < snappedGroundY;

        return (
          <>
            {/* If hovering in air above land with decoration tool, show dashed drop guide line to ground */}
            {isHighAirClick && snappedGroundY !== undefined && (
              <div
                className="absolute pointer-events-none z-25 border-l-2 border-dashed border-amber-400/80 transition-all"
                style={{
                  left: `${((hoverGrid.x + 0.5) / GRID_WIDTH) * 100}%`,
                  top: `${(hoverGrid.y / GRID_HEIGHT) * 100}%`,
                  height: `${((snappedGroundY - hoverGrid.y) / GRID_HEIGHT) * 100}%`
                }}
              />
            )}

            {/* Grounded footprint target box when placing decorations */}
            {activeTool.type === 'decoration' && isValidPlacement && snappedGroundY !== undefined && (
              <div
                className="absolute pointer-events-none border-2 border-emerald-400 bg-emerald-400/25 shadow-[0_0_15px_rgba(52,211,153,0.6)] z-25 rounded-sm transition-all"
                style={{
                  left: `${(hoverGrid.x / GRID_WIDTH) * 100}%`,
                  top: `${(snappedGroundY / GRID_HEIGHT) * 100}%`,
                  width: `${(1 / GRID_WIDTH) * 100}%`,
                  height: `${(1 / GRID_HEIGHT) * 100}%`
                }}
              >
                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 px-1 py-0.5 rounded bg-slate-950/90 text-[8px] font-mono text-emerald-300 whitespace-nowrap border border-emerald-500/50">
                  GROUNDED SURFACE (ROW {snappedGroundY})
                </div>
              </div>
            )}

            {/* Hover cursor box */}
            <div
              className={`absolute pointer-events-none border-2 rounded-sm z-30 transition-all duration-75 ${borderBgClass}`}
              style={{
                left: `${((hoverGrid.x - Math.floor(brushSize / 2)) / GRID_WIDTH) * 100}%`,
                top: `${((hoverGrid.y - Math.floor(brushSize / 2)) / GRID_HEIGHT) * 100}%`,
                width: `${(brushSize / GRID_WIDTH) * 100}%`,
                height: `${(brushSize / GRID_HEIGHT) * 100}%`
              }}
            >
              <div className={`absolute -top-5 left-0 px-1 py-0.5 rounded bg-slate-900/90 text-[9px] font-mono whitespace-nowrap border ${labelColorClass}`}>
                {isHighAirClick ? `${statusLabel} (SNAPS TO ROW ${snappedGroundY})` : statusLabel}
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
});

