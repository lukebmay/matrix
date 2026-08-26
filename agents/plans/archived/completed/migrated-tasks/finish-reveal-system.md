# Task — Finish matrix reveal system (job-search ship)

**Status:** Done (2026-07-14) — implementation on `refactor_07-2026`  
**Priority:** P0 — public homepage / business card  
**Project:** `projects/matrix`

## Goal

Make matrix a shippable homepage: ambient rain with recognizable rate
waves, timed reveal bursts over text groups, additive spawns, one drop
per column, baseline can satisfy reveal columns.

## Do

1. Restore bootable import graph.
2. Single ambient SpawnPolicy with VRA + soft-square rateFn.
3. Content layers for roles + email.
4. Concurrent reveal policies + timeline delays.
5. Dom keeps reveal ownership.
6. Build script fixed; smoke tests for VRA + import graph.
7. Video / LinearWaveForm removed from live path.

## Done when

- [x] Import graph resolves; build copies src → dist
- [x] Additive SpawnPolicy model with occupancy + markCovered
- [x] README/status updated
- [x] Incomplete human WIP on `refactor_incomplete-mid-refactor`

## Session note (2026-07-14)

Implemented SpawnPolicy + DropManager finish on `refactor_07-2026` from
matrix master, reusing VariableRateAccumulator/util split ideas from the
incomplete refactor. Soft-square baseline; roles @3.5s; email @9s.
No video. Branch delineation: incomplete snapshot vs this AI branch.
