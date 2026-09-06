# GameBible

The GameBible is the structured contract every WELD project starts from
(blueprint Â§8). It is the shared source of truth between the (eventual) agent
roles â€” Director, Designer, Architect, Builder, Playtester, Fixer â€” and the
UI. It is versioned and strict.

## Schema location

- TypeScript source of truth: `packages/gamebible/src/index.ts` (Zod).
- Canonical fixture: `packages/gamebible/src/scrap-sprint.gamebible.json`.
- Python wire-mirror: `apps/api/app/gamebible.py` (Pydantic) â€” validates the
  fixture at API startup and before seeding.

## Shape (v1)

```yaml
schemaVersion: 1
game:        { title, slug, genre, target, camera, one_liner }
player:      { role, movement, health }
core_loop:   [ step, step, â€¦ ]              # â‰¥ 2
win_condition: { type, target, description }
lose_conditions: [ timer_zero, health_zero, â€¦ ]
controls:    { up[], down[], left[], right[], pause[], interact[]?, restart[]? }
systems:     [ movement, collisions, scoring, timer, â€¦ ]
visual_direction: { theme, palette[], typography?, notes? }
audio:       { enabled, style? }
quality_requirements:                       # all must be explicitly true
  { start_successfully, restartable, win_reachable, lose_reachable, zero_console_errors }
level:       { width, height, timer_seconds, player_spawn, player_speed,
               delivery_zone, pickups[], hazards[] }
provenance:  { origin, notes? }             # deterministic_sample | ai_generated | human_authored
```

## Rules

1. **Strict.** Unknown fields are rejected (`.strict()`), so drift fails loudly.
2. **Quality gates are literal `true`.** You can't write a bible that opts out
   of win/lose/restart/console requirements.
3. **Deterministic levels.** Fixed spawn tables and timers; no wall-clock or
   unseeded randomness â€” this is what makes playtests reproducible (Â§87).
4. **Bumping the version** means: update the schema, the fixture, the Python
   mirror, the tests, and this doc, and note the migration in the CHANGELOG.

## Why it exists

The Playtester (M3) will read `win_condition`, `lose_conditions`, `controls`,
and `quality_requirements` to build its test plan. The Release Judge (M5) reads
`quality_requirements` as the release gate. The Studio renders it so the human
always knows what the game is *supposed* to do. None of that works if the spec
is prose.
