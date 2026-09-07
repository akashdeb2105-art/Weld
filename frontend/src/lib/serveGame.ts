import { existsSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { NextResponse } from 'next/server';

/**
 * Shared server-side machinery for serving a playable WELD game bundle.
 *
 * One generic, bible-driven Phaser bundle is built once (packages/sample-game)
 * and copied into frontend/public/sample-game. Every project — the deterministic
 * sample AND any game the Director drafts — is served from that same bundle
 * under /games/<slug>; the per-project difference is only the `bible.json`
 * the runtime fetches at boot. (Blueprint: "Build it" — one runtime, many
 * bibles, honestly deterministic for M2.)
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

function bundleDir(): string {
  return resolve(process.cwd(), 'public', 'sample-game');
}

/** The game runs in a cross-document sandboxed iframe (opaque origin), so the
 * browser applies CORS to its sub-resources. Allow it, or the bundle is
 * blocked and the canvas never mounts. */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Cross-Origin-Resource-Policy': 'cross-origin',
  'Cache-Control': 'no-store',
} as const;

/** Serve one file from the bundle dir, path-traversal safe. `routeBase` is the
 * public URL prefix (e.g. "/games/scrap-sprint") used to inject <base href> so
 * relative asset URLs resolve no matter how the URL was typed. */
export async function serveGameBundleFile(
  routeBase: string,
  segments: string[],
): Promise<Response> {
  const dir = bundleDir();
  const requested = segments.length ? segments.join('/') : 'index.html';
  const safePath = normalize(requested).replace(/^(\.\.[/\\])+/, '');
  let filePath = join(dir, safePath);

  // Never escape the bundle dir.
  if (filePath !== dir && !filePath.startsWith(dir + sep)) {
    return new NextResponse('forbidden', { status: 403 });
  }
  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    // Fallback: unknown paths serve index.html.
    filePath = join(dir, 'index.html');
    if (!existsSync(filePath)) {
      return new NextResponse(
        'Game not built yet. Run `npm run sample:build` then restart the web app.',
        { status: 503 },
      );
    }
  }

  if (extname(filePath) === '.html') {
    const html = (await readFile(filePath, 'utf8')).replace(
      '<head>',
      `<head><base href="${routeBase}/" />`,
    );
    return new NextResponse(html, {
      headers: { ...CORS_HEADERS, 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const body = await readFile(filePath);
  return new NextResponse(new Uint8Array(body), {
    headers: { ...CORS_HEADERS, 'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream' },
  });
}

/** Serve a project's GameBible as `bible.json` (what the runtime fetches). */
export function serveBibleJson(bible: unknown): Response {
  return new NextResponse(JSON.stringify(bible), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

export function gameNotBuilt(): Response {
  return new NextResponse(
    'Game not built yet. Run `npm run sample:build` then restart the web app.',
    { status: 503 },
  );
}

export { bundleDir };
