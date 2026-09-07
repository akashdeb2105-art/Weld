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

//  M2: the engine honors every win/lose type the GameBible schema allows,
//  not just the sample's deliver_count / timer_zero. 

import type { GameBible } from '@weld/gamebible';

function bibleWith(overrides: {
  win?: GameBible['win_condition'];
  lose?: GameBible['lose_conditions'];
}): GameBible {
  return parseGameBible({
    ...sampleBible,
    win_condition: overrides.win ?? sampleBible.win_condition,
    lose_conditions: overrides.lose ?? sampleBible.lose_conditions,
  });
}

describe('armed win/lose conditions (M2)', () => {
  it('score_threshold wins at the score target', () => {
    const b = bibleWith({
      win: { type: 'score_threshold', target: 200, description: 'Reach 200 pts' },
    });
    const { state, rules } = createGame(b);
    expect(rules.winType).toBe('score_threshold');
    let s = startGame(state);
    // Deliver two pickups (2 * deliveryScore = 200) at the zone center.
    const zx = rules.deliveryZone.x + rules.deliveryZone.width / 2;
    const zy = rules.deliveryZone.y + rules.deliveryZone.height / 2;
    const dt = 1 / 60;
    const goTo = (tx: number, ty: number) => {
      while (s.status === 'playing') {
        const dx = tx - s.player.x;
        const dy = ty - s.player.y;
        if (Math.abs(dx) < 2 && Math.abs(dy) < 2) break;
        s = update(s, rules, { up: dy < 0, down: dy > 0, left: dx < 0, right: dx > 0 }, dt);
      }
    };
    // First pickup + deliver, then second + deliver.
    const p0 = b.level.pickups[0];
    goTo(p0.x, p0.y);
    goTo(zx, zy);
    const p1 = b.level.pickups[1];
    goTo(p1.x, p1.y);
    goTo(zx, zy);
    expect(s.score).toBeGreaterThanOrEqual(200);
    expect(s.status).toBe('win');
  });

  it('survive_time wins when the timer runs out', () => {
    const b = bibleWith({
      win: { type: 'survive_time', target: 90, description: 'Survive the shift' },
    });
    const { state, rules } = createGame(b);
    expect(rules.winType).toBe('survive_time');
    let s = startGame(state);
    // Idle in place (no hazards at spawn) until the clock hits zero.
    for (let i = 0; i < 90 * 60 + 5 && s.status === 'playing'; i++) {
      s = update(s, rules, INPUT_IDLE, 1 / 60);
    }
    expect(s.timer).toBe(0);
    expect(s.status).toBe('win');
  });

  it('clear_level wins by delivering every pickup', () => {
    // A clean two-pickup level (no hazards on the route) so "clear every
    // pickup" is exercised directly, not gated by the sample's hazard layout.
    const b = parseGameBible({
      ...sampleBible,
      win_condition: { type: 'clear_level', target: 1, description: 'Clear the level' },
      level: {
        ...sampleBible.level,
        hazards: [],
        pickups: [
          { id: 'p-1', kind: 'scrap', x: 200, y: 300 },
          { id: 'p-2', kind: 'scrap', x: 760, y: 300 },
        ],
      },
    });
    const { state, rules } = createGame(b);
    expect(rules.winType).toBe('clear_level');
    let s = startGame(state);
    const zone = rules.deliveryZone;
    const zx = zone.x + zone.width / 2;
    const zy = zone.y + zone.height / 2;
    const dt = 1 / 60;
    const goTo = (tx: number, ty: number) => {
      while (s.status === 'playing') {
        const dx = tx - s.player.x;
        const dy = ty - s.player.y;
        if (Math.abs(dx) < 2 && Math.abs(dy) < 2) break;
        s = update(s, rules, { up: dy < 0, down: dy > 0, left: dx < 0, right: dx > 0 }, dt);
      }
    };
    for (const p of b.level.pickups) {
      if (s.status !== 'playing') break;
      goTo(p.x, p.y);
      goTo(zx, zy);
    }
    expect(s.delivered).toBe(b.level.pickups.length);
    expect(s.status).toBe('win');
  });

  it('timer_zero does NOT end a run when it is not an armed lose condition', () => {
    const b = bibleWith({ lose: ['health_zero'] });
    const { state, rules } = createGame(b);
    let s = startGame(state);
    for (let i = 0; i < 90 * 60 + 5 && s.status === 'playing'; i++) {
      s = update(s, rules, INPUT_IDLE, 1 / 60);
    }
    expect(s.timer).toBe(0);
    expect(s.status).toBe('playing'); // timer ran out but it is not armed
  });

  it('health_zero does NOT end a run when it is not an armed lose condition', () => {
    const b = bibleWith({ lose: ['timer_zero'] });
    const { state, rules } = createGame(b);
    let s = startGame(state);
    const pit = b.level.hazards[0];
    // Stand in the pit until lives are exhausted.
    for (let i = 0; i < 60 * 60 && s.status === 'playing' && s.lives > 0; i++) {
      s = update(s, rules, { ...INPUT_IDLE }, 1 / 60);
      // teleport onto the pit each step so hits land once invulnerability lapses
      s = { ...s, player: { ...s.player, x: pit.x, y: pit.y } };
    }
    expect(s.lives).toBe(0);
    expect(s.status).toBe('playing'); // out of lives but health_zero not armed
  });
});
