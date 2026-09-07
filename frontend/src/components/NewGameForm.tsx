'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { confirmProject, draftGameBible } from '@/app/actions';
import {
  GameBibleEditor,
  applyDraft,
  bibleToDraft,
  type BibleDraft,
} from '@/components/GameBibleEditor';

/**
 * "New game" — the M1 entry point for the Game Director, now with the
 * review-before-create step: prompt -> Director drafts the spec -> you review
 * & edit it -> confirm builds the project.
 *
 * Honest UX throughout: the status line reports the real phase the request is
 * in (never a fake typewriter), the spec shows which mode composed it (LLM vs
 * offline), and API errors are surfaced verbatim.
 */

type Phase = 'idle' | 'drafting' | 'review' | 'creating';

function PhaseStatus({ phase, mode }: { phase: Phase; mode: string | null }) {
  if (phase === 'idle') return null;
  const composing =
    mode === 'llm'
      ? 'the LLM Director'
      : mode === 'offline'
        ? 'the offline composer'
        : 'the Director';
  const text =
    phase === 'drafting'
      ? `Reading your prompt — ${composing} is drafting the Game Bible…`
      : phase === 'creating'
        ? 'Creating your project and building the game…'
        : null;
  if (!text) return null;
  return (
    <p className="flex items-center gap-2 font-mono text-[11px] text-steel" role="status">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-spark" aria-hidden />
      {text}
    </p>
  );
}

export function NewGameForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [prompt, setPrompt] = useState('');
  const [bible, setBible] = useState<Record<string, unknown> | null>(null);
  const [draft, setDraft] = useState<BibleDraft | null>(null);
  const [mode, setMode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setPhase('idle');
    setBible(null);
    setDraft(null);
    setMode(null);
    setError(null);
  }

  function startDraft() {
    setError(null);
    setPhase('drafting');
    startTransition(async () => {
      const result = await draftGameBible(prompt);
      if (!result.ok) {
        setError(result.error);
        setPhase('idle');
        return;
      }
      setBible(result.gameBible);
      setDraft(bibleToDraft(result.gameBible));
      setMode(result.mode);
      setPhase('review');
    });
  }

  function confirm() {
    if (!bible || !draft) return;
    setError(null);
    setPhase('creating');
    const edited = applyDraft(bible, draft);
    startTransition(async () => {
      const result = await confirmProject(edited, prompt, mode ?? 'offline');
      if (!result.ok) {
        setError(result.error);
        setPhase('review'); // back to editing so they can fix it
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

  const busy = pending;

  return (
    <div className="w-full max-w-xl rounded-lg border border-line bg-ink-900/80 p-5">
      {phase === 'review' && bible && draft ? (
        <>
          <div className="mb-3 flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-widest text-dim">
              Review the Game Bible
            </p>
            <span className="rounded border border-line px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-dim">
              {mode === 'llm' ? 'AI Director (LLM)' : 'AI Director (offline)'}
            </span>
          </div>
          <p className="mb-4 text-xs leading-relaxed text-steel">
            The Director drafted this spec from your prompt. Tweak anything, then build it — the
            game is generated from exactly what you confirm here.
          </p>
          <GameBibleEditor draft={draft} onChange={setDraft} disabled={busy} />
          {error && (
            <p role="alert" className="mt-3 font-mono text-xs text-state-failed">
              {error}
            </p>
          )}
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={confirm}
              disabled={busy || !draft.title.trim()}
              className="rounded-md bg-spark px-4 py-2 font-mono text-xs uppercase tracking-wider text-ink-950 transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? 'Building' : 'Build this game'}
            </button>
            <button
              type="button"
              onClick={() => setPhase('idle')}
              disabled={busy}
              className="font-mono text-xs uppercase tracking-wider text-steel hover:text-paper"
            >
              Back
            </button>
            <PhaseStatus phase={phase} mode={mode} />
          </div>
        </>
      ) : (
        <>
          <label
            htmlFor="new-game-prompt"
            className="mb-2 block font-mono text-[10px] uppercase tracking-widest text-dim"
          >
            Describe your game
          </label>
          <textarea
            id="new-game-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder="e.g. A top-down arcade game where you collect glowing mushrooms and dodge acid pools."
            className="w-full resize-none rounded-md border border-line bg-ink-950 p-3 text-sm text-paper placeholder:text-dim focus:border-spark focus:outline-none"
            disabled={busy}
          />
          {error && (
            <p role="alert" className="mt-2 font-mono text-xs text-state-failed">
              {error}
            </p>
          )}
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={startDraft}
              disabled={busy || prompt.trim().length < 8}
              className="rounded-md bg-spark px-4 py-2 font-mono text-xs uppercase tracking-wider text-ink-950 transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? 'Directing' : 'Draft the spec'}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                reset();
              }}
              disabled={busy}
              className="font-mono text-xs uppercase tracking-wider text-steel hover:text-paper"
            >
              Cancel
            </button>
            <PhaseStatus phase={phase} mode={mode} />
          </div>
          <p className="mt-3 font-mono text-[10px] text-dim">
            Uses the LLM Director when a key is set; otherwise the offline composer. You review the
            spec before anything is built.
          </p>
        </>
      )}
    </div>
  );
}
