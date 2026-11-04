/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Turns a photo into a placeable pixel item with Meta Muse Spark Open via Baseten.
 */

import { BASETEN_CHAT_ENDPOINT, META_MUSE_SPARK_MODEL, checkRateLimit } from './basetenService';
import { extractJsonObject } from './voiceService';
import { ItemDraft, SpriteGrid, parseSpriteGrid, sanitizeDraft } from '../src/game/customItems';

export const MAX_IMAGE_CHARS = 3_000_000;
const IMAGE_URL = /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/;

export interface ItemOutput extends ItemDraft {
  sprite?: SpriteGrid;
}

/** Only inline image data is accepted, so the server never fetches a remote URL for a caller. */
export function normalizeImageUrl(input: unknown): string | null {
  if (typeof input !== 'string' || !input || input.length > MAX_IMAGE_CHARS) return null;
  const url = input.startsWith('data:') ? input : `data:image/jpeg;base64,${input}`;
  return IMAGE_URL.test(url) ? url : null;
}

export function buildItemPrompt(hint?: string): string {
  const h = typeof hint === 'string' ? hint.replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, 60) : '';
  return `You are Muse Spark making a placeable pixel-art item for the cozy pixel game ODDLINGS from a real photo.
Look at the main object in the photo${h ? ` (the player says it is: ${h})` : ''}.
Respond with ONLY a raw JSON object with these keys:
- "name": a cute item name of 2 to 4 words based on the real object.
- "description": one short warm sentence, at most 100 characters.
- "category": exactly one of light, seat, plant, toy, decor. Pick by what the object is: lamps, candles, lanterns, string lights and screens are light; chairs, stools, cushions, sofas and benches are seat; real or fake plants, flowers and cacti are plant; plush toys, dolls, balls, figures and games are toy; everything else is decor.
- "glow": true for anything that gives off light (lamps, candles, lanterns, screens, glow sticks, crystals) or would clearly look magical glowing at night; false for ordinary objects such as plush toys, cups, shoes and furniture.
- "heightCm": your best estimate of the real object's height in centimeters (a whole number), judged from what it is and anything in the photo that shows scale (hands, furniture). For example a mug is about 10, a plush toy 20 to 35, a table lamp 45, a chair 90, a floor lamp 150, a door 200.
- "palette": an array of 4 to 6 hex colors like #aabbcc taken from the object.
- "pixels": an array of exactly 16 strings. Each string is exactly 16 characters. Together they draw the object as 16x16 pixel art, front view, centered, filling most of the grid. Use the character . for transparent pixels and the digits 0 to 5 as indexes into your palette. Keep the silhouette simple and clear, with a darker palette color as the outline.
Every pixels string must be exactly 16 characters long.`;
}

export function parseItemOutput(parsed: any): ItemOutput | null {
  const draft = sanitizeDraft(parsed);
  if (!draft) return null;
  const sprite = parseSpriteGrid(parsed?.pixels, parsed?.palette) || undefined;
  return { ...draft, sprite };
}

export async function generateItemFromPhoto(params: { imageBase64: unknown; objectHint?: string }): Promise<ItemOutput> {
  const imageUrl = normalizeImageUrl(params.imageBase64);
  if (!imageUrl) throw { status: 400, message: 'A PNG, JPEG or WebP photo under 3 MB is required.' };

  const apiKey = process.env.BASETEN_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw { status: 503, message: 'BASETEN_API_KEY is not configured in server environment.' };
  }
  const { allowed, retryAfter } = checkRateLimit();
  if (!allowed) throw { status: 429, message: `Rate limit exceeded. Please wait ${retryAfter} seconds.` };

  const payload = {
    model: META_MUSE_SPARK_MODEL,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: buildItemPrompt(params.objectHint) },
          { type: 'image_url', image_url: { url: imageUrl } }
        ]
      }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.6,
    max_tokens: 6000
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const res = await fetch(BASETEN_CHAT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!res.ok) {
      const errText = await res.text();
      if (res.status === 401) throw { status: 401, message: 'Invalid or expired BASETEN_API_KEY.' };
      if (res.status === 402) throw { status: 402, message: 'Baseten account payment required or insufficient credits.' };
      if (res.status === 429) throw { status: 429, message: 'Baseten rate limit reached.' };
      throw { status: res.status, message: `Baseten error: ${errText.slice(0, 120)}` };
    }

    const json: any = await res.json();
    const choice = json.choices?.[0];
    const message = choice?.message || {};
    let rawContent = message.content || choice?.text || '';
    if ((!rawContent || typeof rawContent !== 'string' || !rawContent.trim()) && typeof message.reasoning_content === 'string') {
      rawContent = message.reasoning_content;
    }
    const content = typeof rawContent === 'string'
      ? rawContent.trim()
      : Array.isArray(rawContent) ? rawContent.map((c: any) => c.text || '').join('') : '';
    if (!content) throw { status: 502, message: 'No content returned by Meta Muse Spark Open.' };

    let parsed: any;
    try {
      parsed = extractJsonObject(content, (o) => sanitizeDraft(o) !== null);
    } catch {
      throw { status: 502, message: `Muse Spark reply was not usable JSON (${content.length} chars).` };
    }
    const out = parseItemOutput(parsed);
    if (!out) throw { status: 502, message: 'Meta Muse Spark Open returned no usable item.' };
    return out;
  } catch (err: any) {
    if (err.name === 'AbortError') throw { status: 504, message: 'Item request timed out.' };
    if (err.status) throw err;
    throw { status: 500, message: err.message || 'Item request failed on Baseten.' };
  } finally {
    clearTimeout(timeoutId);
  }
}
