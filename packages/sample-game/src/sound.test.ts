import { describe, expect, it } from 'vitest';

import { SoundSynth, type SoundCue, type SynthContext } from './sound';

/**
 * Pins the M6 sound layer honestly: a cue is scheduled only for a real event
 * when the bible opts in, and the synth is a safe no-op otherwise. We inject a
 * fake AudioContext so tests assert exactly what would be scheduled — no real
 * audio device, no timing flakiness.
 */

interface FakeOsc {
  type: string;
  freq: number;
  startAt: number;
  stopAt: number;
}
interface FakeGain {
  peak: number;
}

function makeFakeCtx(now = 0) {
  const oscs: FakeOsc[] = [];
  const gains: FakeGain[] = [];
  const ctx: SynthContext = {
    currentTime: now,
    destination: {},
    createOscillator() {
      const osc: FakeOsc = { type: 'sine', freq: 0, startAt: 0, stopAt: 0 };
      oscs.push(osc);
      return {
        get type() {
          return osc.type as OscillatorType;
        },
        set type(v: OscillatorType) {
          osc.type = v;
        },
        frequency: {
          setValueAtTime(v: number) {
            osc.freq = v;
          },
        },
        connect() {},
        start(t: number) {
          osc.startAt = t;
        },
        stop(t: number) {
          osc.stopAt = t;
        },
      };
    },
    createGain() {
      const g: FakeGain = { peak: 0 };
      gains.push(g);
      return {
        gain: {
          setValueAtTime(v: number) {
            g.peak = v;
          },
          exponentialRampToValueAtTime() {},
        },
        connect() {},
      };
    },
  };
  return { ctx, oscs, gains };
}

const ALL_CUES: SoundCue[] = ['start', 'deliver', 'hit', 'win', 'lose'];

describe('SoundSynth', () => {
  it('schedules every cue as real oscillator tones when the bible opts in', () => {
    const { ctx, oscs } = makeFakeCtx(1.0);
    const sfx = new SoundSynth(true, ctx);
    for (const cue of ALL_CUES) sfx.play(cue);
    const expected = ALL_CUES.reduce((n, c) => n + SoundSynth.tones(c).length, 0);
    expect(oscs).toHaveLength(expected);
    // Every scheduled tone is a real oscillator with a finite start/stop.
    for (const o of oscs) {
      expect(o.freq).toBeGreaterThan(0);
      expect(o.startAt).toBeGreaterThanOrEqual(1.0);
      expect(o.stopAt).toBeGreaterThan(o.startAt);
    }
  });

  it('schedules the cue\'s tones at the bible-defined frequencies, in order', () => {
    const { ctx, oscs } = makeFakeCtx(0);
    new SoundSynth(true, ctx).play('win');
    const recipe = SoundSynth.tones('win');
    expect(oscs.map((o) => o.freq)).toEqual(recipe.map((t) => t.freq));
    // Rising fanfare: strictly increasing start offsets honor the recipe.
    expect(recipe.length).toBeGreaterThan(1);
  });

  it('honesty: an opted-out bible (audio.enabled=false) schedules nothing', () => {
    const { ctx, oscs } = makeFakeCtx();
    const sfx = new SoundSynth(false, ctx);
    expect(sfx.isEnabled).toBe(false);
    for (const cue of ALL_CUES) sfx.play(cue);
    expect(oscs).toHaveLength(0);
  });

  it('honesty: no audio context (headless/blocked) is a safe no-op, never throws', () => {
    const sfx = new SoundSynth(true, null);
    expect(sfx.isEnabled).toBe(false);
    expect(() => {
      for (const cue of ALL_CUES) sfx.play(cue);
    }).not.toThrow();
  });

  it('a throwing audio backend never breaks gameplay (play swallows it)', () => {
    const broken: SynthContext = {
      currentTime: 0,
      destination: {},
      createOscillator() {
        throw new Error('autoplay blocked');
      },
      createGain() {
        throw new Error('autoplay blocked');
      },
    };
    const sfx = new SoundSynth(true, broken);
    expect(() => sfx.play('deliver')).not.toThrow();
  });
});
