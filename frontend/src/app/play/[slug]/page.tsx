import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { api, type PublicGame } from '@/lib/api';
import { Wordmark } from '@/components/Wordmark';
import { RemixButton } from '@/components/play/RemixButton';

export const dynamic = 'force-dynamic';

async function fetchGame(slug: string): Promise<PublicGame | null> {
  try {
    return await api.getPublicGame(slug);
  } catch {
    return null;
  }
}

/**
 * Open Graph metadata for a published game (M6 share cards). Honest: the
 * description is the game's real summary, and 404/unpublished games get a
 * generic card (the page itself 404s anyway).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const game = await fetchGame(slug);
  if (!game) {
    return { title: 'Game not found' };
  }
  return {
    title: game.title,
    description: game.summary,
    openGraph: {
      title: game.title,
      description: game.summary,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: game.title,
      description: game.summary,
    },
  };
}

/**
 * The public share page (M5 "Ship it"). Anyone with the link can play the
 * published game — no account, no Studio. 404 unless the game is actually
 * published, so an unpublished (or gate-failing) game is never served here.
 */
export default async function PlayPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const game = await fetchGame(slug);
  if (!game) {
    notFound();
  }

  return (
    <main id="main" className="flex min-h-screen flex-col bg-ink-950 text-paper">
      <header className="flex items-center justify-between border-b border-line/60 px-5 py-3.5">
        <Link href="/" aria-label="WELD home">
          <Wordmark />
        </Link>
        <span className="flex items-center gap-3">
          <RemixButton slug={game.slug} />
          <span className="rounded bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-emerald-300">
            Published
          </span>
        </span>
      </header>

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-5 py-8">
        <div className="mb-4">
          <h1 className="font-display text-3xl font-bold tracking-tight">{game.title}</h1>
          <p className="mt-1 text-sm text-steel">{game.summary}</p>
        </div>

        <div className="overflow-hidden rounded-xl border border-line/60 bg-ink-900/40">
          <iframe
            title={`${game.title} — playable`}
            src={`/games/${game.slug}`}
            className="aspect-[16/10] w-full"
            allow="cross-origin-isolated"
          />
        </div>

        <p className="mt-3 text-center font-mono text-[11px] uppercase tracking-widest text-dim">
          WASD / arrows move · E collect · Esc pause · R restart
        </p>
      </div>
    </main>
  );
}
