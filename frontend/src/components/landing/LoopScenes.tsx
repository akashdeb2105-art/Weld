import { StatePill } from '@/components/StatePill';
import { RevealGroup, RevealItem } from '@/components/motion/Reveal';

const SCENES: {
  n: string;
  title: string;
  body: string;
  state: 'building' | 'running' | 'testing' | 'failed' | 'fixing' | 'verified';
  tag: string;
}[] = [
  {
    n: '01',
    title: 'Idea → Game Bible',
    body: 'A plain-language prompt becomes a structured, inspectable spec: genre, core loop, controls, win/lose, quality gates. No free-form vibes.',
    state: 'building',
    tag: 'ProjectBrief → GameBible',
  },
  {
    n: '02',
    title: 'Build → real, editable game',
    body: 'A Phaser + TypeScript project — ordinary source code you own, not a black box. It boots in a real browser, not a mock.',
    state: 'running',
    tag: 'BuildPlan → GameSource',
  },
  {
    n: '03',
    title: 'Play → break something',
    body: 'The Playtester drives Chromium: presses keys, tests win and lose, restarts, watches the console. Verdicts are PASS / FAIL / INCONCLUSIVE — never guesses.',
    state: 'testing',
    tag: 'PlaytestReport',
  },
  {
    n: '04',
    title: 'Bug → narrow fix',
    body: 'A confirmed defect becomes a structured BugReport with reproduction steps and evidence. The Fixer patches the minimum necessary code — never a blind regen.',
    state: 'fixing',
    tag: 'BugReport → Patch',
  },
  {
    n: '05',
    title: 'Replay → regression',
    body: 'The failed scenario is re-run until it passes, then frozen into a regression test. Fixed bugs can’t silently come back.',
    state: 'verified',
    tag: 'RegressionSuite',
  },
  {
    n: '06',
    title: 'Gate → ship',
    body: 'A release candidate only ships when the explicit gate passes: boot, controls, loop, win, lose, restart, console, regressions.',
    state: 'verified',
    tag: 'ReleaseCandidate',
  },
];

export function LoopScenes() {
  return (
    <RevealGroup as="ol" className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" stagger={0.1}>
      {SCENES.map((s) => (
        <RevealItem as="li" key={s.n} className="h-full">
          <div className="group relative h-full rounded-lg border border-line bg-ink-900/60 p-5 transition-colors hover:border-line-strong">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-[11px] tracking-widest text-dim">{s.n}</span>
              <StatePill state={s.state} />
            </div>
            <h3 className="font-display text-lg font-semibold leading-snug text-paper">
              {s.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-steel">{s.body}</p>
            <p className="mt-4 border-t border-line/60 pt-3 font-mono text-[10px] uppercase tracking-widest text-spark-soft">
              {s.tag}
            </p>
          </div>
        </RevealItem>
      ))}
    </RevealGroup>
  );
}
