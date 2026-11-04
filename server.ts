/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { 
  getBasetenStatus, 
  analyzeObjectWithBaseten, 
  fuseCreaturesWithBaseten 
} from './server/basetenService';
import { generateCreatureVoice, sanitizeVoiceInput } from './server/voiceService';
import { generateItemFromPhoto } from './server/itemService';
import { buildBiomeArtPrompt, buildFusionArtPrompt, buildItemArtPrompt, drawCreatureWithMuseImage, getSharedJob as getJob, metaModelApiKey, sanitizeSpriteReview, startSharedJob as startJob, startSharedSpriteReview as startSpriteReview, reserveAi, aiRequestLease, AI_BUSY_MESSAGE } from './server/spriteService';
import { normalizeImageUrl } from './server/itemService';
import fs from 'node:fs';
import { banterBetweenCreatures, chatWithCreature, checkQuestPhoto, sanitizeBanterInput, sanitizeChatInput, sanitizeQuestInput, suggestCreatureName, FIREWORKS_MUSE_SPARK_MODEL } from './server/chatService';

dotenv.config();

const asyncRoute = (handler: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: express.NextFunction) => { void handler(req, res).catch(next); };


const app = express();
// Cloud Run appends the actual visitor address as the closest forwarded hop.
app.set('trust proxy', 1);
const portArgIndex = process.argv.indexOf('--port');
const portFromArg = portArgIndex !== -1 ? parseInt(process.argv[portArgIndex + 1], 10) : NaN;
const PORT = !isNaN(portFromArg) ? portFromArg : (process.env.PORT ? parseInt(process.env.PORT, 10) : 3000);

// Body parser with 10MB limit for base64 camera/upload images
app.use(express.json({ limit: '10mb' }));

// Per-player limits on paid model calls, so a public link cannot drain the Meta and Fireworks credits.
// Counted per visitor address in memory; a restart clears them.
const recentCalls = new Map<string, number[]>();
function perPlayerLimit(name: string, max: number, windowMs: number) {
  return (req: Request, res: Response, next: () => void) => {
    if (req.method !== 'POST') return next();
    const key = name + ':' + (req.ip || req.socket.remoteAddress || 'unknown');
    const now = Date.now();
    const calls = (recentCalls.get(key) || []).filter((t) => now - t < windowMs);
    if (calls.length >= max) {
      res.status(429).json({ error: 'Slow down a little! Your creatures need a short rest. Try again in a few minutes.' });
      return;
    }
    calls.push(now);
    recentCalls.set(key, calls);
    next();
  };
}
app.use('/api/fireworks', perPlayerLimit('fireworks', 40, 10 * 60_000));
app.use('/api/meta/creature-art', perPlayerLimit('creature-art', 10, 60 * 60_000));
app.use('/api/meta/fusion-art', perPlayerLimit('fusion-art', 10, 60 * 60_000));
app.use('/api/meta/biome-art', perPlayerLimit('biome-art', 6, 60 * 60_000));

// Reserve before any model work. Failed attempts remain reserved conservatively.
app.use('/api', async (req: Request, res: Response, next: () => void) => {
  if (req.method !== 'POST' || !/^\/(baseten|fireworks|meta)\//.test(req.path)) return next();
  try {
    const release = await reserveAi(req.path.startsWith('/meta/') ? 'image' : 'text');
    const lease = { release, background: false };
    res.once('finish', () => { if (!lease.background) release(); });
    const sendJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      if (!lease.background) release();
      return sendJson(body);
    }) as typeof res.json;
    // Keep synchronous calls reserved even when the visitor disconnects.
    aiRequestLease.run(lease, next);
  } catch {
    res.setHeader('Retry-After', '60');
    res.status(429).json({ status: 'error', error: AI_BUSY_MESSAGE, retryable: true });
  }
});

// Favicon handler
app.get('/favicon.ico', (_req: Request, res: Response) => {
  res.status(204).end();
});

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Baseten Meta Model Status endpoint
app.get('/api/baseten/status', (_req: Request, res: Response) => {
  try {
    const status = getBasetenStatus();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to get provider status' });
  }
});

// Analyze object with Meta Muse Spark Open via Baseten
app.post('/api/baseten/analyze', async (req: Request, res: Response) => {
  try {
    const { imageBase64, objectHint, region } = req.body || {};
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      res.status(400).json({ error: 'Missing required imageBase64 payload.' });
      return;
    }

    const dna = await analyzeObjectWithBaseten({
      imageBase64,
      objectHint: typeof objectHint === 'string' ? objectHint : undefined,
      region
    });

    res.json({
      success: true,
      dna,
      provenance: {
        provider: 'baseten',
        model: 'meta-models/muse-spark-open-1026',
        isLive: true,
        timestamp: Date.now()
      }
    });
  } catch (err: any) {
    const status = err.status || 500;
    res.status(status).json({
      error: err.message || 'Failed to analyze object with Meta Muse Spark.'
    });
  }
});

