# Plan — ScenePlayer & scene paint

**Status:** In progress (logical/DOM ownership rewrite shipped; **browser eyeball**)  
**Project:** `projects/matrix`  
**Branch:** `refactor_07-2026`  
**Next task:** Eyeball [symphony-logical-grid-paint.md](../tasks/symphony-logical-grid-paint.md);
then residual [symphony-orchestration-plan.md](../tasks/symphony-orchestration-plan.md)

> **Naming:** formerly “Symphony / Orchestration.” Code uses **ScenePlayer**
> + **Phase** (`ScenePlayer.mjs`). Plan/task filenames kept for link stability.

## Goal

One coherent **animation machine**:

1. Pause-aware clock / cues  
2. Reusable **phases** that can **loop**  
3. **Logical grid** (intentional chars) + **DOM grid** (view) via SceneManager  
4. Schedulable clear/reveal/hide/storm utilities  
5. Homepage script as data composed from phases  

## Two grids

| Grid | Holds | Rule |
| --- | --- | --- |
| **Logical** | Non-random intentional characters that **should show** | Written by reveal tip; cleared only by hide tip |
| **DOM** | Painted cells | Logical char if present, else random rain |

Rain never writes content into the logical grid.

## Architecture

```text
ScenePlayer (pause-aware at())
  → Phase list (reusable) + loopPhases
      → DropScene.enterMode / startStorm
SceneManager
  → resolve(r,c): reveals newest-first, then hides
  → logical Map "r,c" → intentional char | empty
DomManager / DomGrid
  → tip enter → applyTip once → paint DOM from logical
  → empty logical → random on DOM; trail styles only
DropManager
  → spawn / motion / column sets
```

### Resolve rules

| Order | Match | Result |
| --- | --- | --- |
| 1 | Active **revealing** scenes, `modeEnteredAt` desc | Set logical char + style |
| 2 | Active **hiding** scenes | Clear logical (none / `" "`) |
| 3 | Else | Logical unchanged; DOM rain if empty |

- Drop must be post-activation (`dropAffects`) when provided.  
- Glyph change only when tip **enters** a cell (once per drop).

### Phases (shipped)

| Piece | Role |
| --- | --- |
| `Phase(name, build)` | `{ durationMs, schedule(t) }` |
| `loopPhases(player, phases, { gapMs })` | Sequence then loop |
| `cardRevealPhase` | Roles/email + storms |
| `quotePhase` | Card hide + quote reveal/hide |
| `cardQuoteLoop` | card → quote → **20s gap** → loop |

### Quote layout

Always **exactly 3 lines** (`wrapLinesAlways3`), centered.

## Task slices

| Task | Status |
| --- | --- |
| [symphony-orchestration.md](../tasks/symphony-orchestration.md) | MVP loop (ScenePlayer) |
| Pause + brightness quickfixes | Partial |
| SceneManager first pass + phases + 20s gap | Shipped; paint rewrite done |
| [symphony-logical-grid-paint.md](../tasks/symphony-logical-grid-paint.md) | Ownership rewrite done; browser eyeball |
| [symphony-orchestration-plan.md](../tasks/symphony-orchestration-plan.md) | Later: events, clearView, clock |

## Residual

- Browser confirmation of card/quote loop paint  
- `clearScene` / `clearView` as first-class schedulable actions  
- Event triggers `on(scene, "completed")`  
- Animation clock unified with frame `dt` (not only setTimeout remaining)  
- Word-space cells in TextLine (blank ownership when revealed) — currently rain gaps

## Session note

**2026-07-15 — Commit handoff**

Shipped this branch slice: logical/DOM paint ownership + ScenePlayer rename.
Smokes + build green. **Not done:** browser eyeball of card→quote→gap→loop.

**Next session**
1. Open dist/homepage; confirm no garbled dual paint (roles, email, quote).
2. If paint still wrong: shared hide/reveal points + hover `applyTip`.
3. Else residual: [symphony-orchestration-plan.md](../tasks/symphony-orchestration-plan.md)
   (event cues, clearView, frame clock).
