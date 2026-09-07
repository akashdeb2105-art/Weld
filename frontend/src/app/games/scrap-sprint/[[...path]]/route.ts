import { existsSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Serves the deterministic sample game from the directory copied into the
 * app at startup (scripts/copy-sample-game.mjs). In Docker the built game is
 * baked into the image; in dev `npm run dev` copies it first.
 */

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.map': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

function sampleDir(): string {
  return resolve(process.cwd(), 'public', 'sample-game');
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> },
): Promise<Response> {
  const { path: segments = [] } = await ctx.params;
  const dir = sampleDir();
  const requested = segments.length ? segments.join('/') : 'index.html';
  const safePath = normalize(requested).replace(/^(\.\.[/\\])+/, '');
  let filePath = join(dir, safePath);

  // Never escape the sample dir.
  if (filePath !== dir && !filePath.startsWith(dir + sep)) {
    return new NextResponse('forbidden', { status: 403 });
  }
  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    // Fallback: unknown paths serve index.html.
    filePath = join(dir, 'index.html');
    if (!existsSync(filePath)) {
      return new NextResponse(
        'Sample game not built yet. Run `npm run sample:build` then restart the web app.',
        { status: 503 },
      );
    }
  }

  // The game HTML references its bundle with a RELATIVE path (./assets/...),
  // which breaks when the route is reached without a trailing slash. Inject a
  // <base href> so relative URLs always resolve under /games/scrap-sprint/
  // regardless of how the URL was typed. (A redirect doesn't work here — Next
  // normalizes the trailing slash away, which caused an infinite 308 loop.)
  if (extname(filePath) === '.html') {
    const html = (await readFile(filePath, 'utf8')).replace(
      '<head>',
      '<head><base href="/games/scrap-sprint/" />',
    );
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
        'Cross-Origin-Resource-Policy': 'cross-origin',
      },
    });
  }

  const body = await readFile(filePath);
  // The game is embedded in a cross-document iframe whose module scripts load
  // from an opaque origin ("null"), so the browser applies CORS. Allow it, or
  // the game bundle is blocked and the canvas never mounts.
  return new NextResponse(new Uint8Array(body), {
    headers: {
      'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    },
  });
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
