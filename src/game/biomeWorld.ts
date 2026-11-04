/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BUILD_ITEMS } from './buildCatalog';

import {
  BiomeWorldState,
  DecorationInstance,
  DecorationType,
  HabitatThemeId,
  StarterTemplateId,
  TileMaterial,
  WorldSnapshot
} from './biomeWorldTypes';

export const GRID_WIDTH = 48;
export const GRID_HEIGHT = 24;
export const DEFAULT_GROUND_ROW = 16; // rows 16..23 are solid ground by default

export function isSolidTile(material: TileMaterial): boolean {
  return material === 'grass' ||
    material === 'dirt' ||
    material === 'stone' ||
    material === 'sand' ||
    material === 'wood' ||
    material === 'brick' ||
    material === 'plaster' ||
    material === 'carpet' ||
    material === 'tile' ||
    material === 'glass' ||
    material === 'metal' ||
    material === 'snow' ||
    material === 'moss';
}

export function isWaterTile(material: TileMaterial): boolean {
  return material === 'water';
}

export function cloneTiles(tiles: TileMaterial[][]): TileMaterial[][] {
  return tiles.map((row) => [...row]);
}

export function cloneDecorations(decorations: DecorationInstance[]): DecorationInstance[] {
  return decorations.map((d) => ({ ...d }));
}

/**
 * Creates an empty 48x24 world grid of air.
 */
export function createEmptyTiles(): TileMaterial[][] {
  const rows: TileMaterial[][] = [];
  for (let y = 0; y < GRID_HEIGHT; y++) {
    const row: TileMaterial[] = [];
    for (let x = 0; x < GRID_WIDTH; x++) {
      row.push('air');
    }
    rows.push(row);
  }
  return rows;
}

/**
 * Builds starter templates for the 3 biome presets:
 * 1. Cozy Clearing (rolling hills, central oak tree, wildflowers, wooden platform bridge)
 * 2. Floating Garden (floating islands, lanterns, stepping stones, wooden terrace)
 * 3. Rocky Pond (recessed pool with shallow water, stone banks, mushrooms, shelter)
 */
