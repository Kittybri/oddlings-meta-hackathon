/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { IncubatorEgg, CreatureDNA, INCUBATION_DURATION_SECONDS } from '../game/creatureTypes';
import { requestBasetenAnalysis } from '../services/basetenClient';
import { IncubatorMachine } from './IncubatorMachine';
import { OddlingAvatar } from './OddlingAvatar';
import { watchPhotoSprite } from '../game/photoSprite';
import { sound } from '../game/soundSynth';
import { walletBook, SEED_ICON, SEED_NAME } from '../game/lifeSeeds';
import { deriveCreatureReveal } from '../game/gardenAdventure';
import { preparePhotoForUpload } from '../game/photoCompression';
import { loadActiveEggFromStorage } from '../game/storage';

interface IncubatorLabProps {
  activeEgg: IncubatorEgg | null;
  onEggCreated: (egg: IncubatorEgg) => boolean;
  onEggClaimed: (egg: IncubatorEgg) => { success: boolean; error?: string } | void;
  onClose: () => void;
}

// Compress photo into a lightweight thumbnail to ensure safe storage under quota limits
function createCompressedThumbnail(dataUrl: string, maxDim = 120, quality = 0.7): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.width;
      let h = img.height;
      if (w > h) {
        if (w > maxDim) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        }
      } else {
        if (h > maxDim) {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } else {
        resolve(dataUrl.slice(0, 5000));
      }
    };
    img.onerror = () => resolve(dataUrl.slice(0, 5000));
    img.src = dataUrl;
  });
}

const PENDING_EGG_KEY = 'oddlings_pending_egg_v1';
const PENDING_PHOTO_KEY = 'oddlings_pending_egg_photo_v1';

function markPendingEgg(photo: string): void {
  try { localStorage.setItem(PENDING_EGG_KEY, JSON.stringify({ at: Date.now(), version: 2 })); } catch { /* storage unavailable */ }
  try { sessionStorage.setItem(PENDING_PHOTO_KEY, photo); } catch { /* photo too big to keep: the seed still comes back */ }
}

function clearPendingEgg(): void {
  try { localStorage.removeItem(PENDING_EGG_KEY); } catch { /* storage unavailable */ }
  try { sessionStorage.removeItem(PENDING_PHOTO_KEY); } catch { /* storage unavailable */ }
}

