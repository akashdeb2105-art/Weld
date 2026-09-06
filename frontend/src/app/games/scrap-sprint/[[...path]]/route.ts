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

  const body = await readFile(filePath);
  return new NextResponse(new Uint8Array(body), {
    headers: {
      'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    },
  });
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
