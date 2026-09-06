/**
 * Scrap Sprint — pure game logic core.
 *
 * Engine-free, dependency-free and deterministic. Phaser (or any renderer)
 * only *renders* this state and feeds it intents (input, dt). All rules —
 * movement, pickup, delivery, hazards, win/lose, restart — live here so they
 * can be unit-tested in Node and (later) asserted by the Playtester.
 *
 * Determinism: no Math.random(), no wall-clock reads. `update(dt)` advances
 * the simulation by the caller-supplied delta only.
 */

import type { GameBible, LevelDefinition } from '@weld/gamebible';

export type GameStatus = 'title' | 'playing' | 'paused' | 'game_over' | 'win';

export interface Vec2 {
  x: number;
  y: number;
}

export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

export interface PickupState {
  id: string;
  x: number;
  y: number;
  collected: boolean;
}

export interface HazardState {
  id: string;
  x: number;
  y: number;
  radius: number;
}

export interface GameState {
  status: GameStatus;
  score: number;
  lives: number;
  delivered: number;
  carried: boolean;
  /** Seconds remaining; never negative, never increases during play. */
  timer: number;
  player: { x: number; y: number; alive: boolean; invulnerableFor: number };
  pickups: PickupState[];
  hazards: HazardState[];
  /** Monotonic simulation clock in seconds. */
  tick: number;
  /** Set to the lose condition that ended the run. */
  loseReason: 'timer_zero' | 'health_zero' | null;
}

export interface Rules {
  winTarget: number;
  startLives: number;
  timerSeconds: number;
  playerSpeed: number;
  pickupRadius: number;
  deliveryScore: number;
  hitInvulnerabilitySeconds: number;
  bounds: { width: number; height: number };
  deliveryZone: { x: number; y: number; width: number; height: number };
}

export function rulesFromBible(bible: GameBible): Rules {
  const level = bible.level;
  return {
    winTarget: bible.win_condition.target,
    startLives: bible.player.health,
    timerSeconds: level.timer_seconds,
    playerSpeed: level.player_speed,
    pickupRadius: 26,
    deliveryScore: 100,
    hitInvulnerabilitySeconds: 1.2,
    bounds: { width: level.width, height: level.height },
    deliveryZone: {
      x: level.delivery_zone.x,
      y: level.delivery_zone.y,
      width: level.delivery_zone.width,
      height: level.delivery_zone.height,
    },
  };
}

export function createGame(bible: GameBible): { state: GameState; rules: Rules } {
  const rules = rulesFromBible(bible);
  return { state: createInitialState(bible.level, rules), rules };
}

export function createInitialState(level: LevelDefinition, rules: Rules): GameState {
  return {
    status: 'title',
    score: 0,
    lives: rules.startLives,
    delivered: 0,
    carried: false,
    timer: rules.timerSeconds,
    player: {
      x: level.player_spawn.x,
      y: level.player_spawn.y,
      alive: true,
      invulnerableFor: 0,
    },
    pickups: level.pickups.map((p) => ({ id: p.id, x: p.x, y: p.y, collected: false })),
    hazards: level.hazards.map((h) => ({ id: h.id, x: h.x, y: h.y, radius: h.radius })),
    tick: 0,
    loseReason: null,
  };
}

const dist = (ax: number, ay: number, bx: number, by: number) =>
  Math.hypot(ax - bx, ay - by);

const inRect = (
  x: number,
  y: number,
  r: { x: number; y: number; width: number; height: number },
) => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height;

export const INPUT_IDLE: InputState = { up: false, down: false, left: false, right: false };

/** Begin (or restart-from-title) a run. */
export function startGame(state: GameState): GameState {
  if (state.status === 'title' || state.status === 'game_over' || state.status === 'win') {
    return { ...state, status: 'playing' };
  }
  return state;
}

export function pauseGame(state: GameState): GameState {
  return state.status === 'playing' ? { ...state, status: 'paused' } : state;
}