export function createStarterWorld(
  biome: HabitatThemeId,
  templateId?: StarterTemplateId
): BiomeWorldState {
  const resolvedTemplate: StarterTemplateId =
    templateId || (biome === 'greenhouse' ? 'living_garden' : 'cozy_clearing');
  const tiles = createEmptyTiles();
  const decorations: DecorationInstance[] = [];

  if (resolvedTemplate === 'cozy_clearing') {
    // Ground foundation: gentle rolling hill from row 16 to 17
    for (let x = 0; x < GRID_WIDTH; x++) {
      const hillOffset = Math.round(Math.sin((x / GRID_WIDTH) * Math.PI * 2) * 1.5);
      const groundRow = Math.max(14, Math.min(18, DEFAULT_GROUND_ROW + hillOffset));

      for (let y = 0; y < GRID_HEIGHT; y++) {
        if (y === groundRow) {
          tiles[y][x] = 'grass';
        } else if (y > groundRow) {
          tiles[y][x] = y > groundRow + 2 ? 'stone' : 'dirt';
        }
      }
    }

    // Elevated wooden platform bridge in the center-right
    for (let x = 28; x <= 37; x++) {
      tiles[12][x] = 'wood';
    }
    // Wooden post supports
    tiles[13][28] = 'wood';
    tiles[14][28] = 'wood';
    tiles[13][37] = 'wood';
    tiles[14][37] = 'wood';

    // Helper to find surface row at column x
    const groundAt = (x: number): number => {
      for (let y = 0; y < GRID_HEIGHT; y++) {
        if (tiles[y][x] !== 'air') return y;
      }
      return DEFAULT_GROUND_ROW;
    };

    // Decorations seated firmly on top surface of terrain
    decorations.push(
      { id: 'decor-tree-1', type: 'tree', gridX: 10, gridY: groundAt(10) },
      { id: 'decor-flower-1', type: 'flower', gridX: 16, gridY: groundAt(16) },
      { id: 'decor-flower-2', type: 'flower', gridX: 18, gridY: groundAt(18) },
      { id: 'decor-shrub-1', type: 'shrub', gridX: 23, gridY: groundAt(23) },
      { id: 'decor-lantern-1', type: 'lantern', gridX: 28, gridY: 12 },
      { id: 'decor-shelter-1', type: 'shelter', gridX: 33, gridY: 12 },
      { id: 'decor-rock-1', type: 'rock', gridX: 42, gridY: groundAt(42) }
    );
  } else if (resolvedTemplate === 'floating_garden') {
    // Lower bedrock base
    for (let x = 0; x < GRID_WIDTH; x++) {
      for (let y = 20; y < GRID_HEIGHT; y++) {
        tiles[y][x] = y === 20 ? 'grass' : 'stone';
      }
    }

    // Island 1: Left floating haven
    for (let x = 6; x <= 18; x++) {
      tiles[14][x] = 'grass';
      tiles[15][x] = 'dirt';
      if (x >= 8 && x <= 16) tiles[16][x] = 'stone';
    }

    // Island 2: Upper right floating terrace
    for (let x = 24; x <= 38; x++) {
      tiles[10][x] = 'grass';
      tiles[11][x] = 'wood';
      if (x >= 28 && x <= 34) tiles[12][x] = 'dirt';
    }

    // Stepping stone platforms between them
    tiles[12][20] = 'wood';
    tiles[12][21] = 'wood';

    // Helper to find surface row at column x
    const gardenGroundAt = (x: number): number => {
      for (let y = 0; y < GRID_HEIGHT; y++) {
        if (tiles[y][x] !== 'air') return y;
      }
      return 14;
    };

    decorations.push(
      { id: 'decor-tree-2', type: 'tree', gridX: 12, gridY: gardenGroundAt(12) },
      { id: 'decor-lantern-2', type: 'lantern', gridX: 7, gridY: gardenGroundAt(7) },
      { id: 'decor-mushroom-1', type: 'mushroom', gridX: 16, gridY: gardenGroundAt(16) },
      { id: 'decor-shelter-2', type: 'shelter', gridX: 32, gridY: gardenGroundAt(32) },
      { id: 'decor-flower-3', type: 'flower', gridX: 26, gridY: gardenGroundAt(26) },
      { id: 'decor-shrub-2', type: 'shrub', gridX: 36, gridY: gardenGroundAt(36) }
    );
  } else if (resolvedTemplate === 'rocky_pond') {
    // Solid ground with carved out water pool in center (cols 16..31)
    for (let x = 0; x < GRID_WIDTH; x++) {
      const isPool = x >= 15 && x <= 32;
      const baseRow = isPool ? 18 : 15;

      for (let y = 0; y < GRID_HEIGHT; y++) {
        if (isPool) {
          // Water pool surface at row 16, depth to row 18
          if (y >= 16 && y < 19) {
            tiles[y][x] = 'water';
          } else if (y >= 19) {
            tiles[y][x] = 'stone';
          }
        } else {
          // Banks
          if (y === baseRow) {
            tiles[y][x] = x < 15 ? 'grass' : 'sand';
          } else if (y > baseRow) {
            tiles[y][x] = y > baseRow + 2 ? 'stone' : 'dirt';
          }
        }
      }
    }

    // Stone rim along pool edges
    tiles[16][14] = 'stone';
    tiles[17][14] = 'stone';
    tiles[16][33] = 'stone';
    tiles[17][33] = 'stone';

    // Wooden dock platform extending into water
    tiles[15][13] = 'wood';
    tiles[15][14] = 'wood';
    tiles[15][15] = 'wood';
    tiles[15][16] = 'wood';

    const pondGroundAt = (x: number): number => {
      for (let y = 0; y < GRID_HEIGHT; y++) {
        if (tiles[y][x] !== 'air' && tiles[y][x] !== 'water') return y;
      }
      return 15;
    };

    decorations.push(
      { id: 'decor-shrub-3', type: 'shrub', gridX: 6, gridY: pondGroundAt(6) },
      { id: 'decor-tree-3', type: 'tree', gridX: 9, gridY: pondGroundAt(9) },
      { id: 'decor-mushroom-2', type: 'mushroom', gridX: 35, gridY: pondGroundAt(35) },
      { id: 'decor-lantern-3', type: 'lantern', gridX: 16, gridY: 15 },
      { id: 'decor-rock-2', type: 'rock', gridX: 37, gridY: pondGroundAt(37) },
      { id: 'decor-shelter-3', type: 'shelter', gridX: 42, gridY: pondGroundAt(42) }
    );
  } else if (resolvedTemplate === 'living_garden') {
    // 1. Terrain Foundation: Rich side-view irregular hills
    // Left knoll: col 0..5 at row 16, with stepped slope col 6..8 up to terrace
    for (let x = 0; x < GRID_WIDTH; x++) {
      let groundRow = 16;
      if (x <= 5) {
        groundRow = 16;
      } else if (x >= 6 && x <= 8) {
        // Stepped slope up: 6 -> 15, 7 -> 14, 8 -> 13
        groundRow = 16 - (x - 5);
      } else if (x >= 9 && x <= 14) {
        // Terrace base ground level
        groundRow = 16;
      } else if (x >= 15 && x <= 17) {
        // Grassy slope down to pond bank (16 -> 17)
        groundRow = x === 17 ? 17 : 16;
      } else if (x >= 18 && x <= 26) {
        // Shallow pond basin
        groundRow = 18;
      } else if (x >= 27 && x <= 37) {
        // Central fertile garden knoll
        groundRow = 16;
      } else if (x >= 38 && x <= 47) {
        // Right gentle hill rising to row 15
        groundRow = x === 38 ? 16 : 15;
      }

      for (let y = 0; y < GRID_HEIGHT; y++) {
        if (x >= 19 && x <= 25 && y >= 17 && y <= 18) {
          // Shallow pond water
          tiles[y][x] = 'water';
        } else if (y === groundRow) {
          if (x === 18 || x === 26) {
            tiles[y][x] = 'sand'; // sandy pond bank
          } else {
            tiles[y][x] = 'grass';
          }
        } else if (y > groundRow) {
          tiles[y][x] = y > groundRow + 2 ? 'stone' : 'dirt';
        }
      }
    }

    // 2. Reachable Elevated Wooden Terrace (cols 9..14 at row 12)
    for (let x = 9; x <= 14; x++) {
      tiles[12][x] = x === 9 || x === 14 ? 'wood' : 'grass';
      tiles[13][x] = 'wood'; // wood planter under turf
    }
    // Wooden structural posts for terrace
    tiles[14][9] = 'wood';
    tiles[15][9] = 'wood';
    tiles[14][14] = 'wood';
    tiles[15][14] = 'wood';

    // 3. Tiny Arched Wooden Footbridge spanning the shallow pond (cols 20..24 at row 15)
    for (let x = 20; x <= 24; x++) {
      tiles[15][x] = 'wood';
    }
    tiles[16][20] = 'wood'; // bridge left pier
    tiles[16][24] = 'wood'; // bridge right pier

    // Helper to find surface row at column x
    const gardenGroundAt = (x: number): number => {
      for (let y = 0; y < GRID_HEIGHT; y++) {
        if (tiles[y][x] !== 'air' && tiles[y][x] !== 'water') return y;
      }
      return 16;
    };

    // 4. Balanced Garden Decorations with Pre-Planted Sprout & Flora
    decorations.push(
      // Left entrance tree
      { id: 'decor-gh-tree-1', type: 'tree', gridX: 3, gridY: gardenGroundAt(3) },
      // Shrub on elevated terrace
      { id: 'decor-gh-shrub-1', type: 'shrub', gridX: 11, gridY: 12 },
      // Lantern on terrace edge
      { id: 'decor-gh-lantern-1', type: 'lantern', gridX: 14, gridY: 12 },
      // Pre-placed flower near slope
      { id: 'decor-gh-flower-1', type: 'flower', gridX: 16, gridY: gardenGroundAt(16) },
      // Bridge post lantern
      { id: 'decor-gh-lantern-2', type: 'lantern', gridX: 20, gridY: 15 },
      // Smooth river boulder at right pond bank
      { id: 'decor-gh-rock-1', type: 'rock', gridX: 26, gridY: gardenGroundAt(26) },
      // Pre-planted growing sprout in central fertile soil
      {
        id: 'decor-gh-starter-sprout',
        type: 'seed',
        gridX: 30,
        gridY: gardenGroundAt(30),
        plantedAt: Date.now() - 40000,
        growthStage: 2,
        flowerVariant: 'sunburst'
      },
      // Second flower in right field
      { id: 'decor-gh-flower-2', type: 'flower', gridX: 35, gridY: gardenGroundAt(35) },
      // Berry shrub near right hill
      { id: 'decor-gh-shrub-2', type: 'shrub', gridX: 39, gridY: gardenGroundAt(39) },
      // Cozy rooted greenhouse shelter
      { id: 'decor-gh-shelter-1', type: 'shelter', gridX: 43, gridY: gardenGroundAt(43) }
    );
  }

  return {
    version: 1,
    biome,
    width: GRID_WIDTH,
    height: GRID_HEIGHT,
    tiles,
    decorations,
    updatedAt: Date.now()
  };
}

