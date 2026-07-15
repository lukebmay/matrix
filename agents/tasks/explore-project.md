# Task — Explore project: matrix

**Status:** Done (2026-07-14)  
**Project:** `projects/matrix` — Matrix-style homepage (vanilla ES modules)

## Goal

Clarify purpose vs monorepo root; document build scripts and whether this
is live, legacy, or experimental; capture drop-manager / rate architecture
for the finish-for-job-search workstream.

## Do

1. Read `package.json`, `scripts/`, `src/` (and dist only as pre-refactor reference).
2. Relationship to monorepo deploy (root shell → `./matrix/`).
3. Update `agents/project.md` + human `README.md`.
4. Recommend keep / finish path for job-search surface area.
5. Critique drop/reveal abstractions (no implementation this session).

## Done when

- [x] `agents/project.md` filled
- [x] Status: mid-refactor WIP, intended live homepage (src currently unbootable)
- [x] Next action if any
- [x] Architecture notes for rate waves + concurrent reveal (see project.md)

## Session note (2026-07-14)

Documented product goals (baseline waveform + timed reveal waves over text
areas). Compared dist-era LinearWaveForm/StaticText design vs src
VariableRateAccumulator + incomplete DropScene hierarchy. Video path
explicitly deferred. Listed import/blocker inventory. No code changes.
Next: implement finish plan in a new task under this `agents/tasks/`.
