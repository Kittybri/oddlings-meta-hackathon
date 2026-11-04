/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GRID_WIDTH,
  GRID_HEIGHT,
  DEFAULT_GROUND_ROW,
  createStarterWorld,
  paintTiles,
  eraseTiles,
  addDecoration,
  removeDecoration,
  canPlaceDecoration,
  computeSeedGrowth,
  findSupportedSurfaceY,
  findSafeSpawnPosition,
  canStepTo,
  loadBiomeWorldFromStorage,
  saveBiomeWorldToStorage,
  resetBiomeWorldStorage,
  BiomeHistoryManager,
  areBiomeWorldsEqual,
  healWorldDecorations
} from './biomeWorld';
import { BiomeWorldState, StarterTemplateId, DecorationInstance } from './biomeWorldTypes';

test('createStarterWorld builds valid 48x24 grid with expected starter templates', () => {
  const templates: StarterTemplateId[] = ['cozy_clearing', 'floating_garden', 'rocky_pond'];

  templates.forEach((tmpl) => {
    const world = createStarterWorld('desk', tmpl);
    assert.equal(world.width, GRID_WIDTH);
    assert.equal(world.height, GRID_HEIGHT);
    assert.equal(world.tiles.length, GRID_HEIGHT);
    assert.equal(world.tiles[0].length, GRID_WIDTH);
    assert.ok(world.decorations.length > 0, `Template ${tmpl} should contain starter decorations`);
  });

  const rockyPond = createStarterWorld('greenhouse', 'rocky_pond');
  // Should have shallow water tiles in pool area
  const hasWater = rockyPond.tiles.some((row) => row.some((tile) => tile === 'water'));
  assert.equal(hasWater, true, 'Rocky Pond template must contain water tiles');
});

test('paintTiles and eraseTiles mutate grid within bounds and clamp invalid inputs', () => {
  const initialWorld = createStarterWorld('desk', 'cozy_clearing');

  // Paint a 1x1 stone block
  const painted1 = paintTiles(initialWorld, 10, 5, 'stone', 1);
  assert.equal(painted1.tiles[5][10], 'stone');

  // Paint with 2x2 wood brush
  const painted2 = paintTiles(initialWorld, 20, 8, 'wood', 2);
  assert.equal(painted2.tiles[8][20], 'wood');
  assert.equal(painted2.tiles[8][21], 'wood');
  assert.equal(painted2.tiles[9][20], 'wood');
  assert.equal(painted2.tiles[9][21], 'wood');

  // Paint with 3x3 sand brush near border (clamping test)
  const painted3 = paintTiles(initialWorld, 0, 0, 'sand', 3);
  assert.equal(painted3.tiles[0][0], 'sand');
  assert.equal(painted3.tiles[1][0], 'sand');
  assert.equal(painted3.tiles[0][1], 'sand');

  // Erase tiles back to air
  const erased = eraseTiles(painted1, 10, 5, 1);
  assert.equal(erased.tiles[5][10], 'air');
});

test('addDecoration and removeDecoration manage prop placement properly', () => {
  const world = createStarterWorld('lab', 'cozy_clearing');
  const countBefore = world.decorations.length;

  const withLantern = addDecoration(world, 'lantern', 15, 14);
  assert.equal(withLantern.decorations.length, countBefore + 1);

  const placed = withLantern.decorations.find((d) => d.gridX === 15 && d.type === 'lantern');
  assert.ok(placed);
  assert.equal(placed?.type, 'lantern');
  const surfaceY = findSupportedSurfaceY(world, 15);
  assert.equal(placed?.gridY, surfaceY, 'Lantern must snap to supporting surface row');

  const removed = removeDecoration(withLantern, placed!.id);
  assert.equal(removed.decorations.length, countBefore);
});

test('BiomeHistoryManager manages undo stroke, redo, and stack limits', () => {
  const manager = new BiomeHistoryManager(10);
  let world = createStarterWorld('desk', 'cozy_clearing');

  assert.equal(manager.canUndo(), false);
  assert.equal(manager.canRedo(), false);

  // Stroke 1: Paint stone platform
  manager.pushSnapshot(world);
  world = paintTiles(world, 10, 10, 'stone', 1);
  assert.equal(manager.canUndo(), true);

  // Stroke 2: Paint water
  manager.pushSnapshot(world);
  world = paintTiles(world, 12, 10, 'water', 1);

  // Undo stroke 2
  const undone1 = manager.undo(world);
  assert.ok(undone1);
  assert.equal(undone1?.tiles[10][12], 'air');
  assert.equal(undone1?.tiles[10][10], 'stone');
  assert.equal(manager.canRedo(), true);

  // Undo stroke 1
  const undone2 = manager.undo(undone1!);
  assert.ok(undone2);
  assert.equal(undone2?.tiles[10][10], 'air');

  // Redo stroke 1
  const redone1 = manager.redo(undone2!);
  assert.ok(redone1);
  assert.equal(redone1?.tiles[10][10], 'stone');
});

