# Project: matrix

## Overview

Vanilla JS Matrix rain **business-card homepage** for lukemay.com.
Submodule; deploys to `/home/luke/www/matrix/`. Root shell loads `./matrix/*`.

**Status:** Runnable on `refactor_07-2026` (finish of mid-refactor).
Incomplete human WIP preserved on `refactor_incomplete-mid-refactor`.

**Next:** Symphony —
[tasks/symphony-orchestration.md](tasks/symphony-orchestration.md)
(alignment A–F + Rain MVP done; G percent anchors later if needed).

## Product rules

### Weather terminology

| Term | Role |
| --- | --- |
| **Drop** | One falling thread |
| **Rain** | Ambient spawn on the grid DropScene |
| **Storm** | Optional faster coverage on a content DropScene |
| **DropScene** | Points + column sets + **mode** (see below) |
| **Symphony** | Developer script of timed/event cues (animation machine) |

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
   `completed`) feed the orchestrator / Symphony.
6. Drops = motion; Dom paints from mode + points.
7. No video path.

**Tasks:**
[rain-storm-column-coverage.md](plans/alignment-anchors/completed/rain-storm-column-coverage.md)
(done),
[symphony-orchestration.md](tasks/symphony-orchestration.md).

## Stack

| Piece | Choice |
| --- | --- |
| Runtime | ES modules (no bundler) |
| Build | `scripts/build.sh` → rsync src → dist |
| Rate | `VariableRateAccumulator` + softSquare / pulse rateFns |
| Deploy | monorepo `scripts/deploy/matrix.py` |

## Architecture (target)

```text
Symphony (cues: time + scene events)
  → Orchestrator
      → DropScenes (mode, columnsSelected, events)
      → Rain / Storm picks + bidirectional sets
      → Drops
layout Positionables.cells() → scene points
DomManager ← mode + points (show/hide)
```

| Module | Role |
| --- | --- |
| DropScene | points, columns, columnsSelected, mode, events |
| Orchestrator / Symphony | sequence revealing/hiding |
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

1. Symphony (event/time cues; replace Configuration timers).
2. Browser polish on reveal timing if needed.
3. Deploy + job-search polish.
