'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateGameBible } from '@/app/actions';
import {
  GameBibleEditor,
  applyDraft,
  bibleToDraft,
  type BibleDraft,
} from '@/components/GameBibleEditor';

/**
 * Studio Game Bible editor (M1). Lets you tweak the spec for a project that
 * already exists and save it — the runtime serves the bible live, so the
 * change takes effect on the next game load. The backend re-validates the
 * document before saving, so a broken edit can never be persisted.
 */
export function BibleEditPanel({
  slug,
  bible,
}: {
  slug: string;
  bible: Record<string, unknown>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<BibleDraft>(() => bibleToDraft(bible));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    setSaved(false);
    const edited = applyDraft(bible, draft);
    startTransition(async () => {
      const result = await updateGameBible(slug, edited);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      setEditing(false);
      router.refresh(); // re-fetch project + playtest so panels reflect the edit
    });
  }

  if (!editing) {
    return (
      <section className="p-4" aria-label="Edit Game Bible">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-widest text-dim">Tune the spec</p>
          <button
            type="button"
            onClick={() => {
              setDraft(bibleToDraft(bible));
              setSaved(false);
              setEditing(true);
            }}
            className="rounded-md border border-line px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-steel transition-colors hover:border-spark/60 hover:text-paper"
          >
            Edit
          </button>
        </div>
        {saved && (
          <p className="mt-2 font-mono text-[11px] text-state-verified" role="status">
            Saved — reload the game to play the updated spec.
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="p-4" aria-label="Edit Game Bible">
      <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-dim">
        Edit the Game Bible
      </p>
      <GameBibleEditor draft={draft} onChange={setDraft} disabled={pending} />
      {error && (
        <p role="alert" className="mt-3 font-mono text-xs text-state-failed">
          {error}
        </p>
      )}
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending || !draft.title.trim()}
          className="rounded-md bg-spark px-4 py-2 font-mono text-xs uppercase tracking-wider text-ink-950 transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? 'Saving' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setError(null);
          }}
          disabled={pending}
          className="font-mono text-xs uppercase tracking-wider text-steel hover:text-paper"
        >
          Cancel
        </button>
      </div>
    </section>
  );
}
