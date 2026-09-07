import Link from 'next/link';
import { Wordmark } from '@/components/Wordmark';
import { Playhead } from '@/components/Playhead';
import { LandingDemo } from '@/components/landing/LandingDemo';
import { LoopScenes } from '@/components/landing/LoopScenes';
import { QualityGates } from '@/components/landing/QualityGates';
import { HeroBeat, HeroCinematic } from '@/components/motion/HeroCinematic';
import { Reveal } from '@/components/motion/Reveal';

export const dynamic = 'force-dynamic';

export default function LandingPage() {
  return (
    <main id="main" className="min-h-screen bg-ink-950 text-paper">
      {/* ── Nav ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-line/60 bg-ink-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <Link href="/" aria-label="WELD home">
            <Wordmark />
          </Link>
          <nav className="flex items-center gap-6" aria-label="Primary">
            <a href="#how" className="font-mono text-xs uppercase tracking-wider text-steel hover:text-paper">
              How it works
            </a>
            <a
              href="#gates"
              className="hidden font-mono text-xs uppercase tracking-wider text-steel hover:text-paper sm:inline"
            >
              Quality gates
            </a>
            <Link
              href="/app"
              className="rounded-md border border-spark/60 bg-spark px-4 py-2 font-mono text-xs font-medium uppercase tracking-wider text-ink-950 transition-colors hover:bg-spark-soft"
            >
              Open Studio
            </Link>
          </nav>
        </div>
      </header>

      {/* ── 01 · The Idea ───────────────────────────────────── */}
      <section className="blueprint-grid relative overflow-hidden border-b border-line/60">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 sm:py-28 lg:grid-cols-2 lg:gap-8">
          <HeroCinematic>
          <div className="flex flex-col justify-center">
            <p className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-line bg-ink-900 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-steel">
              <span className="h-1.5 w-1.5 rounded-full bg-spark" aria-hidden />
              Describe it. Build it. Break it. Ship it.
            </p>
            <h1 className="font-display text-5xl font-bold leading-[1.02] tracking-tight sm:text-6xl">
              Tell us what
              <br />
              you want to <span className="text-spark">play.</span>
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-steel">
              WELD is an AI game studio for the browser. Describe a game — WELD
              builds it, then <em className="text-paper not-italic">actually plays it</em>, finds
              what breaks, fixes it, and ships something that survived its own playtest.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/app"
                className="rounded-md bg-spark px-6 py-3 font-mono text-sm font-medium uppercase tracking-wider text-ink-950 transition-colors hover:bg-spark-soft"
              >
                Open the Studio
              </Link>
              <a
                href="#demo"
                className="rounded-md border border-line-strong px-6 py-3 font-mono text-sm uppercase tracking-wider text-paper transition-colors hover:border-steel"
              >
                Play the sample
              </a>
            </div>
            <p className="mt-5 font-mono text-[11px] uppercase tracking-widest text-dim">
              No fake AI. The demo below is a real game, labeled honestly.
            </p>
          </div>
          </HeroCinematic>

          {/* Prompt → fragments composition */}
          <Reveal delay={0.25} className="relative flex items-center">
            <div className="w-full rounded-xl border border-line bg-ink-900/80 p-5 shadow-2xl shadow-black/40">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-widest text-dim">
                  prompt
                </span>
                <span className="flex gap-1.5" aria-hidden>
                  <i className="h-2 w-2 rounded-full bg-line" />
                  <i className="h-2 w-2 rounded-full bg-line" />
                  <i className="h-2 w-2 rounded-full bg-spark" />
                </span>
              </div>
              <p className="rounded-md border border-line bg-ink-950 p-4 font-mono text-sm leading-relaxed text-paper">
                “A weld-bot courier hauls glowing scrap to the furnace before the
                shift timer burns out. Dodge the spark pits.”
              </p>
              <div className="my-4 flex items-center gap-3" aria-hidden>
                <span className="h-px flex-1 bg-line" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-spark">
                  becomes
                </span>
                <span className="h-px flex-1 bg-line" />
              </div>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {[
                  ['genre', 'top-down arcade'],
                  ['player', 'weld-bot · 3 hull'],
                  ['win', 'deliver 5 scrap'],
                  ['lose', 'timer · hull zero'],
                  ['controls', 'WASD + Esc'],
                  ['world', 'foundry floor'],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-md border border-line bg-ink-950/70 p-3">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-spark-soft">
                      {k}
                    </p>
                    <p className="mt-1 text-xs text-steel">{v}</p>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>

        {/* Playhead strip */}
        <div className="mx-auto max-w-6xl px-5 pb-10">
          <Playhead activeStage="play" />
        </div>
      </section>

      {/* ── 02 · The playable demo ──────────────────────────── */}
      <section id="demo" className="border-b border-line/60 bg-ink-900/40">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-widest text-spark">
                Scene 04 · The first play
              </p>
              <h2 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
                This is a real game. Play it.
              </h2>
              <p className="mt-3 max-w-xl text-steel">
                <strong className="text-paper">Scrap Sprint</strong> is WELD’s deterministic
                reference game — hand-authored, fully playable, and the same artifact our test
                pipeline inspects. No screenshots pretending to be a product.
              </p>
            </div>
            <p className="font-mono text-[11px] uppercase tracking-widest text-dim">
              WASD / arrows · Esc pause · R restart
            </p>
          </div>
          <LandingDemo />
        </div>
      </section>

      {/* ── 03 · The loop (story scenes) ────────────────────── */}
      <section id="how" className="border-b border-line/60">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <p className="font-mono text-[11px] uppercase tracking-widest text-spark">
            The product loop
          </p>
          <h2 className="mt-2 max-w-2xl font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Generated code isn’t the product. A tested game is.
          </h2>
          <p className="mt-3 max-w-2xl text-steel">
            Anyone can turn a prompt into code. WELD closes the loop — build, play, break,
            diagnose, fix, replay, regression, ship. You don’t get the first draft; you get the
            draft that survived its own playtest.
          </p>
          <LoopScenes />
        </div>
      </section>

      {/* ── 04 · Quality gates ──────────────────────────────── */}
      <section id="gates" className="border-b border-line/60 bg-ink-900/40">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <QualityGates />
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────── */}
      <section className="blueprint-grid">
        <div className="mx-auto max-w-6xl px-5 py-24 text-center">
          <h2 className="mx-auto max-w-2xl font-display text-4xl font-bold tracking-tight sm:text-5xl">
            Build it. Break it. Fix it. Play it.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-steel">
            Open the Studio and explore the deterministic sample project — the same shell the real
            AI crew moves into as milestones land.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link
              href="/app"
              className="rounded-md bg-spark px-8 py-3.5 font-mono text-sm font-medium uppercase tracking-wider text-ink-950 transition-colors hover:bg-spark-soft"
            >
              Open the Studio
            </Link>
          </div>
          <div className="mx-auto mt-12 max-w-3xl">
            <Playhead activeStage="ship" />
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="border-t border-line/60">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-5 py-10 sm:flex-row sm:items-center">
          <Wordmark compact />
          <p className="max-w-md font-mono text-[11px] leading-relaxed text-dim">
            WELD never claims “bug-free.” It proves games against explicit quality gates and shows
            the evidence.
          </p>
          <p className="font-mono text-[11px] uppercase tracking-widest text-dim">M0 · deterministic sample</p>
        </div>
      </footer>
    </main>
  );
}