// Live Fusion synthesis with Meta Muse Spark Open via Baseten
app.post('/api/baseten/fuse', async (req: Request, res: Response) => {
  try {
    const { parentA, parentB } = req.body || {};
    if (!parentA || !parentB) {
      res.status(400).json({ error: 'Missing required parentA and parentB specs.' });
      return;
    }

    const hybridDna = await fuseCreaturesWithBaseten({ parentA, parentB });

    res.json({
      success: true,
      hybridDna,
      provenance: {
        provider: 'baseten',
        model: 'meta-models/muse-spark-open-1026',
        isLive: true,
        timestamp: Date.now()
      }
    });
  } catch (err: any) {
    const status = err.status || 500;
    res.status(status).json({
      error: err.message || 'Failed live fusion with Meta Muse Spark.'
    });
  }
});

// Creature diary entries and speech lines written by Meta Muse Spark Open via Baseten
app.post('/api/baseten/voice', async (req: Request, res: Response) => {
  try {
    const input = sanitizeVoiceInput(req.body);
    if (!input) {
      res.status(400).json({ error: 'Invalid creature voice request.' });
      return;
    }
    const out = await generateCreatureVoice(input);
    res.json({
      success: true,
      ...out,
      provenance: {
        provider: 'baseten',
        model: 'meta-models/muse-spark-open-1026',
        isLive: true,
        timestamp: Date.now()
      }
    });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message || 'Failed creature voice with Meta Muse Spark.' });
  }
});

// Photo-made pixel item designed by Meta Muse Spark Open via Baseten
app.post('/api/baseten/item', async (req: Request, res: Response) => {
  try {
    const { imageBase64, objectHint } = req.body || {};
    const item = await generateItemFromPhoto({ imageBase64, objectHint: typeof objectHint === 'string' ? objectHint : undefined });
    res.json({
      success: true,
      item,
      provenance: {
        provider: 'baseten',
        model: 'meta-models/muse-spark-open-1026',
        isLive: true,
        timestamp: Date.now()
      }
    });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message || 'Failed to create item with Meta Muse Spark.' });
  }
});

// Muse Spark reviews a creature sprite traced from the player's photo. The review runs
// in the background and the client checks on it, since it can take longer than the
// hosting proxy lets one request wait.
app.post('/api/baseten/sprite', asyncRoute(async (req: Request, res: Response) => {
  const input = sanitizeSpriteReview(req.body);
  if (!input) {
    res.status(400).json({ error: 'Invalid sprite review request.' });
    return;
  }
  res.json({ success: true, jobId: await startSpriteReview(input) });
}));

app.get('/api/baseten/sprite/:id', asyncRoute(async (req: Request, res: Response) => {
  const job = await getJob(String(req.params.id));
  if (!job) {
    res.status(404).json({ error: 'Unknown sprite review.' });
    return;
  }
  res.json({
    status: job.status,
    result: job.result,
    error: job.error,
    provenance: { provider: 'baseten', model: 'meta-models/muse-spark-open-1026', isLive: true, timestamp: Date.now() }
  });
}));

// Meta Muse Image draws the creature's art from the player's photo (Meta Model API).
// Runs as a background job the client checks on, like the sprite review.
// Muse Image drawings are capped at what the free Meta credits cover ($150 at about $0.01 each).
// The count is kept in a file so it survives server restarts.
const MUSE_IMAGE_LIMIT = 15000;
const MUSE_USAGE_FILE = path.join(process.cwd(), 'meta-usage.json');
function museImagesUsed(): number {
  try {
    const n = JSON.parse(fs.readFileSync(MUSE_USAGE_FILE, 'utf8'))?.images;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}
function countMuseImage(): void {
  try {
    fs.writeFileSync(MUSE_USAGE_FILE, JSON.stringify({ images: museImagesUsed() + 1 }));
  } catch {
    // A failed write only loses one count
  }
}

app.post('/api/meta/creature-art', asyncRoute(async (req: Request, res: Response) => {
  if (!metaModelApiKey()) {
    res.status(503).json({ error: 'META_API_KEY is not configured in server environment.' });
    return;
  }
  const imageUrl = normalizeImageUrl(req.body?.imageBase64);
  if (!imageUrl) {
    res.status(400).json({ error: 'A PNG, JPEG or WebP photo under 3 MB is required.' });
    return;
  }
  const objectName = typeof req.body?.objectName === 'string' ? req.body.objectName : '';
  const colors = Array.isArray(req.body?.colors) ? req.body.colors.filter((c: unknown) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c)).slice(0, 8) : [];
  if (museImagesUsed() >= MUSE_IMAGE_LIMIT) {
    res.status(429).json({ error: 'The creature drawing limit has been reached.' });
    return;
  }
  countMuseImage();
  // kind 'item' draws a placeable photo item instead of a creature
  const prompt = req.body?.kind === 'item' ? buildItemArtPrompt(objectName, colors) : undefined;
  res.json({ success: true, jobId: await startJob(() => drawCreatureWithMuseImage({ imageUrl, objectName, colors, prompt })) });
}));

