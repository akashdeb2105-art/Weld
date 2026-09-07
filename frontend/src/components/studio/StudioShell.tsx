'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import type { Bug, PlaytestReport, ProjectDetail, RegressionSuite } from '@/lib/api';
import type { GameStateSnapshot, PipelineStage } from '@/lib/types';
import { Wordmark } from '@/components/Wordmark';
import { StatePill } from '@/components/StatePill';
import { Playhead } from '@/components/Playhead';
import { GameFrame } from '@/components/GameFrame';
import { CrewPanel } from '@/components/studio/CrewPanel';
import { SpecPanel } from '@/components/studio/SpecPanel';
import { PlaytestPanel } from '@/components/studio/PlaytestPanel';
import { RegressionPanel } from '@/components/studio/RegressionPanel';
import { PublishButton } from '@/components/studio/PublishButton';
import { BibleEditPanel } from '@/components/studio/BibleEditPanel';

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
  bugs,
  regressions,
}: {
  project: ProjectDetail;
  playtest: PlaytestReport | null;
  playtestError: string | null;
  bugs: Bug[];
  regressions: RegressionSuite | null;
}) {
  const [snap, setSnap] = useState<GameStateSnapshot | null>(null);
  const onState = useCallback((s: GameStateSnapshot) => setSnap(s), []);
  const [runtimeErrors, setRuntimeErrors] = useState<string[]>([]);
  const onRuntimeError = useCallback(
    (msg: string) => setRuntimeErrors((prev) => [...prev, msg]),
    [],
  );
  // Left-nav tab: which panel the right rail shows. Every tab is real — the
  // crew behind each one has landed (M1–M6), so there's no honest "soon" left.
  const [tab, setTab] = useState<'overview' | 'source' | 'tests' | 'issues'>('overview');

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
          <RuntimeErrorsChip count={runtimeErrors.length} errors={runtimeErrors} booted={snap !== null} />
          <PublishButton slug={project.slug} published={project.published} />
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
            {(
              [
                ['Overview', 'overview'],
                ['Source', 'source'],
                ['Tests', 'tests'],
                ['Issues', 'issues'],
              ] as const
            ).map(([label, id]) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => setTab(id)}
                  aria-current={tab === id ? 'page' : undefined}
                  className={`block w-full rounded px-3 py-2 text-left font-mono text-xs uppercase tracking-wider transition ${
                    tab === id
                      ? 'bg-ink-800 text-paper'
                      : 'text-dim hover:bg-ink-900 hover:text-steel'
                  }`}
                >
                  {label}
                </button>
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
              onError={onRuntimeError}
            />
            <p className="mt-3 text-center font-mono text-[11px] uppercase tracking-widest text-dim">
              WASD / arrows move · E collect · Esc pause · R restart
            </p>
          </div>
        </section>

        {/* RIGHT — the selected panel. Every tab is real: the data behind each
            one already exists (the Director's bible, the 9-gate playtest
            report, the regression suite), so switching shows real content. */}
        <aside className="hidden min-h-0 overflow-auto border-l border-line/60 bg-ink-900/40 lg:block">
          {tab === 'overview' && (
            <>
              <CrewPanel snap={snap} provenance={project.provenance} />
              {bible && <BibleEditPanel slug={project.slug} bible={bible} />}
              <SpecPanel bible={bible} />
            </>
          )}
          {tab === 'source' && (
            <>
              {/* Blueprint §6: generated games stay ordinary, readable source.
                  The Game Bible is the source the whole crew builds from. */}
              <section className="p-4" aria-label="Source">
                <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-dim">
                  Source · Game Bible
                </p>
                {bible ? (
                  <pre className="max-h-[70vh] overflow-auto rounded-md border border-line/60 bg-ink-950 p-3 font-mono text-[11px] leading-relaxed text-steel">
                    {JSON.stringify(bible, null, 2)}
                  </pre>
                ) : (
                  <p className="text-xs text-dim">No game bible recorded for this project.</p>
                )}
              </section>
              {bible && <BibleEditPanel slug={project.slug} bible={bible} />}
            </>
          )}
          {tab === 'tests' && (
            <PlaytestPanel slug={project.slug} report={playtest} unavailable={playtestError} />
          )}
          {tab === 'issues' && (
            <RegressionPanel slug={project.slug} bugs={bugs} regressions={regressions} />
          )}
        </aside>
      </div>

      {/* BOTTOM — pipeline status */}
      <footer className="border-t border-line/60 bg-ink-900/60 px-4 py-3">
        <div className="mx-auto max-w-5xl">
          <Playhead activeStage={activeStage} />
        </div>
        <p className="mt-2 text-center font-mono text-[10px] uppercase tracking-widest text-dim">
          Live pipeline: the playhead tracks the real game status. The full crew is live — Director,
          Builder, Playtester, and Bug→Fix regression (M1–M4).
        </p>
      </footer>
    </div>
  );
}

/** Honest runtime-error status for the running game (blueprint "never fake
 * it"; release gate "no critical console errors"). It reports only what the
 * game frame actually produced in this session: a live error count when any
 * fire, or a scoped "no errors this session" once the game has booted clean.
 * Before boot it stays neutral and claims nothing. */
function RuntimeErrorsChip({
  count,
  errors,
  booted,
}: {
  count: number;
  errors: string[];
  booted: boolean;
}) {
  const state: 'neutral' | 'verified' | 'failed' =
    count > 0 ? 'failed' : booted ? 'verified' : 'neutral';
  const label =
    count > 0
      ? `${count} runtime error${count === 1 ? '' : 's'}`
      : booted
        ? 'no errors this session'
        : 'console watch';
  const latest = errors[errors.length - 1];
  return (
    <span title={latest} aria-label={`Runtime errors: ${label}`}>
      <StatePill state={state} label={label} />
    </span>
  );
}