/**
 * Paints a tile or cluster of tiles based on brush size (1, 2, or 3).
 * Mutates a cloned copy and returns updated world.
 */
export function isAquaticDecoration(type: DecorationType): boolean {
  // Current terrestrial decorations: tree, shrub, flower, seed, rock, mushroom, lantern, shelter
  return false;
}

export function hasWaterInColumn(world: BiomeWorldState, gridX: number): boolean {
  const clampedX = Math.max(0, Math.min(GRID_WIDTH - 1, Math.round(gridX)));
  for (let y = 0; y < GRID_HEIGHT; y++) {
    if (isWaterTile(world.tiles[y][clampedX])) return true;
  }
  return false;
}

export function hasWaterSurfaceAtColumn(world: BiomeWorldState, gridX: number): boolean {
  const clampedX = Math.max(0, Math.min(GRID_WIDTH - 1, Math.round(gridX)));
  for (let y = 0; y < GRID_HEIGHT; y++) {
    const mat = world.tiles[y][clampedX];
    if (mat === 'air') continue;
    if (isWaterTile(mat)) return true;
    if (isSolidTile(mat)) return false;
  }
  return false;
}

export function findWaterSurfaceY(world: BiomeWorldState, gridX: number): number {
  const clampedX = Math.max(0, Math.min(GRID_WIDTH - 1, Math.round(gridX)));
  for (let y = 0; y < GRID_HEIGHT; y++) {
    if (isWaterTile(world.tiles[y][clampedX])) {
      return y;
    }
  }
  return -1;
}

/**
 * Finds the nearest valid supporting surface for a prop at or below startGridY in column gridX.
 * A supporting surface is the top of a solid tile (grass, dirt, stone, sand, wood)
 * where the tile immediately above it is passable air (not solid and not submerged in water).
 * Returns the grid row index (0..GRID_HEIGHT - 1) of the solid block, or -1 if no support exists.
 */
export function findSupportingSurfaceForProp(
  world: BiomeWorldState,
  gridX: number,
  startGridY?: number
): number {
  const clampedX = Math.max(0, Math.min(GRID_WIDTH - 1, Math.round(gridX)));
  const searchStart = startGridY !== undefined
    ? Math.max(0, Math.min(GRID_HEIGHT - 1, Math.round(startGridY)))
    : 0;

  for (let y = searchStart; y < GRID_HEIGHT; y++) {
    if (isSolidTile(world.tiles[y][clampedX]) && !isWaterTile(world.tiles[y][clampedX])) {
      // Must not be embedded inside solid mass: tile directly above must be passable air (or top of grid)
      if (y === 0 || (!isSolidTile(world.tiles[y - 1][clampedX]) && !isWaterTile(world.tiles[y - 1][clampedX]))) {
        return y;
      }
    }
  }

  return -1;
}