// Fusion Lab: Muse Image draws the hybrid from both parents' pictures (counts toward the same drawing cap)
app.post('/api/meta/fusion-art', asyncRoute(async (req: Request, res: Response) => {
  if (!metaModelApiKey()) {
    res.status(503).json({ error: 'META_API_KEY is not configured in server environment.' });
    return;
  }
  const imageA = normalizeImageUrl(req.body?.imageA);
  const imageB = normalizeImageUrl(req.body?.imageB);
  if (!imageA || !imageB) {
    res.status(400).json({ error: 'Two parent pictures (PNG, JPEG or WebP under 3 MB) are required.' });
    return;
  }
  if (museImagesUsed() >= MUSE_IMAGE_LIMIT) {
    res.status(429).json({ error: 'The creature drawing limit has been reached.' });
    return;
  }
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const traits = Array.isArray(req.body?.traits) ? req.body.traits.filter((x: unknown) => typeof x === 'string') : [];
  countMuseImage();
  const prompt = buildFusionArtPrompt(str(req.body?.nameA), str(req.body?.nameB), str(req.body?.hybridName), traits);
  res.json({ success: true, jobId: await startJob(() => drawCreatureWithMuseImage({ imageUrl: imageA, extraImageUrls: [imageB], objectName: str(req.body?.hybridName), prompt })) });
}));

app.get('/api/meta/fusion-art/:id', asyncRoute(async (req: Request, res: Response) => {
  const job = await getJob(String(req.params.id));
  if (!job) {
    res.status(404).json({ error: 'Unknown fusion art request.' });
    return;
  }
  res.json({ status: job.status, result: job.result, error: job.error, provenance: { provider: 'meta', model: 'muse-image-1.0', isLive: true, timestamp: Date.now() } });
}));

// Which Meta model keys are set (true/false only, never the keys), for the title screen
app.get('/api/meta/status', (_req: Request, res: Response) => {
  res.json({
    museImage: !!metaModelApiKey(),
    fireworks: !!(process.env.FIREWORKS_API_KEY || '').trim(),
    fireworksModel: FIREWORKS_MUSE_SPARK_MODEL
  });
});

// Biome backdrops: Muse Image redraws the player's photo as pixel game scenery (same drawing cap as creatures)
app.post('/api/meta/biome-art', asyncRoute(async (req: Request, res: Response) => {
  if (!metaModelApiKey()) {
    res.status(503).json({ error: 'META_API_KEY is not configured in server environment.' });
    return;
  }
  const imageUrl = normalizeImageUrl(req.body?.imageBase64);
  if (!imageUrl) {
    res.status(400).json({ error: 'A PNG, JPEG or WebP photo under 3 MB is required.' });
    return;
  }
  if (museImagesUsed() >= MUSE_IMAGE_LIMIT) {
    res.status(429).json({ error: 'The drawing limit has been reached.' });
    return;
  }
  countMuseImage();
  const name = typeof req.body?.name === 'string' ? req.body.name : '';
  res.json({ success: true, jobId: await startJob(() => drawCreatureWithMuseImage({ imageUrl, objectName: name, prompt: buildBiomeArtPrompt(name) })) });
}));

app.get('/api/meta/biome-art/:id', asyncRoute(async (req: Request, res: Response) => {
  const job = await getJob(String(req.params.id));
  if (!job) {
    res.status(404).json({ error: 'Unknown backdrop request.' });
    return;
  }
  res.json({ status: job.status, result: job.result, error: job.error });
}));

app.get('/api/meta/creature-art/:id', asyncRoute(async (req: Request, res: Response) => {
  const job = await getJob(String(req.params.id));
  if (!job) {
    res.status(404).json({ error: 'Unknown creature art request.' });
    return;
  }
  res.json({
    status: job.status,
    result: job.result,
    error: job.error,
    provenance: { provider: 'meta', model: 'muse-image-1.0', isLive: true, timestamp: Date.now() }
  });
}));

