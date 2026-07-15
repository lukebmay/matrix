# Task — ScenePlayer phases (animation machine)

**Status:** Partial (MVP shipped; plan residual in symphony-orchestration-plan)  
**Plan:** [symphony.md](../plans/symphony.md)  
**Depends on:** rain-storm-column-coverage, alignment F  
**Priority:** Product sequencing

## Goal

Developer-facing **ScenePlayer**: timed/event cues that drive DropScene modes.

## Shipped

- [x] Homepage sequence as phases (not ad-hoc only)
- [x] Reusable `Phase` + `loopPhases`
- [x] Pause-aware cues
- [x] SceneManager paint resolve (reveal > hide)
- [x] Rename Symphony → ScenePlayer / Orchestration → Phase
- [x] Session note updated

## Residual

**Paint browser eyeball** → [symphony-logical-grid-paint.md](symphony-logical-grid-paint.md)

Later design: [symphony-orchestration-plan.md](symphony-orchestration-plan.md)
(events, clearView, clock).

## Session note

**2026-07-15 — ScenePlayer rename + phase loop**

### Timeline (per cycle)

```text
0–20s   cardRevealPhase (roles@3s, email@5s, storms…)
20s     quotePhase start (cardHide + quoteReveal)
23s     storms on hide + quote
30s     quoteHide
33s     quoteHide storm
+20s    gap (restartGapMs) — rain only
then    loop → roles again
```

### APIs

| Module | API |
| --- | --- |
| `ScenePlayer` | `at`, `pause`, `unpause`, `cancel` |
| `Phase` | `{ durationMs, schedule(t) }` |
| `loopPhases` | phases + `gapMs` |
| `SceneManager` | `resolve`, `applyTip`, `paintGlyph`, logical map |
| `DropScene` | `cellMap` (`"r,c"`) |

### Quote

Always 3 lines via `wrapLinesAlways3`.
