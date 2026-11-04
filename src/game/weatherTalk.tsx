/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Creatures comment on the weather. Each one has a lasting attitude toward rain and
 * reacts when clouds gather, when rain starts, now and then while it pours, and when it clears.
 */

import { WeatherState, hash } from './weather';

export type RainStance = 'loves' | 'hates' | 'worried' | 'curious';
export type WeatherPhase = 'gathering' | 'rain' | 'rainLater' | 'clearing';

export const STANCES: RainStance[] = ['loves', 'hates', 'worried', 'curious'];
export const MAX_WEATHER_LINE_CHARS = 34;

export function stanceFor(creatureId: string): RainStance {
  return STANCES[hash(`rain-stance:${creatureId}`) % STANCES.length];
}

export const WEATHER_LINES: Record<RainStance, Record<WeatherPhase, string[]>> = {
  loves: {
    gathering: ['Ooh, clouds! Will it rain?', 'I smell rain coming! Yay!', 'Rain soon? I hope so!'],
    rain: ['Wow! I love rain! 🌧️', "Yay, it's raining! Splash!", 'Rain, rain! Best day ever!'],
    rainLater: ['I could dance in this all day!', 'Splish splash! So good!', 'Listen to the rain! Lovely!'],
    clearing: ['Aww, the rain stopped already...', 'Come back, rain!']
  },
  hates: {
    gathering: ['Uh oh... those clouds look wet.', 'Please do not rain, please...', 'I felt a drop! No no no!'],
    rain: ["Noooo I don't want to get wet!", 'Oh no! It is raining!!', 'Ewww! Wet! Wet! Wet!'],
    rainLater: ["I'm getting soggy...", 'Make it stop, please!', "Where's a dry spot?!"],
    clearing: ['Phew! Finally it stopped!', 'Dry at last! Thank goodness!']
  },
  worried: {
    gathering: ['Is that a storm coming?', 'The sky looks angry...', 'Should we get inside?'],
    rain: ['Oh no! It is raining!', "Uh oh, I'm getting wet!", 'Do you have an umbrella?'],
    rainLater: ['I hope it ends soon...', 'Stay close to the shelter!', 'Brrr, so damp...'],
    clearing: ['Whew, it is over!', 'All clear? I think so!']
  },
  curious: {
    gathering: ['Hmm, the sky looks funny...', 'Why is it getting so dark?', 'What are those grey puffs?'],
    rain: ['Ooh! Water falls from the sky?!', 'Plink! What is this?!', "It's raining! How neat!"],
    rainLater: ['Each drop is different! Neat!', 'Where does the rain come from?', 'I wonder how clouds work...'],
    clearing: ['The sky stopped! Where did it go?', 'Aw, I wanted to learn more!']
  }
};

export function weatherLine(creatureId: string, phase: WeatherPhase, rng: () => number = Math.random): string {
  const lines = WEATHER_LINES[stanceFor(creatureId)][phase];
  return lines[Math.floor(rng() * lines.length) % lines.length];
}

export interface TalkMemo {
  state: WeatherState;
  pending: WeatherPhase | null; // a reaction this creature has not voiced yet
  at: number; // when the pending reaction is due
  nextChatter: number; // when it may remark on the rain again
}

const REACT_MIN_MS = 600;
const REACT_SPREAD_MS = 5000;
const CHATTER_MIN_MS = 25_000;
const CHATTER_SPREAD_MS = 35_000;

/**
 * Decides whether a creature should say something about the weather right now.
 * Creatures react at slightly different moments, never all at once, and a creature that
 * cannot speak yet keeps its reaction until it can.
 */
export function nextWeatherTalk(
  memo: TalkMemo | undefined,
  weather: { state: WeatherState; rain: number },
  now: number,
  rng: () => number,
  canSpeakNow: boolean
): { memo: TalkMemo; phase: WeatherPhase | null } {
  // First sight of the weather (a reload mid-storm) just sets a baseline
  if (!memo) {
    return {
      memo: { state: weather.state, pending: null, at: 0, nextChatter: weather.state === 'rain' ? now + 8000 + rng() * 20_000 : 0 },
      phase: null
    };
  }

  let next = memo;
  if (weather.state !== memo.state) {
    const pending: WeatherPhase | null =
      weather.state === 'gathering' ? 'gathering' : weather.state === 'rain' ? 'rain' : weather.state === 'clearing' && memo.state === 'rain' ? 'clearing' : null;
    next = {
      state: weather.state,
      pending,
      at: now + REACT_MIN_MS + rng() * REACT_SPREAD_MS,
      nextChatter: weather.state === 'rain' ? now + CHATTER_MIN_MS + rng() * CHATTER_SPREAD_MS : 0
    };
  }

  if (next.pending && now >= next.at) {
    if (!canSpeakNow) return { memo: next, phase: null };
    return { memo: { ...next, pending: null }, phase: next.pending };
  }

  if (!next.pending && weather.state === 'rain' && weather.rain > 0.4 && now >= next.nextChatter && canSpeakNow) {
    return { memo: { ...next, nextChatter: now + CHATTER_MIN_MS + rng() * CHATTER_SPREAD_MS }, phase: 'rainLater' };
  }

  return { memo: next, phase: null };
}
