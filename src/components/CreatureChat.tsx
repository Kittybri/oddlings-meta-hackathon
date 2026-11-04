/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Talk to a creature: a pixel chat window. Replies come from Meta Muse Spark on Fireworks,
 * written in the creature's own voice with its hearts, mood, weather and memories.
 */

import React, { useEffect, useRef, useState } from 'react';
import { CreatureDNA, MoodType } from '../game/creatureTypes';
import { OddlingAvatar } from './OddlingAvatar';
import { heartsFromTrust } from '../game/friendship';
import { weatherBus } from '../game/weatherBus';
import { phaseFromClock, toVoiceCreature } from '../game/creatureVoice';
import { loadWorldEpoch, WORLD_DAY_MS } from '../game/worldAtmosphere';

interface ChatLine {
  from: 'you' | 'creature';
  text: string;
}

const MAX_MESSAGE = 200;
const POLL_MS = 2000;
const WAIT_MS = 90_000;

// Conversations last while the page is open, so closing the window does not lose them
const conversations = new Map<string, ChatLine[]>();

async function askCreature(creature: CreatureDNA, mood: MoodType | undefined, history: ChatLine[], message: string): Promise<string> {
  const voice = toVoiceCreature(creature);
  const body = {
    creature: {
      name: voice.name,
      objectName: voice.objectName,
      material: voice.material,
      temperament: voice.temperament,
      ability: voice.ability,
      rainStance: voice.rainStance
    },
    state: {
      hearts: heartsFromTrust(creature.stats.trust),
      energy: creature.stats.energy,
      mood,
      biome: creature.biomeId === 'greenhouse' || !creature.biomeId ? 'the World' : creature.biomeId,
      phase: phaseFromClock(Date.now(), loadWorldEpoch(), WORLD_DAY_MS),
      weather: weatherBus.get().state,
      memories: creature.memories.slice(0, 5).map((m) => m.text)
    },
    history,
    message
  };
  const start = await fetch('/api/fireworks/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const started = await start.json().catch(() => null);
  if (!started?.jobId) throw new Error(started?.error || 'Could not reach the creature.');
  const until = Date.now() + WAIT_MS;
  while (Date.now() < until) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    const job = await fetch('/api/fireworks/chat/' + started.jobId).then((r) => r.json()).catch(() => null);
    if (job?.status === 'done' && job.result?.reply) return job.result.reply;
    if (job?.status === 'error' || (job && job.status !== 'pending' && job.status !== 'done')) throw new Error(job.error || 'The creature got distracted.');
  }
  throw new Error('The creature is thinking too hard. Try again!');
}

interface CreatureChatProps {
  creature: CreatureDNA;
  mood?: MoodType;
  onClose: () => void;
  onReply?: (reply: string) => void;
}

export const CreatureChat: React.FC<CreatureChatProps> = ({ creature, mood, onClose, onReply }) => {
  const [lines, setLines] = useState<ChatLine[]>(() => conversations.get(creature.id) || []);
  const [draft, setDraft] = useState('');
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    conversations.set(creature.id, lines);
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [lines, creature.id, waiting]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const send = async () => {
    const message = draft.trim().slice(0, MAX_MESSAGE);
    if (!message || waiting) return;
    const history = lines;
    setLines([...history, { from: 'you', text: message }]);
    setDraft('');
    setError('');
    setWaiting(true);
    try {
      const reply = await askCreature(creature, mood, history, message);
      setLines((prev) => [...prev, { from: 'creature', text: reply }]);
      onReply?.(reply);
    } catch (err: any) {
      setError(err?.message || 'The creature got distracted.');
    } finally {
      setWaiting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label={'Talk to ' + creature.name}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-slate-950 border-4 border-emerald-500 shadow-[6px_6px_0_#064e3b] flex flex-col max-h-[80vh]"
      >
        <div className="flex items-center gap-3 px-3 py-2 bg-emerald-900 border-b-4 border-emerald-500">
          <div className="w-12 h-12 shrink-0 overflow-hidden bg-slate-900 border-2 border-emerald-400">
            <OddlingAvatar creature={creature} size={44} mood={mood || 'happy'} showAura={false} faceCrop />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] text-emerald-100 truncate" style={{ fontFamily: '"Press Start 2P", monospace' }}>
              {creature.name}
            </div>
            <div className="text-[10px] text-emerald-300">Talking with a {toVoiceCreature(creature).objectName}</div>
          </div>
          <button onClick={onClose} aria-label="Close chat" className="px-2 py-1 bg-slate-900 border-2 border-emerald-400 text-emerald-200 text-xs">
            X
          </button>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 min-h-[220px]">
          {!lines.length && !waiting && (
            <p className="text-xs text-slate-400 text-center mt-6">Say hi to {creature.name}!</p>
          )}
          {lines.map((l, i) => (
            <div
              key={i}
              className={
                'max-w-[85%] px-3 py-2 text-sm border-2 ' +
                (l.from === 'you'
                  ? 'self-end bg-sky-900 border-sky-400 text-sky-50'
                  : 'self-start bg-emerald-950 border-emerald-400 text-emerald-50')
              }
            >
              {l.text}
            </div>
          ))}
          {waiting && (
            <div className="self-start px-3 py-2 text-sm border-2 bg-emerald-950 border-emerald-400 text-emerald-300 animate-pulse">
              {creature.name} is thinking<span className="thinking-dots ml-1" aria-hidden><span /><span /><span /></span>
            </div>
          )}
          {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
        </div>

        <form
          className="flex gap-2 p-3 border-t-4 border-emerald-500 bg-slate-900"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <input
            autoFocus
            value={draft}
            maxLength={MAX_MESSAGE}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={'Say something to ' + creature.name}
            aria-label="Message"
            className="flex-1 min-w-0 px-2 py-2 bg-slate-950 border-2 border-emerald-700 text-sm text-slate-100 outline-none focus:border-emerald-400"
          />
          <button
            type="submit"
            disabled={waiting || !draft.trim()}
            className="px-3 py-2 bg-emerald-600 border-2 border-emerald-300 text-white text-xs font-bold disabled:opacity-50"
          >
            SEND
          </button>
        </form>
      </div>
    </div>
  );
};