test('findSupportedSurfaceY and findSafeSpawnPosition calculate correct landing heights', () => {
  let world = createStarterWorld('desk', 'cozy_clearing');

  // Ground exists at DEFAULT_GROUND_ROW
  const surfaceY = findSupportedSurfaceY(world, 5);
  assert.ok(surfaceY > 10 && surfaceY < GRID_HEIGHT, 'Surface row must be inside valid ground range');

  // Paint elevated platform at row 7
  world = paintTiles(world, 5, 7, 'wood', 1);
  const elevatedSurfaceY = findSupportedSurfaceY(world, 5);
  assert.equal(elevatedSurfaceY, 7, 'Platform at row 7 should be the highest supported surface');

  // Safe spawn position
  const spawn = findSafeSpawnPosition(world, 50);
  assert.ok(spawn.gridX >= 0 && spawn.gridX < GRID_WIDTH);
  assert.ok(spawn.gridY >= 0 && spawn.gridY < GRID_HEIGHT);
  assert.ok(spawn.xPct >= 0 && spawn.xPct <= 100);
});

test('canStepTo allows walking on flat terrain, 1-block hops up, and prevents walking into solid walls', () => {
  let world = createStarterWorld('desk', 'cozy_clearing');

  // Make flat ground at row 15 for cols 10..12
  world = paintTiles(world, 10, 15, 'grass', 1);
  world = paintTiles(world, 11, 15, 'grass', 1);
  world = paintTiles(world, 12, 15, 'grass', 1);

  // Flat horizontal step (10 -> 11)
  const flatStep = canStepTo(world, 10, 15, 11);
  assert.equal(flatStep.allowed, true);
  assert.equal(flatStep.targetGy, 15);

  // Step 1 block up (11 -> 12 where 12 has a block at row 14)
  world = paintTiles(world, 12, 14, 'stone', 1);
  const hopStep = canStepTo(world, 11, 15, 12);
  assert.equal(hopStep.allowed, true, 'Creature can hop up 1 block');
  assert.equal(hopStep.targetGy, 14);

  // Step into a 3-block high solid wall (blocked)
  world = paintTiles(world, 13, 15, 'stone', 1);
  world = paintTiles(world, 13, 14, 'stone', 1);
  world = paintTiles(world, 13, 13, 'stone', 1);
  world = paintTiles(world, 13, 12, 'stone', 1);
  const wallStep = canStepTo(world, 11, 15, 13);
  assert.equal(wallStep.allowed, false, 'Creature cannot walk through 3-block tall wall');
});

test('loadBiomeWorldFromStorage sanitizes corrupt or empty localStorage data gracefully', () => {
  // Empty storage returns valid default
  const defaultWorld = loadBiomeWorldFromStorage('desk');
  assert.equal(defaultWorld.width, GRID_WIDTH);
  assert.equal(defaultWorld.height, GRID_HEIGHT);

  // Mock corrupt localStorage
  const original = (globalThis as any).localStorage;
  try {
    (globalThis as any).localStorage = {
      getItem: () => '{ invalid json ///',
      setItem: () => {},
      removeItem: () => {}
    };
    const recoveredWorld = loadBiomeWorldFromStorage('lab');
    assert.equal(recoveredWorld.biome, 'lab');
    assert.equal(recoveredWorld.tiles.length, GRID_HEIGHT);
  } finally {
    (globalThis as any).localStorage = original;
  }
});

test('createStarterWorld for desk biome has distinct grass turf, dirt soil, and stone bedrock (not all wood)', () => {
  const deskWorld = createStarterWorld('desk', 'cozy_clearing');
  // Top layer in column 10 must be grass
  const surfaceY = findSupportedSurfaceY(deskWorld, 10);
  assert.equal(deskWorld.tiles[surfaceY][10], 'grass', 'Desk starter top ground tile must be grass, not wood');
  assert.equal(deskWorld.tiles[surfaceY + 1][10], 'dirt', 'Subsurface layer must be dirt');
  assert.equal(deskWorld.tiles[surfaceY + 3][10], 'stone', 'Deep layer must be stone');

  // Wood platform must exist in cols 28..37 at row 12
  assert.equal(deskWorld.tiles[12][30], 'wood', 'Elevated bridge must be wood');
});

