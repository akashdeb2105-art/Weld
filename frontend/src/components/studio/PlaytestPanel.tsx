'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { PlaytestReport } from '@/lib/api';
import { recordBug } from '@/app/actions';

/**
 * Playtest panel (M3) — the "Break it" verdict. Shows each quality gate the
 * deterministic Playtester proved (or failed) against this project's real
 * game logic, with the evidence behind it. Rendered from the API's honest
 * report — never fabricated.
 *
 * M4: a failing gate can be logged as a bug with one click. The recorded
 * evidence is exactly what the Playtester reported here, freezing the current
 * (broken) bible as the regression scenario.
 */
export function PlaytestPanel({
  slug,
  report,
  unavailable,
}: {
  slug: string;
  report: PlaytestReport | null;
  unavailable: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [logged, setLogged] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  function logBug(gate: string, evidence: string) {
    setError(null);
    startTransition(async () => {
      const result = await recordBug(slug, gate, evidence);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setLogged((m) => ({ ...m, [gate]: true }));
      router.refresh(); // pull the new bug into the regression panel
    });
  }

  return (
    <section className="p-4" aria-label="Playtest">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-widest text-dim">Playtest</p>
        {report && (
          <span
            className={`rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${
              report.passed ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'
            }`}
          >
            {report.passed ? 'passed' : 'failed'}
          </span>
        )}
      </div>

      {unavailable ? (
        <div className="rounded-md border border-line/60 bg-ink-950/50 p-3">
          <p className="text-sm text-dim">Playtester unavailable here.</p>
          <p className="mt-1 font-mono text-[11px] leading-relaxed text-dim/80">{unavailable}</p>
        </div>
      ) : !report ? (
        <p className="text-sm text-dim">No playtest yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {report.gates.map((g) => (
            <li key={g.gate} className="rounded-md border border-line/60 bg-ink-950/50 p-2.5">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className={`inline-block h-1.5 w-1.5 rounded-full ${
                    g.passed ? 'bg-emerald-400' : 'bg-red-400'
                  }`}
                />
                <p className="font-mono text-[11px] uppercase tracking-wider text-paper">
                  {g.gate.replace(/_/g, ' ')}
                </p>
                {!g.passed && (
                  <button
                    type="button"
                    disabled={pending || logged[g.gate]}
                    onClick={() => logBug(g.gate, g.evidence)}
                    className="ml-auto rounded border border-red-500/40 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-red-300 transition-colors hover:border-red-400 hover:text-red-200 disabled:opacity-40"
                  >
                    {logged[g.gate] ? 'logged' : 'log bug'}
                  </button>
                )}
              </div>
              <p className="mt-1 font-mono text-[10px] leading-relaxed text-steel">{g.evidence}</p>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p className="mt-2 font-mono text-[11px] text-red-300" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
