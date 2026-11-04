/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { sound } from '../game/soundSynth';
import { 
  convertToLocalPixelArt, 

  checkServerPixelateStatus,
  PixelArtProcessResult 
} from '../game/pixelArtProcessor';
import { 
  saveCustomBiomeBackground, 
  upsertCustomBiomeRecord, 
  deleteCustomBiomeRecord,
  deleteCustomBiomeBackground,
  createStarterCustomWorld 
} from '../game/customBiomeStorage';
import { BiomeWorldState, CustomBiomeRecord } from '../game/biomeWorldTypes';
import { saveBiomeWorldToStorage, getStorageKey } from '../game/biomeWorld';
import { preparePhotoForUpload } from '../game/photoCompression';

// Pixel detail 0 means "draw it with Meta Muse Image" instead of shrinking the photo on the device
const META_DETAIL = 0;

/** Draws an image into a 640x360 game backdrop (cropped to fill) and a 160x90 thumbnail. */
function toBackdrop(src: string, brightness: number): Promise<{ background: string; thumb: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const draw = (w: number, h: number) => {
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas is not available.');
        ctx.imageSmoothingEnabled = false;
        ctx.filter = 'brightness(' + brightness + ')';
        const s = Math.max(w / img.width, h / img.height);
        const dw = img.width * s;
        const dh = img.height * s;
        ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
        return canvas.toDataURL('image/png');
      };
      try {
        resolve({ background: draw(640, 360), thumb: draw(160, 90) });
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('The drawing could not be opened.'));
    img.src = src;
  });
}



interface CreateBiomeModalProps {
  onClose: () => void;
  onBiomeCreated: (biomeId: string, world: BiomeWorldState) => void;
}

