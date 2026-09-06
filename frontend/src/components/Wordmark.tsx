export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-baseline gap-2 select-none">
      <span
        className={`font-display font-bold tracking-tight text-paper ${compact ? 'text-xl' : 'text-2xl'}`}
      >
        WELD
        <span className="text-spark" aria-hidden>
          .
        </span>
      </span>
      {!compact && (
        <span className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-dim sm:inline">
          AI Game Studio
        </span>
      )}
    </span>
  );
}
