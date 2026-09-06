'use client';

/**
 * Game Bible panel — renders the real spec contract for the project.
 */
export function SpecPanel({ bible }: { bible: Record<string, any> | null }) {
  if (!bible) {
    return (
      <section className="p-4" aria-label="Game Bible">
        <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-dim">Game Bible</p>
        <p className="text-sm text-dim">No game bible loaded.</p>
      </section>
    );
  }

  const win = bible.win_condition as { target?: number; description?: string } | undefined;
  const controls = bible.controls as Record<string, string[]> | undefined;
  const systems = (bible.systems as string[]) ?? [];
  const coreLoop = (bible.core_loop as string[]) ?? [];

  return (
    <section className="p-4" aria-label="Game Bible">
      <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-dim">
        Game Bible · v{bible.schemaVersion}
      </p>

      <div className="space-y-4">
        <div className="rounded-md border border-line/60 bg-ink-950/50 p-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-spark-soft">Goal</p>
          <p className="mt-1 text-sm leading-relaxed text-steel">{win?.description}</p>
        </div>

        <div className="rounded-md border border-line/60 bg-ink-950/50 p-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-spark-soft">Core loop</p>
          <ol className="mt-2 space-y-1">
            {coreLoop.map((step, i) => (
              <li key={step} className="flex items-center gap-2 font-mono text-[11px] text-steel">
                <span className="text-dim">{String(i + 1).padStart(2, '0')}</span>
                {step.replace(/_/g, ' ')}
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-md border border-line/60 bg-ink-950/50 p-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-spark-soft">Controls</p>
          <dl className="mt-2 space-y-1 font-mono text-[11px]">
            {Object.entries(controls ?? {}).map(([action, keys]) => (
              <div key={action} className="flex justify-between gap-2">
                <dt className="text-dim">{action}</dt>
                <dd className="text-right text-paper">{(keys as string[]).join(' / ')}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="rounded-md border border-line/60 bg-ink-950/50 p-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-spark-soft">Systems</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {systems.map((s) => (
              <span
                key={s}
                className="rounded border border-line px-1.5 py-0.5 font-mono text-[10px] text-steel"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
