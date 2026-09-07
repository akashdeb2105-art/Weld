import { notFound } from 'next/navigation';
import { api, type Bug, type PlaytestReport, type RegressionSuite } from '@/lib/api';
import { StudioShell } from '@/components/studio/StudioShell';

export const dynamic = 'force-dynamic';

export default async function StudioPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let project;
  try {
    project = await api.getProject(slug);
  } catch {
    notFound();
  }

  // The playtest is best-effort: if the playtester can't run in this
  // environment (503) we still show the Studio, with an honest notice.
  let playtest: PlaytestReport | null = null;
  let playtestError: string | null = null;
  try {
    playtest = await api.getPlaytest(slug);
  } catch (err) {
    playtestError = err instanceof Error ? err.message : 'playtest unavailable';
  }

  // Bugs + regression suite (M4) are also best-effort so the Studio still
  // renders if the backend predates the M4 endpoints.
  let bugs: Bug[] = [];
  let regressions: RegressionSuite | null = null;
  try {
    [bugs, regressions] = await Promise.all([api.listBugs(slug), api.getRegressions(slug)]);
  } catch {
    /* older backend: panels show an honest empty state */
  }

  return (
    <StudioShell
      project={project}
      playtest={playtest}
      playtestError={playtestError}
      bugs={bugs}
      regressions={regressions}
    />
  );
}
