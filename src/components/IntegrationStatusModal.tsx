/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { fetchBasetenStatus, BasetenStatus } from '../services/basetenClient';

interface IntegrationStatusModalProps {
  onClose: () => void;
}

export const IntegrationStatusModal: React.FC<IntegrationStatusModalProps> = ({ onClose }) => {
  const [basetenStatus, setBasetenStatus] = useState<BasetenStatus | null>(null);
  const [metaKeys, setMetaKeys] = useState<{ museImage: boolean; fireworks: boolean; fireworksModel?: string } | null>(null);

  useEffect(() => {
    fetchBasetenStatus()
      .then(setBasetenStatus)
      .catch(() => {
        setBasetenStatus({
          provider: 'baseten',
          model: 'meta-models/muse-spark-open-1026',
          status: 'not_configured',
          hasKey: false,
          lastVerifiedAt: null,
          message: 'Backend server status check failed. Demo & Manual modes active.'
        });
      });

    fetch('/api/meta/status')
      .then((r) => r.json())
      .then((s) => setMetaKeys({
        museImage: !!s?.museImage,
        fireworks: !!s?.fireworks,
        fireworksModel: s?.fireworksModel || 'accounts/fireworks/models/muse-spark-open'
      }))
      .catch(() => setMetaKeys(null));
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col gap-6 max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-xl text-cyan-400">
              ⚙️
            </div>
            <div>
              <h3 className="text-lg font-bold font-['Space_Grotesk'] text-slate-100 flex items-center gap-2">
                <span>SYSTEM & INTEGRATION AUDIT</span>
              </h3>
              <p className="text-xs text-slate-400">
                Transparent status of working game engine vs. Baseten server integration and pending Meta providers.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition-colors"
          >
            ✕ CLOSE
          </button>
        </div>

        {/* Section 1: Working Gameplay Engine */}
        <div className="space-y-3">
          <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-bold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            1. FULLY WORKING GAMEPLAY (VERIFIED RUNTIME)
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            <div className="p-3 rounded-xl bg-slate-950/70 border border-emerald-900/40">
              <span className="font-bold text-slate-200 block mb-1">🎮 Living Habitat Sandbox</span>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Autonomous 60fps creature wandering, treat physics, toy flinging, interactive care, and trust/energy progression.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/70 border border-emerald-900/40">
              <span className="font-bold text-slate-200 block mb-1">🧬 Creature Fusion Lab</span>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Dual-path genetic splicing: instant deterministic inheritance and server-side Meta Muse Spark live synthesis.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/70 border border-emerald-900/40">
              <span className="font-bold text-slate-200 block mb-1">🔊 Web Audio Synthesizer</span>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Zero external sound assets; procedural sine and sawtooth oscillators for chirps, purrs, snacks, and fusion surges.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/70 border border-emerald-900/40">
              <span className="font-bold text-slate-200 block mb-1">💾 Resilient Persistence</span>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                LocalStorage schema validation, corruption recovery, and player-action onboarding tracking across page reloads.
              </p>
            </div>
          </div>
        </div>

        {/* Section 2: Preset Demo Assets & 16-Bit Pixel Engine */}
        <div className="space-y-3">
          <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            2. 16-BIT PIXEL SPRITE ENGINE & COLOR QUANTIZATION
          </span>

          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-amber-900/40 text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200">Local 16-Bit Engine & Procedural Synthesis</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                LOCAL ENGINE ACTIVE
              </span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Living worlds, biomes, and creatures render through an authentic 16-bit pixel raster pipeline, deterministic sprite synthesis, and color quantization. This provides guaranteed 0ms latency offline playability without network dependencies.
            </p>
          </div>
        </div>

        {/* Section 3: Meta AI Model Integrations via Baseten */}
        <div className="space-y-3">
          <span className="text-xs font-mono uppercase tracking-wider text-cyan-400 font-bold flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${basetenStatus?.hasKey ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            3. META AI MODEL PROVIDERS (SERVER BACKEND)
          </span>

          <div className="space-y-2.5 text-xs">
            {/* Meta Muse Spark Open via Baseten */}
            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-200 block">Meta Muse Spark Open</span>
                  <span className="text-[10px] font-mono text-cyan-400">meta-models/muse-spark-open-1026</span>
                </div>
                {basetenStatus?.hasKey ? (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                    CONFIGURED (SERVER KEY DETECTED)
                  </span>
                ) : (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                    UNCONFIGURED (PENDING SERVER KEY)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Full-stack server integration implemented at <code className="text-slate-300 bg-slate-900 px-1 rounded">/api/baseten/analyze</code> and <code className="text-slate-300 bg-slate-900 px-1 rounded">/api/baseten/fuse</code> using Baseten inference (<code className="text-slate-300 bg-slate-900 px-1 rounded">https://inference.baseten.co/v1</code>).
              </p>
              <div className="p-2 rounded bg-slate-900/80 border border-slate-800 text-[11px] text-slate-300">
                {basetenStatus?.hasKey
                  ? '⚡ BASETEN_API_KEY is present in the server environment. Live multimodal image analysis and genetic fusion synthesis are active.'
                  : 'ℹ️ BASETEN_API_KEY is not yet set in the server environment. The application runs seamlessly with instant manual awakening and algorithmic genetic crossover. Setting BASETEN_API_KEY in server secrets enables live Meta AI calls.'}
              </div>
            </div>

            {/* Muse Image */}
            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-300 block">Muse Image</span>
                  <span className="text-[10px] font-mono text-cyan-400">meta-models/muse-image-1.0</span>
                </div>
                {metaKeys?.museImage ? (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                    CONFIGURED (SERVER KEY DETECTED)
                  </span>
                ) : (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                    UNCONFIGURED (PENDING SERVER KEY)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Full-stack server integration implemented at <code className="text-slate-300 bg-slate-900 px-1 rounded">/api/meta/creature-art</code>. {metaKeys?.museImage ? 'Live Meta Muse Image redraws photographed items into stylized pixel sprites.' : 'When META_API_KEY is present in the server environment, live sprite redraws are active.'}
              </p>
            </div>

            {/* Fireworks AI (Creature Chat & Quests) */}
            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-300 block">Fireworks AI (Creature Chat & Quests)</span>
                  <span className="text-[10px] font-mono text-cyan-400">
                    {metaKeys?.fireworksModel || 'accounts/fireworks/models/muse-spark-open'}
                  </span>
                </div>
                {metaKeys?.fireworks ? (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                    CONFIGURED (SERVER KEY DETECTED)
                  </span>
                ) : (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                    UNCONFIGURED (PENDING SERVER KEY)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Full-stack server integration implemented at <code className="text-slate-300 bg-slate-900 px-1 rounded">/api/fireworks/chat</code> and <code className="text-slate-300 bg-slate-900 px-1 rounded">/api/fireworks/quest</code>. {metaKeys?.fireworks ? 'Live conversational roleplay and photo quest verifications are active.' : 'When FIREWORKS_API_KEY is present, live creature chat and quest checks are active.'}
              </p>
            </div>
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs font-mono transition-colors"
        >
          ACKNOWLEDGE & RETURN TO GAME
        </button>
      </div>
    </div>
  );
};
