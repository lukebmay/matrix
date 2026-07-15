# Project: matrix

## Overview

Vanilla JS Matrix rain **business-card homepage** for lukemay.com.
Submodule; deploys to `/home/luke/www/matrix/`. Root shell loads `./matrix/*`.

**Status:** Runnable on `refactor_07-2026` (finish of mid-refactor).
Incomplete human WIP preserved on `refactor_incomplete-mid-refactor`.

**Next:** Polish timings/copy for job search; deploy when ready.

## Product rules

1. Ambient baseline rain forever; soft-square rate waves.
2. Timed reveal waves for text column sets (roles ~3.5s, email ~9s).
3. **Additive** policies (not exclusive mode switch).
4. **At most one live drop per column.**
5. Baseline covering a reveal column **marks that column covered** for the
   active finite reveal (no second drop required there).
6. Drops = motion only; content/links = DisplayText + DomManager.
7. No video / ASCII stream path.

## Stack

| Piece | Choice |
| --- | --- |
| Runtime | ES modules (no bundler) |
| Build | `scripts/build.sh` → rsync src → dist |
| Rate | `VariableRateAccumulator` + softSquare / pulse rateFns |
| Deploy | monorepo `scripts/deploy/matrix.py` |

## Architecture

```text
Configuration.createScene()
  → contentLayers[] (DisplayText)
  → spawnPolicies[] (baseline + reveals)
Matrix loop
  → DropManager.updateDrops(dt)   # policies additive; occupancy
  → DomManager.updateDom()        # paint + reveal glyphs
```

| Module | Role |
| --- | --- |
| `SpawnPolicy` | accumulator, column set, remaining, markCovered |
| `DropManager` | Set of drops, occupied columns, priority-sorted spawn |
| `DisplayText` | positions/columns/href |
| `DomManager` | data-static-char + trail classes |

## Branches

| Branch | Meaning |
| --- | --- |
| `master` | Last pre-finish Luke line (LinearWaveForm era) |
| `refactor_incomplete-mid-refactor` | Human incomplete DropScene/VRA WIP |
| `refactor_07-2026` | AI implementation of finish design |

## Priorities

1. Deploy + eyeball timings on real viewport sizes.
2. Link/resume URL polish for applications.
3. Optional: credit accounting on accumulator when baseline covers reveal
   (column markCovered is already enough for product).
