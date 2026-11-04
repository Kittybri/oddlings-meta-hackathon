/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { MAX_HEARTS, heartsFromTrust } from '../game/friendship';

// 7x6 pixel heart: 1 = filled pixel
const HEART = ['0110110', '1111111', '1111111', '0111110', '0011100', '0001000'];

const PixelHeart: React.FC<{ filled: boolean; px: number }> = ({ filled, px }) => (
  <div
    aria-hidden
    style={{ display: 'grid', gridTemplateColumns: `repeat(7, ${px}px)`, gridAutoRows: `${px}px`, imageRendering: 'pixelated' }}
  >
    {HEART.join('').split('').map((p, i) => (
      <div key={i} style={{ background: p === '0' ? 'transparent' : filled ? '#ff4d6d' : '#3a2a55' }} />
    ))}
  </div>
);

interface HeartMeterProps {
  trust: number;
  size?: number;
  className?: string;
}

export const HeartMeter: React.FC<HeartMeterProps> = ({ trust, size = 2, className }) => {
  const hearts = heartsFromTrust(trust);
  return (
    <div
      className={className}
      role="img"
      aria-label={`${hearts} of ${MAX_HEARTS} friendship hearts`}
      style={{ display: 'flex', gap: size, alignItems: 'center' }}
    >
      {Array.from({ length: MAX_HEARTS }, (_, i) => (
        <PixelHeart key={i} filled={i < hearts} px={size} />
      ))}
    </div>
  );
};
