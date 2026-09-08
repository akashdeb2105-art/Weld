/**
 * Copies the built deterministic sample game into frontend/public/sample-game
 * so the Next server can serve it through the sandboxed iframe route.
 * Safe to run repeatedly; no-op if the game hasn't been built yet (warns).
 *
 * Exported for the regression test (copy-sample-game.test.mjs); runs the copy
 * as a side effect only when invoked directly as a script.
 */

import { cpSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

// here === <repo>/frontend/scripts, so two hops reach the repo root.
// (Regression: this was `../../../` while the dir was apps/web/scripts; the
//  apps/ -> frontend/ rename in 2558a2d made it one hop too many, so the
//  script silently resolved a path outside the repo and never copied.)
export const SAMPLE_GAME_DIST = resolve(here, '..', '..', 'packages', 'sample-game', 'dist');
export const PUBLIC_DEST = resolve(here, '..', 'public', 'sample-game');

/**
 * @param {string} src  built sample-game dist directory
 * @param {string} dest destination inside frontend/public
 * @returns {boolean} true if the copy ran, false if src was missing
 */
export function copySampleGame(src = SAMPLE_GAME_DIST, dest = PUBLIC_DEST) {
  if (!existsSync(src)) {
    console.warn('[copy-sample-game] sample-game dist not found — run `npm run sample:build` first.');
    return false;
  }
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true });
  console.log('[copy-sample-game] copied', src, '->', dest);
  return true;
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  copySampleGame();
}
