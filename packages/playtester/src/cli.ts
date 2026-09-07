#!/usr/bin/env node
/**
 * WELD Playtester CLI \u2014 the seam between the Python API and the TS engine.
 *
 *   node cli.ts <gamebible.json>
 *
 * Reads a GameBible document from a JSON file, runs the deterministic
 * playtest, and prints the report as JSON on stdout. Exit code 0 when every
 * quality gate passed, 1 when any gate failed, 2 for usage/parse errors.
 * Kept dependency-light so the backend can invoke it with plain `node`.
 */
import { readFile } from 'node:fs/promises';
import { parseGameBible } from '@weld/gamebible';
import { playtest } from './index.js';

async function main(): Promise<number> {
  const file = process.argv[2];
  if (!file) {
    console.error('usage: node cli.ts <gamebible.json>');
    return 2;
  }

  let raw: string;
  try {
    raw = await readFile(file, 'utf8');
  } catch {
    console.error(`cannot read bible file: ${file}`);
    return 2;
  }

  let bible;
  try {
    bible = parseGameBible(JSON.parse(raw));
  } catch (err) {
    console.error(`invalid GameBible: ${err instanceof Error ? err.message : String(err)}`);
    return 2;
  }

  const report = playtest(bible);
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  return report.pass ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(2);
  },
);
