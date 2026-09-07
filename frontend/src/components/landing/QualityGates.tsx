const GATES = [
  ['Builds', 'compiles and bundles clean'],
  ['Boots', 'canvas exists, scene starts'],
  ['Controls', 'keys move the player'],
  ['Core loop', 'collect → deliver → score'],
  ['Win reachable', 'the goal is achievable'],
  ['Lose reachable', 'the failure path works'],
  ['Restart', 'state resets to initial'],
  ['Renders', 'the scene draws non-blank content'],
  ['Console clean', 'zero uncaught errors'],
  ['Regressions pass', 'fixed bugs stay fixed'],
] as const;

/**
 * Quality gates — facts, not vibes (blueprint §57: no fake "94/100" scores).
 */
export function QualityGates() {
  return (
    <div className="grid items-start gap-10 lg:grid-cols-2">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-widest text-spark">
          Evidence, not adjectives
        </p>
        <h2 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Never “bug-free.” Always proven.
        </h2>
        <p className="mt-4 max-w-md leading-relaxed text-steel">
          WELD will never market a game as 100% bug-free — no honest system can. Instead it proves
          each game against explicit, checkable gates and shows you the evidence. A game is
          “ready” because the gates passed, not because the model said so.
        </p>
        <blockquote className="mt-6 border-l-2 border-spark pl-4 font-mono text-sm leading-relaxed text-paper">
          “Your first build is probably broken.
          <br />
          Good. Let’s test it.”
        </blockquote>
      </div>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {GATES.map(([name, desc]) => (
          <li
            key={name}
            className="flex items-start gap-3 rounded-md border border-line bg-ink-900/60 p-3.5"
          >
            <span
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-state-verified/50 font-mono text-[11px] text-state-verified"
              aria-hidden
            >
              ✓
            </span>
            <span>
              <span className="block font-mono text-xs font-medium uppercase tracking-wider text-paper">
                {name}
              </span>
              <span className="mt-0.5 block text-xs text-dim">{desc}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
