'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Bug, RegressionSuite } from '@/lib/api';
import { retestBug } from '@/app/actions';

/**
 * Regression panel (M4: Bug -> Fix -> Regression). Two halves:
 *
 *  - Bugs: every recorded gate failure. An open bug can be retested against
 *    the current bible; it flips to "fixed" only when the Playtester says its
 *    gate now passes (an honest flip, never assumed).
 *  - Regression suite: replays every fixed bug's case. If a "fixed" gate
 *    silently starts failing again, the suite reports it here as not passing.
 */
export function RegressionPanel({
  slug,
  bugs,
  regressions,
}: {
  slug: string;
  bugs: Bug[];
  regressions: RegressionSuite | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [justFixed, setJustFixed] = useState<Record<number, boolean>>({});

  function retest(bugId: number) {
    setError(null);
    startTransition(async () => {
      const result = await retestBug(slug, bugId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.fixed) setJustFixed((m) => ({ ...m, [bugId]: true }));
      router.refresh(); // re-fetch bugs + regression suite
    });
  }

  return (
    <section className="p-4" aria-label="Regression">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-widest text-dim">Bug · Regression</p>
        {regressions && (
          <span
            className={`rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${
              regressions.all_passing
                ? 'bg-emerald-500/15 text-emerald-300'
                : 'bg-red-500/15 text-red-300'
            }`}
          >
            {regressions.total === 0 ? 'no cases' : `${regressions.passing}/${regressions.total} passing`}
          </span>
        )}
      </div>

      {bugs.length === 0 ? (
        <p className="text-sm text-dim">
          No bugs logged. When a playtest gate fails, log it as a bug to start the fix loop.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {bugs.map((b) => (
            <li key={b.id} className="rounded-md border border-line/60 bg-ink-950/50 p-2.5">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className={`inline-block h-1.5 w-1.5 rounded-full ${
                    b.status === 'fixed' ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
                <p className="font-mono text-[11px] uppercase tracking-wider text-paper">
                  {b.gate.replace(/_/g, ' ')}
                </p>
                <span
                  className={`rounded px-1 py-0.5 font-mono text-[8px] uppercase tracking-wider ${
                    b.status === 'fixed'
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : 'bg-amber-500/15 text-amber-300'
                  }`}
                >
                  {justFixed[b.id] ? 'fixed' : b.status}
                </span>
                {b.status === 'open' && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => retest(b.id)}
                    className="ml-auto rounded border border-line px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-steel transition-colors hover:border-spark/60 hover:text-paper disabled:opacity-40"
                  >
                    retest
                  </button>
                )}
              </div>
              {b.evidence && (
                <p className="mt-1 font-mono text-[10px] leading-relaxed text-steel">{b.evidence}</p>
              )}
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
