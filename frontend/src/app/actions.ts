'use server';

/**
 * Server actions for the Game Director (M1).
 *
 * The browser never talks to the internal API directly — these run on the
 * Next.js server, where WELD_API_URL is available, keeping internal URLs and
 * any provider configuration off the client bundle.
 */

const base = process.env.WELD_API_URL ?? 'http://localhost:8000';

export type CreateProjectResult =
  | { ok: true; slug: string; mode: string }
  | { ok: false; error: string };

export type DraftResult =
  | { ok: true; gameBible: Record<string, unknown>; mode: string; notes: string[] }
  | { ok: false; error: string };

export type SaveBibleResult = { ok: true } | { ok: false; error: string };

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: string };
    if (typeof body.detail === 'string' && body.detail) return body.detail;
  } catch {
    /* keep fallback */
  }
  return fallback;
}

/** Legacy one-shot: prompt -> project (kept for compatibility). */
export async function createProject(prompt: string): Promise<CreateProjectResult> {
  const text = prompt.trim();
  if (text.length < 8) {
    return { ok: false, error: 'Describe your game in a sentence or two.' };
  }

  let res: Response;
  try {
    res = await fetch(`${base}/api/v1/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: text }),
      cache: 'no-store',
    });
  } catch {
    return { ok: false, error: 'API unreachable. Start the backend and try again.' };
  }

  if (!res.ok) {
    return { ok: false, error: await readError(res, `Director failed (${res.status}).`) };
  }

  const body = (await res.json()) as { project: { slug: string }; mode: string };
  return { ok: true, slug: body.project.slug, mode: body.mode };
}

/**
 * Review-before-create, step 1: draft the Game Bible for a prompt without
 * persisting anything. Returns the spec for the user to review/edit.
 */
export async function draftGameBible(prompt: string): Promise<DraftResult> {
  const text = prompt.trim();
  if (text.length < 8) {
    return { ok: false, error: 'Describe your game in a sentence or two.' };
  }

  let res: Response;
  try {
    res = await fetch(`${base}/api/v1/projects/draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: text }),
      cache: 'no-store',
    });
  } catch {
    return { ok: false, error: 'API unreachable. Start the backend and try again.' };
  }
  if (!res.ok) {
    return { ok: false, error: await readError(res, `Director failed (${res.status}).`) };
  }
  const body = (await res.json()) as {
    game_bible: Record<string, unknown>;
    mode: string;
    notes: string[];
  };
  return { ok: true, gameBible: body.game_bible, mode: body.mode, notes: body.notes };
}

/**
 * Review-before-create, step 2: turn a reviewed (possibly edited) Game Bible
 * into a real project. The backend re-validates the document before saving.
 */
export async function confirmProject(
  gameBible: Record<string, unknown>,
  prompt: string,
  mode: string,
): Promise<CreateProjectResult> {
  let res: Response;
  try {
    res = await fetch(`${base}/api/v1/projects/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game_bible: gameBible, prompt, mode }),
      cache: 'no-store',
    });
  } catch {
    return { ok: false, error: 'API unreachable. Start the backend and try again.' };
  }
  if (!res.ok) {
    return { ok: false, error: await readError(res, `Could not create project (${res.status}).`) };
  }
  const body = (await res.json()) as { project: { slug: string }; mode: string };
  return { ok: true, slug: body.project.slug, mode: body.mode };
}

/** Studio editor: save an edited Game Bible for an existing project. */
export async function updateGameBible(
  slug: string,
  gameBible: Record<string, unknown>,
): Promise<SaveBibleResult> {
  let res: Response;
  try {
    res = await fetch(`${base}/api/v1/projects/${slug}/gamebible`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game_bible: gameBible }),
      cache: 'no-store',
    });
  } catch {
    return { ok: false, error: 'API unreachable. Start the backend and try again.' };
  }
  if (!res.ok) {
    return { ok: false, error: await readError(res, `Could not save Game Bible (${res.status}).`) };
  }
  return { ok: true };
}
