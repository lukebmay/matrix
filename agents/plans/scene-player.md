# Plan — ScenePlayer & scene paint

**Status:** In progress (paint rewrite shipped; **play authoring shipped**)  
**Project:** `projects/matrix`  
**Branch:** `refactor_07-2026`  
**Next task:** optional browser eyeball
[scene-player-logical-grid-paint.md](../tasks/scene-player-logical-grid-paint.md);
then deploy / job-search polish.  
Play implement done:
[scene-player-play.md](scene-player/completed/scene-player-play.md).

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
  → delay | on/wait | activate | hide | storm(seconds) | loop
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

### Phases (legacy — still exported)

| Piece | Role |
| --- | --- |
| `Phase(name, build)` | `{ durationMs, schedule(t) }` |
| `loopPhases(player, phases, { gapMs })` | Sequence then loop |
| `cardRevealPhase` / `quotePhase` | Legacy fixed-duration builders |
| `cardQuoteLoop` | Event-driven interim homepage loop (superseded live) |

**Live homepage:** `src/js/play/homepage.mjs` via `player.context` chains.
Design: [completed/scene-player-play-plan.md](scene-player/completed/scene-player-play-plan.md).

### Play authoring (shipped)

| Piece | Choice |
| --- | --- |
| Verb | `.on(event)`; alias `.wait` ≡ same |
| Events | `started` + `completed`; `scene.events.*` handles |
| Storm | Coverage VRA window; rebuild accumulator per call |
| Skins | A multi-chain + C linear; homepage **C** at `src/js/play/homepage.mjs` |
| Context | Thin `player.context({ scenes })` |
| Kickoff | `ctx.start()` → `emit("appStart")` |
| Out of v1 | Frame-dt clock, Style D async, visual timeline |

### Quote layout

Always **exactly 3 lines** (`wrapLinesAlways3`), centered.

## Task slices

| Task | Status |
| --- | --- |
| [scene-player-mvp.md](../tasks/scene-player-mvp.md) | MVP loop (ScenePlayer) |
| Pause + brightness quickfixes | Partial |
| SceneManager first pass + phases + event loop | Shipped; paint rewrite done |
| [scene-player-logical-grid-paint.md](../tasks/scene-player-logical-grid-paint.md) | Ownership rewrite done; browser eyeball |
| [scene-player-play-plan.md](scene-player/completed/scene-player-play-plan.md) | **Design locked** |
| [scene-player-play.md](scene-player/completed/scene-player-play.md) | **Shipped** — context + chains + storm + homepage |

## Residual

- Browser confirmation of card/quote loop paint  
- Animation clock unified with frame `dt` (after play surface)  
- Word-space cells in TextLine (blank ownership when revealed) — currently rain gaps  
- Deploy + job-search polish  

## Session note

**2026-07-15 — Play authoring shipped**

- APIs: `player.context`, chain `on/wait/delay/activate/hide/storm/clear/clearView/call/loop/loopFrom`, `ctx.start`/`emit`
- Storm coverage helper rebuilds finite VRA per call
- Homepage: `src/js/play/homepage.mjs` Style C; Configuration uses it
- Paths: `ScenePlayer.mjs`, `DropScene.mjs` (`events`), `play/homepage.mjs`, `Configuration.mjs`
- Task archived: [scene-player/completed/scene-player-play.md](scene-player/completed/scene-player-play.md)
- Smokes + build green

**Next**
1. Optional paint eyeball ([scene-player-logical-grid-paint.md](../tasks/scene-player-logical-grid-paint.md))  
2. Deploy / polish when ready  
3. No frame-dt / Style D unless new task
