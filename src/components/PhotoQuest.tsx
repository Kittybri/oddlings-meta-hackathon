import { createPortal } from 'react-dom';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Photo quests: a creature asks for something ("something red"), the player snaps a photo,
 * and Meta Muse Spark on Fireworks checks it. A match earns a friendship heart and energy.
 */

import React, { useEffect, useRef, useState } from 'react';
import { CreatureDNA } from '../game/creatureTypes';
import { OddlingAvatar } from './OddlingAvatar';
import { toVoiceCreature } from '../game/creatureVoice';
import { walletBook, GEM_ICON, GEM_NAME, SEED_ICON, SEED_NAME, SPARKLE_ICON } from '../game/lifeSeeds';
import { preparePhotoForUpload } from '../game/photoCompression';

export const QUESTS = [
  'something red',
  'something blue',
  'something round',
  'a plant or a flower',
  'something soft',
  'something made of metal',
  'something that holds water',
  'something with words on it',
  'something you can wear',
  'something that makes light',
  'something yellow',
  'something with wheels or buttons'
];

const QUEST_KEY = 'oddlings_quests_v1';
const REWARD_TRUST = 10; // one friendship heart
const REWARD_ENERGY = 15;
const PHOTO_MAX = 640;

interface QuestBook {
  [creatureId: string]: { quest: string; done: number };
}

function loadBook(): QuestBook {
  try {
    const raw = JSON.parse(localStorage.getItem(QUEST_KEY) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

function saveBook(book: QuestBook): void {
  try {
    localStorage.setItem(QUEST_KEY, JSON.stringify(book));
  } catch {
    /* a full or blocked storage only forgets the current quest */
  }
}

const pickQuest = (not?: string) => {
  const options = QUESTS.filter((q) => q !== not);
  return options[Math.floor(Math.random() * options.length)];
};

/** The photo, shrunk to a small JPEG so the check is quick. */
function shrinkPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, PHOTO_MAX / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That photo could not be opened.'));
    };
    img.src = url;
  });
}

async function checkPhoto(creature: CreatureDNA, quest: string, imageBase64: string) {
  const voice = toVoiceCreature(creature);
  const start = await fetch('/api/fireworks/quest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quest, imageBase64, creature: { name: voice.name, objectName: voice.objectName } })
  })
    .then((r) => r.json())
    .catch(() => null);
  if (!start?.jobId) throw new Error(start?.error || 'Could not check the photo.');
  for (let i = 0; i < 45; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const job = await fetch('/api/fireworks/quest/' + start.jobId).then((r) => r.json()).catch(() => null);
    if (job?.status === 'done') return job.result as { match: boolean; seen: string; reply: string };
    if (job?.status === 'error' || (job && job.status !== 'pending' && job.status !== 'done')) throw new Error(job.error || 'Could not check the photo.');
  }
  throw new Error('The check took too long. Try again!');
}

interface PhotoQuestProps {
  creature: CreatureDNA;
  onClose: () => void;
  onUpdateCreature: (updated: CreatureDNA) => void;
  onReply?: (reply: string) => void;
  /** A set request from another feature (the garden adventure) instead of a random quest */
  fixedQuest?: string;
  /** Called on a match instead of paying the usual quest rewards */
  onMatch?: (seen: string) => void;
}

