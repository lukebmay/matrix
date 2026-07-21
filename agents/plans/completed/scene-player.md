# Plan — ScenePlayer & scene paint

**Status:** Complete (archived 2026-07-20) — paint eyeball confirmed  
**Project:** `projects/matrix`  
**Branch:** `refactor_07-2026`  
**Next product work:** saying playlist / deploy polish (not this plan).

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
Play (src/js/play/homepage.mjs) via ScenePlayer.context / cue chains
  → delay | on/wait | activate | hide | storm(seconds) | loop
ScenePlayer (pause-aware clock)
  → DropScene.enterMode / configureStormCoverage (VRA window)
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

Live homepage: `src/js/play/homepage.mjs` (Configuration wires it).  
Design: [completed/scene-player-play-plan.md](../scene-player/completed/scene-player-play-plan.md).

### Legacy (still exported)

| Piece | Role |
| --- | --- |
| `Phase` / `loopPhases` | Fixed-duration sequences |
| `cardRevealPhase` / `sayingPhase` | Fixed-duration builders |
| `cardQuoteLoop` | Pre-play-context homepage factory (not used live) |

### Saying layout

Always **exactly 3 lines** (`wrapLinesAlways3`), centered.

## Task slices

| Task | Status |
| --- | --- |
| [scene-player-mvp.md](../scene-player/completed/scene-player-mvp.md) | **Done** — MVP + superseded by play |
| Pause + brightness quickfixes | Partial (historical) |
| SceneManager first pass + phases + event loop | Shipped |
| [scene-player-logical-grid-paint.md](../scene-player/completed/scene-player-logical-grid-paint.md) | **Done** — code + eyeball |
| [scene-player-play-plan.md](../scene-player/completed/scene-player-play-plan.md) | **Design locked** |
| [scene-player-play.md](../scene-player/completed/scene-player-play.md) | **Shipped** — context + chains + storm + homepage |

## Residual (out of plan)

- Word-space cells in TextLine (rain gaps between words today)  
- Frame-`dt` unified animation clock (new task if needed)  
- Deploy + job-search polish  

## Session note

**2026-07-15 — Wrapup**

Play authoring + paint ownership shipped on `refactor_07-2026`. MVP and
play tasks archived under `plans/scene-player/completed/`.

**2026-07-20 — Plan complete**

Eyeball confirmed. Paint task archived under
`plans/scene-player/completed/scene-player-logical-grid-paint.md`.
No open residual for this plan.

**Key paths**

| Path | Role |
| --- | --- |
| `src/js/ScenePlayer.mjs` | Clock + `context` chains + storm helper |
| `src/js/play/homepage.mjs` | Style C homepage play |
| `src/js/DropScene.mjs` | Modes + `events.*` handles |
| `src/js/SceneManager.mjs` | Logical grid + tip resolve |
| `src/js/DomManager.mjs` | DOM paint from logical |
| `src/js/Configuration.mjs` | Layout + wire `homepagePlay` |

**Next product**
1. Saying playlist ([interactive-play](../interactive-play.md))  
2. Deploy / job-search polish  
3. Frame-dt / Style D only if a new task is filed  