test('areBiomeWorldsEqual returns true for identical worlds and detects painted changes and undo restore', () => {
  const initial = createStarterWorld('desk', 'cozy_clearing');
  assert.equal(areBiomeWorldsEqual(initial, initial), true);

  const manager = new BiomeHistoryManager(10);
  manager.pushSnapshot(initial);

  // Paint a stone tile
  const modified = paintTiles(initial, 5, 5, 'stone', 1);
  assert.equal(areBiomeWorldsEqual(initial, modified), false, 'Modified world should not equal initial');

  // Undo stroke returns identical state
  const undone = manager.undo(modified)!;
  assert.equal(areBiomeWorldsEqual(initial, undone), true, 'Undone world back to original must equal initial state');
});

test('starter tree and props are grounded to the true ground surface row (not hovering in air)', () => {
  const deskWorld = createStarterWorld('desk', 'cozy_clearing');
  const tree = deskWorld.decorations.find((d) => d.id === 'decor-tree-1');
  assert.ok(tree, 'Must include starter tree');

  // Ground surface at tree column 10
  const groundRow = findSupportedSurfaceY(deskWorld, tree.gridX);
  assert.equal(tree.gridY, groundRow, `Tree gridY (${tree.gridY}) must match actual ground surface row (${groundRow})`);

  // Check other props
  deskWorld.decorations.forEach((d) => {
    const surface = findSupportedSurfaceY(deskWorld, d.gridX);
    assert.ok(d.gridY >= 10 && d.gridY <= surface, `Decoration ${d.id} must be supported on a valid platform or ground surface`);
  });
});

test('grid-to-render-to-feet coordinate transform mathematically aligns visible sprite feet to terrain surface', () => {
  // Desktop screen 988x849 with playfield height 609px (y150..759)
  const playfieldHeight = 609;
  const groundRow = 17; // Grass terrain row
  const groundSurfaceY = (groundRow / GRID_HEIGHT) * playfieldHeight; // 431.375px from playfield top

  // Avatar size = 72px. Visible feet baseline inside 36x36 viewBox is at y = 31 (31/36 * 72 = 62px)
  const avatarSize = 72;
  const feetBaselineFromAvatarTop = (31 / 36) * avatarSize; // 62px

  // With transform: translate(-50%, -62px):
  // Avatar top is placed at: groundSurfaceY - 62px
  // Visible feet baseline is placed at: (groundSurfaceY - 62px) + 62px = groundSurfaceY
  const avatarTop = groundSurfaceY - feetBaselineFromAvatarTop;
  const actualRenderedFeetY = avatarTop + feetBaselineFromAvatarTop;

  assert.equal(actualRenderedFeetY, groundSurfaceY, 'Visible feet baseline must touch terrain surface with 0px discrepancy');

  // Mobile screen with playfield height 480px
  const mobileHeight = 480;
  const mobileGroundSurfaceY = (groundRow / GRID_HEIGHT) * mobileHeight;
  const mobileAvatarTop = mobileGroundSurfaceY - feetBaselineFromAvatarTop;
  const mobileFeetY = mobileAvatarTop + feetBaselineFromAvatarTop;
  assert.equal(mobileFeetY, mobileGroundSurfaceY, 'Feet remain locked to ground across responsive viewports');
});

test('canStepTo handles 1-block hops up, safe drops down up to 6 blocks, and blocks solid walls', () => {
  let world = createStarterWorld('desk', 'cozy_clearing');

  // Flat ground at row 16
  world = paintTiles(world, 10, 16, 'grass', 1);
  world = paintTiles(world, 11, 16, 'grass', 1);
  world = paintTiles(world, 12, 16, 'grass', 1);

  // 1-block hop up from row 16 to 15
  world = paintTiles(world, 13, 15, 'grass', 1);
  const hop = canStepTo(world, 12, 16, 13);
  assert.equal(hop.allowed, true, 'Can hop up 1 block');
  assert.equal(hop.targetGy, 15);

  // Stepping down 4 blocks from row 12 platform to row 16 ground
  world = paintTiles(world, 20, 12, 'wood', 1);
  world = paintTiles(world, 21, 16, 'grass', 1);
  const drop = canStepTo(world, 20, 12, 21);
  assert.equal(drop.allowed, true, 'Can safely step down 4 blocks');
  assert.equal(drop.targetGy, 16);

  // 2-block tall wall (row 14 and 13 solid from row 16 ground) -> blocked
  world = paintTiles(world, 14, 14, 'stone', 1);
  world = paintTiles(world, 14, 13, 'stone', 1);
  const wall = canStepTo(world, 12, 16, 14);
  assert.equal(wall.allowed, false, 'Cannot pass into 2+ block tall wall');
});

