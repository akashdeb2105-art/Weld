import { beforeAll, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Playhead } from './Playhead';

// jsdom lacks matchMedia; stub it for the Playhead's reduced-motion check.
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      dispatchEvent: () => false,
    }),
  });
});

describe('Playhead', () => {
  it('marks the active stage with aria-current', () => {
    render(<Playhead activeStage="play" />);
    const active = screen.getAllByText('Play');
    expect(active.some((el) => el.getAttribute('aria-current') === 'step')).toBe(true);
  });

  it('renders all stages as reachable labels', () => {
    render(<Playhead activeStage="idea" />);
    for (const label of ['Idea', 'Bible', 'Build', 'Play', 'Test', 'Fix', 'Regression', 'Ship']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });
});