/**
 * Deterministically snaps all decorations to their true supporting ground surface in the world.
 * When ground underneath a prop is removed or edited, re-settles prop to the next surface.
 * Preserves all decoration IDs, types, and seed timestamps without deleting or replacing terrain.
 */
export function settleDecorationsAfterTerrainEdit(world: BiomeWorldState): BiomeWorldState {
  const settledDecorations = world.decorations.map((decor) => {
    // Follow only the ground touching this prop, even under a floating platform.
    let row = decor.gridY;
    while (row > 0 && isSolidTile(world.tiles[row]?.[decor.gridX]) &&
           isSolidTile(world.tiles[row - 1]?.[decor.gridX])) {
      row--;
    }
    const supportedY = findSupportingSurfaceForProp(world, decor.gridX, row);
    if (supportedY !== -1 && supportedY !== decor.gridY) {
      return { ...decor, gridY: supportedY };
    }
    return decor;
  });

  return {
    ...world,
    decorations: settledDecorations
  };
}

export const healWorldDecorations = settleDecorationsAfterTerrainEdit;

export function brushBounds(x: number, y: number, size: 1 | 2 | 3) {
  const offset = Math.floor((size - 1) / 2);
  const left = x - offset;
  const top = y - offset;
  return {
    left: Math.max(0, left),
    top: Math.max(0, top),
    right: Math.min(GRID_WIDTH, left + size),
    bottom: Math.min(GRID_HEIGHT, top + size)
  };
}
/**
 * Paints a tile or cluster of tiles based on brush size (1, 2, or 3).
 * Automatically re-settles affected decorations to the new terrain surface.
 */
export function paintTiles(
  world: BiomeWorldState,
  targetGridX: number,
  targetGridY: number,
  material: TileMaterial,
  brushSize: 1 | 2 | 3 = 1
): BiomeWorldState {
  const nextTiles = cloneTiles(world.tiles);
  const bounds = brushBounds(targetGridX, targetGridY, brushSize);
  for (let y = bounds.top; y < bounds.bottom; y++) {
    for (let x = bounds.left; x < bounds.right; x++) {
      nextTiles[y][x] = material;
    }
  }

  return settleDecorationsAfterTerrainEdit({
    ...world,
    tiles: nextTiles,
    updatedAt: Date.now()
  });
}

/**
 * Erases tiles to 'air' and deterministically drops any decorations resting on removed tiles.
 */
export function eraseTiles(
  world: BiomeWorldState,
  targetGridX: number,
  targetGridY: number,
  brushSize: 1 | 2 | 3 = 1
): BiomeWorldState {
  return paintTiles(world, targetGridX, targetGridY, 'air', brushSize);
}

/**
 * Adds or moves a decoration sprite to the grid, snapping to nearest valid supporting ground.
 */
