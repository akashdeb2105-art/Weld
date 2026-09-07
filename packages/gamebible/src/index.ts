/**
 * GameBible — the structured contract every WELD project starts from.
 *
 * The GameBible is the shared source of truth between (eventually) the
 * Director, Designer, Architect, Builder, Playtester and Fixer roles.
 * In M0 it already serves as the real data behind the deterministic
 * sample project, so the schema is load-bearing, not decorative.
 *
 * Versioned: bump `schemaVersion` on breaking changes and add a migration note.
 */

import { z } from 'zod';

export const GAME_BIBLE_SCHEMA_VERSION = 1 as const;

/** Game families WELD targets in V1 (blueprint §7). */
export const GAME_GENRES = [
  'platformer',
  'top_down_action',
  'top_down_arcade',
  'endless_runner',
  'arcade_shooter',
  'puzzle',
  'dodge_survival',
  'breakout',
  'tower_defense',
  'grid_strategy',
  'card_board',
] as const;

export const GameGenreSchema = z.enum(GAME_GENRES);

export const CameraSchema = z.enum([
  'top_down',
  'side_view',
  'isometric',
  'first_person_fixed',
  'grid',
]);

export const PlayerSchema = z.object({
  role: z.string().min(1),
  movement: z.string().min(1),
  health: z.number().int().positive(),
});

export const CoreLoopStepSchema = z.string().min(1);

export const WinConditionSchema = z.object({
  type: z.enum(['deliver_count', 'score_threshold', 'survive_time', 'clear_level', 'custom']),
  target: z.number().int().positive(),
  description: z.string().min(1),
});

export const LoseConditionSchema = z.enum([
  'timer_zero',
  'health_zero',
  'out_of_bounds',
  'custom',
]);

export const ControlsSchema = z.object({
  up: z.array(z.string().min(1)).min(1),
  down: z.array(z.string().min(1)).min(1),
  left: z.array(z.string().min(1)).min(1),
  right: z.array(z.string().min(1)).min(1),
  interact: z.array(z.string().min(1)).optional(),
  pause: z.array(z.string().min(1)).min(1),
  restart: z.array(z.string().min(1)).optional(),
});

export const GameSystemSchema = z.enum([
  'movement',
  'collisions',
  'enemies',
  'hazards',
  'scoring',
  'timer',
  'pickups',
  'delivery',
  'restart',
  'pause',
  'levels',
]);

export const VisualDirectionSchema = z.object({
  theme: z.string().min(1),
  palette: z.array(z.string().regex(/^#([0-9a-fA-F]{6})$/)).min(1),
  typography: z.string().optional(),
  notes: z.string().optional(),
});

export const AudioDirectionSchema = z.object({
  enabled: z.boolean(),
  style: z.string().optional(),
});

/**
 * Quality requirements — the gates the (future) Playtester and Release
 * Judge must prove with evidence, not vibes.
 */
export const QualityRequirementsSchema = z.object({
  start_successfully: z.literal(true),
  restartable: z.literal(true),
  win_reachable: z.literal(true),
  lose_reachable: z.literal(true),
  zero_console_errors: z.literal(true),
});

export const PointSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const RectSchema = PointSchema.extend({
  width: z.number().positive(),
  height: z.number().positive(),
});

export const PickupSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['scrap']),
  x: z.number(),
  y: z.number(),
});

export const HazardSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['spark_pit']),
  x: z.number(),
  y: z.number(),
  radius: z.number().positive(),
});

/**
 * Deterministic level definition. Fixed spawn tables and timers — no
 * wall-clock randomness — so playtests are reproducible (blueprint §87).
 */
export const LevelDefinitionSchema = z.object({
  name: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  timer_seconds: z.number().int().positive(),
  player_spawn: PointSchema,
  player_speed: z.number().positive(),
  delivery_zone: RectSchema.extend({ label: z.string().min(1) }),
  pickups: z.array(PickupSchema).min(1),
  hazards: z.array(HazardSchema),
});

export const GameSchema = z.object({
  title: z.string().min(1),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug must be kebab-case'),
  genre: GameGenreSchema,
  target: z.literal('browser_desktop'),
  camera: CameraSchema,
  one_liner: z.string().min(1),
});

export const GameBibleSchema = z
  .object({
    schemaVersion: z.literal(GAME_BIBLE_SCHEMA_VERSION),
    game: GameSchema,
    player: PlayerSchema,
    core_loop: z.array(CoreLoopStepSchema).min(2),
    win_condition: WinConditionSchema,
    lose_conditions: z.array(LoseConditionSchema).min(1),
    controls: ControlsSchema,
    systems: z.array(GameSystemSchema).min(1),
    visual_direction: VisualDirectionSchema,
    audio: AudioDirectionSchema,
    quality_requirements: QualityRequirementsSchema,
    level: LevelDefinitionSchema,
    provenance: z.object({
      origin: z.enum(['deterministic_sample', 'ai_generated', 'human_authored', 'remixed']),
      notes: z.string().optional(),
    }),
  })
  .strict();

export type GameBible = z.infer<typeof GameBibleSchema>;
export type LevelDefinition = z.infer<typeof LevelDefinitionSchema>;

export function parseGameBible(input: unknown): GameBible {
  return GameBibleSchema.parse(input);
}

export function isGameBible(input: unknown): input is GameBible {
  return GameBibleSchema.safeParse(input).success;
}

export { sampleBible } from './sample';
export { themeColors, themeWords } from './theme';
export type { ThemeColors, ThemeWords } from './theme';
export { default as scrapSprintBible } from './sample';
