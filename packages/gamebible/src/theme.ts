/**
 * Theme derivation — turn a GameBible's `visual_direction` into the concrete
 * palette the runtime draws with.
 *
 * Why here and not in the scene: the mapping is pure and deterministic, so it
 * belongs in the shared contract package where it can be unit-tested in Node
 * and reused by any renderer (the Phaser runtime today, others later).
 *
 * The defaults reproduce the deterministic Scrap Sprint look exactly, so the
 * sample game is unchanged when its bible is used. A user-described game's
 * bible simply supplies its own `palette` and the same runtime renders it
 * differently — honestly, from the bible, not invented.
 */

import type { GameBible } from './index';

/** Phaser-style numeric colors (0xRRGGBB) the scene draws with. */
export interface ThemeColors {
  bg: number;
  floor: number;
  grid: number;
  player: number;
  playerTrim: number;
  pickup: number;
  pickupCore: number;
  goal: number;
  goalDark: number;
  hazard: number;
  text: string;
  dim: string;
}

/** Words used in HUD / overlay copy, themed by the bible's nouns. */
export interface ThemeWords {
  /** Collectible noun (singular), e.g. "scrap", "mushroom". */
  pickup: string;
  /** Uppercase collectible, e.g. "SCRAP". */
  pickupCaps: string;
  /** Plural-ish collectible for sentences, e.g. "scrap". */
  pickupPlural: string;
  /** Delivery-zone label, e.g. "FURNACE". */
  goal: string;
  /** Hazard noun for flavor text, e.g. "spark pits". */
  hazard: string;
}

const hexToNum = (hex: string, fallback: number): number => {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex.trim());
  return m && m[1] !== undefined ? parseInt(m[1], 16) : fallback;
};

/** Palette position meaning is fixed by convention in the Director/runtime:
 * [0]=bg, [1]=floor, [2]=accent (goals/trim), [3]=pickup, [4]=text. */
export function themeColors(bible: GameBible): ThemeColors {
  const p = bible.visual_direction.palette;
  const at = (i: number): string | undefined => (i < p.length ? p[i] : undefined);
  const num = (i: number, fallback: number): number => {
    const v = at(i);
    return v === undefined ? fallback : hexToNum(v, fallback);
  };
  return {
    bg: num(0, 0x0b0d12),
    floor: num(1, 0x141823),
    grid: num(1, 0x232b3d),
    player: 0xf2f0ea,
    playerTrim: num(2, 0xff5c1a),
    pickup: num(3, 0x8fd3ff),
    pickupCore: num(2, 0xff5c1a),
    goal: num(2, 0xff5c1a),
    goalDark: num(2, 0xb53f0e),
    hazard: num(2, 0xff5c1a),
    text: at(4) ?? '#F2F0EA',
    dim: '#9AA3B5',
  };
}

const NOUN_STRIP = /^(?:glowing|acid|acidic|spiky|fiery|frozen|dark|bright|golden|silver|tiny|giant|fast|slow|deadly|magic|magical|cursed|ancient|neon|electric|toxic|sharp)_/;

/**
 * Pull the collectible / hazard nouns out of the bible's core-loop verbs so
 * HUD copy matches what the prompt asked for ("collect_mushrooms" -> mushroom).
 * Falls back to the sample's vocabulary so the reference game reads the same.
 */
export function themeWords(bible: GameBible): ThemeWords {
  const collect = bible.core_loop.find((s) => s.startsWith('collect_'));
  const avoid = bible.core_loop.find((s) => s.startsWith('avoid_'));

  let pickup = 'scrap';
  if (collect) {
    const noun = collect.replace(/^collect_/, '').replace(NOUN_STRIP, '').replace(/_/g, ' ');
    if (noun) pickup = noun;
  }

  let hazard = 'spark pits';
  if (avoid) {
    const noun = avoid.replace(/^avoid_/, '').replace(NOUN_STRIP, '').replace(/_/g, ' ');
    if (noun) hazard = noun;
  }

  const goal = bible.level.delivery_zone.label || 'GOAL';
  const singular = pickup.replace(/s$/, '') || pickup;

  return {
    pickup: singular,
    pickupCaps: singular.toUpperCase(),
    pickupPlural: pickup,
    goal: goal.toUpperCase(),
    hazard,
  };
}