export const CreateBiomeModal: React.FC<CreateBiomeModalProps> = ({
  onClose,
  onBiomeCreated
}) => {
  const [detail, setDetail] = useState(160);
  const [brightness, setBrightness] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const requestId = useRef(0);
  const [biomeName, setBiomeName] = useState('Sunny City Sanctuary');
  const [originalPhotoUrl, setOriginalPhotoUrl] = useState<string | null>(null);
  const [pixelResult, setPixelResult] = useState<PixelArtProcessResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // The last Meta drawing, so changing brightness re-tints it instead of paying for a new drawing
  const metaDrawing = useRef<{ photo: string; image: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'upload' | 'camera' | 'sample'>('upload');
  
  // Server AI status tracker
  const [serverAiStatus, setServerAiStatus] = useState<{ configured: boolean; message: string }>({
    configured: false,
    message: 'Checking AI status...'
  });

  // Camera video stream refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!originalPhotoUrl) return;
    const timer = setTimeout(() => { processPhotoSource(originalPhotoUrl); }, 150);
    return () => clearTimeout(timer);
  }, [detail, brightness, originalPhotoUrl]);

  useEffect(() => {
    if (isCameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => setErrorMessage('Camera preview could not start. Try choosing a file.'));
    }
  }, [isCameraActive]);

  // Check server-side status on mount
  useEffect(() => {
    let mounted = true;
    checkServerPixelateStatus().then((st) => {
      if (mounted) {
        setServerAiStatus({ configured: st.configured, message: st.message });
      }
    });
    return () => {
      mounted = false;
      requestId.current++;
      stopCamera();
    };
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const startCamera = async () => {
    stopCamera();
    setErrorMessage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch (err: any) {
      console.warn('Camera access denied or unavailable:', err);
      setErrorMessage('Could not access camera. Please check camera permissions or upload an image file.');
      setIsCameraActive(false);
    }
  };

  const handleCaptureCamera = async () => {
    if (!videoRef.current) return;
    try {
      sound.playClick();
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 360;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const rawDataUrl = canvas.toDataURL('image/jpeg', 0.85);
      stopCamera();
      const prepared = await preparePhotoForUpload(rawDataUrl, { maxDimension: 1280, quality: 0.85 });
      processPhotoSource(prepared.dataUrl);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to capture frame from camera.');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setErrorMessage(null);
      const prepared = await preparePhotoForUpload(file, { maxDimension: 1280, quality: 0.85 });
      processPhotoSource(prepared.dataUrl);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Could not read that photo. Please choose it again.');
    } finally {
      e.target.value = ''; 
    }
  };

  const handleUseSamplePhoto = () => {
    sound.playClick();
    setErrorMessage(null);
    setBiomeName('Palm City Terrace');
    setOriginalPhotoUrl('/palm-city-original.webp');
  };
  const processPhotoSource = async (photoDataUrl: string) => {
    const request = ++requestId.current;
    setPixelResult(null);
    setOriginalPhotoUrl(photoDataUrl);
    setIsProcessing(true);
    setErrorMessage(null);

    if (photoDataUrl === '/palm-city-original.webp') {
      try {
        const { background, thumb } = await toBackdrop('/palm-city-meta.png', 1);
        if (request !== requestId.current) return;
        setPixelResult({ backgroundDataUrl: background, thumbnailDataUrl: thumb, generationMode: 'ai_generated', width: 640, height: 360 });
      } catch {
        if (request === requestId.current) setErrorMessage('The sample images could not load. Please try again.');
      } finally {
        if (request === requestId.current) setIsProcessing(false);
      }
      return;
    }

    if (detail === META_DETAIL) {
      // Meta Muse Image redraws the scene as pixel game scenery (about 30 seconds)
      try {
        const cached = metaDrawing.current?.photo === photoDataUrl ? metaDrawing.current.image : '';
        if (cached) {
          const { background, thumb } = await toBackdrop(cached, brightness);
          if (request !== requestId.current) return;
          setPixelResult({ backgroundDataUrl: background, thumbnailDataUrl: thumb, generationMode: 'ai_generated', width: 640, height: 360 });
          return;
        }
        const prepared = await preparePhotoForUpload(photoDataUrl, { maxDimension: 1280, quality: 0.85 });
        const imageBase64 = prepared.dataUrl;
        const start = await fetch('/api/meta/biome-art', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64, name: biomeName.trim() })
        }).then((r) => r.json()).catch(() => null);
        if (!start?.jobId) throw new Error(start?.error || 'Meta Muse Image is not available right now.');
        let image = '';
        for (let i = 0; i < 48 && !image; i++) {
          await new Promise((r) => setTimeout(r, 2500));
          if (request !== requestId.current) return;
          const job = await fetch('/api/meta/biome-art/' + start.jobId).then((r) => r.json()).catch(() => null);
          if (job?.status === 'error' || (job && job.status !== 'pending' && job.status !== 'done')) throw new Error(job.error || 'Meta Muse Image could not draw this one.');
          if (job?.status === 'done') image = job.result?.image || '';
        }
        if (!image) throw new Error('Meta Muse Image took too long.');
        metaDrawing.current = { photo: photoDataUrl, image };
        const { background, thumb } = await toBackdrop(image, brightness);
        if (request !== requestId.current) return;
        setPixelResult({ backgroundDataUrl: background, thumbnailDataUrl: thumb, generationMode: 'ai_generated', width: 640, height: 360 });
        sound.playBounce();
      } catch (err: any) {
        if (request !== requestId.current) return;
        setErrorMessage((err?.message || 'Meta Muse Image failed.') + ' You can pick Classic to use your photo\'s own pixels.');
      } finally {
        if (request === requestId.current) setIsProcessing(false);
      }
      return;
    }

    try {
      // Local 16-bit pixel art conversion (Canvas downsample + Sweetie/Retro color quantization)
      const result = await convertToLocalPixelArt(photoDataUrl, detail, Math.round(detail * 9 / 16), brightness);
      if (request !== requestId.current) return;
      setPixelResult(result);
      sound.playBounce();
    } catch (err: any) {
      console.error('Failed to convert photo to pixel art:', err);
      if (request !== requestId.current) return;
      setErrorMessage(err?.message || 'Failed to convert photo. Please try another image.');
    } finally {
      if (request === requestId.current) setIsProcessing(false);
    }
  };

  const handleSaveCustomBiome = async () => {
    if (isSaving || isProcessing) return;
    if (!pixelResult || !originalPhotoUrl) {
      setErrorMessage('Please select or capture a photo first.');
      return;
    }

    const trimmedName = biomeName.trim().slice(0, 32) || 'Custom Habitat';
    const biomeId = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    try {
      setIsSaving(true);
      sound.playPlaceTile();
      // 1. Save background assets into IndexedDB to protect localStorage quota
      const saved = await saveCustomBiomeBackground(biomeId, pixelResult.backgroundDataUrl, originalPhotoUrl);
      if (!saved) throw new Error('Could not save background.');

      // 2. Register custom biome record in manifest
      const record: CustomBiomeRecord = {
        id: biomeId,
        name: trimmedName,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        generationMode: pixelResult.generationMode,
        previewThumbnailUrl: pixelResult.thumbnailDataUrl,
        hideAtmosphere: true
      };
      const recordSaved = upsertCustomBiomeRecord(record);
      if (!recordSaved) {
        await deleteCustomBiomeBackground(biomeId);
        throw new Error('Could not save custom biome manifest.');
      }

      // 3. Create starter world layout with solid floor
      const starterWorld = createStarterCustomWorld(
        biomeId,
        trimmedName,
        pixelResult.backgroundDataUrl,
        pixelResult.generationMode
      );
      const worldSaved = saveBiomeWorldToStorage(starterWorld);
      if (!worldSaved) {
        deleteCustomBiomeRecord(biomeId);
        await deleteCustomBiomeBackground(biomeId);
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(getStorageKey(biomeId));
          }
        } catch {
          // ignore
        }
        throw new Error('Could not save world layout.');
      }

      // 4. Notify parent and switch to newly created world
      onBiomeCreated(biomeId, starterWorld);
      onClose();
    } catch (err: any) {
      console.error('Failed to save custom biome:', err);
      setIsSaving(false);
      setErrorMessage('Could not save this biome. Free some device space and try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        onKeyDown={(e) => { if (e.key === 'Escape' && !isSaving) { e.stopPropagation(); stopCamera(); onClose(); } }}
        onClick={(e) => e.stopPropagation()}
        role="dialog" aria-modal="true" aria-label="Create photo biome" className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden font-sans"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-2">
            <span className="text-xl">📸</span>
            <div>
              <h2 className="text-base font-bold font-['Space_Grotesk'] text-slate-100 flex items-center gap-2">
                <span>Create Custom Photo Biome</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800">
                  16-Bit Sandbox
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Turn your room, balcony, or street photo into an authentic living habitat
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              sound.playClick();
              stopCamera();
              onClose();
            }}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
            disabled={isSaving}
            title="Close (Esc)"
          >
            ✕
          </button>
        </div>

        <ol aria-label="Create biome steps" className="flex gap-3 px-5 pt-3 text-xs text-cyan-200">
          <li>1 · Choose photo</li><li className={!originalPhotoUrl ? 'opacity-40' : ''}>2 · Preview</li><li className={!pixelResult ? 'opacity-40' : ''}>3 · Name & save</li>
        </ol>
        <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" aria-label="Choose biome photo" onChange={handleFileChange} className="sr-only" />
        {/* Modal Content Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Biome Name Input */}
          <div>
            <label className="block text-xs font-mono font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
              Biome Name
            </label>
            <input
              type="text"
              aria-label="Biome name"
              value={biomeName}
              maxLength={32}
              onChange={(e) => setBiomeName(e.target.value)}
              placeholder="e.g. Sunny City Balcony"
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-sm font-medium focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all"
            />
          </div>

          {/* Source Selection Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
            <button
              onClick={() => {
                sound.playClick();
                stopCamera();
                setActiveTab('upload');
                fileInputRef.current?.click();
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                activeTab === 'upload'
                  ? 'bg-cyan-500 text-slate-950 shadow-md'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <span>📁</span>
              <span>Choose File</span>
            </button>
            <button
              onClick={() => {
                sound.playClick();
                setActiveTab('camera');
                startCamera();
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                activeTab === 'camera'
                  ? 'bg-cyan-500 text-slate-950 shadow-md'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <span>📷</span>
              <span>Camera</span>
            </button>
            <button
              onClick={() => {
                sound.playClick();
                stopCamera();
                setActiveTab('sample');
                handleUseSamplePhoto();
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                activeTab === 'sample'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <span>🌴</span>
              <span>Sample landscape</span>
            </button>
          </div>

          {/* Active Tab Panel */}
          {activeTab === 'upload' && !originalPhotoUrl && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 hover:border-cyan-400 rounded-xl p-6 text-center cursor-pointer transition-colors bg-slate-950/40 hover:bg-cyan-950/10"
            >

              <span className="text-3xl block mb-2">🖼️</span>
              <p className="text-sm font-semibold text-slate-200">
                Choose a photo (PNG, JPEG, WebP)
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Up to 8 MB. Local modes process 100% on this device; AI mode sends a compressed photo to generate scenery.
              </p>
            </div>
          )}

          {activeTab === 'camera' && (
            <div className="relative rounded-xl overflow-hidden bg-slate-950 border border-slate-800 aspect-video flex items-center justify-center">
              {isCameraActive ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-3 inset-x-0 flex justify-center">
                    <button
                      onClick={handleCaptureCamera}
                      className="px-4 py-2 rounded-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-mono shadow-xl flex items-center gap-2 cursor-pointer active:scale-95 transition-all"
                    >
                      <span>📸</span>
                      <span>Capture Photo</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center p-4">
                  <p className="text-xs text-slate-400 mb-3">Camera is stopped.</p>
                  <button
                    onClick={startCamera}
                    className="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-bold transition-all cursor-pointer"
                  >
                    Start Camera
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Error Message Toast */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-600 text-rose-200 text-xs font-mono flex items-center justify-between">
              <span>⚠️ {errorMessage}</span>
              <button 
                onClick={() => setErrorMessage(null)} 
                className="text-rose-400 hover:text-white ml-2 cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>
          )}

          {originalPhotoUrl && originalPhotoUrl !== '/palm-city-original.webp' && <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl bg-slate-950 p-3">
            <legend className="text-xs text-cyan-200 px-1">Tune your backdrop</legend>
            <label className="text-xs text-slate-300">Pixel detail
              <select aria-label="Pixel detail" value={detail} onChange={e => setDetail(Number(e.target.value))} className="block w-full bg-slate-800 p-2 rounded mt-1">
                <option value={96}>Chunky</option><option value={160}>Classic</option><option value={256}>Detailed</option>
                <option value={META_DETAIL}>✨ Meta Muse Image (AI pixel art)</option>
              </select>
            </label>
            <label className="text-xs text-slate-300">Brightness · {Math.round(brightness * 100)}%
              <input aria-label="Backdrop brightness" type="range" min="0.6" max="1.4" step="0.05" value={brightness} onChange={e => setBrightness(Number(e.target.value))} className="block w-full mt-3" />
            </label>
          </fieldset>}
          {/* Processing Spinner */}
          {isProcessing && (
            <div className="p-4 rounded-xl bg-slate-950/80 border border-cyan-500/50 text-center flex flex-col items-center gap-2 animate-pulse">
              <span className="text-2xl animate-spin">⚙️</span>
              <p className="text-xs font-mono text-cyan-300 font-semibold">
                {detail === META_DETAIL ? 'Meta Muse Image is painting your backdrop…' : 'Making your pixel backdrop…'}
              </p>
            </div>
          )}

          {/* Dual Previews: Photo & 16-Bit Pixel Art Output */}
          {pixelResult && originalPhotoUrl && !isProcessing && (
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
                  PREVIEWS:
                </span>
                {/* Generation Mode Badge */}
                <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-600/60 font-semibold flex items-center gap-1">
                  <span>{pixelResult.generationMode === 'ai_generated' ? '✨' : '⚡'}</span>
                  <span>{pixelResult.generationMode === 'ai_generated' ? 'Drawn by Meta Muse Image' : 'Local photo pixel conversion'}</span>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Original Photo Preview */}
                <div className="rounded-xl overflow-hidden bg-slate-950 border border-slate-800 p-2">
                  <div className="text-[10px] font-mono text-slate-400 mb-1 flex items-center justify-between">
                    <span>ORIGINAL PHOTO</span>
                    <span>Source</span>
                  </div>
                  <div className="aspect-video w-full rounded-lg overflow-hidden bg-slate-900">
                    <img
                      src={originalPhotoUrl}
                      alt="Original user photo"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>

                {/* 16-Bit Pixel Art Result Preview */}
                <div className="rounded-xl overflow-hidden bg-slate-950 border border-cyan-600/60 p-2 shadow-lg shadow-cyan-950/30">
                  <div className="text-[10px] font-mono text-cyan-300 mb-1 flex items-center justify-between font-bold">
                    <span>{pixelResult.generationMode === 'ai_generated' ? 'META PIXEL BACKDROP' : '16-BIT PIXEL BACKDROP'}</span>
                    <span>640x360</span>
                  </div>
                  <div className="aspect-video w-full rounded-lg overflow-hidden bg-slate-900 border border-cyan-500/30">
                    <img
                      src={pixelResult.backgroundDataUrl}
                      alt="Pixel art backdrop"
                      className="w-full h-full object-cover"
                      style={{ imageRendering: 'pixelated' }}
                    />
                  </div>
                </div>
              </div>

              {/* Status Note */}
              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-[11px] font-mono text-slate-400 flex items-start gap-2">
                <span className="text-cyan-400 text-sm">ℹ️</span>
                <div>
                  <span className="text-slate-200 font-semibold">Ready to build! </span>
                  Your backdrop stays saved on this device. Build ground and platforms over the scenery for your Oddlings to walk on.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-800 bg-slate-950/70">
          <button
            disabled={isSaving}
            onClick={() => {
              sound.playClick();
              stopCamera();
              onClose();
            }}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono font-bold transition-all cursor-pointer"
          >
            Cancel
          </button>

          <button
            disabled={!pixelResult || isProcessing || isSaving}
            onClick={handleSaveCustomBiome}
            className={`px-5 py-2 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5 shadow-md ${
              pixelResult && !isProcessing
                ? 'bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 font-extrabold hover:brightness-110 active:scale-95 cursor-pointer'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/60'
            }`}
          >
            <span>✨</span>
            <span>{isSaving ? 'Saving…' : 'Save & Open Biome'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
