import fs from 'fs';
import path from 'path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createPngBuffer } from './keyFixture';
import { sanitizeCreature } from '../src/game/storage';
import { OddlingAvatar } from '../src/components/OddlingAvatar';
import { legacyTinefangPlaytestRecord } from './verifyTinefangRender';
import { CreatureDNA } from '../src/game/creatureTypes';

function hexToRgba(hex: string, alpha = 1): [number, number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const num = parseInt(h, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255, Math.round(alpha * 255)];
}

function parseColor(str?: string): [number, number, number, number] {
  if (!str) return [255, 255, 255, 255];
  if (str.startsWith('#')) return hexToRgba(str);
  return [255, 255, 255, 255];
}

export function renderActualOddlingAvatarToPng(): void {
  // 1. Sanitize the legacy playtest specimen with lost fork noun and 3 disconnected blocks
  const healedCreature = sanitizeCreature(legacyTinefangPlaytestRecord) as CreatureDNA;

  // 2. Render actual React OddlingAvatar component to static SVG string
  const svgMarkup = renderToStaticMarkup(
    React.createElement(OddlingAvatar, {
      creature: healedCreature,
      size: 160,
      showAura: false,
      mood: 'happy'
    })
  );

  // 3. Initialize 36x36 pixel grid buffer with dark studio background
  const grid: Array<Array<[number, number, number, number]>> = Array.from({ length: 36 }, () =>
    Array.from({ length: 36 }, () => [15, 23, 42, 255]) // dark slate #0f172a
  );

  // 4. Parse all rendered SVG rects in exact rendering order
  // Handles <g fill="..."> inheritance, transforms, and direct fill attributes
  const rectRegex = /<rect\s+([^>]+?)\/?>/g;
  let match: RegExpExecArray | null;

  // Track parent group fills
  // Simple regex parser for our crisp SVG output
  const elementRegex = /(<g[^>]*>|<\/g>|<rect[^>]+?\/>|<rect[^>]+>)/g;
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
      const opacityMatch = tag.match(/opacity="([^"]+)"/);

      if (xMatch && yMatch && wMatch && hMatch) {
        const x = Math.round(parseFloat(xMatch[1]));
        const y = Math.round(parseFloat(yMatch[1]));
        const w = Math.round(parseFloat(wMatch[1]));
        const h = Math.round(parseFloat(hMatch[1]));
        const fill = fillMatch ? fillMatch[1] : (groupFillStack[groupFillStack.length - 1] || '#ffffff');
        const opacity = opacityMatch ? parseFloat(opacityMatch[1]) : 1.0;

        const [r, g, b, a] = parseColor(fill);

        for (let py = y; py < y + h; py++) {
          for (let px = x; px < x + w; px++) {
            if (px >= 0 && px < 36 && py >= 0 && py < 36) {
              if (opacity < 1.0) {
                // Alpha blend over background
                const [bgR, bgG, bgB] = grid[py][px];
                grid[py][px] = [
                  Math.round(r * opacity + bgR * (1 - opacity)),
                  Math.round(g * opacity + bgG * (1 - opacity)),
                  Math.round(b * opacity + bgB * (1 - opacity)),
                  255
                ];
              } else {
                grid[py][px] = [r, g, b, 255];
              }
            }
          }
        }
      }
    }
  }

  // 5. Scale 36x36 up to 288x288 crisp 8x pixel art PNG
  const pixelScale = 8;
  const outputPng = createPngBuffer(36 * pixelScale, 36 * pixelScale, (px, py) => {
    const gx = Math.floor(px / pixelScale);
    const gy = Math.floor(py / pixelScale);
    return grid[gy][gx];
  });

  const outPath = path.join(process.cwd(), 'tinefang_healed_preview.png');
  fs.writeFileSync(outPath, outputPng);
  console.log('✓ Successfully rendered actual OddlingAvatar SVG to PNG:', outPath);
}

renderActualOddlingAvatarToPng();
