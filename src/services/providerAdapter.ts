/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { IntegrationStatus } from '../game/creatureTypes';

export class ProviderNotConfiguredError extends Error {
  constructor(public providerName: string, message: string) {
    super(message);
    this.name = 'ProviderNotConfiguredError';
  }
}

/**
 * Provider adapter boundary for external Meta AI services.
 * Strictly avoids fake mock responses or invented endpoints.
 * Returns honest unconfigured status reports until verified server credentials exist.
 */
export async function getProviderStatusReport(): Promise<IntegrationStatus> {
  return {
    gameEngine: {
      status: 'active',
      description: 'Autonomous 60fps simulation, procedural Web Audio, genetic inheritance engine'
    },
    demoMode: {
      status: 'active',
      description: 'Pre-designed scenes, SVG vector masks, and procedural DNA algorithms'
    },
    samSegmentation: {
      status: 'unconfigured',
      name: 'Segment Anything (SAM 3.1)',
      message: 'Meta SAM API endpoint not configured in server environment. Manual interactive region selector is active.'
    },
    museSpark: {
      status: 'unconfigured',
      name: 'Muse Spark / Image',
      message: 'Meta Multimodal API not configured in server environment. Algorithmic procedural DNA generator is active.'
    }
  };
}

/**
 * Attempts to call Meta SAM 3.1.
 * Since credentials and verified endpoints are unconfigured, this explicitly throws
 * ProviderNotConfiguredError rather than faking an AI response.
 */
export async function callMetaSamSegmentation(_imagePayload: string): Promise<never> {
  throw new ProviderNotConfiguredError(
    'Segment Anything (SAM 3.1)',
    'Meta SAM 3.1 provider is unconfigured. Please use manual region selection fallback.'
  );
}

/**
 * Attempts to call Meta Muse Spark.
 * Since credentials and verified endpoints are unconfigured, this explicitly throws
 * ProviderNotConfiguredError rather than faking an AI response.
 */
export async function callMetaMuseSpark(_imagePayload: string): Promise<never> {
  throw new ProviderNotConfiguredError(
    'Muse Spark 1.3',
    'Meta Muse Spark provider is unconfigured. Please use algorithmic DNA generation.'
  );
}
