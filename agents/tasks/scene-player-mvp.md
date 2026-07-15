# Task — ScenePlayer phases (animation machine)

**Status:** Done (MVP shipped; play authoring supersedes residual)  
**Plan:** [scene-player.md](../plans/scene-player.md)  
**Depends on:** rain-storm-column-coverage, alignment F  
**Priority:** Product sequencing

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

**Paint browser eyeball** → [scene-player-logical-grid-paint.md](scene-player-logical-grid-paint.md)

**Play authoring** → shipped  
[scene-player-play.md](../plans/scene-player/completed/scene-player-play.md)
(homepage uses `src/js/play/homepage.mjs`; `cardQuoteLoop` legacy only).

## Session note

**2026-07-15 — MVP complete; play supersedes interim loop**

Homepage no longer uses `cardQuoteLoop`; Style C play context in
`src/js/play/homepage.mjs`. MVP `Phase` / `loopPhases` / `cardQuoteLoop`
remain exported for legacy/tests.

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
