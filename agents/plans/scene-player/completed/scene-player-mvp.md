# Task — ScenePlayer phases (animation machine)

**Status:** Done (archived)  
**Plan:** [scene-player.md](../../scene-player.md)  
**Depends on:** rain-storm-column-coverage, alignment F  
**Follow-on:** [scene-player-play.md](scene-player-play.md) (shipped)

## Goal

Developer-facing **ScenePlayer**: timed/event cues that drive DropScene modes.

## Shipped

- [x] Homepage sequence as phases (not ad-hoc only)
- [x] Reusable `Phase` + `loopPhases`
- [x] Pause-aware cues
- [x] SceneManager paint resolve (reveal > hide)
- [x] Naming: ScenePlayer + Phase (not Symphony / Orchestrator)
- [x] Session note updated
- [x] Play context + chains (follow-on shipped)

## Residual

**Paint browser eyeball** →
[scene-player-logical-grid-paint.md](../../../tasks/scene-player-logical-grid-paint.md)

**Play authoring** → shipped ([scene-player-play.md](scene-player-play.md)).

## Session note

**2026-07-15 — MVP complete; archived**

Homepage uses Style C play in `src/js/play/homepage.mjs`. MVP
`Phase` / `loopPhases` / `cardQuoteLoop` remain exported for legacy/tests.

### APIs

| Module | API |
| --- | --- |
| `ScenePlayer` | `at`, `pause`, `unpause`, `cancel`, `context` |
| `Phase` / `loopPhases` | fixed-duration sequences (legacy) |
| `cardQuoteLoop` | legacy factory |
| play context | `on`/`wait`/`delay`/`activate`/`hide`/`storm`/`clear`/`loop` |
| `SceneManager` | `resolve`, `applyTip`, `paintGlyph`, logical map |
| `DropScene` | `cellMap`, `events.started` / `events.completed` |

### Quote

Always 3 lines via `wrapLinesAlways3`.
