# WELD — AI Game Studio
## Master Product Blueprint

**Working product name:** WELD
**Category:** AI-native browser game studio
**Core promise:** **Describe it. Build it. Break it. Ship it.**
**Primary product:** Web application
**Primary output:** A playable, editable, shareable browser game
**Initial game scope:** 2D HTML5 browser games
**Development model:** milestone-based, test-driven, human-approved
**Status:** Source of truth — committed with the M0 foundation

> This repository copy records the blueprint the project is built against.
> The full document was provided by the project owner as
> `WELD_AI_GAME_STUDIO_MASTER_BLUEPRINT.md`. If you are reading this, the
> canonical brief lives in the project owner's materials; this file anchors
> the key product rules below so they are always in-repo.

## The loop

```text
PROMPT
→ GAME BIBLE
→ BUILD
→ PLAY
→ TEST
→ BUG
→ FIX
→ RETEST
→ REGRESSION
→ PUBLISH
```

## Core principles

1. **Code is not the product.** The playable experience is the product.
2. **Compilation is not completion.** A build passing is not proof a game works.
3. **A screenshot is not a playtest.**
4. **An LLM saying "looks good" is not QA.** Concrete deterministic checks first.
5. **Bugs become regression tests.**
6. **Generated games stay ordinary editable source code.**
7. **User intent wins.** WELD is a studio, not an autonomous creative tyrant.
8. **Small vertical slices beat giant architectures.**

## Never do

- Never claim a game is "100% bug free" — use evidence-backed quality gates.
- Never fake AI progress, event streams, playtests, or fixes.
- Never commit secrets.
- Never push to GitHub without explicit human approval.
- Never add "Built with" AI-provider branding.

## Milestones

```text
M0  Website + App Shell + Design System + deterministic sample game   ◄ current
M1  Game Director + Game Bible
M2  Game Builder
M3  Real Playtester
M4  Bug → Fix → Regression
M5  Live Studio + Publish
M6+ Cinematic website/demo refinement, Visual QA, Community, Remix
```

## Quality gates (the eventual release gate)

```text
✓ builds   ✓ boots        ✓ controls work   ✓ core loop works
✓ win ok   ✓ lose ok      ✓ restart works   ✓ no critical console errors
✓ assets   ✓ regressions  ✓ visual checks   ✓ performance acceptable
```
