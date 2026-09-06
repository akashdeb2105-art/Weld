'use server';

/**
 * Server action: run the Game Director (M1) to create a project from a prompt.
 *
 * The browser never talks to the internal API directly — this runs on the
 * Next.js server, where WELD_API_URL is available, keeping internal URLs and
 * any provider configuration off the client bundle.
 */

const base = process.env.WELD_API_URL ?? 'http://localhost:8000';

export type CreateProjectResult =
  | { ok: true; slug: string; mode: string }
  | { ok: false; error: string };

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
    let detail = `Director failed (${res.status}).`;
    try {
      const body = (await res.json()) as { detail?: string };
      if (body.detail) detail = body.detail;
    } catch {
      /* keep default */
    }
    return { ok: false, error: detail };
  }

  const body = (await res.json()) as {
    project: { slug: string };
    mode: string;
  };
  return { ok: true, slug: body.project.slug, mode: body.mode };
}
