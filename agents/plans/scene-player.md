# Plan — ScenePlayer & scene paint

**Status:** In progress (logical/DOM ownership rewrite shipped; **browser eyeball**)  
**Project:** `projects/matrix`  
**Branch:** `refactor_07-2026`  
**Next task:** Eyeball [scene-player-logical-grid-paint.md](../tasks/scene-player-logical-grid-paint.md);
then finish design in [scene-player-play-plan.md](../tasks/scene-player-play-plan.md)
→ implement `scene-player-play` after sign-off.

## Goal

One coherent **animation machine**:

1. Pause-aware clock / cues  
2. **Programmatic play authoring** (multi-style chains + thin play context)  
3. **Logical grid** (intentional chars) + **DOM grid** (view) via SceneManager  
4. Schedulable clear/reveal/hide + **storm(duration)** coverage window  
5. Homepage play as its own module on that surface (not magic factories)  

## Two grids

| Grid | Holds | Rule |
| --- | --- | --- |
| **Logical** | Non-random intentional characters that **should show** | Written by reveal tip; cleared only by hide tip |
| **DOM** | Painted cells | Logical char if present, else random rain |

Rain never writes content into the logical grid.

## Architecture

```text
Play (homepage.mjs) via ScenePlayer.context / cue chains
  → delay | on/when | activate | hide | storm(seconds) | loop
ScenePlayer (pause-aware clock)
  → DropScene.enterMode / startStorm (VRA coverage window)
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

### Phases (shipped — interim)

| Piece | Role |
| --- | --- |
| `Phase(name, build)` | `{ durationMs, schedule(t) }` |
| `loopPhases(player, phases, { gapMs })` | Sequence then loop |
| `cardRevealPhase` / `quotePhase` | Legacy fixed-duration builders |
| `cardQuoteLoop` | Event-driven interim homepage loop |

**Target replace:** play context + cue chains (see play-authoring plan).
Homepage should read as steps / event reactions, not option bags on a
named factory. `storm(seconds)` = VRA window so pool columns *begin*
within that time.

### Quote layout

Always **exactly 3 lines** (`wrapLinesAlways3`), centered.

## Task slices

| Task | Status |
| --- | --- |
| [scene-player-mvp.md](../tasks/scene-player-mvp.md) | MVP loop (ScenePlayer) |
| Pause + brightness quickfixes | Partial |
| SceneManager first pass + phases + event loop | Shipped; paint rewrite done |
| [scene-player-logical-grid-paint.md](../tasks/scene-player-logical-grid-paint.md) | Ownership rewrite done; browser eyeball |
| [scene-player-play-plan.md](../tasks/scene-player-play-plan.md) | **In progress** — ScenePlayer play API design |
| `scene-player-play.md` (suggested) | After sign-off: context + chains + storm window; migrate homepage |

## Residual

- Browser confirmation of card/quote loop paint  
- **Play authoring** — multi-style chains + thin `context({ scenes })`  
- **`storm(seconds)`** — VRA coverage window (all pool cols begin in window)  
- `clearScene` / `clearView` as first-class schedulable actions  
- Animation clock unified with frame `dt` (not only setTimeout remaining)  
- Word-space cells in TextLine (blank ownership when revealed) — currently rain gaps  

Design detail: [scene-player-play-plan.md](../tasks/scene-player-play-plan.md).

## Session note

**2026-07-15 — Paint audit + hide DOM fix**

Logical/DOM ownership verified. Fixed hide tip leaving intentional chars on
DOM (`DomManager.paintFromLogical` now re-rolls when clearing `m-revealed`).
Smokes + build green. Paint task still needs **human browser eyeball**.

**Next**
1. Eyeball [scene-player-logical-grid-paint.md](../tasks/scene-player-logical-grid-paint.md)
   card → quote → loop; complete task when clean.  
2. Play authoring design/sign-off in [scene-player-play-plan.md](../tasks/scene-player-play-plan.md).  
3. Implement `scene-player-play` after approval.
