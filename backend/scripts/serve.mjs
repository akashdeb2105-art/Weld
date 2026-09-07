/**
 * Launch the FastAPI app with the project's Python venv when one exists.
 *
 * `npm run dev`/e2e spawn a bare `uvicorn`, which resolves to whatever Python
 * is on PATH. On a fresh clone (or Windows) that's often the system Python
 * without the API deps installed, so the server crashes. This wrapper prefers
 * `.venv` (the documented local setup) and falls back to system `uvicorn`.
 *
 * Usage: node scripts/serve.mjs <port> [--reload]
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const backendDir = join(here, '..');

// If a SQLite DATABASE_URL points at a file, make sure its parent directory
// exists first — otherwise the app crashes on startup with "unable to open
// database file" (the e2e config writes to e2e/.tmp, which isn't committed).
const dbUrl = process.env.DATABASE_URL ?? '';
const sqliteMatch = dbUrl.match(/^sqlite\+?\w*:\/\/\/(.+)$/);
if (sqliteMatch) {
  const dbPath = sqliteMatch[1];
  const dir = dirname(dbPath);
  if (dir && dir !== '.' && !existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  // Hermetic e2e (playwright.config §92/§93): the suite promises a FRESH
  // database, but Playwright's `reuseExistingServer` reuses this process —
  // and its DB file — across local runs, so the "No published games yet"
  // assertion broke on any second run. When (and only when) ENVIRONMENT=test,
  // drop the prior DB on startup so each launch of the test API is genuinely
  // hermetic. The app re-creates + seeds the schema on boot. Production/dev
  // never set ENVIRONMENT=test, so real data is never touched.
  if (process.env.ENVIRONMENT === 'test' && existsSync(dbPath)) {
    rmSync(dbPath, { force: true });
  }
}

const port = process.argv[2] ?? '8000';
const reload = process.argv.includes('--reload');

const isWin = process.platform === 'win32';
const venvPython = join(backendDir, '.venv', isWin ? 'Scripts' : 'bin', isWin ? 'python.exe' : 'python');

let cmd;
let args;
if (existsSync(venvPython)) {
  cmd = venvPython;
  args = ['-m', 'uvicorn', 'app.main:app', '--host', '0.0.0.0', '--port', port];
} else {
  cmd = 'uvicorn';
  args = ['app.main:app', '--host', '0.0.0.0', '--port', port];
}
if (reload) args.push('--reload');

const child = spawn(cmd, args, { cwd: backendDir, stdio: 'inherit' });
child.on('exit', (code) => process.exit(code ?? 0));
