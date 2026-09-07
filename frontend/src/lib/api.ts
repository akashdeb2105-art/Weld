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

export interface GameBibleOut {
  project_slug: string;
  schema_version: number;
  data: Record<string, unknown>;
}

export interface PlaytestGate {
  gate: string;
  passed: boolean;
  evidence: string;
  detail: Record<string, unknown> | null;
}

export interface PlaytestReport {
  slug: string;
  passed: boolean;
  gates: PlaytestGate[];
  simulated_seconds: number;
}

export interface Bug {
  id: number;
  project_slug: string;
  gate: string;
  summary: string;
  evidence: string;
  status: string; // "open" | "fixed"
  created_at: string;
  fixed_at: string | null;
}

export interface RegressionCase {
  bug_id: number;
  gate: string;
  passed: boolean;
  evidence: string;
}

export interface RegressionSuite {
  project_slug: string;
  total: number;
  passing: number;
  regressions: RegressionCase[];
  all_passing: boolean;
}

export const api = {
  health: () => get<{ status: string }>(`/health`),
  listProjects: () => get<Project[]>(`/api/v1/projects`),
  getProject: (slug: string) => get<ProjectDetail>(`/api/v1/projects/${slug}`),
  getGameBible: (slug: string) => get<GameBibleOut>(`/api/v1/projects/${slug}/gamebible`),
  getPlaytest: (slug: string) => get<PlaytestReport>(`/api/v1/projects/${slug}/playtest`),
  listBugs: (slug: string) => get<Bug[]>(`/api/v1/projects/${slug}/bugs`),
  getRegressions: (slug: string) => get<RegressionSuite>(`/api/v1/projects/${slug}/regressions`),
};
