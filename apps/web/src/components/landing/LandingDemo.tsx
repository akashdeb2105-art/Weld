'use client';

import { useState } from 'react';
import { GameFrame } from '@/components/GameFrame';
import type { GameStateSnapshot } from '@/lib/types';

/**
 * Landing-page demo: the real deterministic game in a sandboxed frame, with
 * live state mirrored next to it — proof that WELD's telemetry is real.
 */
export function LandingDemo() {
  const [snap, setSnap] = useState<GameStateSnapshot | null>(null);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
      <GameFrame
        src="/games/scrap-sprint"
        title="Scrap Sprint — playable sample game"
        onState={setSnap}
      />
      <aside
        className="rounded-lg border border-line bg-ink-900/70 p-5"
        aria-label="Live game state"
      >
        <p className="mb-4 flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-dim">
          <span className="h-1.5 w-1.5 rounded-full bg-state-verified" aria-hidden />
          Live game state · window.__WELD__
        </p>
        {snap ? (
          <dl className="grid grid-cols-2 gap-3">
            {[
              ['status', snap.status],
              ['score', String(snap.score)],
              ['hull', '▮'.repeat(Math.max(0, snap.lives)) || '—'],
              ['scrap', `${snap.delivered}/${snap.winTarget}`],
              ['timer', `${Math.ceil(snap.timer)}s`],
              ['carrying', snap.carried ? 'yes' : 'no'],
              ['player', `${snap.player.x},${snap.player.y}`],
              ['pickups left', String(snap.pickupsRemaining)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-md border border-line/70 bg-ink-950/70 p-3">
                <dt className="font-mono text-[10px] uppercase tracking-widest text-dim">{k}</dt>
                <dd className="mt-1 font-mono text-sm text-paper">{v}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-dim">
            Click the game and press a key — its read-only test bridge streams real state here as
            you play.
          </p>
        )}
        <p className="mt-4 border-t border-line/60 pt-4 font-mono text-[10px] leading-relaxed text-dim">
          The same bridge the Playtester (M3) will read to prove controls, win/lose, restart, and
          regressions. Read-only — no arbitrary execution.
        </p>
      </aside>
    </div>
  );
}
