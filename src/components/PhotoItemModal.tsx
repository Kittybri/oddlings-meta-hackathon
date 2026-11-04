import { createPortal } from 'react-dom';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  CustomItem,
  ITEM_CATEGORIES,
  ItemDraft,
  ItemCategory,
  SPRITE_SIZE,
  SpriteGrid,
  gridToRgba,
  itemTiles,
  makeItem,
  parseSpriteGrid,
  photoToSpriteGrid,
  sanitizeDraft
} from '../game/customItems';
import { customItemLibrary } from '../game/customItemStore';
import { parseSafeJson } from '../services/basetenClient';
import { drawItemArt } from '../game/photoSprite';
import { preparePhotoForUpload } from '../game/photoCompression';

const PIXEL_FONT = '"Press Start 2P", ui-monospace, "JetBrains Mono", monospace';
const FONT_LINK_ID = 'oddlings-pixel-font';
const MODEL = 'meta-models/muse-spark-open-1026';

interface PhotoState {
  preview: string;
  jpeg: string;
  local: SpriteGrid;
}

export function gridToDataUrl(grid: SpriteGrid): string {
  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_SIZE;
  canvas.height = SPRITE_SIZE;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(SPRITE_SIZE, SPRITE_SIZE);
  img.data.set(gridToRgba(grid));
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('That file could not be read as an image.'));
    img.src = src;
  });
}

/** Shrinks the photo for upload and builds the local fallback sprite from its pixels. */
async function readPhoto(file: File): Promise<PhotoState> {
  const { dataUrl: jpeg } = await preparePhotoForUpload(file, { maxDimension: 1280, quality: 0.85 });
  const img = await loadImage(jpeg);
  const small = Math.min(1, 128 / Math.max(img.width, img.height));
  const sw = Math.max(1, Math.round(img.width * small));
  const sh = Math.max(1, Math.round(img.height * small));
  const sc = document.createElement('canvas');
  sc.width = sw;
  sc.height = sh;
  const sctx = sc.getContext('2d')!;
  sctx.drawImage(img, 0, 0, sw, sh);
  const local = photoToSpriteGrid(sctx.getImageData(0, 0, sw, sh));
  return { preview: jpeg, jpeg, local };
}

interface PhotoItemModalProps {
  onClose: () => void;
  onSaved: (item: CustomItem) => void;
}

import { walletBook, GEM_ICON, GEM_NAME, SPARKLE_ICON, SHOP_ITEMS } from '../game/lifeSeeds';

const GEM_PRICE = SHOP_ITEMS.find((i) => i.id === 'gem')?.price ?? 8;
const CATEGORY_LABELS: Record<ItemCategory, string> = { decor: '🖼️ Decoration', toy: '🧸 Toy', plant: '🌱 Plant', light: '💡 Light', seat: '🪑 Seat' };

/** The main colors of the photo's middle, so Muse Image keeps them. */
async function photoColors(jpeg: string): Promise<string[]> {
  const img = await loadImage(jpeg);
  const c = document.createElement('canvas');
  c.width = c.height = 24;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, img.width * 0.2, img.height * 0.2, img.width * 0.6, img.height * 0.6, 0, 0, 24, 24);
  const d = ctx.getImageData(0, 0, 24, 24).data;
  const counts = new Map<string, number>();
  for (let i = 0; i < d.length; i += 4) {
    const key = [d[i], d[i + 1], d[i + 2]].map((v) => Math.min(255, Math.round(v / 40) * 40).toString(16).padStart(2, '0')).join('');
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => '#' + k);
}

type ArtChoice = 'meta' | 'photo';

