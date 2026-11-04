import fs from 'fs';
import path from 'path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createPngBuffer } from './keyFixture';
import { createStarterWorld, GRID_WIDTH, GRID_HEIGHT } from '../src/game/biomeWorld';
import { INITIAL_ODDLINGS } from '../src/game/creatureCatalog';
import { sanitizeCreature } from '../src/game/storage';
import { OddlingAvatar } from '../src/components/OddlingAvatar';
import { CreatureDNA } from '../src/game/creatureTypes';

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

// Exact legacy Clicker Whiskers user playtest record
export const legacyClickerWhiskersRecord = {
  id: 'oddling-clicker-whiskers-playtest',
  name: 'Clicker Whiskers',
  speciesName: 'Mus Electricus Domesticus',
  title: 'Wired Wanderer',
  primaryElement: 'Mechanical',
  temperament: 'Curious & Zippy',
  provenance: 'ai_extracted',
  specialAbility: {
    name: 'Scroll Surge',
    description: 'Surges forward with rapid tactile wheel rotation.',
    powerRating: 80,
    icon: '⚡'
  },
  sourceObject: {
    name: 'Wired Computer Mouse',
    category: 'Electronics',
    material: 'Matte ABS Plastic',
    description: 'A wired beige/gray computer mouse with two buttons, dark central scroll wheel, and black cable.'
  },
  appearance: {
    bodyShape: 'boxy',
    primaryColor: '#e2e8f0', // Beige/gray ABS plastic
    secondaryColor: '#cbd5e1', // Button division tone
    accentColor: '#334155', // Dark scroll wheel & cord
    eyeStyle: 'wide',
    visualPlan: {
      version: 1,
      archetype: 'compositional',
      // Prior bug: generic curio rectangular blocks
      compositional: {
        category: 'curio',
        aspectRatio: 'square',
        bodyBlocks: [
          { x: 10, y: 10, w: 16, h: 16, role: 'primary' },
          { x: 12, y: 8, w: 12, h: 4, role: 'secondary' }
        ],
        featureAccents: [],
        faceX: 18,
        faceY: 18
      },
      definingParts: { hasHandle: false, hasSpines: false },
      materialSurface: { finish: 'smooth_plastic', pattern: 'solid' },
      facePlacement: { surfaceRegion: 'body_center', yOffset: 0 }
    }
  },
  inheritedTraits: [
    'Two ergonomic click buttons with tactile microswitches',
    'Dark ribbed rubberized scroll wheel with optical sensor',
    'Trailing black USB connection cable'
  ],
  habitatPreference: 'Cozy Desk Studio',
  stats: { trust: 50, energy: 88, curiosity: 92, generation: 1 },
  memories: [{ timestamp: 1234567, text: 'Awakened from photographed wired computer mouse', type: 'awaken' }],
  discoveredAt: 1729000000000
};

