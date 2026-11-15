/**
 * @license
 * SPDX-License-Identifier: LicenseRef-Oddlings-Proprietary
 */

import { ItemLibrary } from './customItems';

/** Shared library used by the game UI. Kept apart from the pure logic so the server can import that safely. */
export const customItemLibrary = new ItemLibrary();
