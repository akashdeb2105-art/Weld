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

  // Remix lineage (M6): resolve this project's remix *children* — any project
  // whose recorded remix job points back at this slug. The projects list has no
  // jobs, so we fetch each remix project's detail to read its real parent. This
  // keeps the Versions tab honest: it only shows lineage the data proves.
  let children: import('@/lib/api').Project[] = [];
  try {
    const all = await api.listProjects();
    const remixDetails = await Promise.all(
      all
        .filter((p) => p.slug !== slug && p.provenance === 'remix')
        .map((p) => api.getProject(p.slug).catch(() => null)),
    );
    children = remixDetails.filter((d): d is NonNullable<typeof d> => {
      if (!d) return false;
      const rj = d.jobs.find((j) => j.type === 'remix');
      const parent =
        (rj?.result?.['remixed_from'] as string | undefined) ??
        (rj?.payload?.['source_slug'] as string | undefined);
      return parent === slug;
    });
  } catch {
    /* older backend / list unavailable: Versions tab shows "No remixes yet" */
  }

  return (
    <StudioShell
      project={project}
      playtest={playtest}
      playtestError={playtestError}
      bugs={bugs}
      regressions={regressions}
      lineageChildren={children}
    />
  );
}
