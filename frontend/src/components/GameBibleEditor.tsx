'use client';

/**
 * Structured Game Bible editor (M1). Edits the high-leverage fields with
 * proper inputs — title, one-liner, genre, win target, timer, player speed,
 * and the movement key bindings — and applies them onto a copy of the Bible.
 * Everything else in the document passes through untouched. Local edits only;
 * the parent decides when to persist (review-confirm or Studio save).
 */

export const GENRES = [
  { value: 'top_down_arcade', label: 'Top-down arcade' },
  { value: 'platformer', label: 'Platformer' },
  { value: 'dodge_survival', label: 'Dodge survival' },
] as const;

export interface BibleDraft {
  title: string;
  one_liner: string;
  genre: string;
  winTarget: number;
  timerSeconds: number;
  playerSpeed: number;
  keys: { up: string; down: string; left: string; right: string };
}

/** Pull the editable fields out of a full Game Bible document. */
export function bibleToDraft(bible: Record<string, unknown>): BibleDraft {
  const game = (bible.game ?? {}) as Record<string, unknown>;
  const win = (bible.win_condition ?? {}) as Record<string, unknown>;
  const level = (bible.level ?? {}) as Record<string, unknown>;
  const controls = (bible.controls ?? {}) as Record<string, unknown>;
  const first = (v: unknown) => (Array.isArray(v) && v.length ? String(v[0]) : '');
  return {
    title: String(game.title ?? ''),
    one_liner: String(game.one_liner ?? ''),
    genre: String(game.genre ?? 'top_down_arcade'),
    winTarget: Number(win.target ?? 5),
    timerSeconds: Number(level.timer_seconds ?? 90),
    playerSpeed: Number(level.player_speed ?? 220),
    keys: {
      up: first(controls.up) || 'W',
      down: first(controls.down) || 'S',
      left: first(controls.left) || 'A',
      right: first(controls.right) || 'D',
    },
  };
}

/** Apply the edited fields onto a copy of the Bible (immutable). */
export function applyDraft(
  bible: Record<string, unknown>,
  d: BibleDraft,
): Record<string, unknown> {
  const next = structuredClone(bible) as Record<string, any>;
  next.game = { ...(next.game ?? {}), title: d.title, one_liner: d.one_liner, genre: d.genre };
  next.win_condition = { ...(next.win_condition ?? {}), target: d.winTarget };
  next.level = {
    ...(next.level ?? {}),
    timer_seconds: d.timerSeconds,
    player_speed: d.playerSpeed,
  };
  const c = { ...(next.controls ?? {}) };
  const keep = (orig: unknown, edited: string) =>
    Array.isArray(orig) && orig.length > 1 ? [edited, ...orig.slice(1)] : [edited];
  c.up = keep(c.up, d.keys.up.toUpperCase());
  c.down = keep(c.down, d.keys.down.toUpperCase());
  c.left = keep(c.left, d.keys.left.toUpperCase());
  c.right = keep(c.right, d.keys.right.toUpperCase());
  next.controls = c;
  return next;
}

const input =
  'w-full rounded-md border border-line bg-ink-950 px-2.5 py-1.5 text-sm text-paper focus:border-spark focus:outline-none';
const label = 'mb-1 block font-mono text-[10px] uppercase tracking-widest text-dim';

function Field({
  id,
  text,
  children,
}: {
  id: string;
  text: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className={label}>
        {text}
      </label>
      {children}
    </div>
  );
}

export function GameBibleEditor({
  draft,
  onChange,
  disabled,
}: {
  draft: BibleDraft;
  onChange: (d: BibleDraft) => void;
  disabled?: boolean;
}) {
  const set = (patch: Partial<BibleDraft>) => onChange({ ...draft, ...patch });
  const setKey = (k: keyof BibleDraft['keys'], v: string) =>
    onChange({ ...draft, keys: { ...draft.keys, [k]: v } });

  return (
    <div className="space-y-3">
      <Field id="gb-title" text="Title">
        <input
          id="gb-title"
          className={input}
          value={draft.title}
          disabled={disabled}
          onChange={(e) => set({ title: e.target.value })}
        />
      </Field>

      <Field id="gb-oneliner" text="One-liner">
        <textarea
          id="gb-oneliner"
          rows={2}
          className={`${input} resize-none`}
          value={draft.one_liner}
          disabled={disabled}
          onChange={(e) => set({ one_liner: e.target.value })}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field id="gb-genre" text="Genre">
          <select
            id="gb-genre"
            className={input}
            value={draft.genre}
            disabled={disabled}
            onChange={(e) => set({ genre: e.target.value })}
          >
            {GENRES.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </Field>
        <Field id="gb-win" text="Win target (deliveries)">
          <input
            id="gb-win"
            type="number"
            min={1}
            max={50}
            className={input}
            value={draft.winTarget}
            disabled={disabled}
            onChange={(e) => set({ winTarget: Math.max(1, Number(e.target.value) || 1) })}
          />
        </Field>
        <Field id="gb-timer" text="Timer (seconds)">
          <input
            id="gb-timer"
            type="number"
            min={10}
            max={600}
            className={input}
            value={draft.timerSeconds}
            disabled={disabled}
            onChange={(e) => set({ timerSeconds: Math.max(10, Number(e.target.value) || 10) })}
          />
        </Field>
        <Field id="gb-speed" text="Player speed (px/s)">
          <input
            id="gb-speed"
            type="number"
            min={60}
            max={600}
            className={input}
            value={draft.playerSpeed}
            disabled={disabled}
            onChange={(e) => set({ playerSpeed: Math.max(60, Number(e.target.value) || 60) })}
          />
        </Field>
      </div>

      <div>
        <p className={label}>Move keys</p>
        <div className="grid grid-cols-4 gap-2">
          {(['up', 'down', 'left', 'right'] as const).map((dir) => (
            <div key={dir}>
              <label htmlFor={`gb-key-${dir}`} className="sr-only">
                {dir}
              </label>
              <input
                id={`gb-key-${dir}`}
                className={`${input} text-center font-mono uppercase`}
                value={draft.keys[dir]}
                maxLength={1}
                disabled={disabled}
                onChange={(e) => setKey(dir, e.target.value)}
                aria-label={`${dir} key`}
              />
              <p className="mt-1 text-center font-mono text-[9px] uppercase tracking-wider text-dim">
                {dir}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
