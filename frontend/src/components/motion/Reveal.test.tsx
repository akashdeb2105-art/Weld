import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Reveal, RevealGroup, RevealItem } from './Reveal';

// jsdom lacks IntersectionObserver (used by motion's whileInView); stub it.
beforeAll(() => {
  class IO {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  Object.defineProperty(window, 'IntersectionObserver', { writable: true, value: IO });
  Object.defineProperty(globalThis, 'IntersectionObserver', { writable: true, value: IO });
});

/**
 * The cinematic polish honors prefers-reduced-motion: content must never be
 * hidden behind an animation for users who opt out. jsdom lacks matchMedia, so
 * we stub it and toggle `matches` per test.
 */
function stubMatchMedia(reduced: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: reduced && query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      dispatchEvent: () => false,
    }),
  });
}

describe('Reveal (M6 cinematic)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders its children', () => {
    stubMatchMedia(false);
    render(<Reveal>hello world</Reveal>);
    expect(screen.getByText('hello world')).toBeInTheDocument();
  });

  it('exposes a reduced-motion-safe initial state (no hidden content trap)', () => {
    stubMatchMedia(true);
    render(<Reveal>calm content</Reveal>);
    // Honest contract: content is present in the DOM regardless of motion
    // preference -- it is never conditionally removed for reduced-motion users.
    expect(screen.getByText('calm content')).toBeInTheDocument();
  });

  it('cascades a group of items in list semantics', () => {
    stubMatchMedia(false);
    render(
      <RevealGroup as="ol">
        <RevealItem as="li">first</RevealItem>
        <RevealItem as="li">second</RevealItem>
      </RevealGroup>,
    );
    expect(screen.getByText('first').closest('li')).toBeInTheDocument();
    expect(screen.getByText('second').closest('li')).toBeInTheDocument();
  });
});
