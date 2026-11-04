import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import type { IncomingMessage } from 'http';
import { defineConfig, Plugin } from 'vite';
import { 
  getBasetenStatus, 
  fuseCreaturesWithBaseten, 
  analyzeObjectWithBaseten 
} from './server/basetenService';

function parseRequestBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 10 * 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

function basetenFallbackPlugin(): Plugin {
  const handler = async (req: IncomingMessage, res: any, next: () => void) => {
    const url = req.url?.split('?')[0];

    if (url === '/favicon.ico') {
      res.statusCode = 204;
      res.end();
      return;
    }

    if (url === '/api/baseten/status') {
      try {
        const status = getBasetenStatus();
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        res.end(JSON.stringify(status));
      } catch (err: any) {
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 500;
        res.end(JSON.stringify({ error: err.message || 'Failed to get provider status' }));
      }
      return;
    }

    if (url === '/api/baseten/fuse' && req.method === 'POST') {
      try {
        const body = await parseRequestBody(req);
        const { parentA, parentB } = body || {};
        if (!parentA || !parentB) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Missing required parentA and parentB specs.' }));
          return;
        }

        const hybridDna = await fuseCreaturesWithBaseten({ parentA, parentB });
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        res.end(JSON.stringify({
          success: true,
          hybridDna,
          provenance: {
            provider: 'baseten',
            model: 'meta-models/muse-spark-open-1026',
            isLive: true,
            timestamp: Date.now()
          }
        }));
      } catch (err: any) {
        const status = err.status || 500;
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = status;
        res.end(JSON.stringify({
          error: err.message || 'Failed live fusion with Meta Muse Spark.'
        }));
      }
      return;
    }

    if (url === '/api/baseten/analyze' && req.method === 'POST') {
      try {
        const body = await parseRequestBody(req);
        const { imageBase64, objectHint, region } = body || {};
        if (!imageBase64 || typeof imageBase64 !== 'string') {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Missing required imageBase64 payload.' }));
          return;
        }

        const dna = await analyzeObjectWithBaseten({
          imageBase64,
          objectHint: typeof objectHint === 'string' ? objectHint : undefined,
          region
        });

        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        res.end(JSON.stringify({
          success: true,
          dna,
          provenance: {
            provider: 'baseten',
            model: 'meta-models/muse-spark-open-1026',
            isLive: true,
            timestamp: Date.now()
          }
        }));
      } catch (err: any) {
        const status = err.status || 500;
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = status;
        res.end(JSON.stringify({
          error: err.message || 'Failed to analyze object with Meta Muse Spark.'
        }));
      }
      return;
    }

    next();
  };

  return {
    name: 'baseten-fallback-api',
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    }
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), basetenFallbackPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

