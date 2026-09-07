import { describe, expect, it } from 'vitest';

import { parseGameBible, sampleBible, type GameBible } from '@weld/gamebible';
import { playtest, formatReport, type PlaytestReport } from './index.js';

const bible = parseGameBible(sampleBible);

function gate(report: PlaytestReport, name: string) {
  const g = report.gates.find((x) => x.gate === name);
  expect(g, `gate ${name} present`).toBeDefined();
  return g!;
}

describe('WELD Playtester (M3)', () => {
  it('proves every quality gate for the deterministic sample bible', () => {
    const report = playtest(bible);

    expect(report.slug).toBe('scrap-sprint');
    expect(report.pass).toBe(true);
    for (const g of report.gates) {
      expect(g.pass, `gate ${g.gate} should pass: ${g.evidence}`).toBe(true);
    }
  });

  it('reaches "win" with evidence (delivers the target)', () => {
    const report = playtest(bible);
    const win = gate(report, 'win_reachable');
    expect(win.pass).toBe(true);
    expect(win.detail?.['status']).toBe('win');
    expect(win.detail?.['delivered']).toBe(bible.win_condition.target);
    // The solver finished the run without dying (it avoids hazards).
    expect(win.detail?.['lives']).toBeGreaterThan(0);
  });

  it('reaches both declared lose conditions with evidence', () => {
    const report = playtest(bible);
    const lose = gate(report, 'lose_reachable');
    expect(lose.pass).toBe(true);
    expect(lose.evidence).toMatch(/timer_zero/);
    expect(lose.evidence).toMatch(/health_zero/);
  });

  it('is deterministic: same bible -> identical verdict and evidence', () => {
    const a = playtest(bible);
    const b = playtest(bible);
    expect(a).toEqual(b);
  });

  it('fails honestly when the win target exceeds available pickups', () => {
    // Break the game: require more deliveries than there are pickups.
    const broken: GameBible = parseGameBible({
      ...JSON.parse(JSON.stringify(bible)),
      win_condition: { ...bible.win_condition, target: 999, description: 'impossible' },
    });
    const report = playtest(broken);
    const win = gate(report, 'win_reachable');
    expect(win.pass).toBe(false);
    expect(report.pass).toBe(false);
    expect(formatReport(report)).toMatch(/FAIL/);
  });

  it('formats a readable PASS/FAIL report block', () => {
    const report = playtest(bible);
    const text = formatReport(report);
    expect(text).toContain('scrap-sprint');
    expect(text).toMatch(/PASS\s+win_reachable/);
    expect(text).toMatch(/PASS\s+lose_reachable/);
  });

  // M6 Visual QA
  it('proves the sample scene renders non-blank content', () => {
    const report = playtest(bible);
    const renders = gate(report, 'renders');
    expect(renders.pass).toBe(true);
    expect(renders.detail?.['renderables']).toBeGreaterThan(0);
    expect(renders.detail?.['paletteColors']).toBeGreaterThan(0);
    expect(renders.detail?.['playerInBounds']).toBe(true);
  });

  it('fails Visual QA honestly when the player spawns off-canvas', () => {
    // Broken render: the player spawns outside the level bounds, so nothing
    // visible is drawn where the player should be. (Schema-valid: spawn is a
    // free point; only the bounds are constrained.)
    const offscreen: GameBible = parseGameBible({
      ...JSON.parse(JSON.stringify(bible)),
      level: { ...bible.level, player_spawn: { x: -500, y: -500 } },
    });
    const report = playtest(offscreen);
    const renders = gate(report, 'renders');
    expect(renders.pass).toBe(false);
    expect(renders.evidence).toMatch(/out of bounds/);
    expect(renders.detail?.['playerInBounds']).toBe(false);
  });
});