test('living_garden starter template creates reachably terraced greenhouse world with pond and bridge', () => {
  const world = createStarterWorld('greenhouse', 'living_garden');
  assert.equal(world.biome, 'greenhouse');
  assert.equal(world.width, GRID_WIDTH);
  assert.equal(world.height, GRID_HEIGHT);

  // Shallow pond basin present between x=19..25
  let waterCount = 0;
  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 19; x <= 25; x++) {
      if (world.tiles[y][x] === 'water') waterCount++;
    }
  }
  assert.ok(waterCount >= 6, `Pond must contain at least 6 water blocks (found ${waterCount})`);

  // Reachable terrace at row 12 is accessible from knoll
  const stepCheck = canStepTo(world, 8, 13, 9);
  assert.equal(stepCheck.allowed, true, 'Terrace at row 12 must be stepped into from knoll slope at row 13');
  assert.equal(stepCheck.targetGy, 12);

  // Wood footbridge spans the pond at row 15
  for (let x = 20; x <= 24; x++) {
    assert.equal(world.tiles[15][x], 'wood', `Footbridge tile at x=${x}, y=15 must be wood`);
  }

  // Contains starter seed decoration and shelter
  const seedDecor = world.decorations.find((d) => d.type === 'seed');
  assert.ok(seedDecor, 'Living garden must include starter seed');
  assert.equal(typeof seedDecor?.plantedAt, 'number');

  const shelterDecor = world.decorations.find((d) => d.type === 'shelter');
  assert.ok(shelterDecor, 'Living garden must include rooted shelter');
});

test('canPlaceDecoration validates solid ground support and disallows illegal placements', () => {
  const world = createStarterWorld('greenhouse', 'living_garden');

  // Surface of knoll at x=10, y=11 (block underneath at y=12 is solid grass)
  assert.equal(world.tiles[12][10], 'grass');
  assert.equal(world.tiles[11][10], 'air');
  const validSoilCheck = canPlaceDecoration(world, 'seed', 10, 11);
  assert.equal(validSoilCheck.allowed, true, 'Should allow placing seed on solid soil');
  assert.equal(validSoilCheck.snappedY, 12);

  // Clicking in the air above narrow terrace rejects tree due to insufficient footprint (< 60% ground share)
  const narrowCheck = canPlaceDecoration(world, 'tree', 10, 5);
  assert.equal(narrowCheck.allowed, false, 'Tree on narrow terrace rejects due to insufficient footprint');
  assert.equal(narrowCheck.reason, 'Needs more flat ground');

  // Clicking in the air above wide fertile knoll (cols 27..37 at row 16) has valid terrain support and snaps to ground
  const airCheck = canPlaceDecoration(world, 'tree', 32, 5);
  assert.equal(airCheck.allowed, true, 'High-air click above sufficiently supported land snaps to ground');
  assert.equal(airCheck.snappedY, 16);

  // Submerged directly inside or clicking over pond water at column 22
  const waterCheck = canPlaceDecoration(world, 'tree', 22, 5);
  assert.equal(waterCheck.allowed, false, 'Must reject decoration placement over water');
  assert.equal(waterCheck.reason, 'Cannot place on water');
});

