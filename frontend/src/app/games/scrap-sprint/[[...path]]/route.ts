import { NextRequest } from 'next/server';
import { serveGameBundleFile } from '@/lib/serveGame';

/**
 * The deterministic sample game ("Scrap Sprint") — kept at its stable URL.
 * Serves the generic bible-driven bundle with NO bible.json override, so the
 * runtime falls back to the bundled reference bible. Identical behaviour to
 * any other project's game; only the URL is special (landing + docs link here).
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> },
): Promise<Response> {
  const { path: segments = [] } = await ctx.params;
  return serveGameBundleFile('/games/scrap-sprint', segments);
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
