'use client';

import { useEffect, useRef, useState } from 'react';
import { PIPELINE_STAGES, type PipelineStage } from '@/lib/types';

/**
 * The Playhead — WELD's signature device (blueprint §33).
 * A thin continuous line that moves through IDEA → … → SHIP as the product
 * state advances. Motion communicates state; it is never decoration alone.
 * Honors prefers-reduced-motion by snapping discretely instead of animating.
 */
export function Playhead({
  activeStage,
  orientation = 'horizontal',
}: {
  activeStage: PipelineStage;
  orientation?: 'horizontal' | 'vertical';
}) {
  const idx = Math.max(
    0,
    PIPELINE_STAGES.findIndex((s) => s.id === activeStage),
  );
  const progress = PIPELINE_STAGES.length > 1 ? idx / (PIPELINE_STAGES.length - 1) : 0;
  const ref = useRef<HTMLDivElement>(null);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    ref.current?.style.setProperty('--playhead-progress', String(progress));
  }, [progress]);

  if (orientation === 'vertical') {
    return (
      <ol className="relative space-y-0 border-l-2 border-line pl-0" aria-label="Pipeline stages">
        {PIPELINE_STAGES.map((s, i) => {
          const reached = i <= idx;
          const isActive = i === idx;
          return (
            <li key={s.id} className="relative flex items-center gap-3 py-2 pl-5">
              <span
                aria-hidden
                className={`absolute -left-[5px] h-2 w-2 rounded-full transition-colors ${
                  isActive
                    ? 'bg-spark shadow-[0_0_0_4px_rgb(255_92_26/0.18)]'
                    : reached
                      ? 'bg-spark-dim'
                      : 'bg-line'
                }`}
              />
              <span
                className={`font-mono text-xs uppercase tracking-widest ${
                  isActive ? 'text-paper' : reached ? 'text-steel' : 'text-dim'
                }`}
                aria-current={isActive ? 'step' : undefined}
              >
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>
    );
  }

  return (
    <div className="w-full" role="group" aria-label={`Pipeline: stage ${PIPELINE_STAGES[idx]?.label}`}>
      <div ref={ref} className="playhead-track" data-reduced={reduced} />
      <ol className="mt-3 flex justify-between">
        {PIPELINE_STAGES.map((s, i) => {
          const reached = i <= idx;
          const isActive = i === idx;
          return (
            <li key={s.id} className="flex flex-col items-center">
              <span
                aria-hidden
                className={`mb-1.5 block h-1.5 w-1.5 rounded-full ${
                  isActive ? 'bg-spark' : reached ? 'bg-spark-dim' : 'bg-line'
                }`}
              />
              <span
                className={`font-mono text-[10px] uppercase tracking-widest ${
                  isActive ? 'text-paper' : reached ? 'text-steel' : 'text-dim'
                }`}
                aria-current={isActive ? 'step' : undefined}
              >
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