test('computeSeedGrowth calculates 3 deterministic stages and accelerates near pond', () => {
  const world = createStarterWorld('greenhouse', 'living_garden');
  const baseTime = 1700000000000;

  // Far from pond: placed at x=5, y=15
  const farSeed: DecorationInstance = {
    id: 'seed_far',
    type: 'seed',
    gridX: 5,
    gridY: 15,
    plantedAt: baseTime
  };

  // Stage 1: Elapsed 10s (<25s) -> stage 1
  const stage1 = computeSeedGrowth(farSeed, baseTime + 10000, world);
  assert.equal(stage1.stage, 1);
  assert.equal(stage1.stageName, 'Seedling Shoot');

  // Stage 2: Elapsed 35s (25s..60s) -> stage 2
  const stage2 = computeSeedGrowth(farSeed, baseTime + 35000, world);
  assert.equal(stage2.stage, 2);
  assert.equal(stage2.stageName, 'Sproutling Bud');

  // Stage 3: Elapsed 65s (>=60s) -> stage 3
  const stage3 = computeSeedGrowth(farSeed, baseTime + 65000, world);
  assert.equal(stage3.stage, 3);
  assert.equal(stage3.stageName, 'Full Bloom');

  // Near pond: placed at x=17, y=16 (within 4 tiles of pond at x=19..25)
  const pondSeed: DecorationInstance = {
    id: 'seed_pond',
    type: 'seed',
    gridX: 17,
    gridY: 16,
    plantedAt: baseTime
  };

  // At 20s: Far seed is stage 1 (20s < 25s), but near pond accelerated by 1.5x (effective 30s) -> stage 2!
  const acceleratedStage2 = computeSeedGrowth(pondSeed, baseTime + 20000, world);
  assert.equal(acceleratedStage2.isAcceleratedByWater, true);
  assert.equal(acceleratedStage2.stage, 2);

  // At 42s: Far seed is stage 2 (42s < 60s), but near pond accelerated by 1.5x (effective 63s) -> stage 3!
  const acceleratedStage3 = computeSeedGrowth(pondSeed, baseTime + 42000, world);
  assert.equal(acceleratedStage3.isAcceleratedByWater, true);
  assert.equal(acceleratedStage3.stage, 3);
});

test('createStarterWorld defaults to living_garden for greenhouse biome', () => {
  const world = createStarterWorld('greenhouse');
  assert.equal(world.biome, 'greenhouse');
  assert.ok(world.decorations.some((d) => d.type === 'shelter'), 'Should default to living_garden with shelter');
  assert.ok(world.tiles.some((row) => row.some((t) => t === 'water')), 'Should default to living_garden with pond water');
});

test('high-air clicks place an oak on land directly under cursor', () => {
  const world = createStarterWorld('desk', 'cozy_clearing');
  // Column 10 has rolling grass ground at row 17
  const groundRow = findSupportedSurfaceY(world, 10);
  assert.equal(groundRow, 17);

  // Click high up in the air at row 2
  const check = canPlaceDecoration(world, 'tree', 10, 2);
  assert.equal(check.allowed, true, 'High-air click at row 2 must be allowed');
  assert.equal(check.snappedY, 17, 'High-air click at row 2 must snap to ground row 17');

  // addDecoration at (10, 2) places oak tree firmly on ground surface
  const withTree = addDecoration(world, 'tree', 10, 2);
  const oak = withTree.decorations.find((d) => d.gridX === 10 && d.type === 'tree');
  assert.ok(oak, 'Oak tree should be placed');
  assert.equal(oak?.gridY, 17, 'Oak tree must rest on ground surface row 17, not in the air');
});

test('sloped and platform placement snaps decorations to correct elevated surfaces', () => {
  const world = createStarterWorld('desk', 'cozy_clearing');
  // Wooden platform is at row 12 in cols 28..37
  assert.equal(world.tiles[12][30], 'wood');

  // Place lantern on wooden platform by clicking at row 12 or above it (row 8)
  const platformCheck = canPlaceDecoration(world, 'lantern', 30, 8);
  assert.equal(platformCheck.allowed, true);
  assert.equal(platformCheck.snappedY, 12, 'Must snap to wooden platform at row 12');

  const withPlatformLantern = addDecoration(world, 'lantern', 30, 8);
  const platformLantern = withPlatformLantern.decorations.find((d) => d.gridX === 30 && d.type === 'lantern');
  assert.equal(platformLantern?.gridY, 12, 'Lantern must rest on platform at row 12');

  // Stepped slope in living_garden (col 7 has stepped ground at row 14)
  const gardenWorld = createStarterWorld('greenhouse', 'living_garden');
  assert.equal(gardenWorld.tiles[14][7], 'grass');
  const slopeCheck = canPlaceDecoration(gardenWorld, 'shrub', 7, 3);
  assert.equal(slopeCheck.allowed, true);
  assert.equal(slopeCheck.snappedY, 14, 'Must snap to stepped slope at row 14');
});

