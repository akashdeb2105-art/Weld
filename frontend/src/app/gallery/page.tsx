import Link from 'next/link';
import { api, type PublicGame } from '@/lib/api';
import { Wordmark } from '@/components/Wordmark';
import { Reveal, RevealGroup, RevealItem } from '@/components/motion/Reveal';

export const dynamic = 'force-dynamic';

/**
 * The public gallery (M6 Community). Every published game, discoverable in one
 * place. Honest by construction: only games that passed every quality gate and
 * were actually published appear here — a private draft or a broken build is
 * never surfaced. Empty state is honest, not a fake placeholder grid.
 */
export default async function GalleryPage() {
  let games: PublicGame[] = [];
  let apiDown = false;
  try {
    games = await api.listPublished();
  } catch {
    apiDown = true;
  }

  return (
    <main id="main" className="min-h-screen bg-ink-950 text-paper">
      <header className="flex items-center justify-between border-b border-line/60 px-5 py-3.5">
        <Link href="/" aria-label="WELD home">
          <Wordmark />
        </Link>
        <Link
          href="/app"
          className="rounded-md bg-spark px-4 py-2 font-mono text-xs font-medium uppercase tracking-wider text-ink-950 transition-colors hover:bg-spark-soft"
        >
          Open the Studio
        </Link>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-14">
        <Reveal>
          <p className="font-mono text-[11px] uppercase tracking-widest text-spark">
            Made with WELD
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight sm:text-5xl">
            The gallery.
          </h1>
          <p className="mt-4 max-w-xl leading-relaxed text-steel">
            Every game here was described, built, played, broken, fixed, and shipped by WELD — and
            survived its own playtest before going public. Play one, then remix it into your own.
          </p>
        </Reveal>

        {apiDown ? (
          <Reveal>
            <p className="mt-12 rounded-md border border-line bg-ink-900/60 p-6 font-mono text-sm text-steel">
              The gallery is unavailable right now — the studio API is offline. Nothing to hide;
              check back shortly.
            </p>
          </Reveal>
        ) : games.length === 0 ? (
          <Reveal>
            <p className="mt-12 rounded-md border border-line bg-ink-900/60 p-6 font-mono text-sm text-steel">
              No published games yet. The first one is yours —{' '}
              <Link href="/app" className="text-spark-soft underline underline-offset-2">
                describe it in the Studio
              </Link>
              .
            </p>
          </Reveal>
        ) : (
          <RevealGroup as="ul" className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" stagger={0.08}>
            {games.map((g) => (
              <RevealItem as="li" key={g.slug} className="h-full">
                <Link
                  href={`/play/${g.slug}`}
                  className="group flex h-full flex-col rounded-lg border border-line bg-ink-900/60 p-5 transition-colors hover:border-line-strong"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-spark-soft">
                      {g.genre}
                    </span>
                    <span className="rounded bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-emerald-300">
                      Published
                    </span>
                  </div>
                  <h2 className="font-display text-lg font-semibold leading-snug text-paper group-hover:text-spark-soft">
                    {g.title}
                  </h2>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-steel">{g.summary}</p>
                  <p className="mt-4 border-t border-line/60 pt-3 font-mono text-[10px] uppercase tracking-widest text-dim">
                    Play &amp; remix →
                  </p>
                </Link>
              </RevealItem>
            ))}
          </RevealGroup>
        )}
      </div>
    </main>
  );
}
