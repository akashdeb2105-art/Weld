import { describe, expect, it } from 'vitest';

import { parseGameBible, sampleBible } from '@weld/gamebible';
import { createGame, startGame, snapshotState } from '@weld/engine';

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