export const IncubatorLab: React.FC<IncubatorLabProps> = ({
  activeEgg,
  onEggCreated,
  onEggClaimed,
  onClose
}) => {
  const [now, setNow] = useState<number>(Date.now());
  const [showChoicePanel, setShowChoicePanel] = useState(false);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isRefining, setIsRefining] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Chamber egg interactions
  const [isWobbling, setIsWobbling] = useState(false);
  const [hatchStep, setHatchStep] = useState<0 | 1 | 2 | 3>(0);
  const [isHatchedLocal, setIsHatchedLocal] = useState<boolean>(activeEgg?.isHatched || false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isSubmittingRef = useRef(false);
  const isMountedRef = useRef(true);
  const cameraSeq = useRef(0);
  const analysisJobSeq = useRef(0);

  const [isVideoReady, setIsVideoReady] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  // The player can keep Meta's name for the new creature or give it their own
  const [customName, setCustomName] = useState('');
  const [isNaming, setIsNaming] = useState(false);
  const triedNames = useRef<string[]>([]);
  useEffect(() => { setCustomName(''); triedNames.current = []; setClaimError(null); }, [activeEgg?.id]);

  // Intercept Escape key during egg analysis to prevent closing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isAnalyzing) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        stopCameraStream();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isAnalyzing, onClose]);

  // ✨ AI name: Muse Spark suggests a fresh name each tap and writes it in the box (Meta's first name if it can't)
  const handleAiName = async () => {
    if (!activeEgg || isNaming) return;
    const c = activeEgg.creature;
    setIsNaming(true);
    triedNames.current = [...new Set([c.name, customName.trim(), ...triedNames.current].filter(Boolean))];
    let suggestion: string | null = null;
    try {
      const start = await fetch('/api/fireworks/name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objectName: c.sourceObject?.name,
          material: c.sourceObject?.material,
          description: c.sourceObject?.description || c.title,
          colors: [c.appearance?.primaryColor, c.appearance?.secondaryColor, c.appearance?.accentColor].filter(Boolean).join(', '),
          element: [c.primaryElement, c.secondaryElement].filter(Boolean).join(' / '),
          ability: c.specialAbility ? c.specialAbility.name + ': ' + c.specialAbility.description : '',
          temperament: c.temperament,
          avoid: triedNames.current
        })
      });
      const started = await start.json();
      if (!start.ok || !started?.jobId) throw new Error(started?.error || 'Naming is busy. Please try again later.');
      const jobId = started.jobId;
      for (let i = 0; jobId && i < 30 && !suggestion; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        const job = await (await fetch('/api/fireworks/name/' + encodeURIComponent(jobId))).json();
        if (job?.status === 'done') suggestion = job.result?.name || null;
        else if (job?.status !== 'pending') throw new Error(job?.error || 'Naming was interrupted. Please try again.');
      }
    } catch (err: any) {
      setAnalysisError(err?.message || 'Naming was interrupted. Please try again.');
      suggestion = null;
    }
    setCustomName(suggestion || c.name);
    setIsNaming(false);
  };

  // A photo being turned into an egg is remembered until the egg exists, so a refresh or a closed tab mid-analysis
  // gives the Life Seed back and brings the photo back for another try (instead of losing both)
  useEffect(() => {
    let pending: { at: number; version?: number } | null = null;
    try { pending = JSON.parse(localStorage.getItem(PENDING_EGG_KEY) || 'null'); } catch { pending = null; }
    const reservation = walletBook.get().incubation;
    if (pending?.version === 2 && !reservation) { clearPendingEgg(); return; }
    if (reservation) pending = reservation;
    if (!pending) return;
    if (activeEgg && activeEgg.createdAt >= pending.at) { if (!reservation || walletBook.settleIncubation(reservation.id, false)) clearPendingEgg(); return; } // the egg was made just before the interruption
    if (!(reservation ? walletBook.settleIncubation(reservation.id, true) : walletBook.refundSeed())) { setAnalysisError("Free device space and reopen the incubator to recover your seed."); return; }
    let photo: string | null = null;
    try { photo = sessionStorage.getItem(PENDING_PHOTO_KEY); sessionStorage.removeItem(PENDING_PHOTO_KEY); } catch { photo = null; }
    clearPendingEgg();
    if (photo && !activeEgg) setPhotoPreviewUrl(photo);
    setAnalysisError('Your last photo was interrupted before its egg was made. Your ' + SEED_NAME + ' is back' + (photo && !activeEgg ? ': tap the button to try again.' : '.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Muse Image starts drawing the creature as soon as its egg exists (and again after a refresh), so the art
  // is usually ready by the time the 30-second timer ends instead of being started at the hatch
  useEffect(() => {
    const so = activeEgg?.creature?.sourceObject;
    const url = so?.spritePhotoUrl || so?.userPhotoUrl;
    if (!url) return;
    return watchPhotoSprite(url, so?.name || '', () => {});
  }, [activeEgg?.id]);

  // Sync isHatched when activeEgg changes
  useEffect(() => {
    if (activeEgg?.isHatched) {
      setIsHatchedLocal(true);
      setHatchStep(3);
    }
  }, [activeEgg?.isHatched]);

  // Clean up camera stream safely
  const stopCameraStream = useCallback(() => {
    cameraSeq.current++;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setIsVideoReady(false);
  }, []);

  // Stop camera stream and stop late permission streams whenever component unmounts
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopCameraStream();
    };
  }, [stopCameraStream]);

  // Attach stream AFTER <video> element is mounted in DOM
  useEffect(() => {
    if (isCameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [isCameraActive]);

  // Real-time ticking interval for absolute timestamp countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 500);

    return () => clearInterval(interval);
  }, []);

  // Calculate timing from absolute timestamps
  const createdAt = activeEgg?.createdAt || now;
  const hatchAt = activeEgg?.hatchAt || (now + INCUBATION_DURATION_SECONDS * 1000);
  const totalDurationMs = Math.max(1, hatchAt - createdAt);
  const remainingMs = Math.max(0, hatchAt - now);
  const elapsedMs = Math.min(totalDurationMs, Math.max(0, now - createdAt));
  const progressPercent = Math.min(100, Math.max(0, (elapsedMs / totalDurationMs) * 100));

  const isReadyToHatch = remainingMs === 0;

  // Format MM:SS
  const totalSecondsRemaining = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSecondsRemaining / 60);
  const seconds = totalSecondsRemaining % 60;
  const timerFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  // Camera activation (ONLY after user clicks)
  const handleStartCamera = async () => {
    setShowChoicePanel(false);
    setCameraError(null);
    setAnalysisError(null);
    setIsVideoReady(false);
    sound.playClick();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Camera API is not supported on this device. Please choose a photo file.');
      return;
    }

    const reqId = ++cameraSeq.current;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      // Stop late permission stream after close/unmount or sequence cancellation
      if (!isMountedRef.current || reqId !== cameraSeq.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      setIsCameraActive(true);
    } catch (err: any) {
      if (reqId !== cameraSeq.current) return;
      stopCameraStream();
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera access was not granted. You can choose a photo file instead!');
      } else {
        setCameraError('Unable to start camera. Please choose a photo file instead.');
      }
    }
  };

  // Capture frame from webcam
  const handleSnapPhoto = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
      setCameraError('Camera is still initializing. Please wait a moment.');
      return;
    }
    try {
      sound.playClick();
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const rawDataUrl = canvas.toDataURL('image/jpeg', 0.85);
        stopCameraStream();
        const { dataUrl } = await preparePhotoForUpload(rawDataUrl, { maxDimension: 1280, quality: 0.85 });
        setPhotoPreviewUrl(dataUrl);
      }
    } catch (err: any) {
      setCameraError(err?.message || 'Failed to capture frame from camera.');
    }
  };

  // Handle file picker upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setShowChoicePanel(false);
    setAnalysisError(null);
    setCameraError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    sound.playClick();
    try {
      // Shared compressor validates size, image format, and decodes before setting preview
      const { dataUrl } = await preparePhotoForUpload(file, { maxDimension: 1280, quality: 0.85 });
      setPhotoPreviewUrl(dataUrl);
    } catch (err: any) {
      setAnalysisError(err?.message || 'Failed to read image file.');
    } finally {
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  // Create egg via AI analysis of the photographed everyday item
  const handleCreateEgg = async () => {
    if (!photoPreviewUrl || isSubmittingRef.current || isAnalyzing) return;
    setAnalysisError(null);
    // Reserve Life Seed upfront; refunded immediately if analysis fails
    setIsRefining(false);
    const reservation = walletBook.beginIncubation();
    if (!reservation) {
      setAnalysisError('No ' + SEED_NAME + 's left! Finish a photo quest with one of your creatures to earn more ' + SEED_ICON);
      return;
    }
    isSubmittingRef.current = true;
    setIsAnalyzing(true);
    sound.playEggHum();
    markPendingEgg(photoPreviewUrl);
    const jobId = ++analysisJobSeq.current;

    try {
      // Pre-upload compress/validate image to ~1280px JPEG matching server limits
      const { dataUrl: uploadPhoto } = await preparePhotoForUpload(photoPreviewUrl, { maxDimension: 1280, quality: 0.85 });

      const result = await requestBasetenAnalysis({
        imageBase64: uploadPhoto
      }, () => setIsRefining(true));

      // Ignore late results if cancelled, unmounted, or superseded by a newer job
      if (!isMountedRef.current || jobId !== analysisJobSeq.current) {
        return;
      }

      // Check if active egg slot was occupied while awaiting response; never overwrite active egg
      if (loadActiveEggFromStorage()) {
        console.warn('Active egg slot occupied; ignoring late response to preserve active egg.');
        if (walletBook.settleIncubation(reservation.id, true)) clearPendingEgg();
        setIsAnalyzing(false);
        isSubmittingRef.current = false;
        return;
      }

      const extracted = result.dna;
      const thumbnail = await createCompressedThumbnail(uploadPhoto, 120, 0.7);
      // Sharper copy for tracing the creature's pixel sprite
      const spritePhoto = await createCompressedThumbnail(uploadPhoto, 384, 0.85);

      const creatureId = `oddling-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;
      const newCreature: CreatureDNA = {
        id: creatureId,
        name: extracted.name,
        speciesName: extracted.speciesName,
        title: extracted.title,
        primaryElement: extracted.primaryElement,
        secondaryElement: extracted.secondaryElement,
        temperament: extracted.temperament,
        provenance: 'ai_extracted',
        provenanceDetails: {
          provider: 'baseten',
          model: 'meta-models/muse-spark-open-1026',
          isLive: true,
          timestamp: Date.now(),
          sourceDescription: `Incubated from photographed everyday item (${extracted.material})`
        },
        specialAbility: extracted.specialAbility,
        sourceObject: {
          name: extracted.recognizedObject || extracted.name,
          category: extracted.visualPlan?.compositional?.category || 'Everyday Item',
          material: extracted.material,
          description: extracted.description,
          userPhotoUrl: thumbnail,
          spritePhotoUrl: spritePhoto
        },
        appearance: extracted.appearance,
        habitatPreference: extracted.primaryElement === 'Botanical' ? 'Sunlit Greenhouse' : 'Cozy Desk Studio',
        stats: {
          trust: 40,
          energy: 90,
          curiosity: 80,
          generation: 1
        },
        memories: [
          {
            timestamp: Date.now(),
            text: `Incubated from everyday ${extracted.material} item; awakened into a living ${extracted.name}!`,
            type: 'awaken'
          },
          ...(extracted.inheritedTraits || []).map((trait: string) => ({
            timestamp: Date.now(),
            text: `Inherent trait: ${trait}`,
            type: 'awaken' as const
          }))
        ],
        discoveredAt: Date.now()
      };

      const patterns: IncubatorEgg['pattern'][] = ['stripes', 'spots', 'zigzag', 'cosmic'];
      const pattern = patterns[Math.floor(Math.random() * patterns.length)];

      const eggId = `egg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const creationTimestamp = Date.now();
      const hatchTimestamp = creationTimestamp + (INCUBATION_DURATION_SECONDS * 1000);

      const newEgg: IncubatorEgg = {
        id: eggId,
        creature: newCreature,
        photoThumbnail: thumbnail,
        primaryColor: extracted.appearance.primaryColor,
        secondaryColor: extracted.appearance.secondaryColor,
        accentColor: extracted.appearance.accentColor,
        pattern,
        createdAt: creationTimestamp,
        hatchAt: hatchTimestamp,
        isHatched: false,
        isClaimed: false
      };

      if (walletBook.get().incubation?.id !== reservation.id) throw new Error("This incubation was already recovered.");
      if (!onEggCreated(newEgg)) throw new Error("Could not save the egg. Free device space and try again.");
      if (walletBook.settleIncubation(reservation.id, false)) clearPendingEgg();
      setPhotoPreviewUrl(null);
      setIsAnalyzing(false);
      isSubmittingRef.current = false;
      sound.playFanfare();
    } catch (err: any) {
      if (jobId !== analysisJobSeq.current) return;
      // Refund reserved Life Seed on failure and retain photo preview for user retry
      const refunded = walletBook.settleIncubation(reservation.id, true);
      if (refunded) clearPendingEgg();
      setIsAnalyzing(false);
      isSubmittingRef.current = false;
      sound.playBounce();
      const message = refunded
        ? 'We couldn’t make an egg from this photo. Your Life Seed is back. Try again when you’re ready.'
        : 'We couldn’t make an egg. Free device space and reopen the incubator to recover your Life Seed.';
      setAnalysisError(message);
    }
  };

  // Wiggle active egg on user click
  const handleWiggleEgg = () => {
    if (isWobbling || isHatchedLocal) return;
    setIsWobbling(true);
    sound.playEggWobble();
    setTimeout(() => setIsWobbling(false), 500);
  };

  // Hatch egg when ready
  const handleHatchEgg = () => {
    if (!activeEgg || !isReadyToHatch || isHatchedLocal) return;
    sound.playEggCrack();
    setHatchStep(1);

    setTimeout(() => {
      setHatchStep(2);
      sound.playEggCrack();
    }, 350);

    setTimeout(() => {
      setHatchStep(3);
      setIsHatchedLocal(true);
      sound.playFanfare();
    }, 750);
  };

  // Claim creature and bring to habitat (safely checks persistence success before closing)
  const handleClaim = () => {
    if (!activeEgg) return;
    setClaimError(null);
    const chosen = customName.replace(/\s+/g, ' ').trim().slice(0, 24);
    const eggToClaim = chosen ? { ...activeEgg, creature: { ...activeEgg.creature, name: chosen } } : activeEgg;
    const res = onEggClaimed(eggToClaim);
    if (res && res.success === false) {
      sound.playBounce();
      setClaimError(res.error || 'Failed to bring creature to habitat. Storage may be full.');
      return;
    }
    sound.playFanfare();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col p-4 md:p-6 overflow-y-auto select-none" onClick={(e) => { if (isAnalyzing) e.stopPropagation(); }}>
      {/* Top Header - Warm and Simple */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 shrink-0">
        <div>
          <h2 className="text-2xl font-bold font-['Space_Grotesk'] text-amber-300 tracking-tight flex items-center gap-2">
            <span>Incubator</span>
          </h2>
          <p className="text-xs text-slate-300 font-medium mt-0.5">
            A little life is hiding in your everyday things.
          </p>
        </div>

        <button
          onClick={() => {
            if (isAnalyzing) return;
            stopCameraStream();
            onClose();
          }}
          disabled={isAnalyzing}
          title={isAnalyzing ? 'Egg analysis in progress...' : 'Close incubator'}
          className="px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-slate-500 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 text-xs font-mono transition-colors cursor-pointer"
        >
          ESC / CLOSE ✕
        </button>
      </div>

      {/* Main Center Stage: Pixel-Art Incubator Machine */}
      <div className="egg-stage flex-1 flex flex-col items-center justify-center max-w-2xl w-full mx-auto my-auto py-2">
        {/* The 16-Bit Pixel-Art Machine (Shared across empty, incubating, and hatch states) */}
        <IncubatorMachine
          activeEgg={activeEgg}
          isReadyToHatch={isReadyToHatch}
          hatchStep={hatchStep}
          isHatchedLocal={isHatchedLocal}
          isWobbling={isWobbling}
          onMachineClick={() => {
            sound.playClick();
            setShowChoicePanel(true);
          }}
          onEggClick={isReadyToHatch ? handleHatchEgg : handleWiggleEgg}
          className="w-full max-w-sm sm:max-w-md"
        />

        {/* ================= STATE 1: EMPTY MACHINE CONTROLS ================= */}
        {!activeEgg && !photoPreviewUrl && !isCameraActive && (
          <div className="w-full max-w-sm flex flex-col items-center mt-3 space-y-2">
            {/* If choice panel is open: compact selection panel */}
            {showChoicePanel ? (
              <div className="w-full bg-slate-900/95 border border-amber-500/40 rounded-2xl p-4 shadow-2xl flex flex-col gap-2.5 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold text-amber-300 font-mono">
                    CHOOSE PHOTO SOURCE
                  </span>
                  <button
                    onClick={() => setShowChoicePanel(false)}
                    className="text-slate-400 hover:text-slate-200 text-xs font-mono"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleStartCamera}
                    className="py-3 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs font-mono flex items-center justify-center gap-1.5 transition-all shadow cursor-pointer"
                  >
                    <span>📷</span>
                    <span>Camera</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowChoicePanel(false);
                      fileInputRef.current?.click();
                    }}
                    className="py-3 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-xs font-mono flex items-center justify-center gap-1.5 border border-slate-700 transition-all cursor-pointer"
                  >
                    <span>📁</span>
                    <span>Choose File</span>
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 text-center font-mono">
                Click the glass chamber to photograph an everyday object.
              </p>
            )}
          </div>
        )}

        {/* ================= STATE 1B: LIVE CAMERA VIEWFINDER ================= */}
        {isCameraActive && (
          <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-3 shadow-2xl mt-3 flex flex-col items-center gap-3 animate-in fade-in duration-200">
            <div className="relative w-full aspect-[4/3] bg-black rounded-xl overflow-hidden border border-slate-800">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                onLoadedMetadata={() => setIsVideoReady(true)}
                onCanPlay={() => setIsVideoReady(true)}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-4 border border-dashed border-amber-400/50 rounded-lg pointer-events-none" />
            </div>

            <div className="w-full flex items-center justify-between gap-2">
              <button
                onClick={stopCameraStream}
                className="px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-mono border border-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSnapPhoto}
                disabled={!isVideoReady}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold text-xs font-mono shadow-md cursor-pointer"
              >
                {isVideoReady ? '📸 SNAP PHOTO' : '📷 WARMING UP...'}
              </button>
            </div>
          </div>
        )}

        {/* ================= STATE 1C: PHOTO PREVIEW & CREATE EGG ================= */}
        {photoPreviewUrl && (
          <div className="w-full max-w-sm bg-slate-900 border border-amber-500/40 rounded-2xl p-3.5 shadow-2xl mt-3 flex flex-col gap-3 animate-in fade-in duration-200">
            <div className="relative w-full aspect-[4/3] bg-black rounded-xl overflow-hidden border border-slate-800">
              <img
                src={photoPreviewUrl}
                alt="Selected item"
                className="w-full h-full object-contain"
              />
              {isAnalyzing && (
                <div className="absolute inset-0 bg-slate-950/70 flex flex-col items-center justify-center p-3 text-center">
                  <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mb-2" />
                  <span className="text-xs font-bold text-amber-300 font-mono">
                    {isRefining ? 'Refining your creature…' : 'Discovering life within...'}
                  </span>
                </div>
              )}
            </div>

            {analysisError && (
              <div className="p-2.5 rounded-xl bg-red-950/70 border border-red-500/50 text-red-300 text-xs">
                {analysisError}
              </div>
            )}

            <div className="flex gap-2">
              {!isAnalyzing && (
                <button
                  onClick={() => setPhotoPreviewUrl(null)}
                  className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono cursor-pointer"
                >
                  Retake
                </button>
              )}
              <button
                onClick={handleCreateEgg}
                disabled={isAnalyzing}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-pink-500 hover:from-amber-400 hover:to-pink-400 text-slate-950 font-bold text-xs font-mono tracking-wider shadow-lg transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isAnalyzing ? 'WARMING CHAMBER...' : 'CREATE EGG 🥚 · ' + SEED_ICON + ' ' + walletBook.get().seeds}
              </button>
            </div>
          </div>
        )}

        {/* Camera Error Notice */}
        {cameraError && (
          <div className="w-full max-w-sm mt-3 p-3 rounded-xl bg-red-950/80 border border-red-500/50 text-red-300 text-xs flex flex-col gap-2">
            <span>⚠️ {cameraError}</span>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="py-1 px-2.5 rounded bg-red-900 text-slate-100 font-mono text-xs w-fit"
            >
              📁 Choose File Instead
            </button>
          </div>
        )}

        {/* ================= STATE 2: ACTIVE INCUBATING EGG CONTROLS ================= */}
        {activeEgg && !isHatchedLocal && (
          <div className="w-full max-w-sm bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl mt-3 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase block">
                  Incubating
                </span>
                <span className="text-sm font-bold text-slate-100 font-['Space_Grotesk']">
                  {activeEgg.creature.sourceObject.name}
                </span>
              </div>

              {/* MM:SS Countdown */}
              <div className="text-right">
                <span className={`text-2xl font-mono font-bold tracking-widest tabular-nums ${
                  isReadyToHatch ? 'text-emerald-400 animate-pulse' : 'text-amber-400'
                }`}>
                  {isReadyToHatch ? 'READY! 🐣' : timerFormatted}
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Action CTA */}
            {isReadyToHatch ? (
              <button
                onClick={handleHatchEgg}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-400 via-pink-500 to-emerald-400 hover:from-amber-300 hover:to-emerald-300 text-slate-950 font-bold text-xs font-mono tracking-wider shadow-lg transition-transform hover:scale-[1.02] active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>🔨</span>
                <span>CRACK OPEN EGG! 🐣</span>
              </button>
            ) : (
              <div className="space-y-1.5">
                <button
                  onClick={handleWiggleEgg}
                  className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs font-mono border border-slate-700 transition-colors cursor-pointer"
                >
                  Warm Egg (Tap Glass)
                </button>
                <button
                  onClick={onClose}
                  className="w-full py-2 rounded-xl bg-slate-950 text-slate-400 hover:text-slate-200 text-[11px] font-mono transition-colors cursor-pointer"
                >
                  Return to Habitat (Incubates in Background) →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ================= STATE 3: HATCHED CELEBRATION & CLAIM ================= */}
        {activeEgg && isHatchedLocal && (
          <div className="w-full max-w-sm bg-slate-900/95 border border-amber-500/40 rounded-2xl p-4 shadow-2xl mt-3 flex flex-col gap-3.5 animate-in fade-in duration-300">
            <div className="text-center">
              <h3 className="text-lg font-bold font-['Space_Grotesk'] text-slate-100">
                {activeEgg.creature.name}
              </h3>
              <span className="text-xs font-mono text-cyan-300 italic block">
                {activeEgg.creature.speciesName}
              </span>
            </div>

            {/* Source Photo -> Monster Transformation */}
            <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 flex items-center justify-around gap-2">
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-lg overflow-hidden border border-slate-700 bg-slate-900 flex items-center justify-center">
                  {activeEgg.photoThumbnail ? (
                    <img
                      src={activeEgg.photoThumbnail}
                      alt="Origin"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xl">📸</span>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 font-mono mt-1">Origin Photo</span>
              </div>

              <span className="text-amber-400 font-bold">➔</span>

              <div className="flex flex-col items-center">
                <div className="w-12 h-12 flex items-center justify-center">
                  <OddlingAvatar
                    creature={activeEgg.creature}
                    size={48}
                    mood="excited"
                    showAura={false}
                  />
                </div>
                <span className="text-[10px] text-amber-300 font-mono font-bold mt-1">
                  Living Creature
                </span>
              </div>
            </div>

            {/* How the photo became this creature: object -> what it kept -> what it can do in the game */}
            {(() => {
              const reveal = deriveCreatureReveal(activeEgg.creature);
              return (
                <div className="text-[11px] text-slate-300 bg-slate-950/60 p-2.5 rounded-xl border border-amber-500/30 space-y-1">
                  <div className="font-bold text-amber-300">How your photo became {reveal.name}</div>
                  <div>📸 A {reveal.material.toLowerCase()} {reveal.objectName}</div>
                  <div>🧬 Kept: {reveal.inheritedTrait}</div>
                  <div>✨ In the game it can: {reveal.effectLabel}</div>
                </div>
              );
            })()}

            <div className="text-xs text-slate-300 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
              <span className="font-bold text-pink-300 block mb-0.5">
                Ability: {activeEgg.creature.specialAbility.name}
              </span>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {activeEgg.creature.specialAbility.description}
              </p>
            </div>

            {/* Name it yourself, or keep the name Meta Muse Spark gave it */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="oddling-name" className="text-[11px] font-mono text-amber-200">Name your Oddling</label>
              <div className="flex gap-2">
                <input
                  id="oddling-name"
                  value={customName}
                  maxLength={24}
                  onChange={(e) => setCustomName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleClaim(); }}
                  placeholder={activeEgg.creature.name}
                  className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 focus:border-amber-400 outline-none text-sm text-slate-100 placeholder:text-slate-500"
                />
                <button
                  type="button"
                  onClick={handleAiName}
                  disabled={isNaming}
                  title="Ask Meta Muse Spark for a new name"
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-cyan-200 whitespace-nowrap cursor-pointer"
                >
                  {isNaming ? '✨ Thinking…' : '✨ AI name'}
                </button>
              </div>
              <span className="text-[10px] text-slate-400">{customName.trim() ? 'It will be called ' + customName.trim().slice(0, 24) + '.' : 'Leave it empty to keep Meta\'s name: ' + activeEgg.creature.name + '.'}</span>
            </div>

            {claimError && (
              <div className="p-2.5 rounded-xl bg-red-950/80 border border-red-500/50 text-red-300 text-xs flex flex-col gap-2">
                <span>⚠️ {claimError}</span>
                <button
                  type="button"
                  onClick={handleClaim}
                  className="w-full py-2 rounded-lg bg-red-800 hover:bg-red-700 text-white font-mono text-xs font-bold transition-colors cursor-pointer"
                >
                  🔄 Retry Claim
                </button>
              </div>
            )}

            <button
              onClick={handleClaim}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-bold text-xs font-mono tracking-wider shadow-lg transition-transform hover:scale-[1.02] active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>🌿</span>
              <span>{claimError ? 'RETRY BRING TO HABITAT' : 'BRING TO HABITAT'}</span>
            </button>
          </div>
        )}

        {/* Permanent hidden native file input for CDP automation and native chooser */}
        <input
          ref={fileInputRef}
          id="incubator-file-input"
          data-testid="incubator-file-input"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileUpload}
          className="hidden"
          aria-label="Upload photo of everyday object"
        />
      </div>
    </div>
  );
};
