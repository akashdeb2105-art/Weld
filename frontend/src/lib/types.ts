/** Shared UI types for the WELD web app. */

export type PipelineStage =
  | 'idea'
  | 'bible'
  | 'build'
  | 'play'
  | 'test'
  | 'fix'
  | 'regression'
  | 'ship';

export const PIPELINE_STAGES: { id: PipelineStage; label: string }[] = [
  { id: 'idea', label: 'Idea' },
  { id: 'bible', label: 'Bible' },
  { id: 'build', label: 'Build' },
  { id: 'play', label: 'Play' },
  { id: 'test', label: 'Test' },
  { id: 'fix', label: 'Fix' },
  { id: 'regression', label: 'Regression' },
  { id: 'ship', label: 'Ship' },
];

export type SemanticState =
  | 'neutral'
  | 'building'
  | 'running'
  | 'testing'
  | 'warning'
  | 'failed'
  | 'fixing'
  | 'verified'
  | 'published';

export interface GameStateSnapshot {
  status: 'title' | 'playing' | 'paused' | 'game_over' | 'win';
  score: number;
  lives: number;
  delivered: number;
  winTarget: number;
  carried: boolean;
  timer: number;
  loseReason: string | null;
  tick: number;
  player: { x: number; y: number; alive: boolean };
  objectives: { type: string; delivered: number; target: number; complete: boolean };
  pickupsRemaining: number;
}
