import { describe, expect, it } from 'vitest';
import { PIPELINE_STAGES } from './types';

describe('pipeline stages', () => {
  it('contains the full honest loop in order', () => {
    const ids = PIPELINE_STAGES.map((s) => s.id);
    expect(ids).toEqual(['idea', 'bible', 'build', 'play', 'test', 'fix', 'regression', 'ship']);
  });

  it('has a label for every stage', () => {
    for (const s of PIPELINE_STAGES) {
      expect(s.label.length).toBeGreaterThan(0);
    }
  });
});
