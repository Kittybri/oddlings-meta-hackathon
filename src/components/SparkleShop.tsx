/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The Sparkle Shop: a little pixel market stall where Sparkle Coins buy more Life Seeds,
 * Craft Gems and quest photo checks. Coins are earned by caring for creatures and quests.
 */

import React, { useEffect, useState } from 'react';
import {
  CARE_SPARKLES_PER_DAY,
  GEM_ICON,
  QUEST_SPARKLES,
  SEED_ICON,
  SHOP_ITEMS,
  SPARKLE_ICON,
  SPARKLE_NAME,
  walletBook
} from '../game/lifeSeeds';
import { sound } from '../game/soundSynth';

const PIXEL_FONT = '"Press Start 2P", monospace';

interface SparkleShopProps {
  onClose: () => void;
}

export const SparkleShop: React.FC<SparkleShopProps> = ({ onClose }) => {
  const [wallet, setWallet] = useState(() => walletBook.get());
  const [message, setMessage] = useState('');

  useEffect(() => walletBook.subscribe(() => setWallet(walletBook.get())), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      // Keep Space/Enter from reaching the title screen's start shortcut
      if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const purchase = (id: string, name: string) => {
    const out = walletBook.buy(id);
    if (out.ok) {
      sound.playChirp(880);
      setMessage('Thank you! You got ' + name + ' ' + SPARKLE_ICON);
    } else {
      setMessage(out.reason === 'storage' ? 'Could not save the purchase. Free device space and try again.' : out.reason === 'too-poor' ? 'Not enough ' + SPARKLE_NAME + 's yet!' : 'You already have plenty of that!');
    }
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Sparkle Shop"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-[#fff3d6] text-[#2b1b4d] border-4 border-[#1b1033] shadow-[6px_6px_0_#1b1033]"
        style={{ fontFamily: PIXEL_FONT }}
      >
        {/* Striped market awning */}
        <div
          aria-hidden
          className="h-6 border-b-4 border-[#1b1033]"
          style={{ background: 'repeating-linear-gradient(90deg, #ff6b9d 0 24px, #fff3d6 24px 48px)' }}
        />
        <div className="flex items-center gap-3 px-4 py-3 border-b-4 border-[#1b1033] bg-[#ffd36b]">
          <span className="text-2xl" aria-hidden>
            🛍️
          </span>
          <div className="flex-1">
            <div className="text-[12px]">SPARKLE SHOP</div>
            <div className="text-[8px] mt-1 opacity-80">Trade {SPARKLE_NAME}s for more fun!</div>
          </div>
          <div className="px-2 py-1 bg-[#2b1b4d] text-[#ffe36b] text-[10px] border-2 border-[#1b1033]" aria-label={wallet.sparkles + ' ' + SPARKLE_NAME + 's'}>
            {SPARKLE_ICON} {wallet.sparkles}
          </div>
          <button onClick={onClose} aria-label="Close shop" className="px-2 py-1 bg-[#fff3d6] border-2 border-[#1b1033] text-[10px]">
            X
          </button>
        </div>

        <div className="px-4 pt-3 text-[8px] flex gap-4 flex-wrap opacity-90">
          <span>
            {SEED_ICON} {wallet.seeds} Life Seeds
          </span>
          <span>
            {GEM_ICON} {wallet.gems} Craft Gems
          </span>
          <span>📸 {walletBook.checksLeft()} quest photos left today</span>
        </div>

        <div className="grid grid-cols-2 gap-3 p-4">
          {SHOP_ITEMS.map((item) => {
            const check = walletBook.check(item.id);
            const full = !check.ok && check.reason === 'already-full';
            const poor = !check.ok && check.reason === 'too-poor';
            return (
              <div key={item.id} className="flex flex-col gap-2 p-3 bg-[#fffaf0] border-4 border-[#1b1033]">
                <div className="text-2xl text-center" aria-hidden>
                  {item.icon}
                </div>
                <div className="text-[9px] text-center leading-4">{item.name}</div>
                <div className="text-[7px] text-center leading-3 opacity-75 min-h-[24px]">{item.description}</div>
                <button
                  onClick={() => purchase(item.id, item.name)}
                  disabled={!check.ok}
                  className="px-2 py-2 text-[9px] border-4 border-[#1b1033] disabled:opacity-50"
                  style={{ background: check.ok ? '#7bffb2' : '#e0d8c8', fontFamily: PIXEL_FONT }}
                >
                  {full ? 'FULL' : SPARKLE_ICON + ' ' + item.price}
                </button>
                {poor && <div className="text-[7px] text-center opacity-70">Need {item.price - wallet.sparkles} more</div>}
              </div>
            );
          })}
        </div>

        {message && (
          <div role="status" className="mx-4 mb-3 p-2 text-[8px] border-4 border-[#1b1033] bg-[#ffe36b]">
            {message}
          </div>
        )}

        <div className="px-4 pb-4 text-[7px] leading-4 opacity-80">
          Earn {SPARKLE_ICON} by petting, feeding, playing and naps (up to {CARE_SPARKLES_PER_DAY} a day), and +{QUEST_SPARKLES} for every photo
          quest you finish.
        </div>
      </div>
    </div>
  );
};
