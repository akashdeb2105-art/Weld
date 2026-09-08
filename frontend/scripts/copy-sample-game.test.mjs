// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SAMPLE_GAME_DIST, PUBLIC_DEST, copySampleGame } from './copy-sample-game.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const scratch = [];

afterEach(() => {
  while (scratch.length) rmSync(scratch.pop(), { recursive: true, force: true });
});

describe('copy-sample-game default paths', () => {
  it('resolves the dist source inside the repo (regression for the apps/->frontend/ rename)', () => {
    // The bug: an extra `..` pointed this at <parent-of-repo>/packages/... which
    // never exists, so the copy silently no-opped on every build and e2e run.
    expect(SAMPLE_GAME_DIST).toBe(join(repoRoot, 'packages', 'sample-game', 'dist'));
    expect(existsSync(dirname(SAMPLE_GAME_DIST))).toBe(true); // packages/sample-game/ exists
  });

  it('targets frontend/public/sample-game as the destination', () => {
    expect(PUBLIC_DEST).toBe(join(repoRoot, 'frontend', 'public', 'sample-game'));
  });
});

describe('copySampleGame behaviour', () => {
  it('copies a built dist tree into the destination', () => {
    const base = mkdtempSync(join(tmpdir(), 'weld-copy-'));
    scratch.push(base);
    const src = join(base, 'dist');
    const dest = join(base, 'public', 'sample-game');
    mkdirSync(join(src, 'assets'), { recursive: true });
    writeFileSync(join(src, 'index.html'), '<!doctype html><title>Scrap Sprint</title>');
    writeFileSync(join(src, 'assets', 'index-abc123.js'), 'console.log("game")');

    const ran = copySampleGame(src, dest);

    expect(ran).toBe(true);
    expect(existsSync(join(dest, 'index.html'))).toBe(true);
    expect(existsSync(join(dest, 'assets', 'index-abc123.js'))).toBe(true);
  });

  it('replaces stale contents rather than merging them', () => {
    const base = mkdtempSync(join(tmpdir(), 'weld-copy-'));
    scratch.push(base);
    const src = join(base, 'dist');
    const dest = join(base, 'public', 'sample-game');
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, 'index.html'), 'fresh');
    mkdirSync(join(dest, 'assets'), { recursive: true });
    writeFileSync(join(dest, 'assets', 'index-OLDHASH.js'), 'stale bundle');

    copySampleGame(src, dest);

    expect(existsSync(join(dest, 'assets', 'index-OLDHASH.js'))).toBe(false);
  });

  it('returns false and does not throw when the dist directory is missing', () => {
    const base = mkdtempSync(join(tmpdir(), 'weld-copy-'));
    scratch.push(base);
    expect(copySampleGame(join(base, 'nope'), join(base, 'dest'))).toBe(false);
  });
});
