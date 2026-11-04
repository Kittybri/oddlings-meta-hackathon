/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CLEAR_SKY, Weather } from './weather';

let current: Weather = CLEAR_SKY;
const listeners = new Set<() => void>();

/** The weather the World is showing right now, shared with the creatures that talk about it. */
export const weatherBus = {
  get(): Weather {
    return current;
  },
  set(weather: Weather): void {
    current = weather;
    listeners.forEach((fn) => fn());
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }
};
