import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  GAME_BIBLE_SCHEMA_VERSION,
  GameBibleSchema,
  isGameBible,
  parseGameBible,
} from './index.js';

const here = dirname(fileURLToPath(import.meta.url));
const samplePath = join(here, 'scrap-sprint.gamebible.json');

describe('GameBible schema', () => {
  it('parses the canonical deterministic sample fixture', () => {
    const raw = JSON.parse(readFileSync(samplePath, 'utf-8'));
    const bible = parseGameBible(raw);

    expect(bible.schemaVersion).toBe(GAME_BIBLE_SCHEMA_VERSION);
    expect(bible.game.slug).toBe('scrap-sprint');
    expect(bible.player.health).toBe(3);
    expect(bible.win_condition.target).toBe(5);
    expect(bible.level.pickups.length).toBeGreaterThanOrEqual(
      bible.win_condition.target,
    );
    expect(bible.provenance.origin).toBe('deterministic_sample');
  });

  it('rejects a bible missing a win condition', () => {
    const raw = JSON.parse(readFileSync(samplePath, 'utf-8'));
    delete raw.win_condition;
    expect(isGameBible(raw)).toBe(false);
    expect(() => parseGameBible(raw)).toThrow();
  });

  it('rejects unknown extra fields (strict contract)', () => {
    const raw = JSON.parse(readFileSync(samplePath, 'utf-8'));
    raw.magic_field = 'nope';
    expect(() => parseGameBible(raw)).toThrow();
  });

  it('requires all quality gates to be explicitly true', () => {
    const raw = JSON.parse(readFileSync(samplePath, 'utf-8'));
    raw.quality_requirements.win_reachable = false;
    expect(() => GameBibleSchema.parse(raw)).toThrow();
  });

  it('enforces kebab-case slugs and sane level bounds', () => {
    const raw = JSON.parse(readFileSync(samplePath, 'utf-8'));
    raw.game.slug = 'Scrap Sprint!';
    expect(() => parseGameBible(raw)).toThrow();

    const raw2 = JSON.parse(readFileSync(samplePath, 'utf-8'));
    raw2.level.width = -5;
    expect(() => parseGameBible(raw2)).toThrow();
  });
});