export function renderHabitatVerificationScreenshot(): string {
  const world = createStarterWorld('desk', 'cozy_clearing');
  const thornbrew = INITIAL_ODDLINGS[0];
  const luxacanth = INITIAL_ODDLINGS[1];
  const clickerWhiskers = sanitizeCreature(legacyClickerWhiskersRecord) as CreatureDNA;

  // Habitat resolution: 480 wide x 288 high (each 16-bit tile is 10x12 px, or exact 10px per tile)
  // Let us render at 480 x 240 (each tile is 10x10 px)
  const TILE_SIZE = 10;
  const WIDTH = GRID_WIDTH * TILE_SIZE; // 480 px
  const HEIGHT = GRID_HEIGHT * TILE_SIZE; // 240 px

  const canvas: Array<Array<[number, number, number, number]>> = Array.from({ length: HEIGHT }, () =>
    Array.from({ length: WIDTH }, () => [15, 23, 42, 255]) // Dark sky background #0f172a
  );

  // 1. Paint Biome Background gradient / sky
  for (let y = 0; y < HEIGHT; y++) {
    const progress = y / HEIGHT;
    const r = Math.round(15 + progress * 20);
    const g = Math.round(23 + progress * 35);
    const b = Math.round(42 + progress * 40);
    for (let x = 0; x < WIDTH; x++) {
      canvas[y][x] = [r, g, b, 255];
    }
  }

  // 2. Render Terrain Tiles
  const materialColors: Record<string, [number, number, number, number]> = {
    air: [0, 0, 0, 0],
    grass: [74, 222, 128, 255], // Emerald green #4ade80
    dirt: [120, 53, 15, 255],   // Rich dirt brown #78350f
    stone: [100, 116, 139, 255],// Slate stone #64748b
    wood: [180, 83, 9, 255],    // Amber wood platform #b45309
    sand: [251, 191, 36, 255],  // Golden sand #fbbf24
    water: [56, 189, 248, 200]  // Sky blue water #38bdf8
  };

  for (let gy = 0; gy < GRID_HEIGHT; gy++) {
    for (let gx = 0; gx < GRID_WIDTH; gx++) {
      const tile = world.tiles[gy][gx];
      if (tile !== 'air') {
        const color = materialColors[tile] || [100, 100, 100, 255];
        for (let py = 0; py < TILE_SIZE; py++) {
          for (let px = 0; px < TILE_SIZE; px++) {
            const y = gy * TILE_SIZE + py;
            const x = gx * TILE_SIZE + px;
            if (y < HEIGHT && x < WIDTH) {
              // Add subtle top grass highlight
              if (tile === 'grass' && py === 0) {
                canvas[y][x] = [134, 239, 172, 255]; // light green highlight
              } else if (tile === 'wood' && py === 0) {
                canvas[y][x] = [217, 119, 6, 255]; // light wood highlight
              } else {
                canvas[y][x] = color;
              }
            }
          }
        }
      }
    }
  }

  // 3. Render Grounded Starter Tree Props
  for (const decor of world.decorations) {
    const rootX = decor.gridX * TILE_SIZE + 5;
    const groundY = decor.gridY * TILE_SIZE; // Top surface of ground tile
    // Render tree trunk and foliage grounded precisely on top surface of ground tile
    if (decor.type === 'tree') {
      // Trunk (4px wide, 14px high) sitting on groundY
      for (let ty = groundY - 14; ty < groundY; ty++) {
        for (let tx = rootX - 2; tx <= rootX + 2; tx++) {
          if (ty >= 0 && ty < HEIGHT && tx >= 0 && tx < WIDTH) {
            canvas[ty][tx] = [120, 53, 15, 255]; // brown trunk
          }
        }
      }
      // Foliage crown (16px circle)
      for (let cy = groundY - 32; cy <= groundY - 12; cy++) {
        for (let cx = rootX - 10; cx <= rootX + 10; cx++) {
          const dist = Math.hypot(cx - rootX, cy - (groundY - 22));
          if (dist <= 10 && cy >= 0 && cy < HEIGHT && cx >= 0 && cx < WIDTH) {
            canvas[cy][cx] = [34, 197, 94, 255]; // vibrant green leaves
          }
        }
      }
    }
  }

  // 4. Helper to render an Oddling SVG into the canvas anchored at visible feet baseline (y=31)
  function renderCreatureAt(creature: CreatureDNA, centerGx: number, groundGy: number) {
    const svgMarkup = renderToStaticMarkup(
      React.createElement(OddlingAvatar, {
        creature,
        size: 72,
        showAura: false,
        mood: 'happy'
      })
    );

    // In 36x36 coordinate space, feet baseline is y=31.
    // SVG is rendered at size 72px (2x scale: each 36 unit is 2px).
    // Feet touch ground surface: groundY = groundGy * TILE_SIZE.
    // The top of the 72px avatar is at groundY - 62px.
    const groundYPx = groundGy * TILE_SIZE;
    const avatarTopYPx = groundYPx - 62;
    const avatarLeftXPx = Math.round(centerGx * TILE_SIZE - 36);

    // Parse SVG rects and circles
    const elementRegex = /(<g[^>]*>|<\/g>|<rect[^>]+?\/>|<rect[^>]+>|<circle[^>]+?\/>|<circle[^>]+>)/g;
    const groupFillStack: string[] = [];
    let token: RegExpExecArray | null;

    while ((token = elementRegex.exec(svgMarkup)) !== null) {
      const tag = token[1];
      if (tag.startsWith('<g')) {
        const fillMatch = tag.match(/fill="([^"]+)"/);
        groupFillStack.push(fillMatch ? fillMatch[1] : (groupFillStack[groupFillStack.length - 1] || ''));
      } else if (tag.startsWith('</g')) {
        groupFillStack.pop();
      } else if (tag.startsWith('<rect')) {
        const xMatch = tag.match(/x="([^"]+)"/);
        const yMatch = tag.match(/y="([^"]+)"/);
        const wMatch = tag.match(/width="([^"]+)"/);
        const hMatch = tag.match(/height="([^"]+)"/);
        const fillMatch = tag.match(/fill="([^"]+)"/);

        if (xMatch && yMatch && wMatch && hMatch) {
          const rx = parseFloat(xMatch[1]);
          const ry = parseFloat(yMatch[1]);
          const rw = parseFloat(wMatch[1]);
          const rh = parseFloat(hMatch[1]);
          const fill = fillMatch ? fillMatch[1] : (groupFillStack[groupFillStack.length - 1] || '#ffffff');
          const [r, g, b, a] = parseSvgColor(fill);

          if (a > 0) {
            // Map 36x36 unit to 72px canvas (factor 2)
            const startX = avatarLeftXPx + Math.round(rx * 2);
            const startY = avatarTopYPx + Math.round(ry * 2);
            const endX = avatarLeftXPx + Math.round((rx + rw) * 2);
            const endY = avatarTopYPx + Math.round((ry + rh) * 2);

            for (let py = startY; py < endY; py++) {
              for (let px = startX; px < endX; px++) {
                if (py >= 0 && py < HEIGHT && px >= 0 && px < WIDTH) {
                  // Alpha blend over canvas
                  const bg = canvas[py][px];
                  const alpha = a / 255;
                  canvas[py][px] = [
                    Math.round(r * alpha + bg[0] * (1 - alpha)),
                    Math.round(g * alpha + bg[1] * (1 - alpha)),
                    Math.round(b * alpha + bg[2] * (1 - alpha)),
                    255
                  ];
                }
              }
            }
          }
        }
      }
    }

    // Draw name label plate above creature (upright, outside measured avatar anchor)
    const namePlateY = avatarTopYPx - 8;
    const nameWidth = creature.name.length * 6 + 12;
    const nameStartX = Math.round(centerGx * TILE_SIZE - nameWidth / 2);
    for (let ny = namePlateY; ny < namePlateY + 12; ny++) {
      for (let nx = nameStartX; nx < nameStartX + nameWidth; nx++) {
        if (ny >= 0 && ny < HEIGHT && nx >= 0 && nx < WIDTH) {
          canvas[ny][nx] = [15, 23, 42, 230]; // dark badge #0f172a
        }
      }
    }
  }

  // Ground 3 Creatures firmly on the terrain surface:
  // Tree is at col 10 (groundGy=17).
  // 1. Thornbrew at x=14, groundGy=17 (grass surface row, right next to tree)
  renderCreatureAt(thornbrew, 14, 17);

  // 2. Clicker Whiskers (healed computer mouse) at x=24, groundGy=17 (grass surface row)
  renderCreatureAt(clickerWhiskers, 24, 17);

  // 3. Luxacanth at x=40, groundGy=17 (grass surface row)
  renderCreatureAt(luxacanth, 40, 17);

  // Also render Clicker Whiskers standing firmly on the elevated wooden platform at x=30, groundGy=12
  renderCreatureAt(clickerWhiskers, 30, 12);

  // Encode to PNG buffer
  const pngBuffer = createPngBuffer(WIDTH, HEIGHT, (x, y) => canvas[y][x]);
  
  const artifactDir = '/.aistudio/artifacts/brain/8165c3c9-7858-47bc-be66-335861a2a6c3';
  if (!fs.existsSync(artifactDir)) {
    fs.mkdirSync(artifactDir, { recursive: true });
  }
  const outputPath = path.join(artifactDir, 'grounded_habitat_verification.png');
  fs.writeFileSync(outputPath, pngBuffer);
  console.log(`✓ Verification screenshot rendered successfully to ${outputPath}`);
  return outputPath;
}

renderHabitatVerificationScreenshot();
