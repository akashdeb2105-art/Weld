'use client';

import { useEffect, useRef, useState } from 'react';
import type { GameStateSnapshot } from '@/lib/types';

/**
 * Sandboxed game preview (blueprint §85). The generated/sample game runs in
 * an isolated iframe with only `allow-scripts`; it cannot touch the parent
 * app. Live state arrives via the game's read-only __WELD__ bridge over
 * postMessage — real telemetry, never fabricated.
 */
export function GameFrame({
  src,
  title,
  onState,
}: {
  src: string;
  title: string;
  onState?: (snapshot: GameStateSnapshot) => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data?.type === 'weld:game-state' && onState) {
        onState(e.data.payload as GameStateSnapshot);
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onState]);

  return (
    <div
      className={`relative overflow-hidden rounded-lg border bg-ink-950 transition-colors ${
        focused ? 'border-spark/60' : 'border-line'
      }`}
    >
      {/* Input-mode bar (blueprint §84: explicit game-controls-active state) */}
      <div className="flex items-center justify-between border-b border-line bg-ink-900 px-3 py-1.5">
        <span className="font-mono text-[11px] uppercase tracking-wider text-dim">
          {focused ? 'Game controls active — Esc returns to Studio' : 'Click the game to play'}
        </span>
        <span className="flex gap-1.5" aria-hidden>
          <i className="h-2 w-2 rounded-full bg-line" />
          <i className="h-2 w-2 rounded-full bg-line" />
          <i className={`h-2 w-2 rounded-full ${loaded ? 'bg-state-verified' : 'bg-line'}`} />
        </span>
      </div>
      <div className="blueprint-grid relative aspect-[16/9] w-full">
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-mono text-xs text-dim">booting game…</span>
          </div>
        )}
        <iframe
          ref={iframeRef}
          src={src}
          title={title}
          sandbox="allow-scripts"
          onLoad={() => setLoaded(true)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="absolute inset-0 h-full w-full"
          // Game renders its own canvas; no same-origin access from parent.
        />
      </div>
    </div>
  );
}
