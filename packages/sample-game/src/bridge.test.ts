import { describe, expect, it } from 'vitest';

import { parseGameBible, sampleBible } from '@weld/gamebible';
import { createGame, startGame, snapshotState } from '@weld/engine';
import { installWeldBridge, recordConsoleError } from './bridge';

/**
 * The sample-game package is the Phaser *presentation* layer; its rules live
 * in @weld/engine. These tests pin the seam the bundle actually depends on:
 * the state snapshot the window.__WELD__ bridge emits to the Studio.
 */
describe('sample-game bridge snapshot', () => {
  it('emits a structured, JSON-safe snapshot from the bible', () => {
    const bible = parseGameBible(sampleBible);
    const { state, rules } = createGame(bible);
    const snap = snapshotState(startGame(state), rules);
    const rt = JSON.parse(JSON.stringify(snap));
    expect(rt.status).toBe('playing');
    expect(rt.objectives.target).toBe(bible.win_condition.target);
    expect(typeof rt.score).toBe('number');
    expect(rt.player.alive).toBe(true);
  });

  it('boots from the bible with the spawn, timer and pickups the doc declares', () => {
    const bible = parseGameBible(sampleBible);
    const { state, rules } = createGame(bible);
    expect(state.status).toBe('title');
    expect(state.timer).toBe(rules.timerSeconds);
    expect(state.pickups).toHaveLength(bible.level.pickups.length);
  });
});

describe('bridge console-error evidence (zero_console_errors made real)', () => {
  it('records runtime errors read-only and returns a copy, never the live list', () => {
    // node env: no real window. installWeldBridge assigns to window.__WELD__,
    // so stub a minimal global for it and drive the returned bridge directly.
    const g = globalThis as Record<string, unknown>;
    const prevWindow = g['window'];
    g['window'] = {};
    try {
      const bible = parseGameBible(sampleBible);
      const sim = createGame(bible);
      const bridge = installWeldBridge(() => ({ state: sim.state, rules: sim.rules }));

      const before = bridge.getConsoleErrors().length;
      recordConsoleError('TypeError: boom');
      recordConsoleError('ReferenceError: nope');
      const errs = bridge.getConsoleErrors();
      expect(errs.length).toBe(before + 2);
      expect(errs.slice(-2)).toEqual(['TypeError: boom', 'ReferenceError: nope']);
      // Read-only: mutating the returned array must not change the bridge state.
      errs.push('injected');
      expect(bridge.getConsoleErrors().length).toBe(before + 2);
      // And it is exposed on the window global the playtester reads.
      expect((g['window'] as { __WELD__?: typeof bridge }).__WELD__).toBe(bridge);
    } finally {
      if (prevWindow === undefined) delete g['window'];
      else g['window'] = prevWindow;
    }
  });
});
