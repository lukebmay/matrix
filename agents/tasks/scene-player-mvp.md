# Task — ScenePlayer phases (animation machine)

**Status:** Partial (MVP shipped; residual in play-authoring plan)  
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

## Residual

**Paint browser eyeball** → [scene-player-logical-grid-paint.md](scene-player-logical-grid-paint.md)

**Play authoring** → [scene-player-play.md](scene-player-play.md)  
(design locked:
[scene-player-play-plan.md](../plans/scene-player/completed/scene-player-play-plan.md)).
Multi-style play context + cue chains; `storm(seconds)` coverage window.
Replaces magic `cardQuoteLoop` / phase factories.

## Session note

**2026-07-15 — Event-driven card/quote timing (interim)**

`cardQuoteLoop` is event-driven on DropScene `completed` (not fixed 20s phases):

```text
roles@3s → email@+2s (storms delayed)
email completed(revealed) → cardHold 2s → cardHide
cardHide completed(hidden) → afterCardGoneMs 3s → quoteReveal
quoteReveal completed(revealed) → quoteHoldMs 5s → quoteHide
quoteHide completed(hidden) → restartGapMs 0 → loop
```

Config: `afterCardGoneMs: 3_000`, `quoteHoldMs: 5_000`, `restartGapMs: 0`.

**Follow-on:** replace this factory with ScenePlayer play API (see
play-authoring plan). MVP phase/loop APIs remain as low-level until then.

### APIs (interim)

| Module | API |
| --- | --- |
| `ScenePlayer` | `at`, `pause`, `unpause`, `cancel` |
| `Phase` / `loopPhases` | fixed-duration sequences |
| `cardQuoteLoop` | event chain + opts (to be replaced) |
| `SceneManager` | `resolve`, `applyTip`, `paintGlyph`, logical map |
| `DropScene` | `cellMap` (`"r,c"`), `on("completed")` |

### Quote

Always 3 lines via `wrapLinesAlways3`.
