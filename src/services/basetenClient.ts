/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface BasetenStatus {
  provider: 'baseten';
  model: string;
  status: 'not_configured' | 'configured_unverified' | 'verified_live';
  hasKey: boolean;
  lastVerifiedAt: number | null;
  message: string;
}

export interface AnalyzeResult {
  success: boolean;
  dna: any;
  provenance: {
    provider: 'baseten';
    model: string;
    isLive: boolean;
    timestamp: number;
  };
}

export async function parseSafeJson<T>(res: Response, endpointDesc: string): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  const text = await res.text();

  // Detect HTML fallback from Vite SPA or static preview
  if (
    contentType.includes('text/html') ||
    text.trim().startsWith('<!doctype') ||
    text.trim().startsWith('<html') ||
    text.trim().startsWith('<')
  ) {
    // The server was briefly unreachable (restarting, or a busy moment) and a web page came back instead of data
    const err = new Error(`The game server is busy for a moment, so ${endpointDesc} could not finish. Nothing was used up: please try again.`);
    (err as any).transient = true;
    throw err;
  }

  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON response received for ${endpointDesc}.`);
  }

  if (!res.ok) {
    throw Object.assign(new Error(data?.error || `${endpointDesc} failed (HTTP ${res.status})`), { transient: res.status !== 429 && data?.retryable === true });
  }

  return data as T;
}

const STATUS_CACHE_KEY = 'oddlings_baseten_status_cache';

export function getCachedBasetenStatus(): BasetenStatus | null {
  try {
    if (typeof sessionStorage !== 'undefined') {
      const raw = sessionStorage.getItem(STATUS_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.status === 'string') return parsed;
      }
    }
  } catch {}
  return null;
}

export async function fetchBasetenStatus(): Promise<BasetenStatus> {
  try {
    const res = await fetch('/api/baseten/status');
    const contentType = res.headers.get('content-type') || '';
    const text = await res.text();

    if (
      contentType.includes('text/html') ||
      text.trim().startsWith('<!doctype') ||
      text.trim().startsWith('<html') ||
      text.trim().startsWith('<')
    ) {
      const fallback: BasetenStatus = {
        provider: 'baseten',
        model: 'meta-models/muse-spark-open-1026',
        status: 'not_configured',
        hasKey: false,
        lastVerifiedAt: null,
        message: 'Backend API unavailable in this preview runtime. Demo & Manual modes active.'
      };
      return fallback;
    }

    if (!res.ok) {
      throw new Error(`Server returned HTTP ${res.status}`);
    }

    const data: BasetenStatus = JSON.parse(text);
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(STATUS_CACHE_KEY, JSON.stringify(data));
      }
    } catch {}
    return data;
  } catch (err: any) {
    const fallback: BasetenStatus = {
      provider: 'baseten',
      model: 'meta-models/muse-spark-open-1026',
      status: 'not_configured',
      hasKey: false,
      lastVerifiedAt: null,
      message: err.message || 'Could not connect to backend server endpoint.'
    };
    return fallback;
  }
}

export interface FusionResult {
  success: boolean;
  hybridDna: any;
  provenance: {
    provider: 'baseten';
    model: string;
    isLive: boolean;
    timestamp: number;
  };
}

export async function requestBasetenAnalysis(params: {
  imageBase64: string;
  objectHint?: string;
  region?: { x: number; y: number; width: number; height: number };
}, onRefining?: () => void): Promise<AnalyzeResult> {
  // Muse Spark usually answers in 15-30 s; a request that hangs is given up after 140 s so the player can retry
  // A brief server hiccup is retried once by itself before the player sees an error
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 140_000);
  try {
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await fetch('/api/baseten/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...params, refining: attempt === 1 }),
          signal: controller.signal
        });
        const result = await parseSafeJson<AnalyzeResult>(res, 'Meta Muse Spark analysis');
        if (!result?.success || !result.dna?.name || !result.dna?.recognizedObject || !result.dna?.specialAbility?.name || !result.dna?.appearance) {
          throw Object.assign(new Error('Creature details were incomplete.'), { transient: true });
        }
        return result;
      } catch (err: any) {
        if (attempt > 0 || !err?.transient) throw err;
        onRefining?.();
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') throw new Error('Meta took too long to look at your photo. Nothing was used up: please try again.');
    if (err instanceof TypeError) throw new Error('Could not reach the game server. Check your connection and try again; nothing was used up.');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function requestBasetenFusion(params: {
  parentA: { name: string; element: string; ability: string; material: string; traits?: string[] };
  parentB: { name: string; element: string; ability: string; material: string; traits?: string[] };
}): Promise<FusionResult> {
  const res = await fetch('/api/baseten/fuse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });

  const data = await parseSafeJson<any>(res, 'Meta live fusion');
  return {
    success: data.success,
    hybridDna: data.hybridDna || data.dna,
    provenance: data.provenance
  };
}

