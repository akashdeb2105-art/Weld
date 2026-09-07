import { describe, expect, it } from 'vitest';

import { parseGameBible } from './index';
import { sampleBible } from './sample';
import { themeColors, themeWords } from './theme';

const sample = parseGameBible(sampleBible);

describe('themeColors', () => {
  it('reproduces the Scrap Sprint palette for the sample bible', () => {
    const c = themeColors(sample);
    expect(c.goal).toBe(0xff5c1a);
    expect(c.pickup).toBe(0x8fd3ff);
    expect(c.text).toBe('#F2F0EA');
    expect(c.bg).toBe(0x0b0d12);
  });

  it('drives colors from a custom bible palette', () => {
    const custom = parseGameBible({
      ...sampleBible,
      visual_direction: {
        ...sampleBible.visual_direction,
        palette: ['#101010', '#202020', '#00FF00', '#FF00FF', '#FFFFFF'],
      },
    });
    const c = themeColors(custom);
    expect(c.bg).toBe(0x101010);
    expect(c.goal).toBe(0x00ff00);
    expect(c.pickup).toBe(0xff00ff);
    expect(c.text).toBe('#FFFFFF');
  });
});

describe('themeWords', () => {
  it('uses the sample vocabulary for the sample bible', () => {
    const w = themeWords(sample);
    expect(w.pickup).toBe('scrap');
    expect(w.pickupCaps).toBe('SCRAP');
    expect(w.goal).toBe('FURNACE');
    expect(w.hazard).toBe('spark pits');
  });

  it('derives nouns from a described bible core loop', () => {
    const custom = parseGameBible({
      ...sampleBible,
      core_loop: [
        'spot_glowing_mushrooms',
        'collect_glowing_mushrooms',
        'avoid_acid_pools',
        'deliver_to_goal',
        'earn_score',
        'beat_the_timer',
      ],
    });
    const w = themeWords(custom);
    expect(w.pickup).toBe('mushroom');
    expect(w.pickupCaps).toBe('MUSHROOM');
    expect(w.hazard).toBe('pools');
  });
});
