/**
 * Build the playtester library (dist/index.js via tsc) AND bundle a
 * self-contained CLI (dist/cli.cjs) the backend can run with plain `node`.
 *
 * The library keeps normal dist output. The CLI is bundled (engine +
 * gamebible + playtester inlined) because @weld/gamebible ships extensionless
 * ESM that raw Node can't resolve — bundling sidesteps that and gives the
 * FastAPI bridge one stable artifact to invoke.
 */
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';

// 1. Library output (types + ESM) for any TS consumer.
const tsc = process.platform === 'win32' ? 'npx.cmd' : 'npx';
execFileSync(tsc, ['tsc', '-p', 'tsconfig.json'], { stdio: 'inherit', shell: process.platform === 'win32' });

// 2. Self-contained CLI for the backend to shell out to.
await build({
  entryPoints: ['src/cli.ts'],
  outfile: 'dist/cli.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  logLevel: 'info',
});

console.log('built dist/index.js + dist/cli.cjs');