export function resumeGame(state: GameState): GameState {
  return state.status === 'paused' ? { ...state, status: 'playing' } : state;
}

/**
 * Advance the simulation. `dt` in seconds. Mutates nothing — returns the next
 * state (callers replace their reference). All transitions are pure.
 */
export function update(state: GameState, rules: Rules, input: InputState, dt: number): GameState {
  if (state.status !== 'playing') return state;

  const next: GameState = {
    ...state,
    player: { ...state.player },
    pickups: state.pickups.map((p) => ({ ...p })),
  };

  next.tick = +(state.tick + dt).toFixed(4);

  // ── Timer: counts down only, never below zero ──────────────────────────
  next.timer = Math.max(0, +(state.timer - dt).toFixed(4));
  if (next.timer === 0) {
    return endGame(next, 'timer_zero');
  }

  // ── Invulnerability decay ───────────────────────────────────────────────
  next.player.invulnerableFor = Math.max(0, state.player.invulnerableFor - dt);

  // ── Movement (normalized so diagonals aren't faster) ────────────────────
  let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  if (dx !== 0 || dy !== 0) {
    const len = Math.hypot(dx, dy);
    dx /= len;
    dy /= len;
    next.player.x += dx * rules.playerSpeed * dt;
    next.player.y += dy * rules.playerSpeed * dt;
    // Clamp inside the level bounds (player is ~28px across).
    const pad = 16;
    next.player.x = Math.min(Math.max(next.player.x, pad), rules.bounds.width - pad);
    next.player.y = Math.min(Math.max(next.player.y, pad), rules.bounds.height - pad);
  }

  // ── Pickups: collect at most one scrap at a time ─────────────────────────
  if (!next.carried) {
    const hit = next.pickups.find(
      (p) => !p.collected && dist(p.x, p.y, next.player.x, next.player.y) <= rules.pickupRadius,
    );
    if (hit) {
      hit.collected = true;
      next.carried = true;
    }
  }

  // ── Delivery: carrying + inside the furnace zone ─────────────────────────
  if (next.carried && inRect(next.player.x, next.player.y, rules.deliveryZone)) {
    next.carried = false;
    next.delivered += 1;
    next.score += rules.deliveryScore;
    if (next.delivered >= rules.winTarget) {
      next.status = 'win';
      next.player.alive = true;
      return next;
    }
  }

  // ── Hazards: spark pits cost a life (with brief invulnerability) ─────────
  if (next.player.invulnerableFor <= 0) {
    const pit = next.hazards.find(
      (h) => dist(h.x, h.y, next.player.x, next.player.y) <= h.radius + 14,
    );
    if (pit) {
      next.lives = Math.max(0, next.lives - 1);
      next.player.invulnerableFor = rules.hitInvulnerabilitySeconds;
      if (next.lives === 0) {
        return endGame(next, 'health_zero');
      }
    }
  }

  return next;
}

function endGame(state: GameState, reason: 'timer_zero' | 'health_zero'): GameState {
  return {
    ...state,
    status: 'game_over',
    loseReason: reason,
    player: { ...state.player, alive: false },
  };
}

/**
 * Read-only snapshot exposed to the window.__WELD__ test bridge and the
 * Studio. Structured, numeric, and safe — no functions, no references.
 */
export function snapshotState(state: GameState, rules: Rules) {
  return {
    status: state.status,
    score: state.score,
    lives: state.lives,
    delivered: state.delivered,
    winTarget: rules.winTarget,
    carried: state.carried,
    timer: state.timer,
    loseReason: state.loseReason,
    tick: state.tick,
    player: {
      x: Math.round(state.player.x),
      y: Math.round(state.player.y),
      alive: state.player.alive,
    },
    objectives: {
      type: 'deliver_scrap',
      delivered: state.delivered,
      target: rules.winTarget,
      complete: state.delivered >= rules.winTarget,
    },
    pickupsRemaining: state.pickups.filter((p) => !p.collected).length,
  };
}