export const PhotoItemModal: React.FC<PhotoItemModalProps> = ({ onClose, onSaved }) => {
  const [photo, setPhoto] = useState<PhotoState | null>(null);
  const [hint, setHint] = useState('');
  const [busy, setBusy] = useState<'' | 'making' | 'redrawing' | 'refining'>('');
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<ItemDraft | null>(null);
  const [museArt, setMuseArt] = useState<string | null>(null);
  const [museGrid, setMuseGrid] = useState<SpriteGrid | null>(null);
  const [choice, setChoice] = useState<ArtChoice>('meta');
  const [wallet, setWallet] = useState(() => walletBook.get());
  const [isAtCapacity, setIsAtCapacity] = useState(() => customItemLibrary.isAtCapacity());
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    if (!document.getElementById(FONT_LINK_ID)) {
      const link = document.createElement('link');
      link.id = FONT_LINK_ID;
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap';
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => walletBook.subscribe(() => setWallet(walletBook.get())), []);
  useEffect(() => customItemLibrary.subscribe(() => setIsAtCapacity(customItemLibrary.isAtCapacity())), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    setDraft(null);
    setMuseArt(null);
    setMuseGrid(null);
    setChoice('meta');
    try {
      setPhoto(await readPhoto(file));
    } catch (e: any) {
      setPhoto(null);
      setError(e?.message || 'That photo could not be opened.');
    }
  };

  const buyGem = () => {
    const r = walletBook.buy('gem');
    if (!r.ok) setError('Not enough Sparkles yet: a ' + GEM_NAME + ' costs ' + SPARKLE_ICON + ' ' + GEM_PRICE + '. Pet, feed and quest with your creatures to earn more.');
    else setError('');
  };

  // Muse Spark names and sorts the item while Muse Image draws it; both from the same photo, at the same time
  const create = async () => {
    if (!photo || busy) return;
    if (customItemLibrary.isAtCapacity()) {
      setError('Your item library is full (12/12 items). Remove an unused item from your build menu before making a new one.');
      return;
    }
    if (walletBook.get().gems <= 0) {
      setError('You need a ' + GEM_NAME + ' ' + GEM_ICON + ' to make an item. Buy one below for ' + SPARKLE_ICON + ' ' + GEM_PRICE + '.');
      return;
    }
    setBusy('making');
    setError('');
    const colors = await photoColors(photo.jpeg).catch(() => [] as string[]);
    const sparkJob = fetch('/api/baseten/item', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: photo.jpeg, objectHint: hint.trim() || undefined })
    })
      .then((res) => parseSafeJson<any>(res, 'Meta Muse Spark item'))
      .catch(() => null);
    const artJob = drawItemArt(photo.jpeg, hint.trim() || 'object', colors, () => setBusy('refining')).catch(() => null);
    const [data, art] = await Promise.all([sparkJob, artJob]);
    const d = sanitizeDraft(data?.item) || { name: hint.trim().slice(0, 32) || 'My Photo Item', description: 'Made from my own photo.', category: 'decor' as ItemCategory, glow: false };
    setDraft(d);
    setMuseGrid(parseSpriteGrid(data?.item?.sprite?.rows, data?.item?.sprite?.palette));
    setMuseArt(art);
    setChoice(art ? 'meta' : 'photo');
    if (!art) setError('Meta couldn’t draw this item. No Craft Gem was spent. Try again or use your photo. Saving the item costs one gem.');
    setBusy('');
  };

  const redraw = async () => {
    if (!photo || busy) return;
    setBusy('redrawing');
    setError('');
    const colors = await photoColors(photo.jpeg).catch(() => [] as string[]);
    const art = await drawItemArt(photo.jpeg, draft?.name || hint.trim() || 'object', colors, () => setBusy('refining')).catch(() => null);
    if (art) {
      setMuseArt(art);
      setChoice('meta');
    } else {
      setError('Meta couldn’t redraw the item. Your current preview is still here. No Craft Gem was spent.');
    }
    setBusy('');
  };

  // The picture that will be saved: Meta's drawing, or the photo's own pixels (Muse Spark's tiny design if that is all there is)
  const sprite = !photo ? null : choice === 'meta' && museArt ? museArt : choice === 'meta' && museGrid ? gridToDataUrl(museGrid) : gridToDataUrl(photo.local);
  const byMeta = choice === 'meta' && !!(museArt || museGrid);

  const save = () => {
    if (!photo || !draft || !sprite || isSubmittingRef.current) return;
    const clean = sanitizeDraft(draft);
    if (!clean) {
      setError('Give your item a name first.');
      return;
    }
    if (customItemLibrary.isAtCapacity()) {
      setError('Your item library is full (12/12 items). Remove an unused item from your build menu before saving a new one.');
      return;
    }
    if (!walletBook.spendGem()) {
      setError('You need a ' + GEM_NAME + ' ' + GEM_ICON + ' to save this. Buy one below for ' + SPARKLE_ICON + ' ' + GEM_PRICE + '.');
      return;
    }
    isSubmittingRef.current = true;
    const item = makeItem(clean, sprite, byMeta ? 'muse-spark' : 'local', museArt && choice === 'meta' ? 'muse-image-1.0 + ' + MODEL : MODEL);
    if (!customItemLibrary.add(item)) {
      const refunded = walletBook.refundGem();
      isSubmittingRef.current = false;
      const reason = customItemLibrary.isAtCapacity()
        ? 'Your item library is full. Remove an unused item and try again.'
        : 'The item couldn’t be saved. Free device space and try again.';
      setError(reason + (refunded ? ' Your Craft Gem was refunded.' : ' The Craft Gem refund couldn’t be saved.'));
      return;
    }
    isSubmittingRef.current = false;
    onSaved(item);
  };

  const box: React.CSSProperties = { border: '4px solid #1b1033', background: '#fffaf0' };
  const btn: React.CSSProperties = { border: '4px solid #1b1033', fontFamily: PIXEL_FONT, cursor: 'pointer', boxShadow: '0 3px 0 0 rgba(0,0,0,0.3)' };

  // What making an item costs, what the player has, and the shop right here
  const wallet_ = (
    <div className="p-2 space-y-1.5" style={{ ...box, background: '#efe7ff' }}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span>COST: {GEM_ICON} 1 {GEM_NAME.toUpperCase()}</span>
        <span>YOU HAVE: {GEM_ICON} {wallet.gems} · {SPARKLE_ICON} {wallet.sparkles}</span>
      </div>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="opacity-80">{wallet.gems > 0 ? 'Enough for ' + wallet.gems + ' more item' + (wallet.gems === 1 ? '' : 's') + '.' : 'No ' + GEM_NAME + 's left.'}</span>
        <button onClick={buyGem} disabled={wallet.sparkles < GEM_PRICE} className="px-2 py-1 text-[7px] disabled:opacity-50" style={{ ...btn, background: '#ffe27a' }}>
          BUY {GEM_ICON} 1 FOR {SPARKLE_ICON} {GEM_PRICE}
        </button>
      </div>
      <div className="flex items-center justify-between text-[7px] text-[#5b4a92] px-1 pt-1 border-t border-[#d8cce8] flex-wrap">
        <span>ITEM LIBRARY: {customItemLibrary.list().length}/12 ITEMS</span>
        {isAtCapacity ? (
          <span className="text-[#be123c] font-bold">CAPACITY REACHED (12/12)</span>
        ) : (
          <span className="text-[#15803d]">{12 - customItemLibrary.list().length} slots left</span>
        )}
      </div>
      {isAtCapacity && (
        <div className="p-2 text-[7px] text-[#9f1239] bg-[#ffe4e6] border border-[#f43f5e] rounded" style={{ fontFamily: PIXEL_FONT }}>
          ⚠️ Item library is full (12/12). Remove an unused item from your build menu before making a new one. No gems will be charged.
        </div>
      )}
    </div>
  );

  return createPortal(
    <div
      className="phone-dialog fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Make an item from a photo"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[90vh] overflow-y-auto"
        style={{ background: '#fff3d6', color: '#2b1b4d', fontFamily: PIXEL_FONT, border: '4px solid #1b1033', boxShadow: '0 8px 0 0 rgba(0,0,0,0.35)' }}
      >
        <div className="flex items-center justify-between p-3" style={{ background: '#ffb3d1', borderBottom: '4px solid #1b1033' }}>
          <span className="text-[10px]">📷 MAKE AN ITEM FROM A PHOTO</span>
          <button onClick={onClose} aria-label="Close" className="text-[10px] px-2 py-1" style={{ ...btn, background: '#fff3d6' }}>
            X
          </button>
        </div>

        <div className="p-4 space-y-3 text-[8px] leading-4">
          <p>Snap or pick a photo of any object. Meta draws it as a pixel item you can place in your World.</p>

          {wallet_}

          <label className="block p-3 text-center cursor-pointer" style={{ ...box, borderStyle: 'dashed' }}>
            {photo ? '📷 PICK A DIFFERENT PHOTO' : '📷 CHOOSE OR TAKE A PHOTO'}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
          </label>

          {photo && (
            <>
              {!draft && (
                <input
                  value={hint}
                  maxLength={60}
                  onChange={(e) => setHint(e.target.value)}
                  placeholder="What is it? (optional)"
                  className="w-full px-2 py-2 text-[8px]"
                  style={{ ...box, fontFamily: PIXEL_FONT }}
                />
              )}

              <div className="flex items-center gap-3">
                <img src={photo.preview} alt="Your photo" className="w-24 h-24 object-cover" style={box} />
                <span className="text-[12px]">➔</span>
                <div style={{ ...box, padding: 4, background: '#e8e2f5' }}>
                  {draft && sprite ? (
                    <img src={sprite} alt="Item preview" width={128} height={128} style={{ imageRendering: 'pixelated', width: 128, height: 128, objectFit: 'contain' }} />
                  ) : (
                    <div style={{ width: 128, height: 128 }} className={'flex items-center justify-center ' + (busy ? 'animate-pulse' : 'opacity-60')}>
                      {busy ? '✨' : '?'}
                    </div>
                  )}
                </div>
              </div>

              {!draft && (
                <button
                  onClick={create}
                  disabled={!!busy || wallet.gems <= 0 || isAtCapacity}
                  className="w-full px-3 py-3 text-[9px] disabled:opacity-60"
                  style={{ ...btn, background: isAtCapacity ? '#e2e8f0' : '#ff6b9d' }}
                >
                  {busy
                    ? (busy === 'refining' ? '✨ REFINING YOUR ITEM…' : '✨ META IS DRAWING…')
                    : isAtCapacity
                    ? '⚠️ ITEM LIBRARY FULL (12/12)'
                    : '★ MAKE IT WITH META · ' + GEM_ICON + ' 1'}
                </button>
              )}

              {draft && (
                <div className="space-y-2">
                  {/* How it will look in the World: real size, standing on grass */}
                  <div>
                    <div className="mb-1 opacity-80">IN YOUR WORLD:</div>
                    <div className="relative h-28 overflow-hidden" style={{ ...box, background: 'linear-gradient(#8fd3ff 0%, #c9ecff 68%, #6cc04a 68%, #4f9a35 82%, #7a4a2b 82%, #5e3820 100%)' }}>
                      {sprite && (
                        <img src={sprite} alt="" className="absolute left-1/2 -translate-x-1/2" style={{ bottom: '30%', width: Math.round(itemTiles(draft.heightCm) * 16), height: Math.round(itemTiles(draft.heightCm) * 16), imageRendering: 'pixelated', objectFit: 'contain', objectPosition: 'bottom', filter: draft.glow ? 'drop-shadow(0 0 6px #fff3a0)' : undefined }} />
                      )}
                      <div className="absolute left-[18%] text-[14px]" style={{ bottom: '30%' }}>🌷</div>
                      <div className="absolute right-[16%] text-[14px]" style={{ bottom: '30%' }}>🌿</div>
                    </div>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <button onClick={redraw} disabled={!!busy} className="px-2 py-1.5 text-[7px] disabled:opacity-60" style={{ ...btn, background: '#ffd1e8' }}>
                      {busy === 'refining' ? '✨ REFINING YOUR ITEM…' : busy === 'redrawing' ? '✨ REDRAWING…' : '✨ TRY AGAIN'}
                    </button>
                    <button onClick={() => setChoice(choice === 'meta' ? 'photo' : 'meta')} disabled={!!busy || (!museArt && !museGrid)} className="px-2 py-1.5 text-[7px] disabled:opacity-50" style={{ ...btn, background: '#fff3d6' }}>
                      {choice === 'meta' ? '📷 USE THE PHOTO INSTEAD' : '★ USE META\'S DRAWING'}
                    </button>
                  </div>

                  <input
                    value={draft.name}
                    maxLength={32}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    aria-label="Item name"
                    className="w-full px-2 py-2 text-[9px]"
                    style={{ ...box, fontFamily: PIXEL_FONT }}
                  />
                  <textarea
                    value={draft.description}
                    maxLength={120}
                    rows={2}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                    aria-label="Item description"
                    className="w-full px-2 py-2 text-[8px]"
                    style={{ ...box, fontFamily: PIXEL_FONT }}
                  />
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="flex items-center gap-1">
                      TYPE:
                      <select
                        value={draft.category}
                        onChange={(e) => setDraft({ ...draft, category: e.target.value as ItemCategory })}
                        aria-label="Item type"
                        className="px-2 py-1 text-[8px]"
                        style={{ ...box, fontFamily: PIXEL_FONT }}
                      >
                        {ITEM_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {CATEGORY_LABELS[c]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex items-center gap-1" title="Muse Spark's guess at the real object's height; it sets the size in your World">
                      📏 REAL HEIGHT:
                      <input
                        type="number"
                        min={1}
                        max={400}
                        value={draft.heightCm ?? ''}
                        placeholder="?"
                        onChange={(e) => setDraft({ ...draft, heightCm: e.target.value ? Math.max(1, Math.min(400, Math.round(Number(e.target.value)))) : undefined })}
                        aria-label="Real height in centimeters"
                        className="w-14 px-1 py-1 text-[8px]"
                        style={{ ...box, fontFamily: PIXEL_FONT }}
                      />
                      CM
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input type="checkbox" checked={draft.glow} onChange={(e) => setDraft({ ...draft, glow: e.target.checked })} />
                      ✨ GLOWS AT NIGHT
                    </label>
                  </div>
                  <div className="text-[7px] opacity-70">
                    {choice === 'meta' && museArt ? '★ DRAWN BY META MUSE IMAGE · NAMED BY MUSE SPARK' : byMeta ? '★ DESIGNED BY META MUSE SPARK' : '✎ PIXELS FROM YOUR PHOTO'}
                  </div>
                  <button
                    onClick={save}
                    disabled={!!busy || wallet.gems <= 0 || isAtCapacity}
                    className="w-full px-3 py-3 text-[9px] disabled:opacity-60"
                    style={{ ...btn, background: isAtCapacity ? '#e2e8f0' : '#7bffb2' }}
                  >
                    {isAtCapacity ? '⚠️ ITEM LIBRARY FULL (12/12)' : 'SAVE TO MY ITEMS · ' + GEM_ICON + ' 1'}
                  </button>
                </div>
              )}
            </>
          )}

          {error && (
            <div role="alert" className="p-2 text-[7px] leading-4" style={{ ...box, background: '#ffd9d9' }}>
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  , document.querySelector('.oddlings-app') || document.body);
};
