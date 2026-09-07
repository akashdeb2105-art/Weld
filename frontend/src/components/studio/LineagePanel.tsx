import Link from 'next/link';
import type { Job, Project } from '@/lib/api';

/**
 * Versions tab — the project's remix lineage (M6 Community/Remix), shown
 * honestly from the data the crew already records. Every remix appends a real
 * `remix` job on the *child*: its `result.remixed_from` names the parent it was
 * cloned from. So lineage is not a new invention — it is the recorded remix
 * jobs rendered as a family (parent above, remixes below).
 *
 * Honest by construction: a project that was never remixed shows a truthful
 * "No remixes yet"; a remix names its real parent (or says so if the parent is
 * no longer listed). Nothing is synthesized. `remixes` is computed server-side
 * from each remix project's recorded job, so the panel only shows lineage the
 * data actually proves.
 */
export function LineagePanel({
  title,
  provenance,
  createdAt,
  updatedAt,
  jobs,
  remixes,
}: {
  title: string;
  provenance: string;
  createdAt: string;
  updatedAt: string;
  jobs: Job[];
  remixes: Project[];
}) {
  const isRemix = provenance === 'remix';
  // This project's parent: its own remix job, if it is itself a remix.
  const remixJob = jobs.find((j) => j.type === 'remix');
  const parentSlug =
    (remixJob?.result?.['remixed_from'] as string | undefined) ??
    (remixJob?.payload?.['source_slug'] as string | undefined) ??
    null;
  const originNote = isRemix
    ? 'A remix — source shown above when it is still listed.'
    : 'An original — not remixed from another game.';

  return (
    <section className="p-4" aria-label="Versions">
      <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-dim">
        Versions · remix lineage
      </p>

      {/* Parent (only if this project is itself a remix) */}
      {isRemix && (
        <div className="mb-4">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-dim">
            Remixed from
          </p>
          {parentSlug ? (
            <LineageLink slug={parentSlug} />
          ) : (
            <p className="font-mono text-[11px] text-dim">Source project no longer listed.</p>
          )}
        </div>
      )}

      {/* This project */}
      <div className="mb-4 rounded-md border border-spark/40 bg-ink-800/60 px-3 py-2">
        <p className="truncate font-display text-sm font-semibold text-paper">{title}</p>
        <p className="font-mono text-[10px] uppercase tracking-wider text-dim">
          this project · {provenance.replace(/_/g, ' ')}
        </p>
        <p className="mt-1 font-mono text-[10px] text-steel">{originNote}</p>
        <p className="mt-1 font-mono text-[10px] text-dim">
          created {fmt(createdAt)}
          {updatedAt !== createdAt ? ` · updated ${fmt(updatedAt)}` : ''}
        </p>
      </div>

      {/* Remixes */}
      <div>
        <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-dim">
          Remixes of this
        </p>
        {remixes.length > 0 ? (
          <ul className="space-y-1.5">
            {remixes.map((c) => (
              <li key={c.slug}>
                <LineageLink slug={c.slug} title={c.title} createdAt={c.created_at} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="font-mono text-[11px] text-dim">No remixes yet.</p>
        )}
      </div>
    </section>
  );
}

/** A lineage entry linking to a sibling project's Studio. */
function LineageLink({
  slug,
  title,
  createdAt,
}: {
  slug: string;
  title?: string;
  createdAt?: string;
}) {
  return (
    <Link
      href={`/app/studio/${slug}`}
      className="block rounded-md border border-line/60 bg-ink-900/60 px-3 py-2 transition-colors hover:border-spark/50"
    >
      <p className="truncate font-display text-sm text-paper">{title ?? slug}</p>
      <p className="font-mono text-[10px] uppercase tracking-wider text-dim">
        {slug}
        {createdAt ? ` · ${fmt(createdAt)}` : ''}
      </p>
    </Link>
  );
}

/** Short, stable date for lineage rows (ISO date only — no TZ-dependent time). */
function fmt(iso: string): string {
  return iso.slice(0, 10);
}
