# Project: matrix

## Overview

Vanilla JS Matrix rain **business-card homepage** for lukemay.com.
Submodule; deploys to `/home/luke/www/matrix/`. Root shell loads `./matrix/*`.

**Status:** Runnable on `refactor_07-2026` (ScenePlayer play + paint
ownership shipped; adaptive perf core shipped). Incomplete human WIP
preserved on `refactor_incomplete-mid-refactor`.

**Next:** Saying playlist interlude; deploy + job-search polish; optional
ASCII portrait / theme cull / canvas rain.

**Design:** [docs/DESIGN.md](../docs/DESIGN.md).

**Active plan:** [plans/interactive-play.md](plans/interactive-play.md)
(runtime + hover shipped; playlist next).

**Completed plans:** [scene-player](plans/completed/scene-player.md),
[alignment-anchors](plans/completed/alignment-anchors.md),
[adaptive-performance](plans/completed/adaptive-performance.md)
(slices 1–6; optional canvas rain later).

## Product rules

### Weather terminology

| Term | Role |
| --- | --- |
| **Drop** | One falling thread |
| **Rain** | Ambient spawn on the grid DropScene |
| **Storm** | Optional faster coverage on a content DropScene |
| **DropScene** | Points + column sets + **mode** (see below) |
| **ScenePlayer** | Timed/event cues that drive DropScene modes (animation machine) |

### DropScene modes

| Mode | Kind | Drop system acts? | Effect when drop covers points/cols |
| --- | --- | --- | --- |
| `hidden` | stable | No | — |
| `revealing` | active | Yes | **Show** glyphs; drain `columnsSelected` |
| `revealed` | stable | No | Text stays shown |
| `hiding` | active | Yes | **Reset** `columnsSelected` on enter; **hide** glyphs as cols covered |

- Scenes **exist** anytime; only `revealing` / `hiding` are acted on.
- Prefer **separate** reveal vs hide scene instances (one job each).
- Entering `hiding` always **resets** the column selection set.

### Spawn rules

1. **Rain** forever; soft-square rate; first-pass **without replacement**
   then free random.
2. Optional **Storms** on active content scenes.
3. Additive Rain + Storm; Rain **one live drop per column**. Storms may
   **stack** on occupied `columnsSelected` cols (no-overtake speed) unless
   weather scale is on —
   see [tasks/completed/storm-stack-behind-leader.md](tasks/completed/storm-stack-behind-leader.md),
   [tasks/completed/weather-scale.md](tasks/completed/weather-scale.md).
4. **Bidirectional sets** on spawn: Rain↔active scene `columnsSelected`
   and Rain first-pass (stable scenes untouched).
5. **Events** on scenes (`started`, `dropSelected`, point show/hide,
   `completed`) feed ScenePlayer.
6. Drops = motion; Dom paints from mode + points.
7. No video path.

**Tasks / plan work:**

| Item | Status |
| --- | --- |
| [alignment-anchors.md](plans/completed/alignment-anchors.md) | **Done** — A–F shipped; G unfiled |
| [rain-storm-column-coverage.md](plans/alignment-anchors/completed/rain-storm-column-coverage.md) | Done |
| [scene-player.md](plans/completed/scene-player.md) | **Done** — play + paint + eyeball |
| [scene-player-mvp.md](plans/scene-player/completed/scene-player-mvp.md) | Done |
| [scene-player-play-plan.md](plans/scene-player/completed/scene-player-play-plan.md) | Design locked |
| [scene-player-play.md](plans/scene-player/completed/scene-player-play.md) | Shipped |
| [scene-player-logical-grid-paint.md](plans/scene-player/completed/scene-player-logical-grid-paint.md) | Done — code + eyeball |
| [adaptive-performance.md](plans/completed/adaptive-performance.md) | **Done** — slices 1–6; optional canvas later |
| [interactive-play.md](plans/interactive-play.md) | Runtime + hover shipped; **playlist next** |
| [interactive-play_design.md](plans/interactive-play/completed/interactive-play_design.md) | Done — design lock |
| [interactive-play_runtime.md](plans/interactive-play/completed/interactive-play_runtime.md) | Done — runtime + homepage |
| [hover-hasten-reveal.md](plans/interactive-play/completed/hover-hasten-reveal.md) | Done — hasten / extend / re-reveal |
| [persistent-text-glow.md](tasks/completed/persistent-text-glow.md) | Done — settled glow; black edge on body text |
| [storm-stack-behind-leader.md](tasks/completed/storm-stack-behind-leader.md) | Done — multi-drop + maxSafeStackSpeed |
| [kiosk-long-running.md](tasks/completed/kiosk-long-running.md) | Done — path `/kiosk` + detect; portfolio polite pauses gated |
| [color-themes-cycle.md](tasks/completed/color-themes-cycle.md) | Done — multi-theme blend + coverage drain |
| [content-glyph-density.md](tasks/completed/content-glyph-density.md) | Done — content COLS/ROWS + saying wrap (narrow) |
| [cheap-glow.md](tasks/completed/cheap-glow.md) | Done — `m-cheap-glow` (narrow + low-power + ratchet; freeze fix) |
| [dirty-dom-paint.md](tasks/completed/dirty-dom-paint.md) | Done — tip enter / trail leave / role flip only |
| [hot-path-allocations.md](tasks/completed/hot-path-allocations.md) | Done — glyph pools, forEachColumnDrops, free-col reuse |
| [weather-scale.md](tasks/completed/weather-scale.md) | Done — shorter tails / no storm stack (rain rate full) |
| [frame-scheduler.md](tasks/completed/frame-scheduler.md) | Done — rAF throttle + adaptive interval + dt clamp |

## Stack

| Piece | Choice |
| --- | --- |
| Runtime | ES modules (no bundler) |
| Build | `scripts/build.sh` → rsync src → dist |
| Rate | `VariableRateAccumulator` + softSquare / pulse rateFns |
| Deploy | monorepo `scripts/deploy/matrix.py` |

## Architecture

```text
play/homepage.mjs (Unit/Thread sugar)
  → play/runtime.mjs (reveal/hide/hold units, thread.run|spawn|delay|loop)
  → ScenePlayer (pause-aware timers + clear)
  → DropScenes (mode, columnsSelected, events)
  → Rain / Storm picks + bidirectional sets
  → Drops
layout Positionables.cells() → scene points
SceneManager (logical grid) + DomManager (paint)
```

| Module | Role |
| --- | --- |
| DropScene | points, columns, columnsSelected, mode, events |
| ScenePlayer | pause-aware clock + play context / cue chains |
| play/runtime.mjs | Unit/Thread factories + sugar |
| play/homepage.mjs | Live homepage Unit/Thread play |
| SceneManager | logical grid + tip resolve |
| Rain / Storm | weather rates + column pick |
| layout/* | positionables; Grid; DomGrid |
| DomManager | paint |

## Branches

| Branch | Meaning |
| --- | --- |
| `master` | Last pre-finish Luke line (LinearWaveForm era) |
| `refactor_incomplete-mid-refactor` | Human incomplete DropScene/VRA WIP |
| `refactor_07-2026` | AI implementation of finish design |

## Priorities

1. Saying playlist interlude ([plans/interactive-play.md](plans/interactive-play.md)).
2. Deploy + job-search polish (includes root `/kiosk/` shell with matrix).
3. Optional: ASCII portrait, frame-`dt` clock, canvas rain
   ([plans/completed/adaptive-performance.md](plans/completed/adaptive-performance.md) slice 7).
