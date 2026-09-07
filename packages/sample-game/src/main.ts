import Phaser from 'phaser';
import { parseGameBible, sampleBible, type GameBible } from '@weld/gamebible';
import { createGame } from '@weld/engine';
import { installWeldBridge, recordConsoleError, type WeldBridge } from './bridge';
import { GameScene } from './scenes/GameScene';

/**
 * Runtime error watcher — makes the bible's `quality_requirements.
 * zero_console_errors` promise *real* instead of declared-but-unproven
 * (blueprint "never fake it"; release gate "no critical console errors").
 * Installed before boot so even pre-bridge failures are caught. Each error is
 * recorded on the bridge AND relayed to the embedding Studio via postMessage
 * (the iframe is sandboxed/opaque-origin, so this is the only channel).
 */
function installErrorWatcher(): void {
  const relay = (msg: string) => {
    recordConsoleError(msg);
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'weld:console-error', message: msg }, '*');
    }
  };
  window.addEventListener('error', (e) => {
    relay(e.message || (e.error instanceof Error ? e.error.message : 'unknown error'));
  });
  window.addEventListener('unhandledrejection', (e) => {
    const r = (e as PromiseRejectionEvent).reason;
    relay(r instanceof Error ? r.message : String(r));
  });
  const origError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    relay(args.map(String).join(' '));
    origError(...args);
  };
}

installErrorWatcher();

/**
 * Boot the runtime from a GameBible.
 *
 * The bundle is generic: at boot it tries to fetch `bible.json` (served
 * alongside the game, one per project — see the /games/[slug] route). When
 * none is present (the deterministic sample) it falls back to the bundled
 * reference bible, so the sample is unchanged and any described game boots
 * from its own bible. Determinism is preserved: the sim never reads the wall
 * clock; only the bible choice differs per project.
 */
async function loadBible(): Promise<GameBible> {
  try {
    const res = await fetch('./bible.json', { cache: 'no-store' });
    if (!res.ok) return parseGameBible(sampleBible);
    return parseGameBible(await res.json());
  } catch {
    return parseGameBible(sampleBible);
  }
}

async function boot(): Promise<WeldBridge> {
  const bible = await loadBible();

  const sim = createGame(bible);

  // The scene advances simRef.state each frame; the bridge always reads the
  // latest snapshot, so window.__WELD__ is never stale.
  const simRef = { state: sim.state, rules: sim.rules };
  const bridge = installWeldBridge(() => simRef);

  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: 'game-root',
    width: bible.level.width,
    height: bible.level.height,
    backgroundColor: '#0B0D12',
    scene: [new GameScene(simRef, bible)],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    render: { antialias: true, pixelArt: false },
  };

  void new Phaser.Game(config);
  return bridge;
}

export const bridgePromise: Promise<WeldBridge> = boot();