export const PhotoQuest: React.FC<PhotoQuestProps> = ({ creature, onClose, onUpdateCreature, onReply, fixedQuest, onMatch }) => {
  const [quest, setQuest] = useState(() => fixedQuest || loadBook()[creature.id]?.quest || pickQuest());
  const [photo, setPhoto] = useState('');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{ match: boolean; seen: string; reply: string } | null>(null);
  const [error, setError] = useState('');
  const [reward, setReward] = useState<{ seeds: number; gems: number; sparkles: number } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (fixedQuest) return; // a set request is not this creature's own quest
    const book = loadBook();
    book[creature.id] = { quest, done: book[creature.id]?.done || 0 };
    saveBook(book);
  }, [creature.id, quest]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const newQuest = () => {
    setQuest(pickQuest(quest));
    setPhoto('');
    setResult(null);
    setReward(null);
    setError('');
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    setResult(null);
    // Each photo check calls Meta, so there is a daily limit
    if (!walletBook.recordCheck()) {
      setError('You checked lots of photos today! Come back tomorrow for more quests.');
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    const reservedDay = walletBook.get().checksDay;
    let refunded = false;
    const safeRefundCheck = () => {
      if (!refunded) {
        refunded = true;
        walletBook.refundCheck(reservedDay);
      }
    };
    try {
      // Shared pre-upload compressor ~1280px JPEG; decode failure throws ImageDecodeError without provider call
      const { dataUrl: image } = await preparePhotoForUpload(file, { maxDimension: 1280, quality: 0.85 });
      setPhoto(image);
      setChecking(true);
      const out = await checkPhoto(creature, quest, image);
      setResult(out);
      onReply?.(out.reply);
      if (out.match && onMatch) {
        onMatch(out.seen);
      } else if (out.match) {
        const book = loadBook();
        book[creature.id] = { quest, done: (book[creature.id]?.done || 0) + 1 };
        saveBook(book);
        setReward(walletBook.rewardQuest());
        onUpdateCreature({
          ...creature,
          stats: {
            ...creature.stats,
            trust: Math.min(100, creature.stats.trust + REWARD_TRUST),
            energy: Math.min(100, creature.stats.energy + REWARD_ENERGY)
          },
          memories: [
            { timestamp: Date.now(), text: 'Got ' + quest + ' for my photo quest: ' + (out.seen || 'a great find') + '!', type: 'play' as const },
            ...creature.memories.slice(0, 15)
          ]
        });
      }
      // Note: legitimate model rejection (out.match === false) is NOT an error, so no refund is issued.
    } catch (err: any) {
      safeRefundCheck();
      setError(err?.message || 'Could not check the photo.');
    } finally {
      setChecking(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const done = loadBook()[creature.id]?.done || 0;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label={creature.name + ' photo quest'}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-slate-950 border-4 border-amber-400 shadow-[6px_6px_0_#78350f] flex flex-col"
      >
        <div className="flex items-center gap-3 px-3 py-2 bg-amber-900 border-b-4 border-amber-400">
          <div className="w-12 h-12 shrink-0 overflow-hidden bg-slate-900 border-2 border-amber-300">
            <OddlingAvatar creature={creature} size={44} mood="curious" showAura={false} faceCrop />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] text-amber-100" style={{ fontFamily: '"Press Start 2P", monospace' }}>
              {fixedQuest ? 'GARDEN ADVENTURE' : 'PHOTO QUEST'}
            </div>
            <div className="text-[10px] text-amber-300">
              {fixedQuest ? 'Help ' + creature.name + ' water the seed' : done + ' completed with ' + creature.name} · {walletBook.checksLeft()} photo checks left today
            </div>
          </div>
          <button onClick={onClose} aria-label="Close quest" className="px-2 py-1 bg-slate-900 border-2 border-amber-300 text-amber-200 text-xs">
            X
          </button>
        </div>

        <div className="p-4 flex flex-col gap-3">
          <div className="px-3 py-2 border-2 border-amber-300 bg-amber-950 text-amber-50 text-sm">
            {creature.name}: "Can you show me <b>{quest}</b>? 📸"
          </div>

          {photo && (
            <img src={photo} alt="Your quest photo" className="w-full max-h-56 object-contain border-2 border-slate-700 bg-slate-900" />
          )}

          {checking && <p className="text-sm text-amber-300 animate-pulse">{creature.name} is looking closely<span className="thinking-dots ml-1" aria-hidden><span /><span /><span /></span></p>}

          {result && (
            <div
              role="status"
              className={
                'px-3 py-2 border-2 text-sm ' +
                (result.match ? 'border-emerald-400 bg-emerald-950 text-emerald-50' : 'border-rose-400 bg-rose-950 text-rose-50')
              }
            >
              <div>{result.reply}</div>
              <div className="text-[11px] mt-1 opacity-80">
                {result.match && fixedQuest
                  ? 'The seed is watered! 💧'
                  : result.match
                  ? 'Quest complete! +1 heart, +' + REWARD_ENERGY + ' energy, +1 ' + SEED_ICON + ' ' + SEED_NAME + (reward?.gems ? ', +1 ' + GEM_ICON + ' ' + GEM_NAME : '') + (reward ? ', +' + reward.sparkles + ' ' + SPARKLE_ICON : '')
                  : 'Saw: ' + (result.seen || 'something else') + '. Try another photo!'}
              </div>
            </div>
          )}

          {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          <div className="flex gap-2">
            {result?.match ? (
              <button onClick={fixedQuest ? onClose : newQuest} className="flex-1 px-3 py-2 bg-emerald-600 border-2 border-emerald-300 text-white text-xs font-bold">
                {fixedQuest ? 'BACK TO THE GARDEN' : 'NEXT QUEST'}
              </button>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                disabled={checking}
                className="flex-1 px-3 py-2 bg-amber-500 border-2 border-amber-200 text-slate-950 text-xs font-bold disabled:opacity-50"
              >
                {photo ? 'TRY ANOTHER PHOTO' : 'TAKE A PHOTO'}
              </button>
            )}
            {!result?.match && !fixedQuest && (
              <button
                onClick={newQuest}
                disabled={checking}
                className="px-3 py-2 bg-slate-800 border-2 border-slate-500 text-slate-200 text-xs font-bold disabled:opacity-50"
              >
                SKIP
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  , document.querySelector('.oddlings-app') || document.body);
};
