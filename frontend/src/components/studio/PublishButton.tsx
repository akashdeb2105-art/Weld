'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { publishGame } from '@/app/actions';

/**
 * Publish action (M5 "Ship it"). Gate-guarded on the backend: the Playtester
 * must prove every quality gate or the publish is refused with an honest
 * message. On success it shows the shareable public link (/play/<slug>).
 */
export function PublishButton({ slug, published }: { slug: string; published: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sharePath, setSharePath] = useState<string | null>(
    published ? `/play/${slug}` : null,
  );

  function publish() {
    setError(null);
    startTransition(async () => {
      const result = await publishGame(slug);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSharePath(result.sharePath);
      router.refresh();
    });
  }

  return (
    <div className="relative flex items-center gap-2">
      {sharePath ? (
        <a
          href={sharePath}
          target="_blank"
          rel="noreferrer"
          className="rounded-md border border-emerald-500/50 bg-emerald-500/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-emerald-300 transition-colors hover:border-emerald-400"
        >
          Live · {sharePath}
        </a>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={publish}
          className="rounded-md border border-spark/50 bg-spark/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-spark transition-colors hover:border-spark disabled:opacity-40"
        >
          {pending ? 'Publishing…' : 'Publish'}
        </button>
      )}
      {error && (
        <p
          role="alert"
          className="absolute right-0 top-full z-10 mt-1 w-64 rounded-md border border-red-500/40 bg-ink-950 p-2 font-mono text-[10px] leading-relaxed text-red-300"
        >
          {error}
        </p>
      )}
    </div>
  );
}