export function addDecoration(
  world: BiomeWorldState,
  type: DecorationType,
  gridX: number,
  gridY: number,
  extra?: Partial<DecorationInstance>
): BiomeWorldState {
  const clampedX = Math.max(0, Math.min(GRID_WIDTH - 1, gridX));
  // Snap to valid supporting ground surface
  const supportedY = findSupportingSurfaceForProp(world, clampedX, gridY);
  const finalY = supportedY !== -1 ? supportedY : Math.max(0, Math.min(GRID_HEIGHT - 1, gridY));

  // Remove any decoration existing at the exact same grid column and resting surface
  const filtered = world.decorations.filter((d) => !(d.gridX === clampedX && d.gridY === finalY));

  const newDecor: DecorationInstance = {
    id: `decor-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    type,
    gridX: clampedX,
    gridY: finalY,
    ...(type === 'seed'
      ? {
          plantedAt: Date.now(),
          growthStage: 1,
          flowerVariant: extra?.flowerVariant || (['sunburst', 'moonbell', 'starbloom'] as const)[Math.floor(Math.random() * 3)]
        }
      : {}),
    ...extra
  };

  return {
    ...world,
    decorations: [...filtered, newDecor],
    updatedAt: Date.now()
  };
}

/**
 * Removes a decoration sprite by ID or near coordinates.
 */
export function removeDecoration(
  world: BiomeWorldState,
  id: string
): BiomeWorldState {
  return {
    ...world,
    decorations: world.decorations.filter((d) => d.id !== id),
    updatedAt: Date.now()
  };
}

/**
 * Finds the top surface Y (in grid rows) for a given X column.
 * If startGridY is provided, finds the nearest solid tile at or below startGridY.
 * Returns -1 if no solid surface exists in the column.
 */
export function findSupportedSurfaceY(
  world: BiomeWorldState,
  gridX: number,
  startGridY = 0
): number {
  const clampedX = Math.max(0, Math.min(GRID_WIDTH - 1, Math.round(gridX)));
  const searchStart = Math.max(0, Math.min(GRID_HEIGHT - 1, Math.round(startGridY)));

  for (let y = searchStart; y < GRID_HEIGHT; y++) {
    if (isSolidTile(world.tiles[y][clampedX])) {
      return y;
    }
  }

  // Fallback: search whole column from top if startGridY was below everything
  for (let y = 0; y < GRID_HEIGHT; y++) {
    if (isSolidTile(world.tiles[y][clampedX])) {
      return y;
    }
  }

  return -1; // Void column (creatures will slide to adjacent supported column)
}

/**
 * Finds a safe, supported spawn position for a creature.
 */
export function findSafeSpawnPosition(
  world: BiomeWorldState,
  preferredX?: number
): { xPct: number; yPct: number; gridX: number; gridY: number } {
  let targetX = preferredX !== undefined
    ? Math.max(2, Math.min(GRID_WIDTH - 3, Math.round((preferredX / 100) * GRID_WIDTH)))
    : Math.floor(GRID_WIDTH / 2);

  let surfaceY = findSupportedSurfaceY(world, targetX);

  // If column has no solid ground, search outward left & right
  if (surfaceY === -1) {
    for (let offset = 1; offset < GRID_WIDTH / 2; offset++) {
      const leftX = targetX - offset;
      if (leftX >= 0 && (surfaceY = findSupportedSurfaceY(world, leftX)) !== -1) {
        targetX = leftX;
        break;
      }
      const rightX = targetX + offset;
      if (rightX < GRID_WIDTH && (surfaceY = findSupportedSurfaceY(world, rightX)) !== -1) {
        targetX = rightX;
        break;
      }
    }
  }

  if (surfaceY === -1) {
    // Total void fallback: center row
    surfaceY = DEFAULT_GROUND_ROW;
  }

  const xPct = ((targetX + 0.5) / GRID_WIDTH) * 100;
  // Creature feet rest precisely at the top surface of the solid block: surfaceY / GRID_HEIGHT * 100
  const yPct = (surfaceY / GRID_HEIGHT) * 100;

  return { xPct, yPct, gridX: targetX, gridY: surfaceY };
}

/**
 * Checks if a step from current (gx, gy) to (nextGx) is walkable.
 * Allows walking horizontally, climbing 1 block up, or stepping down ledges/slopes up to 6 blocks.
 */
export function canStepTo(
  world: BiomeWorldState,
  currentGx: number,
  currentGy: number,
  nextGx: number
): { allowed: boolean; targetGy: number } {
  if (nextGx < 0 || nextGx >= GRID_WIDTH) {
    return { allowed: false, targetGy: currentGy };
  }

  // Check 1: 1-block hop up onto a solid block at currentGy - 1
  const stepUpY = currentGy - 1;
  if (stepUpY >= 0 && isSolidTile(world.tiles[stepUpY][nextGx])) {
    // 1-block hop up: target is stepUpY
    // Requires clear headroom: 2 air blocks above the step (stepUpY - 1 and stepUpY - 2)
    const head1 = stepUpY - 1;
    const head2 = stepUpY - 2;
    if (head1 >= 0 && isSolidTile(world.tiles[head1][nextGx])) {
      return { allowed: false, targetGy: currentGy }; // 2+ block tall wall
    }
    if (head2 >= 0 && isSolidTile(world.tiles[head2][nextGx])) {
      return { allowed: false, targetGy: currentGy }; // low ceiling above step
    }
    return { allowed: true, targetGy: stepUpY };
  }

  // Check 2: Walking forward (flat ground or dropping down)
  // Both body (currentGy - 1) and head (currentGy - 2) must be clear air
  const headY = currentGy - 2;
  if (headY >= 0 && isSolidTile(world.tiles[headY][nextGx])) {
    return { allowed: false, targetGy: currentGy }; // Blocked by 2+ block tall wall or low overhang
  }

  // Check surface below feet in next column
  const nextSurfaceY = findSupportedSurfaceY(world, nextGx, currentGy);
  if (nextSurfaceY === -1) {
    return { allowed: false, targetGy: currentGy }; // void drop
  }

  const dropDistance = nextSurfaceY - currentGy;
  // Can walk flat (dropDistance === 0) or step down safely up to 6 blocks
  if (dropDistance >= 0 && dropDistance <= 6) {
    return { allowed: true, targetGy: nextSurfaceY };
  }

  return { allowed: false, targetGy: currentGy };
}

const STORAGE_PREFIX = 'oddlings_biome_world_v1_';

export function getStorageKey(biome: HabitatThemeId): string {
  return `${STORAGE_PREFIX}${biome}`;
}

export function saveBiomeWorldToStorage(world: BiomeWorldState): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    const serialized = JSON.stringify(world);
    localStorage.setItem(getStorageKey(world.biome), serialized);
    return true;
  } catch (err) {
    console.warn('Failed to save biome world to localStorage:', err);
    return false;
  }
}

/**
 * Validates and sanitizes a biome world state from arbitrary object data.
 * Returns null if irrecoverably corrupt or missing required grid dimensions.
 */
export function sanitizeBiomeWorld(raw: unknown, expectedBiome?: HabitatThemeId): BiomeWorldState | null {
  if (!raw || typeof raw !== 'object') return null;
  const parsed = raw as Record<string, unknown>;

  const validBiomes: HabitatThemeId[] = ['desk', 'greenhouse', 'lab'];
  let biome: HabitatThemeId;
  if (expectedBiome) {
    biome = expectedBiome;
  } else if (typeof parsed.biome === 'string' && parsed.biome.trim()) {
    biome = parsed.biome;
  } else {
    biome = 'desk';
  }

  if (parsed.version !== 1) return null;
  if (!Array.isArray(parsed.tiles) || parsed.tiles.length !== GRID_HEIGHT) {
    return null;
  }

  const validMaterials: TileMaterial[] = [
    'air', 'grass', 'dirt', 'stone', 'sand', 'wood', 'water',
    'brick', 'plaster', 'carpet', 'tile', 'glass', 'metal', 'snow', 'moss'
  ];
  const sanitizedTiles: TileMaterial[][] = [];

  for (let y = 0; y < GRID_HEIGHT; y++) {
    const row = parsed.tiles[y];
    if (!Array.isArray(row) || row.length !== GRID_WIDTH) {
      return null;
    }
    sanitizedTiles.push(
      row.map((tile: any) => (validMaterials.includes(tile) ? tile : 'air'))
    );
  }

  const validDecorTypes: DecorationType[] = ['tree', 'shrub', 'flower', 'rock', 'mushroom', 'lantern', 'shelter', 'seed', 'custom', 'bench', 'fence', 'flowerpot', 'campfire', 'lamppost', 'crystal', 'well', 'cottage', ...BUILD_ITEMS.map(item => item.type)];
  const sanitizedDecorations: DecorationInstance[] = Array.isArray(parsed.decorations)
    ? parsed.decorations
        .filter(
          (d: any) =>
            d &&
            typeof d.id === 'string' &&
            validDecorTypes.includes(d.type) &&
            (d.type !== 'custom' || typeof d.customItemId === 'string') &&
            typeof d.gridX === 'number' &&
            typeof d.gridY === 'number'
        )
        .map((d: any) => ({
          id: String(d.id),
          type: d.type as DecorationType,
          gridX: Math.max(0, Math.min(GRID_WIDTH - 1, Math.round(d.gridX))),
          gridY: Math.max(0, Math.min(GRID_HEIGHT - 1, Math.round(d.gridY))),
          plantedAt: typeof d.plantedAt === 'number' ? d.plantedAt : undefined,
          wateredAt: typeof d.wateredAt === 'number' ? d.wateredAt : undefined,
          growthStage: [1, 2, 3].includes(d.growthStage) ? d.growthStage : undefined,
          flowerVariant: ['sunburst', 'moonbell', 'starbloom'].includes(d.flowerVariant) ? d.flowerVariant : undefined,
          customItemId: d.type === 'custom' && typeof d.customItemId === 'string' ? d.customItemId : undefined
        }))
    : [];

  const name = typeof parsed.name === 'string' ? parsed.name : undefined;
  const isCustom = typeof parsed.isCustom === 'boolean' ? parsed.isCustom : (biome.startsWith('custom_') || undefined);
  const customBackgroundUrl = typeof parsed.customBackgroundUrl === 'string' ? parsed.customBackgroundUrl : undefined;
  const originalPhotoUrl = typeof parsed.originalPhotoUrl === 'string' ? parsed.originalPhotoUrl : undefined;
  const generationMode = parsed.generationMode === 'ai_generated' ? 'ai_generated' : (parsed.generationMode === 'local_quantization' ? 'local_quantization' : undefined);
  const hideAtmosphere = typeof parsed.hideAtmosphere === 'boolean' ? parsed.hideAtmosphere : (isCustom ? true : undefined);

  return healWorldDecorations({
    version: 1,
    biome,
    name,
    isCustom,
    customBackgroundUrl,
    originalPhotoUrl,
    generationMode,
    hideAtmosphere,
    width: GRID_WIDTH,
    height: GRID_HEIGHT,
    tiles: sanitizedTiles,
    decorations: sanitizedDecorations,
    updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now()
  });
}

/**
 * Computes deterministic seed growth based on saved timestamps.
 * Growth stages:
 * Stage 1: Burrowed Seed (0 to 25s)
 * Stage 2: Sproutling with leaves (25s to 60s)
 * Stage 3: Bloomed Flower (60s+)
 * Proximity to water / shallow pond accelerates growth by 50% (blooms in 30s)!
 */
export function computeSeedGrowth(
  decor: DecorationInstance,
  currentTimestamp: number,
  world?: BiomeWorldState
): {
  stage: 1 | 2 | 3;
  isPondAccelerated: boolean;
  isAcceleratedByWater: boolean;
  progressPct: number;
  stageName: string;
} {
  if (decor.type !== 'seed') {
    return {
      stage: 3,
      isPondAccelerated: false,
      isAcceleratedByWater: false,
      progressPct: 100,
      stageName: 'Full Bloom'
    };
  }
  const plantedAt = decor.plantedAt || currentTimestamp;
  const hydrationBonus = decor.wateredAt && decor.wateredAt >= plantedAt && decor.wateredAt <= currentTimestamp ? 15000 : 0;
  const elapsedMs = Math.max(0, currentTimestamp - plantedAt) + hydrationBonus;

  // Check if near water (within 3 columns of water tile)
  let isNearWater = false;
  if (world) {
    for (let dx = -3; dx <= 3; dx++) {
      const checkX = decor.gridX + dx;
      if (checkX >= 0 && checkX < GRID_WIDTH) {
        for (let y = 0; y < GRID_HEIGHT; y++) {
          if (isWaterTile(world.tiles[y][checkX])) {
            isNearWater = true;
            break;
          }
        }
      }
      if (isNearWater) break;
    }
  }

  // Base times: Stage 1 -> 2 at 25s, Stage 2 -> 3 at 60s
  // Near pond acceleration: 50% faster (12.5s and 30s)
  const factor = isNearWater ? 0.5 : 1.0;
  const stage2TimeMs = 25000 * factor;
  const stage3TimeMs = 60000 * factor;

  if (elapsedMs >= stage3TimeMs) {
    return {
      stage: 3,
      isPondAccelerated: isNearWater,
      isAcceleratedByWater: isNearWater,
      progressPct: 100,
      stageName: 'Full Bloom'
    };
  } else if (elapsedMs >= stage2TimeMs) {
    const progress = ((elapsedMs - stage2TimeMs) / (stage3TimeMs - stage2TimeMs)) * 100;
    return {
      stage: 2,
      isPondAccelerated: isNearWater,
      isAcceleratedByWater: isNearWater,
      progressPct: Math.min(99, Math.round(progress)),
      stageName: 'Sproutling Bud'
    };
  } else {
    const progress = (elapsedMs / stage2TimeMs) * 100;
    return {
      stage: 1,
      isPondAccelerated: isNearWater,
      isAcceleratedByWater: isNearWater,
      progressPct: Math.min(99, Math.round(progress)),
      stageName: 'Seedling Shoot'
    };
  }
}

/**
 * Validates whether a decoration (especially seed) can be placed at the target grid position.
 * Cannot be placed inside a solid block or submerged in water; seeds must have solid ground support underneath.
 */
// Decoration sizes in world tiles (width, height), so props keep realistic sizes next to each other
// and next to creatures at any screen size. Each keeps its sprite's own proportions.
export const DECOR_TILES: Record<string, [number, number]> = {
  tree: [11, 8.1], // a full-grown oak: much taller than a creature and a bit taller than the cottage
  shrub: [3, 2],
  flower: [1.2, 1.5],
  rock: [2, 1.4],
  mushroom: [1.35, 1.5],
  custom: [1.8, 1.8],
  lantern: [1.8, 2.5],
  shelter: [7, 5.4],
  seed: [1.1, 1.35],
  bench: [3, 3],
  fence: [3, 3],
  flowerpot: [2, 2],
  campfire: [2.5, 2.5],
  lamppost: [4.5, 4.5],
  crystal: [2.5, 2.5],
  well: [3.5, 3.5],
  cottage: [7.5, 7.5],
  ...Object.fromEntries(BUILD_ITEMS.map(item => [item.type, [...item.tiles] as [number, number]]))
};

// Wide props need solid ground under most of their width, so a cottage cannot hang off a ledge
export const MIN_GROUND_SHARE = 0.6;

/** Share of the prop's footprint that has solid, dry ground at the row it would stand on. */
export function groundShareUnderProp(world: BiomeWorldState, decorType: DecorationType, gridX: number, groundY: number): number {
  const width = DECOR_TILES[decorType]?.[0] ?? 1;
  const half = Math.max(0, Math.floor(width / 2));
  // Wide props are drawn pulled in from the world edges, so their footprint is measured where they are drawn
  const left = Math.max(0, Math.min(GRID_WIDTH - 1 - half * 2, gridX - half));
  let supported = 0;
  for (let x = left; x <= left + half * 2; x++) {
    const tile = x >= 0 && x < GRID_WIDTH ? world.tiles[groundY]?.[x] : undefined;
    if (tile && isSolidTile(tile) && !isWaterTile(tile)) supported++;
  }
  return supported / (half * 2 + 1);
}

export function canPlaceDecoration(
  world: BiomeWorldState,
  decorType: DecorationType,
  gridX: number,
  gridY: number,
  options?: { snapToGround?: boolean }
): { allowed: boolean; reason?: string; snappedY?: number } {
  if (gridX < 0 || gridX >= GRID_WIDTH || gridY < 0 || gridY >= GRID_HEIGHT) {
    return { allowed: false, reason: 'Out of world bounds' };
  }

  const isAquatic = isAquaticDecoration(decorType);

  // If column contains water:
  if (hasWaterInColumn(world, gridX)) {
    if (!isAquatic) {
      if (isWaterTile(world.tiles[gridY][gridX])) {
        return { allowed: false, reason: 'Cannot place on water' };
      }
      // Terrestrial props (trees, rocks, flowers, shrubs, seeds, shelters) cannot be placed over water
      if (decorType !== 'lantern') {
        return { allowed: false, reason: 'Cannot place on water' };
      }
    }
  }

  // Find supporting ground surface underneath this footprint (supports clicking in air, on slope, or platform)
  const snappedY = findSupportingSurfaceForProp(world, gridX, gridY);

  if (snappedY === -1) {
    if (hasWaterInColumn(world, gridX)) {
      if (isAquatic) {
        return { allowed: true, snappedY: findWaterSurfaceY(world, gridX) };
      }
      return { allowed: false, reason: 'Cannot place on water' };
    }
    return { allowed: false, reason: 'No supporting land in this column' };
  }

  if ((DECOR_TILES[decorType]?.[0] ?? 1) >= 2.5 && groundShareUnderProp(world, decorType, gridX, snappedY) < MIN_GROUND_SHARE) {
    return { allowed: false, reason: 'Needs more flat ground' };
  }

  if (decorType === 'seed') {
    const tileMat = world.tiles[snappedY][gridX];
    if (tileMat !== 'dirt' && tileMat !== 'grass' && tileMat !== 'moss') {
      return { allowed: false, reason: 'Seeds need fertile soil, grass, or moss' };
    }
  }

  return { allowed: true, snappedY };
}

export function isWorldTerrainEmpty(world: BiomeWorldState): boolean {
  return !world.tiles.some(row => row.some(t => t !== 'air'));
}

export function loadBiomeWorldFromStorage(biome: HabitatThemeId): BiomeWorldState {
  try {
    const defaultTemplate: StarterTemplateId = biome === 'greenhouse' ? 'living_garden' : 'cozy_clearing';
    if (typeof localStorage === 'undefined') {
      return createStarterWorld(biome, defaultTemplate);
    }
    const raw = localStorage.getItem(getStorageKey(biome));
    if (!raw) {
      return createStarterWorld(biome, defaultTemplate);
    }

    const parsed = JSON.parse(raw);
    const sanitized = sanitizeBiomeWorld(parsed, biome);
    if (!sanitized) {
      return createStarterWorld(biome, defaultTemplate);
    }

    // Versioned migration check:
    // If loading the greenhouse biome and the saved world matches the old default cozy_clearing,
    // upgrade it automatically to the lush living_garden starter world.
    // If the player made any custom edits to their greenhouse, preserve their custom world completely.
    if (biome === 'greenhouse') {
      const isGreenhouseBare = sanitized.decorations.length === 0 && isWorldTerrainEmpty(sanitized);
      if (isGreenhouseBare) {
        const deskRaw = localStorage.getItem(getStorageKey('desk'));
        if (deskRaw) {
          try {
            const deskWorld = sanitizeBiomeWorld(JSON.parse(deskRaw), 'desk');
            if (deskWorld && (deskWorld.decorations.length > 0 || !isWorldTerrainEmpty(deskWorld))) {
              const migrated: BiomeWorldState = {
                ...deskWorld,
                biome: 'greenhouse',
                updatedAt: Date.now()
              };
              saveBiomeWorldToStorage(migrated);
              return migrated;
            }
          } catch { /* ignore corrupt desk */ }
        }
        const starter = createStarterWorld('greenhouse', 'living_garden');
        saveBiomeWorldToStorage(starter);
        return starter;
      }

      const legacyDefault = createStarterWorld('desk', 'cozy_clearing');
      if (areBiomeWorldsEqual(sanitized, legacyDefault)) {
        const upgraded = createStarterWorld('greenhouse', 'living_garden');
        saveBiomeWorldToStorage(upgraded);
        return upgraded;
      }
    }

    return sanitized;
  } catch (err) {
    console.warn('Error reading biome world from storage, restoring default:', err);
    return createStarterWorld(biome, biome === 'greenhouse' ? 'living_garden' : 'cozy_clearing');
  }
}

/**
 * Checks deep structural equality between two BiomeWorldState states (tiles and decorations).
 * Used to derive the true "Saved" vs "Unsaved" dirty state.
 */
export function areBiomeWorldsEqual(a: BiomeWorldState, b: BiomeWorldState): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.biome !== b.biome) return false;
  if (a.decorations.length !== b.decorations.length) return false;
  for (let i = 0; i < a.decorations.length; i++) {
    const da = a.decorations[i];
    const db = b.decorations[i];
    if (da.id !== db.id || da.type !== db.type || da.gridX !== db.gridX || da.gridY !== db.gridY) {
      return false;
    }
  }
  for (let y = 0; y < GRID_HEIGHT; y++) {
    const rowA = a.tiles[y];
    const rowB = b.tiles[y];
    for (let x = 0; x < GRID_WIDTH; x++) {
      if (rowA[x] !== rowB[x]) return false;
    }
  }
  return true;
}

export function resetBiomeWorldStorage(biome: HabitatThemeId): BiomeWorldState {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(getStorageKey(biome));
    }
  } catch (err) {
    console.warn('Failed to clear biome storage:', err);
  }
  return createStarterWorld(biome, biome === 'greenhouse' ? 'living_garden' : 'cozy_clearing');
}

/**
 * Manages Undo / Redo history stack for world edits.
 * Each continuous drag stroke or discrete action pushes 1 snapshot.
 */
export class BiomeHistoryManager {
  private undoStack: WorldSnapshot[] = [];
  private redoStack: WorldSnapshot[] = [];
  private maxHistory: number;

  constructor(maxHistory = 30) {
    this.maxHistory = maxHistory;
  }

  public pushSnapshot(world: BiomeWorldState): void {
    this.undoStack.push({
      tiles: cloneTiles(world.tiles),
      decorations: cloneDecorations(world.decorations)
    });
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    // Any new action clears the redo stack
    this.redoStack = [];
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public undo(currentWorld: BiomeWorldState): BiomeWorldState | null {
    const previous = this.undoStack.pop();
    if (!previous) return null;

    // Push current to redo
    this.redoStack.push({
      tiles: cloneTiles(currentWorld.tiles),
      decorations: cloneDecorations(currentWorld.decorations)
    });

    return {
      ...currentWorld,
      tiles: cloneTiles(previous.tiles),
      decorations: cloneDecorations(previous.decorations),
      updatedAt: Date.now()
    };
  }

  public redo(currentWorld: BiomeWorldState): BiomeWorldState | null {
    const next = this.redoStack.pop();
    if (!next) return null;

    // Push current to undo
    this.undoStack.push({
      tiles: cloneTiles(currentWorld.tiles),
      decorations: cloneDecorations(currentWorld.decorations)
    });

    return {
      ...currentWorld,
      tiles: cloneTiles(next.tiles),
      decorations: cloneDecorations(next.decorations),
      updatedAt: Date.now()
    };
  }

  public clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}
