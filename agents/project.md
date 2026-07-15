# Project: matrix

## Overview

Vanilla JS Matrix rain **business-card homepage** for lukemay.com.
Submodule; deploys to `/home/luke/www/matrix/`. Root shell loads `./matrix/*`.

**Status:** Runnable on `refactor_07-2026` (finish of mid-refactor).
Incomplete human WIP preserved on `refactor_incomplete-mid-refactor`.

**Next:** Logical grid + DOM paint fix —
[tasks/scene-player-logical-grid-paint.md](tasks/scene-player-logical-grid-paint.md)
(prior SceneManager pass incomplete in browser; G percent anchors later).

**Plan:** [plans/scene-player.md](plans/scene-player.md).

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
3. Additive Rain + Storm; **one live drop per column**.
4. **Bidirectional sets** on spawn: Rain↔active scene `columnsSelected`
   and Rain first-pass (stable scenes untouched).
5. **Events** on scenes (`started`, `dropSelected`, point show/hide,
   `completed`) feed ScenePlayer.
6. Drops = motion; Dom paints from mode + points.
7. No video path.

**Tasks:**
[rain-storm-column-coverage.md](plans/alignment-anchors/completed/rain-storm-column-coverage.md)
(done),
[scene-player-mvp.md](tasks/scene-player-mvp.md)
(MVP loop),
[scene-player-logical-grid-paint.md](tasks/scene-player-logical-grid-paint.md)
(**next** — logical vs DOM grid, fix paint),
[scene-player-play-plan.md](tasks/scene-player-play-plan.md)
(residual design: events, clearView, clock).

## Stack

| Piece | Choice |
| --- | --- |
| Runtime | ES modules (no bundler) |
| Build | `scripts/build.sh` → rsync src → dist |
| Rate | `VariableRateAccumulator` + softSquare / pulse rateFns |
| Deploy | monorepo `scripts/deploy/matrix.py` |

## Architecture (target)

```text
ScenePlayer (cues: time + scene events)
  → DropScenes (mode, columnsSelected, events)
  → Rain / Storm picks + bidirectional sets
  → Drops
layout Positionables.cells() → scene points
SceneManager (logical grid) + DomManager (paint)
```

| Module | Role |
| --- | --- |
| DropScene | points, columns, columnsSelected, mode, events |
| ScenePlayer | sequence revealing/hiding via timed phases |
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

1. ScenePlayer **play authoring** (context + chains; storm coverage window) —
   design in `tasks/scene-player-play-plan.md`; implement after sign-off.
2. Browser polish on reveal timing / paint eyeball if needed.
3. Deploy + job-search polish.
