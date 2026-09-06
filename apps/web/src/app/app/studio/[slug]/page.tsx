import { notFound } from 'next/navigation';
import { api } from '@/lib/api';
import { StudioShell } from '@/components/studio/StudioShell';

export const dynamic = 'force-dynamic';

export default async function StudioPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const project = await api.getProject(slug);
    return <StudioShell project={project} />;
  } catch {
    notFound();
  }
}
