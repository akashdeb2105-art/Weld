/**
 * SoundSynth — the WELD sound layer (M6).
 *
 * The GameBible declares an audio intent (`audio: { enabled, style }`). Until
 * now nothing realized it: the scene was silent. This module closes that gap
 * honestly. Every cue is *synthesized* with the Web Audio API — a couple of
 * oscillators and a gain envelope — so it matches the blueprint's V1 rule
 * (procedural assets, no external fetching) and stays fully deterministic:
 * no network, no assets, no wall-clock beyond the cue's own scheduled length.
 *
 * Honesty contract (blueprint "never fake it"):
 *  - Sound plays only when the bible opts in (`audio.enabled: true`). A bible
 *    that opts out produces silence, not a fake blip.
 *  - A cue fires only for a *real* game event (start, deliver, hit, win, lose)
 *    — never to mask a dead control or pretend something happened.
 *  - If Web Audio is unavailable (headless test, old browser, autoplay
 *    blocked before a gesture), `play()` is a safe no-op. The game logic and
 *    rendering never depend on audio.
 */

export type SoundCue = 'start' | 'deliver' | 'hit' | 'win' | 'lose';

/** The minimal slice of an AudioContext the synth needs. Structural (Phaser
 * passes its own; tests pass a fake). */
export interface SynthContext {
  currentTime: number;
  destination: unknown;
  createOscillator(): {
    type: OscillatorType;
    frequency: { setValueAtTime(v: number, t: number): void };
    connect(n: unknown): void;
    start(t: number): void;
    stop(t: number): void;
  };
  createGain(): {
    gain: {
      setValueAtTime(v: number, t: number): void;
      exponentialRampToValueAtTime(v: number, t: number): void;
    };
    connect(n: unknown): void;
  };
}

interface Tone {
  freq: number;
  /** seconds the tone sustains before decaying. */
  dur: number;
  type: OscillatorType;
  /** seconds after the cue start at which this tone begins. */
  at?: number;
  /** peak gain for the tone. */
  vol?: number;
}

/** Deterministic cue → tone recipe. Small and readable on purpose: the whole
 * point is that a game author can hear what each event is. */
const CUES: Record<SoundCue, Tone[]> = {
  start: [
    { freq: 392, dur: 0.09, type: 'triangle', vol: 0.18 },
    { freq: 587, dur: 0.11, type: 'triangle', at: 0.09, vol: 0.18 },
  ],
  deliver: [
    { freq: 523, dur: 0.07, type: 'square', vol: 0.16 },
    { freq: 784, dur: 0.12, type: 'square', at: 0.07, vol: 0.16 },
  ],
  hit: [{ freq: 110, dur: 0.2, type: 'sawtooth', vol: 0.22 }],
  win: [
    { freq: 523, dur: 0.12, type: 'triangle', vol: 0.2 },
    { freq: 659, dur: 0.12, type: 'triangle', at: 0.12, vol: 0.2 },
    { freq: 784, dur: 0.12, type: 'triangle', at: 0.24, vol: 0.2 },
    { freq: 1046, dur: 0.26, type: 'triangle', at: 0.36, vol: 0.2 },
  ],
  lose: [
    { freq: 220, dur: 0.22, type: 'sawtooth', vol: 0.2 },
    { freq: 155, dur: 0.4, type: 'sawtooth', at: 0.2, vol: 0.18 },
  ],
};

export class SoundSynth {
  private readonly enabled: boolean;

  /** `ctx` is injectable so tests can observe tones without real audio. Pass
   * `null` (or omit) and `play()` becomes a no-op. The `enabled` flag comes
   * from `bible.audio.enabled` — the single source of truth for whether the
   * game should make sound at all. */
  constructor(enabled: boolean, private readonly ctx: SynthContext | null = null) {
    this.enabled = enabled && ctx !== null;
  }

  /** True when a `play()` call will actually schedule audio. */
  get isEnabled(): boolean {
    return this.enabled;
  }

  /** The tones a cue would schedule, in order. Exposed so tests can assert the
   * event→cue mapping without touching an AudioContext. */
  static tones(cue: SoundCue): readonly Tone[] {
    return CUES[cue];
  }

  /** Schedule a cue. Safe to call always: no-op when disabled or ctx is null,
   * and it never throws (audio must never crash gameplay). */
  play(cue: SoundCue): void {
    if (!this.enabled || !this.ctx) return;
    try {
      const t0 = this.ctx.currentTime;
      for (const tone of CUES[cue]) {
        this.tone(tone, t0 + (tone.at ?? 0));
      }
    } catch {
      // Audio is best-effort presentation. A blocked/failed context must never
      // break the game loop.
    }
  }

  private tone(tone: Tone, at: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const dur = tone.dur;
    const vol = tone.vol ?? 0.2;
    osc.type = tone.type;
    osc.frequency.setValueAtTime(tone.freq, at);
    gain.gain.setValueAtTime(vol, at);
    // Exponential decay to near-silence over the tone's duration.
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }
}
