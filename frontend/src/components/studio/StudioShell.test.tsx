import { beforeAll, describe, expect, it, vi } from 'vitest';
import { act, render, screen, fireEvent, within } from '@testing-library/react';

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

// The Studio panels call useRouter() (refresh after logging a bug / retest).
// In jsdom there is no Next router, so mock the seam the panels actually use.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

import { StudioShell } from './StudioShell';
import type { ProjectDetail, PlaytestReport, RegressionSuite } from '@/lib/api';

const project = {
  id: 1,
  slug: 'scrap-sprint',
  title: 'Scrap Sprint',
  prompt: 'collect scrap',
  summary: 'collect scrap',
  genre: 'platformer',
  status: 'built',
  provenance: 'deterministic_sample',
  published: false,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
  game_bible: { game: { slug: 'scrap-sprint', title: 'Scrap Sprint' }, level: { width: 960 } },
  jobs: [],
} as unknown as ProjectDetail;

const playtest = {
  slug: 'scrap-sprint',
  pass: true,
  gates: [],
  simulatedSeconds: 12,
} as unknown as PlaytestReport;

const regressions = { total: 0, passing: 0, suites: [] } as unknown as RegressionSuite;

describe('StudioShell project nav', () => {
  // The Playhead also renders a nav labelled "Project"; the tab bar is the one
  // that actually contains the Overview/Source/Tests/Issues buttons.
  function tabBar() {
    const navs = screen.getAllByRole('navigation', { name: 'Project' });
    const withTabs = navs.find((n) => within(n).queryByRole('button', { name: 'Source' }));
    expect(withTabs, 'a Project nav containing the tab buttons exists').toBeTruthy();
    return withTabs!;
  }

  it('every nav tab is a real, clickable control (no more "soon" placeholders)', async () => {
    const view = render(
      <StudioShell project={project} playtest={playtest} playtestError={null} bugs={[]} regressions={regressions} lineageChildren={[]} />,
    );
    // The M5-era "lands in a later milestone" placeholders are gone — the crew
    // behind every tab has landed, so none may be disabled or marked "soon".
    expect(screen.queryByText(/soon/i)).toBeNull();
    const nav = tabBar();
    for (const label of ['Overview', 'Source', 'Tests', 'Issues', 'Versions']) {
      const el = within(nav).getByRole('button', { name: label });
      expect(el).not.toBeDisabled();
    }
    // Flush effects/queue and tear down inside act so no concurrent-scheduled
    // update outlives the test (CI hit "window is not defined" after teardown).
    await act(async () => {
      view.unmount();
    });
  });

  it('switches the right rail to real content for each tab', async () => {
    const view = render(
      <StudioShell project={project} playtest={playtest} playtestError={null} bugs={[]} regressions={regressions} lineageChildren={[]} />,
    );
    const nav = tabBar();
    // Source tab shows the real Game Bible (blueprint §6).
    fireEvent.click(within(nav).getByRole('button', { name: 'Source' }));
    expect(screen.getByLabelText('Source')).toBeTruthy();
    // Tests tab shows the real playtest panel.
    fireEvent.click(within(nav).getByRole('button', { name: 'Tests' }));
    expect(screen.getByLabelText('Playtest')).toBeTruthy();
    // Issues tab shows the real regression panel.
    fireEvent.click(within(nav).getByRole('button', { name: 'Issues' }));
    expect(screen.getByLabelText('Regression')).toBeTruthy();
    // Versions tab shows the real remix lineage (M6) — here, an honest
    // not-a-remix original with no remixes yet.
    fireEvent.click(within(nav).getByRole('button', { name: 'Versions' }));
    expect(screen.getByLabelText('Versions')).toBeTruthy();
    expect(screen.getByText(/An original/i)).toBeTruthy();
    expect(screen.getByText(/No remixes yet/i)).toBeTruthy();
    // Overview returns to the crew view (Source panel swapped away, the
    // crew's bible editor is back).
    fireEvent.click(within(nav).getByRole('button', { name: 'Overview' }));
    expect(screen.queryByLabelText('Source')).toBeNull();
    expect(screen.getAllByLabelText('Edit Game Bible').length).toBeGreaterThan(0);
    await act(async () => {
      view.unmount();
    });
  });
});
