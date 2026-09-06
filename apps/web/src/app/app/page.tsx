import Link from 'next/link';
import { api, type Project } from '@/lib/api';
import { Wordmark } from '@/components/Wordmark';
import { StatePill } from '@/components/StatePill';
import { NewGameForm } from '@/components/NewGameForm';
import type { SemanticState } from '@/lib/types';

export const dynamic = 'force-dynamic';

function statusToState(status: string): SemanticState {
  switch (status) {
    case 'verified':
      return 'verified';
    case 'published':
      return 'published';
    case 'draft':
    default:
      return 'neutral';
  }
}

export default async function ProjectsPage() {
  let projects: Project[] = [];
  let apiUp = true;
  try {
    projects = await api.listProjects();
  } catch {
    apiUp = false;
  }

  return (
    <main id="main" className="min-h-screen bg-ink-950 text-paper">
      <header className="border-b border-line/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <Link href="/" aria-label="WELD home">
            <Wordmark />
          </Link>
          <Link
            href="/"
            className="font-mono text-xs uppercase tracking-wider text-steel hover:text-paper"
          >
            ← Site
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-12">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl font-bold tracking-tight">Your games</h1>
            <p className="mt-2 text-steel">
              Describe a game and the Director drafts its Game Bible (M1). The deterministic
              reference project is here too — open any of them in the Studio.
            </p>
          </div>
          <NewGameForm />
        </div>

        {!apiUp && (
          <div
            role="alert"
            className="mb-6 rounded-md border border-state-warning/40 bg-state-warning/10 p-4 text-sm text-state-warning"
          >
            API unreachable. Start the backend with <code className="font-mono">weld dev</code> or{' '}
            <code className="font-mono">docker compose up</code>, then reload.
          </div>
        )}

        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                href={`/app/studio/${p.slug}`}
                className="group block rounded-lg border border-line bg-ink-900/60 p-5 transition-colors hover:border-spark/60 focus-visible:border-spark"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-dim">
                    {p.genre.replace(/_/g, ' ')}
                  </span>
                  <StatePill state={statusToState(p.status)} label={p.status} />
                </div>
                <h2 className="font-display text-xl font-semibold text-paper group-hover:text-spark-soft">
                  {p.title}
                </h2>
                <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-steel">{p.summary}</p>
                <p className="mt-4 border-t border-line/60 pt-3 font-mono text-[10px] uppercase tracking-widest text-dim">
                  {p.provenance === 'deterministic_sample'
                    ? 'Deterministic sample'
                    : p.provenance === 'ai_generated'
                      ? 'AI Director (LLM)'
                      : p.provenance === 'offline_draft'
                        ? 'AI Director (offline)'
                        : p.provenance}
                </p>
              </Link>
            </li>
          ))}
        </ul>

        {apiUp && projects.length === 0 && (
          <p className="rounded-md border border-line bg-ink-900/60 p-8 text-center text-steel">
            No projects yet. The sample project seeds automatically — check the API logs.
          </p>
        )}
      </div>
    </main>
  );
}
