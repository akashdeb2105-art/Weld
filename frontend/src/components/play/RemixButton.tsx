'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { remixGame } from '@/app/actions';

/**
 * Remix action (M6 Community/Remix). Clones this published game into a new,
 * private, editable draft in the Studio (provenance `remix`, pointing back at
 * the source) and takes the user straight to it. The original is never
 * touched. Honest on failure: shows the backend's reason (e.g. "only
 * published games can be remixed").
 */
export function RemixButton({ slug }: { slug: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remix() {
    setError(null);
    startTransition(async () => {
      const result = await remixGame(slug);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(result.studioPath);
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={remix}
        disabled={pending}
        className="rounded-md border border-spark/60 bg-spark/10 px-3 py-1.5 font-mono text-[11px] font-medium uppercase tracking-wider text-spark transition-colors hover:bg-spark/20 disabled:opacity-50"
      >
        {pending ? 'Remixing…' : 'Remix this game'}
      </button>
      {error ? (
        <span className="font-mono text-[11px] text-red-300" role="alert">
          {error}
        </span>
      ) : null}
    </span>
  );
}
