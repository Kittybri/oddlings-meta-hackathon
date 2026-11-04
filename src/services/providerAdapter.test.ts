/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  getProviderStatusReport, 
  callMetaSamSegmentation, 
  callMetaMuseSpark, 
  ProviderNotConfiguredError 
} from './providerAdapter';

test('getProviderStatusReport accurately reports unconfigured Meta providers', async () => {
  const report = await getProviderStatusReport();
  assert.equal(report.gameEngine.status, 'active');
  assert.equal(report.demoMode.status, 'active');
  assert.equal(report.samSegmentation.status, 'unconfigured');
  assert.equal(report.museSpark.status, 'unconfigured');
});

test('calling unconfigured providers throws explicit ProviderNotConfiguredError rather than faking calls', async () => {
  await assert.rejects(
    async () => {
      await callMetaSamSegmentation('dummy-image-data');
    },
    (err: Error) => {
      assert.ok(err instanceof ProviderNotConfiguredError);
      assert.equal(err.providerName, 'Segment Anything (SAM 3.1)');
      return true;
    }
  );

  await assert.rejects(
    async () => {
      await callMetaMuseSpark('dummy-image-data');
    },
    (err: Error) => {
      assert.ok(err instanceof ProviderNotConfiguredError);
      assert.equal(err.providerName, 'Muse Spark 1.3');
      return true;
    }
  );
});
