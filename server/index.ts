import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { getDb } from './db/connection.ts';
import { createApp } from './app.ts';

function loadDotEnvIfPresent(): void {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

async function startServer() {
  loadDotEnvIfPresent();

  // Initialize SQLite database (runs versioned migrations + idempotent seed)
  getDb();

  const app = createApp();
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : undefined,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const cwdDist = path.resolve(process.cwd(), 'dist');
    const dirDist = path.resolve(import.meta.dirname, 'dist');
    const distPath = fs.existsSync(cwdDist) ? cwdDist : dirDist;
    app.use(express.static(distPath));
    app.get(/.*/, (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Server reads HOST (default 127.0.0.1 in local dev; 0.0.0.0 in production / Cloud Run) and PORT (default 3000) from env
  const defaultHost = isProd || process.env.K_SERVICE || process.env.CLOUD_RUN_JOB ? '0.0.0.0' : '127.0.0.1';
  const host = process.env.HOST || defaultHost;
  const port = Number(process.env.PORT || 3000);

  app.listen(port, host, () => {
    console.log(`Semester 3 – Productive App running at http://${host}:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
