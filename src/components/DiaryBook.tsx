/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { CreatureDNA } from '../game/creatureTypes';
import { creatureVoice, DiaryEntry, DiaryEventType } from '../game/creatureVoice';
import { heartsFromTrust, heartTitle } from '../game/friendship';
import { HeartMeter } from './HeartMeter';
import { OddlingAvatar } from './OddlingAvatar';
import { FOOD_TREATS } from '../game/creatureCatalog';
import { tasteBook, TASTE_ICON, Taste } from '../game/gifts';

const PIXEL_FONT = '"Press Start 2P", ui-monospace, "JetBrains Mono", monospace';
const FONT_LINK_ID = 'oddlings-pixel-font';

const STICKERS: Record<DiaryEventType, { glyph: string; label: string; color: string }> = {
  hatch: { glyph: '◉', label: 'HATCHED', color: '#ffd166' },
  fuse: { glyph: '✚', label: 'FUSED', color: '#c77dff' },
  pet: { glyph: '♥', label: 'PETTED', color: '#ff6b9d' },
  feed: { glyph: '●', label: 'SNACK', color: '#ffa94d' },
  play: { glyph: '★', label: 'PLAYED', color: '#4dd4ff' },
  nap: { glyph: '☾', label: 'NAP', color: '#9db4ff' },
  ability: { glyph: '✦', label: 'POWER', color: '#7bffb2' },
  move: { glyph: '▲', label: 'MOVED', color: '#ffe066' },
  heart: { glyph: '♥', label: 'HEARTS', color: '#ff4d6d' },
  gift: { glyph: '◆', label: 'GIFT', color: '#ffcf4d' }
};

// 8x8 pixel face: 0 empty, 1 body, 2 eye, 3 cheek, 4 mouth, 5 accent
const FACE = [
  '00555500',
  '01111110',
  '11111111',
  '12111121',
  '11111111',
  '13111131',
  '11144111',
  '01111110'
];

const PixelFace: React.FC<{ creature: CreatureDNA }> = ({ creature }) => {
  const a = creature.appearance;
  const colors: Record<string, string> = {
    '1': a?.primaryColor || '#ffb86b',
    '2': '#1b1033',
    '3': '#ff8fab',
    '4': '#1b1033',
    '5': a?.accentColor || '#ffd166'
  };
  return (
    <div
      aria-hidden
      style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 8px)', gridAutoRows: '8px', imageRendering: 'pixelated' }}
    >
      {FACE.join('').split('').map((p, i) => (
        <div key={i} style={{ background: p === '0' ? 'transparent' : colors[p] }} />
      ))}
    </div>
  );
};

const fmtTime = (ts: number) =>
  new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

interface DiaryBookProps {
  creature: CreatureDNA;
  onClose: () => void;
}

export const DiaryBook: React.FC<DiaryBookProps> = ({ creature, onClose }) => {
  const [entries, setEntries] = useState<DiaryEntry[]>(() => creatureVoice.getDiary(creature.id));
  const [tastes, setTastes] = useState<Record<string, Taste>>(() => tasteBook.known(creature.id));

  useEffect(() => {
    setTastes(tasteBook.known(creature.id));
    return tasteBook.subscribe(() => setTastes({ ...tasteBook.known(creature.id) }));
  }, [creature.id]);

  useEffect(() => {
    if (!document.getElementById(FONT_LINK_ID)) {
      const link = document.createElement('link');
      link.id = FONT_LINK_ID;
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap';
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
    setEntries(creatureVoice.getDiary(creature.id));
    return creatureVoice.subscribe(() => setEntries([...creatureVoice.getDiary(creature.id)]));
  }, [creature.id]);

  const pixelBorder: React.CSSProperties = {
    boxShadow: '0 -4px 0 0 #1b1033, 0 4px 0 0 #1b1033, -4px 0 0 0 #1b1033, 4px 0 0 0 #1b1033, 0 8px 0 0 rgba(0,0,0,0.35)'
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${creature.name}'s diary`}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[85vh] flex flex-col"
        style={{ background: '#fff3d6', color: '#2b1b4d', fontFamily: PIXEL_FONT, ...pixelBorder }}
      >
        <div className="flex items-center gap-3 p-4" style={{ background: '#ffb3d1', borderBottom: '4px solid #1b1033' }}>
          <div style={{ background: '#fff3d6', padding: 4, border: '4px solid #1b1033' }}>
            <div style={{ width: 64, height: 64, overflow: 'hidden' }}><OddlingAvatar creature={creature} size={64} mood="happy" showAura={false} faceCrop /></div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] leading-4 truncate">{creature.name.toUpperCase()}'S DIARY</div>
            <div className="text-[8px] leading-4 opacity-70 truncate">FROM A {(creature.sourceObject?.name || 'MYSTERY').toUpperCase()}</div>
            <div className="mt-1 flex items-center gap-2">
              <HeartMeter trust={creature.stats.trust} size={2} />
              <span className="text-[7px] opacity-70 whitespace-nowrap">{heartTitle(heartsFromTrust(creature.stats.trust)).toUpperCase()}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close diary"
            className="text-[10px] px-2 py-1 cursor-pointer"
            style={{ background: '#fff3d6', border: '4px solid #1b1033', fontFamily: PIXEL_FONT }}
          >
            X
          </button>
        </div>

        <div className="overflow-y-auto p-4 space-y-3" style={{ backgroundImage: 'repeating-linear-gradient(transparent 0 23px, rgba(43,27,77,0.08) 23px 24px)' }}>
          <div className="p-3" style={{ background: '#fffaf0', border: '4px solid #1b1033' }}>
            <div className="text-[8px] mb-2">TASTES</div>
            {FOOD_TREATS.filter((t) => tastes[t.id]).map((t) => (
              <div key={t.id} className="text-[7px] leading-4">
                {TASTE_ICON[tastes[t.id]]} {t.name.toUpperCase()}
              </div>
            ))}
            {Object.keys(tastes).length === 0 && <div className="text-[7px] leading-4 opacity-60">GIVE TREATS TO FIND OUT!</div>}
          </div>
          {entries.length === 0 && (
            <p className="text-[9px] leading-5 text-center py-8 opacity-70">
              NOTHING WRITTEN YET.
              <br />
              PET ME, FEED ME, OR MOVE ME!
            </p>
          )}
          {entries.map((e) => {
            const s = STICKERS[e.event] || STICKERS.play;
            return (
              <article key={e.id} className="p-3" style={{ background: '#fffaf0', border: '4px solid #1b1033' }}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[8px] px-1.5 py-1" style={{ background: s.color, border: '3px solid #1b1033' }}>
                    {s.glyph} {s.label}
                  </span>
                  <span className="text-[7px] opacity-60">{fmtTime(e.at)}</span>
                </div>
                <p className="text-[9px] leading-5" style={{ wordBreak: 'break-word' }}>{e.text}</p>
                <div className="mt-2 text-[7px] opacity-70">
                  {e.source === 'muse-spark' ? '★ WRITTEN BY META MUSE SPARK' : '✎ LOCAL NOTE'}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
};
