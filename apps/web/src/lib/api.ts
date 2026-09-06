/**
 * Server-side API client. The browser never talks to the internal API
 * directly — Next.js server components fetch here, keeping internal URLs
 * off the client bundle.
 */

export interface Project {
  id: number;
  slug: string;
  title: string;
  summary: string;
  genre: string;
  status: string;
  provenance: string;
  created_at: string;
  updated_at: string;
}

export interface Job {
  id: number;
  type: string;
  status: string;
  payload: Record<string, unknown>;
  result: Record<string, unknown>;
  error: string | null;
  created_at: string;
  finished_at: string | null;
}

export interface ProjectDetail extends Project {
  game_bible: Record<string, unknown> | null;
  jobs: Job[];
}

const base = process.env.WELD_API_URL ?? 'http://localhost:8000';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${base}${path}`, { next: { revalidate: 5 } });
  if (!res.ok) {
    throw new Error(`API ${path} failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export const api = {
  health: () => get<{ status: string }>(`/health`),
  listProjects: () => get<Project[]>(`/api/v1/projects`),
  getProject: (slug: string) => get<ProjectDetail>(`/api/v1/projects/${slug}`),
};
