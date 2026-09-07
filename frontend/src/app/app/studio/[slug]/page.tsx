import { notFound } from 'next/navigation';
import { api, type PlaytestReport } from '@/lib/api';
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

  return <StudioShell project={project} playtest={playtest} playtestError={playtestError} />;
}
