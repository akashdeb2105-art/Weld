import type { SemanticState } from '@/lib/types';

const STATE_STYLE: Record<SemanticState, string> = {
  neutral: 'text-steel border-line',
  building: 'text-state-building border-state-building/40',
  running: 'text-state-running border-state-running/40',
  testing: 'text-state-testing border-state-testing/40',
  warning: 'text-state-warning border-state-warning/40',
  failed: 'text-state-failed border-state-failed/50',
  fixing: 'text-state-fixing border-state-fixing/50',
  verified: 'text-state-verified border-state-verified/40',
  published: 'text-state-published border-state-published/40',
};

const STATE_DOT: Record<SemanticState, string> = {
  neutral: 'bg-dim',
  building: 'bg-state-building',
  running: 'bg-state-running',
  testing: 'bg-state-testing',
  warning: 'bg-state-warning',
  failed: 'bg-state-failed',
  fixing: 'bg-state-fixing',
  verified: 'bg-state-verified',
  published: 'bg-state-published',
};

export function StatePill({ state, label }: { state: SemanticState; label?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wider ${STATE_STYLE[state]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${STATE_DOT[state]}`} aria-hidden />
      {label ?? state}
    </span>
  );
}
