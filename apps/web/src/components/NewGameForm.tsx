'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createProject } from '@/app/actions';

/**
 * "New game" prompt form — the M1 entry point for the Game Director.
 *
 * Honest UX: it shows exactly what the Director did (real LLM vs. offline
 * composer) via the mode it returns, and surfaces actionable API errors
 * (e.g. unsupported genre) verbatim instead of a generic failure.
 */
export function NewGameForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await createProject(prompt);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/app/studio/${result.slug}`);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-spark/60 bg-spark/10 px-5 py-2.5 font-mono text-xs uppercase tracking-wider text-spark-soft transition-colors hover:bg-spark/20"
      >
        + New game
      </button>
    );
  }

  return (
    <div className="w-full max-w-xl rounded-lg border border-line bg-ink-900/80 p-5">
      <label htmlFor="new-game-prompt" className="mb-2 block font-mono text-[10px] uppercase tracking-widest text-dim">
        Describe your game
      </label>
      <textarea
        id="new-game-prompt"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={3}
        placeholder="e.g. A top-down arcade game where you collect glowing mushrooms and dodge acid pools."
        className="w-full resize-none rounded-md border border-line bg-ink-950 p-3 text-sm text-paper placeholder:text-dim focus:border-spark focus:outline-none"
        disabled={pending}
      />
      {error && (
        <p role="alert" className="mt-2 font-mono text-xs text-state-failed">
          {error}
        </p>
      )}
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={pending || prompt.trim().length < 8}
          className="rounded-md bg-spark px-4 py-2 font-mono text-xs uppercase tracking-wider text-ink-950 transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? 'Directing…' : 'Direct it'}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          disabled={pending}
          className="font-mono text-xs uppercase tracking-wider text-steel hover:text-paper"
        >
          Cancel
        </button>
        <p className="ml-auto font-mono text-[10px] text-dim">
          Uses the LLM Director when a key is set; otherwise the offline composer.
        </p>
      </div>
    </div>
  );
}
