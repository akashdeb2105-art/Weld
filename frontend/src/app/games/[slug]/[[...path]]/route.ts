import { NextRequest, NextResponse } from 'next/server';
import { api } from '@/lib/api';
import { gameNotBuilt, serveBibleJson, serveGameBundleFile } from '@/lib/serveGame';

/**
 * A project's playable game (blueprint "Build it").
 *
 * Serves the generic bible-driven bundle keyed to this project's own Game
 * Bible. `bible.json` is fetched from the API (`GET /projects/{slug}/gamebible`)
 * so the runtime boots the game the user actually described; every other asset
 * is the shared bundle. Unknown / missing bibles degrade honestly.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ slug: string; path?: string[] }> },
): Promise<Response> {
  const { slug, path: segments = [] } = await ctx.params;
  const routeBase = `/games/${slug}`;

  // The runtime's first fetch: the project's bible.
  if (segments.length === 1 && segments[0] === 'bible.json') {
    let bible: unknown;
    try {
      const out = await api.getGameBible(slug);
      bible = out.data;
    } catch {
      return new NextResponse(`No game bible for '${slug}'.`, { status: 404 });
    }
    return serveBibleJson(bible);
  }

  // Everything else is the shared bundle.
  const res = await serveGameBundleFile(routeBase, segments);
  return res ?? gameNotBuilt();
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