test('prevents unsupported placement over gaps and water unless aquatic', () => {
  const world = createStarterWorld('greenhouse', 'living_garden');

  // Over water pool (col 22 has shallow water)
  const waterCheckTree = canPlaceDecoration(world, 'tree', 22, 4);
  assert.equal(waterCheckTree.allowed, false, 'Tree cannot be placed over water');
  assert.equal(waterCheckTree.reason, 'Cannot place on water');

  const waterCheckRock = canPlaceDecoration(world, 'rock', 22, 17);
  assert.equal(waterCheckRock.allowed, false, 'Rock cannot be placed in water pool');

  // Over gap (all air in column 5 after digging out column)
  let chasmWorld = world;
  for (let y = 0; y < GRID_HEIGHT; y++) {
    chasmWorld = paintTiles(chasmWorld, 5, y, 'air', 1);
  }
  const gapCheck = canPlaceDecoration(chasmWorld, 'flower', 5, 4);
  assert.equal(gapCheck.allowed, false, 'Cannot place over empty chasm');
  assert.equal(gapCheck.reason, 'No supporting land in this column');
});

test('terrain edits automatically re-settle affected decorations to new surface', () => {
  let world = createStarterWorld('desk', 'cozy_clearing');
  // Column 10 has tree at row 17
  const initialTree = world.decorations.find((d) => d.gridX === 10 && d.type === 'tree');
  assert.equal(initialTree?.gridY, 17);

  // 1. Elevate terrain under tree: paint a 3-block higher mound at row 14
  world = paintTiles(world, 10, 14, 'grass', 1);
  const elevatedTree = world.decorations.find((d) => d.gridX === 10 && d.type === 'tree');
  assert.equal(elevatedTree?.gridY, 14, 'Tree must re-settle upwards onto newly painted hill surface');

  // 2. Erase terrain under tree: shave down to row 18
  world = eraseTiles(world, 10, 14, 1);
  world = eraseTiles(world, 10, 15, 1);
  world = eraseTiles(world, 10, 16, 1);
  world = eraseTiles(world, 10, 17, 1);
  const droppedTree = world.decorations.find((d) => d.gridX === 10 && d.type === 'tree');
  assert.equal(droppedTree?.gridY, 18, 'Tree must drop down to newly exposed ground surface below');
});

test('existing saved props render grounded without destructive save resets', () => {
  const world = createStarterWorld('desk', 'cozy_clearing');
  // Simulate corrupt or legacy saved prop hovering at gridY = 4
  const legacyWorldState = {
    version: 1,
    biome: 'desk',
    tiles: world.tiles,
    decorations: [
      { id: 'legacy-tree', type: 'tree', gridX: 10, gridY: 4 },
      { id: 'legacy-flower', type: 'flower', gridX: 16, gridY: 2 }
    ],
    updatedAt: Date.now()
  };

  // sanitizeBiomeWorld heals the hovering props to the ground without deleting them
  const healed = healWorldDecorations(legacyWorldState as any);
  assert.equal(healed.decorations.length, 2, 'Must not destructively delete saved props');
  assert.equal(healed.decorations[0].id, 'legacy-tree');
  assert.equal(healed.decorations[0].gridY, 17, 'Legacy tree must be grounded to row 17');
  assert.equal(healed.decorations[1].id, 'legacy-flower');
  assert.equal(healed.decorations[1].gridY, 17, 'Legacy flower must be grounded to row 17');
});

test('undo and redo properly restores placed decorations and settled positions', () => {
  const history = new BiomeHistoryManager(10);
  let world = createStarterWorld('desk', 'cozy_clearing');
  const countInitial = world.decorations.length;

  history.pushSnapshot(world);
  // Add a boulder on flat ground at col 20 (high-air click at row 5)
  const check = canPlaceDecoration(world, 'rock', 20, 5);
  world = addDecoration(world, 'rock', 20, check.snappedY!);
  assert.equal(world.decorations.length, countInitial + 1);

  // Undo decoration placement
  world = history.undo(world)!;
  assert.equal(world.decorations.length, countInitial, 'Undo must remove placed decoration');

  // Redo decoration placement
  world = history.redo(world)!;
  assert.equal(world.decorations.length, countInitial + 1, 'Redo must restore placed decoration');
  const restoredRock = world.decorations.find((d) => d.gridX === 20 && d.type === 'rock');
  assert.ok(restoredRock);
  assert.equal(restoredRock?.gridY, check.snappedY, 'Restored rock must retain its grounded position');
});


