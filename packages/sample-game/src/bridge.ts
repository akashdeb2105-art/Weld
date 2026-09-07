/**
 * window.__WELD__ — the safe, read-only test bridge (blueprint §14).
 *
 * Exposes structured game *state* only. No mutation, no arbitrary code
 * execution. The Studio listens via postMessage; the future Playtester will
 * read it via Playwright. `emit()` broadcasts snapshots to a parent frame.
 */

import type { Rules, GameState } from '@weld/engine';
import { snapshotState } from '@weld/engine';

export interface WeldBridge {
  getGameState: () => ReturnType<typeof snapshotState>;
  getScore: () => number;
  getLives: () => number;
  getGameStatus: () => GameState['status'];
  getPlayerState: () => { x: number; y: number; alive: boolean };
  getObjectives: () => ReturnType<typeof snapshotState>['objectives'];
  version: string;
}

declare global {
  interface Window {
    __WELD__?: WeldBridge;
  }
}

export function installWeldBridge(getState: () => { state: GameState; rules: Rules }): WeldBridge {
  const bridge: WeldBridge = {
    version: '0.1.0',
    getGameState: () => {
      const { state, rules } = getState();
      return snapshotState(state, rules);
    },
    getScore: () => getState().state.score,
    getLives: () => getState().state.lives,
    getGameStatus: () => getState().state.status,
    getPlayerState: () => {
      const p = getState().state.player;
      return { x: Math.round(p.x), y: Math.round(p.y), alive: p.alive };
    },
    getObjectives: () => {
      const { state, rules } = getState();
      return snapshotState(state, rules).objectives;
    },
  };
  window.__WELD__ = bridge;
  return bridge;
}

/** Broadcast a snapshot to the embedding Studio (if any). */
export function emitToParent(state: GameState, rules: Rules): void {
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type: 'weld:game-state', payload: snapshotState(state, rules) }, '*');
  }
}
