'use client';

import type { GameStateSnapshot } from '@/lib/types';

/**
 * AI crew panel — HONEST in M0.
 *
 * The blueprint is explicit: never fake agent activity. So instead of fake
 * "Builder ●" dots, the crew is shown as a roster of roles with their real
 * milestone status. The only live telemetry is the actual game state.
 */
type CrewRole = { role: string; lands: string; does: string; live?: boolean };

function crewFor(provenance: string | undefined): CrewRole[] {
  // The Director + Designer go live (M1) only for projects they actually made.
  const generated = provenance === 'ai_generated' || provenance === 'offline_draft';
  return [
    { role: 'Director', lands: 'M1', does: 'Turns your prompt into structured intent', live: generated },
    { role: 'Designer', lands: 'M1', does: 'Writes the Game Bible', live: generated },
    { role: 'Architect', lands: 'M2', does: 'Chooses the build plan' },
    { role: 'Builder', lands: 'M2', does: 'Writes the game source' },
    { role: 'Playtester', lands: 'M3', does: 'Drives Chromium, tests win/lose/restart' },
    { role: 'Triage', lands: 'M4', does: 'Turns failures into bug reports' },
    { role: 'Fixer', lands: 'M4', does: 'Applies minimal targeted patches' },
    { role: 'Visual QA', lands: 'M6', does: 'Checks screenshots for visual defects' },
    { role: 'Release Judge', lands: 'M5', does: 'Runs the release gate' },
  ];
}

export function CrewPanel({
  snap,
  provenance,
}: {
  snap: GameStateSnapshot | null;
  provenance?: string;
}) {
  const crew = crewFor(provenance);
  return (
    <section className="border-b border-line/60 p-4" aria-label="AI crew">
      <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-dim">AI crew</p>
      <ul className="space-y-2">
        {crew.map((c) => (
          <li
            key={c.role}
            className="flex items-start gap-3 rounded-md border border-line/60 bg-ink-950/50 p-2.5"
            title={`${c.role} — ${c.does}`}
          >
            <span
              className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${c.live ? 'bg-state-verified' : 'bg-line'}`}
              aria-hidden
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-mono text-xs text-steel">{c.role}</span>
              <span className="block truncate text-[11px] text-dim">{c.does}</span>
            </span>
            <span
              className={`rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${
                c.live ? 'border-state-verified/50 text-state-verified' : 'border-line text-dim'
              }`}
            >
              {c.live ? 'live' : c.lands}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-4 rounded-md border border-spark/30 bg-spark/5 p-3">
        <p className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-spark-soft">
          <span className={`h-1.5 w-1.5 rounded-full ${snap ? 'bg-state-verified' : 'bg-line'}`} aria-hidden />
          Live game state
        </p>
        {snap ? (
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 font-mono text-[11px]">
            <dt className="text-dim">status</dt>
            <dd className="text-right text-paper">{snap.status}</dd>
            <dt className="text-dim">score</dt>
            <dd className="text-right text-paper">{snap.score}</dd>
            <dt className="text-dim">scrap</dt>
            <dd className="text-right text-paper">
              {snap.delivered}/{snap.winTarget}
            </dd>
            <dt className="text-dim">hull</dt>
            <dd className="text-right text-paper">{snap.lives}</dd>
            <dt className="text-dim">timer</dt>
            <dd className="text-right text-paper">{Math.ceil(snap.timer)}s</dd>
            <dt className="text-dim">carrying</dt>
            <dd className="text-right text-paper">{snap.carried ? 'yes' : 'no'}</dd>
          </dl>
        ) : (
          <p className="font-mono text-[11px] text-dim">
            Play the game — its read-only bridge streams state here in real time.
          </p>
        )}
      </div>
    </section>
  );
}