// Live chat with a creature: Muse Spark on Fireworks, run as a background job like the sprite review.
// Incubator: Muse Spark suggests a name for a newly hatched creature
app.post('/api/fireworks/name', asyncRoute(async (req: Request, res: Response) => {
  res.json({ success: true, jobId: await startJob(() => suggestCreatureName(req.body)) });
}));

app.get('/api/fireworks/name/:id', asyncRoute(async (req: Request, res: Response) => {
  const job = await getJob(String(req.params.id));
  if (!job) {
    res.status(404).json({ error: 'Unknown name request.' });
    return;
  }
  res.json({ status: job.status, result: job.result, error: job.error });
}));

app.post('/api/fireworks/chat', asyncRoute(async (req: Request, res: Response) => {
  const input = sanitizeChatInput(req.body);
  if (!input) {
    res.status(400).json({ error: 'A creature and a message are required.' });
    return;
  }
  res.json({ success: true, jobId: await startJob(() => chatWithCreature(input)) });
}));

app.get('/api/fireworks/chat/:id', asyncRoute(async (req: Request, res: Response) => {
  const job = await getJob(String(req.params.id));
  if (!job) {
    res.status(404).json({ error: 'Unknown chat request.' });
    return;
  }
  res.json({ status: job.status, result: job.result, error: job.error });
}));

// Two creatures talking to each other: friends or rivals by material, written by Muse Spark on Fireworks.
app.post('/api/fireworks/banter', asyncRoute(async (req: Request, res: Response) => {
  const input = sanitizeBanterInput(req.body);
  if (!input) {
    res.status(400).json({ error: 'Two creatures are required.' });
    return;
  }
  res.json({ success: true, jobId: await startJob(() => banterBetweenCreatures(input)) });
}));

app.get('/api/fireworks/banter/:id', asyncRoute(async (req: Request, res: Response) => {
  const job = await getJob(String(req.params.id));
  if (!job) {
    res.status(404).json({ error: 'Unknown banter request.' });
    return;
  }
  res.json({ status: job.status, result: job.result, error: job.error });
}));

// Photo quests: Muse Spark on Fireworks checks the player's photo against what the creature asked for.
app.post('/api/fireworks/quest', asyncRoute(async (req: Request, res: Response) => {
  const input = sanitizeQuestInput(req.body);
  if (!input) {
    res.status(400).json({ error: 'A quest, a photo under 3 MB and a creature are required.' });
    return;
  }
  res.json({ success: true, jobId: await startJob(() => checkQuestPhoto(input)) });
}));

app.get('/api/fireworks/quest/:id', asyncRoute(async (req: Request, res: Response) => {
  const job = await getJob(String(req.params.id));
  if (!job) {
    res.status(404).json({ error: 'Unknown quest check.' });
    return;
  }
  res.json({ status: job.status, result: job.result, error: job.error });
}));

// Local conversion is implemented; no image-generation provider is connected.
app.get('/api/pixelate/status', (_req: Request, res: Response) => {
  res.json({ configured: false, provider: 'none', message: 'AI background generation is not connected. Photo pixel conversion runs locally on your device.' });
});
app.post('/api/pixelate/generate', (_req: Request, res: Response) => {
  res.status(503).json({ success: false, reason: 'image_provider_unconfigured', error: 'AI background generation is not connected. Use local photo pixel conversion.' });
});

// Main dev / prod mounting
app.use((err: unknown, _req: Request, res: Response, next: express.NextFunction) => {
  if (res.headersSent) return next(err);
  res.status(503).json({ status: 'error', error: AI_BUSY_MESSAGE, retryable: true });
});

async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    // Mount Vite dev server middlewares
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    // Static production build serving
    const distPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'dist');
    // Only serve precompressed build assets; never touch API responses.
    app.get('/assets/*', (req, res, next) => {
      res.vary('Accept-Encoding');
      if (!req.acceptsEncodings('gzip')) return next();
      const relative = req.path.slice('/assets/'.length);
      const file = path.resolve(distPath, 'assets', relative);
      if (!file.startsWith(path.resolve(distPath, 'assets') + path.sep) || !/\.(js|css)$/.test(file) || !fs.existsSync(file + '.gz')) return next();
      res.type(path.extname(file)).set('Content-Encoding', 'gzip');
      res.sendFile(file + '.gz');
    });
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[ODDLINGS] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[ODDLINGS] Failed to start server:', err);
  process.exit(1);
});
