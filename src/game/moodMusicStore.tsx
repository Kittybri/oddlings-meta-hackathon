/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { gameMusic } from './gameMusic';
import { MoodMusic } from './moodMusic';

/** Shared mood layer. Kept apart from the engine so tests can build their own with fakes. */
export const moodMusic = new MoodMusic(gameMusic);
