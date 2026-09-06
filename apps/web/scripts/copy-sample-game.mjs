/**
 * Copies the built deterministic sample game into apps/web/public/sample-game
 * so the Next server can serve it through the sandboxed iframe route.
 * Safe to run repeatedly; no-op if the game hasn't been built yet (warns).
 */

import { cpSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', '..', '..', 'packages', 'sample-game', 'dist');
const dest = join(here, '..', 'public', 'sample-game');

if (!existsSync(src)) {
  console.warn('[copy-sample-game] sample-game dist not found — run `npm run sample:build` first.');
  process.exit(0);
}

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log('[copy-sample-game] copied', src, '->', dest);
