# Plan — ScenePlayer & scene paint

**Status:** In progress (paint rewrite shipped; play design **locked**)  
**Project:** `projects/matrix`  
**Branch:** `refactor_07-2026`  
**Next task:** [scene-player-play.md](../tasks/scene-player-play.md)
(play context + chains + storm window + homepage migrate).  
Optional parallel: browser eyeball
[scene-player-logical-grid-paint.md](../tasks/scene-player-logical-grid-paint.md).

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

### Phases (shipped — interim until play task)

| Piece | Role |
| --- | --- |
| `Phase(name, build)` | `{ durationMs, schedule(t) }` |
| `loopPhases(player, phases, { gapMs })` | Sequence then loop |
| `cardRevealPhase` / `quotePhase` | Legacy fixed-duration builders |
| `cardQuoteLoop` | Event-driven interim homepage loop |

**Target replace:** play context + cue chains — design locked in
[completed/scene-player-play-plan.md](scene-player/completed/scene-player-play-plan.md).
Implement: [scene-player-play.md](../tasks/scene-player-play.md).

### Play authoring (locked)

| Piece | Choice |
| --- | --- |
| Verb | `.on(event)`; alias `.wait` ≡ same |
| Events | `started` + `completed` (existing DropScene); optional `scene.events.*` |
| Storm | Coverage VRA window; rebuild accumulator per call |
| Skins | A multi-chain + C linear; homepage **C** at `src/js/play/homepage.mjs` |
| Context | Thin `player.context({ scenes })` |
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
| [scene-player-play.md](../tasks/scene-player-play.md) | **Next implement** — context + chains + storm window; migrate homepage |

## Residual

- Browser confirmation of card/quote loop paint  
- **Play authoring implement** (locked design → code)  
- Animation clock unified with frame `dt` (after play surface)  
- Word-space cells in TextLine (blank ownership when revealed) — currently rain gaps  

## Session note

**2026-07-15 — Play design locked**

Open questions resolved (`.on`+`.wait`, `started`/`completed`, storm
subject + VRA rebuild, `src/js/play/homepage.mjs`). Design archived at
[scene-player/completed/scene-player-play-plan.md](scene-player/completed/scene-player-play-plan.md).
Implement task: [scene-player-play.md](../tasks/scene-player-play.md).

**Next agent**
1. Implement play context/chains + storm coverage + homepage migrate only.  
2. No frame-dt clock, Style D, deploy, or reopening design.  
3. Eyeball paint remains optional/parallel if human available.
