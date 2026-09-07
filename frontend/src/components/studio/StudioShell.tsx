'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import type { PlaytestReport, ProjectDetail } from '@/lib/api';
import type { GameStateSnapshot, PipelineStage } from '@/lib/types';
import { Wordmark } from '@/components/Wordmark';
import { StatePill } from '@/components/StatePill';
import { Playhead } from '@/components/Playhead';
import { GameFrame } from '@/components/GameFrame';
import { CrewPanel } from '@/components/studio/CrewPanel';
import { SpecPanel } from '@/components/studio/SpecPanel';
import { PlaytestPanel } from '@/components/studio/PlaytestPanel';

/**
 * The Studio — the heart of the app (blueprint §25/§26). The game preview is
 * the visual hero. Left: project nav. Center: playable game. Right: AI crew +
 * live game state. Bottom: pipeline playhead.
 *
 * Honest M0: the game is live and real; the crew panel shows which roles are
 * real vs. arriving, and never fabricates AI activity.
 */
export function StudioShell({
  project,
  playtest,
  playtestError,
}: {
  project: ProjectDetail;
  playtest: PlaytestReport | null;
  playtestError: string | null;
}) {
  const [snap, setSnap] = useState<GameStateSnapshot | null>(null);
  const onState = useCallback((s: GameStateSnapshot) => setSnap(s), []);

  const bible = project.game_bible as Record<string, any> | null;

  // Map live game status onto the playhead so the line communicates state.
  const activeStage: PipelineStage =
    snap?.status === 'playing'
      ? 'play'
      : snap?.status === 'win'
        ? 'ship'
        : snap?.status === 'game_over'
          ? 'fix'
          : snap
            ? 'test'
            : 'build';

  return (
    <div className="flex h-screen flex-col bg-ink-950 text-paper">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-line/60 px-4 py-2.5">
        <div className="flex items-center gap-4">
          <Link href="/" aria-label="WELD home">
            <Wordmark compact />
          </Link>
          <span className="hidden h-4 w-px bg-line sm:block" aria-hidden />
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-semibold">{project.title}</p>
            <p className="font-mono text-[10px] uppercase tracking-widest text-dim">
              {project.provenance === 'deterministic_sample'
                ? 'deterministic sample'
                : project.provenance === 'ai_generated'
                  ? 'director · llm'
                  : project.provenance === 'offline_draft'
                    ? 'director · offline'
                    : project.provenance}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatePill state={snap ? (snap.status === 'win' ? 'verified' : 'running') : 'neutral'}
            label={snap ? `game ${snap.status}` : 'idle'} />
          <Link
            href="/app"
            className="font-mono text-xs uppercase tracking-wider text-steel hover:text-paper"
          >
            ← Projects
          </Link>
        </div>
      </header>

      {/* Main 3-pane */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[220px_1fr_300px]">
        {/* LEFT — project nav */}
        <nav
          className="hidden border-r border-line/60 bg-ink-900/40 p-4 lg:block"
          aria-label="Project"
        >
          <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-dim">Project</p>
          <ul className="space-y-1">
            {[
              ['Overview', true],
              ['Game Bible', true],
              ['Source', false],
              ['Tests', false],
              ['Issues', false],
              ['Versions', false],
            ].map(([label, active]) => (
              <li key={label as string}>
                <span
                  className={`block rounded px-3 py-2 font-mono text-xs uppercase tracking-wider ${
                    active
                      ? 'bg-ink-800 text-paper'
                      : 'cursor-not-allowed text-dim'
                  }`}
                  title={active ? undefined : 'Lands in a later milestone'}
                  aria-disabled={!active}
                >
                  {label as string}
                  {!active && <span className="float-right text-[9px] text-dim/60">soon</span>}
                </span>
              </li>
            ))}
          </ul>

          <p className="mb-3 mt-6 font-mono text-[10px] uppercase tracking-widest text-dim">Stage</p>
          <Playhead activeStage={activeStage} orientation="vertical" />
        </nav>

        {/* CENTER — the game is the hero */}
        <section className="blueprint-grid flex min-h-0 flex-col items-center justify-center overflow-auto p-4 sm:p-6">
          <div className="w-full max-w-4xl">
            <GameFrame
              src={`/games/${project.slug}`}
              title={`${project.title} — playable preview`}
              onState={onState}
            />
            <p className="mt-3 text-center font-mono text-[11px] uppercase tracking-widest text-dim">
              WASD / arrows move · E collect · Esc pause · R restart
            </p>
          </div>
        </section>

        {/* RIGHT — crew + live state + spec */}
        <aside className="hidden min-h-0 overflow-auto border-l border-line/60 bg-ink-900/40 lg:block">
          <CrewPanel snap={snap} provenance={project.provenance} />
          <PlaytestPanel report={playtest} unavailable={playtestError} />
          <SpecPanel bible={bible} />
        </aside>
      </div>

      {/* BOTTOM — pipeline status */}
      <footer className="border-t border-line/60 bg-ink-900/60 px-4 py-3">
        <div className="mx-auto max-w-5xl">
          <Playhead activeStage={activeStage} />
        </div>
        <p className="mt-2 text-center font-mono text-[10px] uppercase tracking-widest text-dim">
          Live pipeline: the playhead tracks the real game status. The Director drafts games from
          M1; the rest of the crew lands M2–M5.
        </p>
      </footer>
    </div>
  );
}
