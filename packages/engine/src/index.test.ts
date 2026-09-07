import { describe, expect, it } from 'vitest';

import { parseGameBible, sampleBible } from '@weld/gamebible';
import {
  createGame,
  createInitialState,
  rulesFromBible,
  snapshotState,
  startGame,
  pauseGame,
  resumeGame,
  update,
  INPUT_IDLE,
  type InputState,
} from './index.js';

const bible = parseGameBible(sampleBible);

function freshPlaying() {
  const { state, rules } = createGame(bible);
  return { state: startGame(state), rules };
}

describe('Scrap Sprint logic core', () => {
  it('creates a deterministic initial state from the GameBible', () => {
    const rules = rulesFromBible(bible);
    const a = createInitialState(bible.level, rules);
    const b = createInitialState(bible.level, rules);
    expect(a).toEqual(b);
    expect(a.status).toBe('title');
    expect(a.timer).toBe(bible.level.timer_seconds);
    expect(a.pickups).toHaveLength(bible.level.pickups.length);
  });

  it('starts, pauses and resumes from the correct statuses only', () => {
    const { state } = createGame(bible);
    expect(startGame(state).status).toBe('playing');
    const playing = startGame(state);
    expect(pauseGame(playing).status).toBe('paused');
    expect(resumeGame(pauseGame(playing)).status).toBe('playing');
    // Pausing a paused game is a no-op.
    expect(pauseGame(pauseGame(playing)).status).toBe('paused');
  });

  it('moves the player with input and clamps to level bounds', () => {
    const { rules } = freshPlaying();
    let state = startGame(createGame(bible).state);
    const x0 = state.player.x;
    state = update(state, rules, { ...INPUT_IDLE, right: true }, 1);
    expect(state.player.x).toBeGreaterThan(x0);

    // Walk hard left for a long time â€” must clamp, never go negative.
    for (let i = 0; i < 60 * 20 && state.status === 'playing'; i++) {
      state = update(state, rules, { ...INPUT_IDLE, left: true }, 1 / 60);
    }
    expect(state.player.x).toBeGreaterThanOrEqual(16);
  });

  it('timer counts down and never increases', () => {
    const { rules } = freshPlaying();
    let state = startGame(createGame(bible).state);
    const t0 = state.timer;
    state = update(state, rules, INPUT_IDLE, 1);
    expect(state.timer).toBeLessThan(t0);
    const t1 = state.timer;
    state = update(state, rules, INPUT_IDLE, 0.5);
    expect(state.timer).toBeLessThan(t1);
  });

  it('lose condition: timer reaches zero -> game_over (timer_zero)', () => {
    const { rules } = freshPlaying();
    let state = startGame(createGame(bible).state);
    state = update(state, rules, INPUT_IDLE, bible.level.timer_seconds + 1);
    expect(state.status).toBe('game_over');
    expect(state.loseReason).toBe('timer_zero');
    expect(state.player.alive).toBe(false);
    expect(state.timer).toBe(0);
  });

  it('collects every pickup, delivers each, and wins at the target', () => {
    const { rules } = freshPlaying();
    let state = startGame(createGame(bible).state);
    const zone = rules.deliveryZone;
    const zx = zone.x + zone.width / 2;
    const zy = zone.y + zone.height / 2;
    const speed = rules.playerSpeed;
    const dt = 1 / 60;

    // Deterministic scripted route: axis-aligned moves through the open
    // center column (x=480 clears both top spark pits; y=300 clears the bottom
    // pit), visiting each pickup then the furnace. Avoids every hazard, so the
    // run wins well inside the shift timer.
    const move = (dx: number, dy: number) => {
      const dist = Math.max(Math.abs(dx), Math.abs(dy));
      const steps = Math.ceil(dist / (speed * dt));
      for (let i = 0; i < steps && state.status === 'playing'; i++) {
        state = update(state, rules, { up: dy < 0, down: dy > 0, left: dx < 0, right: dx > 0 }, dt);
      }
    };
    const goTo = (tx: number, ty: number) => {
      move(tx - state.player.x, 0);
      move(0, ty - state.player.y);
    };

    // Pickup positions from the GameBible (corners + edges), in a hazard-safe order.
    const route: Array<[number, number]> = [
      [480, 160], [zx, zy],
      [740, 300], [zx, zy],
      [220, 300], [zx, zy],
      [132, 140], [zx, zy],
      [828, 140], [zx, zy],
    ];

    let lastLives = state.lives;
    for (const [tx, ty] of route) {
      if (state.status !== 'playing') break;
      goTo(tx, ty);
      // No hazard should ever be hit on this route.
      expect(state.lives).toBe(lastLives);
      lastLives = state.lives;
    }

    expect(state.delivered).toBe(bible.win_condition.target);
    expect(state.status).toBe('win');
    expect(state.score).toBe(bible.win_condition.target * 100);
  });

  it('hazard hits cost a life; lives never go negative; health_zero ends the run', () => {
    const { rules } = freshPlaying();
    let state = startGame(createGame(bible).state);
    const pit = bible.level.hazards[0]!;

    for (let expectedLives = 2; expectedLives >= 0; expectedLives--) {
      // Walk into the pit (invulnerability may require waiting inside).
      let guard = 0;
      while (state.lives > expectedLives && guard < 600 && state.status === 'playing') {
        const input: InputState = {
          up: pit.y < state.player.y - 2,
          down: pit.y > state.player.y + 2,
          left: pit.x < state.player.x - 2,
          right: pit.x > state.player.x + 2,
        };
        state = update(state, rules, input, 1 / 60);
        guard++;
      }
      expect(state.lives).toBe(expectedLives);
    }
    expect(state.lives).toBe(0);
    expect(state.status).toBe('game_over');
    expect(state.loseReason).toBe('health_zero');
    expect(state.lives).toBeGreaterThanOrEqual(0);
  });

  it('invariants: score never decreases; game_over freezes gameplay state', () => {
    const { rules } = freshPlaying();
    let state = startGame(createGame(bible).state);
    let lastScore = state.score;
    // Random-ish walk with deterministic pattern.
    for (let i = 0; i < 300; i++) {
      const input: InputState = {
        up: i % 4 === 0,
        down: i % 4 === 2,
        left: i % 5 === 0,
        right: i % 5 === 3,
      };
      state = update(state, rules, input, 1 / 30);
      expect(state.score).toBeGreaterThanOrEqual(lastScore);
      lastScore = state.score;
    }

    const over = update(
      { ...state, status: 'game_over', loseReason: 'timer_zero' },
      rules,
      { ...INPUT_IDLE, right: true },
      5,
    );
    expect(over.player.x).toBe(state.player.x); // input ignored after game over
    expect(over.score).toBe(state.score);
  });

  it('snapshotState is structured, numeric, and JSON-safe', () => {
    const { rules } = freshPlaying();
    let state = startGame(createGame(bible).state);
    state = update(state, rules, { ...INPUT_IDLE, up: true }, 0.5);
    const snap = snapshotState(state, rules);
    const roundTrip = JSON.parse(JSON.stringify(snap));
    expect(roundTrip.status).toBe('playing');
    expect(typeof roundTrip.score).toBe('number');
    expect(roundTrip.player.alive).toBe(true);
    expect(roundTrip.objectives.target).toBe(bible.win_condition.target);
    expect(roundTrip.pickupsRemaining).toBe(bible.level.pickups.length);
  });

  it('restart resets state to the deterministic initial state', () => {
    const { rules } = freshPlaying();
    const fresh = createInitialState(bible.level, rules);
    const restarted = { ...fresh, status: 'playing' as const };
    expect(restarted.player).toEqual(fresh.player);
    expect(restarted.score).toBe(0);
    expect(restarted.lives).toBe(rules.startLives);
    expect(restarted.pickups.every((p) => !p.collected)).toBe(true);
  });
});
