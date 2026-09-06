import Link from 'next/link';

export default function NotFound() {
  return (
    <main id="main" className="flex min-h-screen flex-col items-center justify-center bg-ink-950 px-5 text-paper">
      <p className="font-mono text-[11px] uppercase tracking-widest text-spark">404</p>
      <h1 className="mt-3 font-display text-3xl font-bold">That build doesn’t exist.</h1>
      <p className="mt-3 text-steel">The project or page you asked for isn’t here.</p>
      <Link
        href="/app"
        className="mt-6 rounded-md bg-spark px-6 py-3 font-mono text-sm uppercase tracking-wider text-ink-950 hover:bg-spark-soft"
      >
        Back to projects
      </Link>
    </main>
  );
}
