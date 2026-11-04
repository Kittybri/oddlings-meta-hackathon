/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ExtraBuildType } from './buildCatalog';

export type HabitatThemeId = 'desk' | 'greenhouse' | 'lab' | string;

export type TileMaterial =
  | 'air'
  | 'grass'
  | 'dirt'
  | 'stone'
  | 'sand'
  | 'wood'
  | 'water'
  | 'brick'
  | 'plaster'
  | 'carpet'
  | 'tile'
  | 'glass'
  | 'metal'
  | 'snow'
  | 'moss';

export type DecorationType =
  | 'tree'
  | 'shrub'
  | 'flower'
  | 'rock'
  | 'mushroom'
  | 'lantern'
  | 'shelter'
  | 'seed'
  | 'custom'
  | 'bench'
  | 'fence'
  | 'flowerpot'
  | 'campfire'
  | 'lamppost'
  | 'crystal'
  | 'well'
  | 'cottage'
  | ExtraBuildType;

export type StarterTemplateId = 'cozy_clearing' | 'floating_garden' | 'rocky_pond' | 'living_garden';

export type FlowerVariant = 'sunburst' | 'moonbell' | 'starbloom';

export interface DecorationInstance {
  id: string;
  type: DecorationType;
  gridX: number;
  gridY: number; // grid row where bottom of decoration rests
  plantedAt?: number; // timestamp when seed was planted
  wateredAt?: number; // timestamp if watered / accelerated
  growthStage?: 1 | 2 | 3; // 1 = seed kernel, 2 = growing sprout, 3 = full blossom
  flowerVariant?: FlowerVariant;
  customItemId?: string; // photo-made item shown by a 'custom' decoration
}

export interface GardenTasksState {
  plantedSeed: boolean;
  grownFlower: boolean;
  oddlingEnjoyedPond: boolean;
  rewardClaimed: boolean;
}

export interface CustomBiomeRecord {
  id: string; // e.g. "custom_1700000000_abc"
  name: string; // e.g. "Sunset Balcony"
  createdAt: number;
  updatedAt: number;
  generationMode: 'local_quantization' | 'ai_generated';
  previewThumbnailUrl?: string; // small thumbnail for switcher
  hideAtmosphere?: boolean; // suppress outdoor sun/clouds
}

export interface BiomeWorldState {
  version: 1;
  biome: HabitatThemeId;
  name?: string;
  isCustom?: boolean;
  customBackgroundUrl?: string;
  originalPhotoUrl?: string;
  generationMode?: 'local_quantization' | 'ai_generated';
  hideAtmosphere?: boolean;
  width: number;  // default 48
  height: number; // default 24
  tiles: TileMaterial[][]; // [y][x] array of 24 rows x 48 cols
  decorations: DecorationInstance[];
  updatedAt: number;
}

export type EditorToolTab = 'terrain' | 'water' | 'decorations' | 'photos' | 'templates';

export type EditorTool =
  | { type: 'brush'; material: TileMaterial }
  | { type: 'eraser' }
  | { type: 'grab' } // pick up placed items to move them or drop them on the trash; never paints
  | { type: 'decoration'; decorType: DecorationType; customItemId?: string };

export interface WorldSnapshot {
  tiles: TileMaterial[][];
  decorations: DecorationInstance[];
}

export interface CreaturePhysicalPosition {
  xPct: number; // 0 - 100%
  yPct: number; // 0 - 100%
  gridX: number;
  gridY: number;
  isGrounded: boolean;
  isInWater: boolean;
  isNearShelter: boolean;
}
