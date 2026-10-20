import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const distDir = path.join(rootDir, 'dist');
const nextDir = path.join(rootDir, '.next');
const standaloneDir = path.join(nextDir, 'standalone');
const standaloneDistDir = path.join(standaloneDir, 'dist');
const staticDir = path.join(nextDir, 'static');
const publicDir = path.join(rootDir, 'public');

if (!fs.existsSync(distDir)) {
  throw new Error(`Expected Vite build output at ${distDir}, but it was not found.`);
}

fs.rmSync(nextDir, { recursive: true, force: true });
fs.mkdirSync(standaloneDistDir, { recursive: true });
fs.mkdirSync(staticDir, { recursive: true });
fs.mkdirSync(publicDir, { recursive: true });

// Copy Vite frontend build into .next/standalone/dist
fs.cpSync(distDir, standaloneDistDir, { recursive: true });

// Ensure .next/static has a placeholder file
fs.writeFileSync(path.join(staticDir, '.keep'), '');

// Locate esbuild binary
const esbuildCandidates = [
  path.join(rootDir, 'node_modules', '@esbuild', 'linux-x64', 'bin', 'esbuild'),
  path.join(rootDir, 'node_modules', '.bin', 'esbuild'),
];
const esbuildBin = esbuildCandidates.find((candidate) => fs.existsSync(candidate)) ?? 'esbuild';

const banner = [
  "import { createRequire as __createRequire } from 'node:module';",
  'const require = __createRequire(import.meta.url);',
  "if (!process.env.NODE_ENV) { process.env.NODE_ENV = 'production'; }",
].join(' ');

execFileSync(
  esbuildBin,
  [
    path.join(rootDir, 'server', 'index.ts'),
    '--bundle',
    '--platform=node',
    '--target=node22',
    '--format=esm',
    '--external:vite',
    '--define:process.env.NODE_ENV="production"',
    `--banner:js=${banner}`,
    `--outfile=${path.join(standaloneDir, 'server.js')}`,
  ],
  { stdio: 'inherit' }
);

console.log('Standalone deployment artifact prepared in .next/standalone');
