# Task — Alignment F: Reveal glue to layout outputs

**Status:** Done  
**Plan:** [alignment-anchors.md](../../alignment-anchors.md)  
**Depends on:** E  
**Next:** Symphony ([symphony-orchestration.md](../../../tasks/symphony-orchestration.md)); G percent anchors later if needed

## Goal

Bind laid-out positionables into **DropScenes** (`cells()` → points).
Wire homepage **reveal** (and optional **hide**) scenes using modes from
[rain-storm-column-coverage.md](rain-storm-column-coverage.md). Prefer
**separate** reveal vs hide scene instances. Timers OK; leave hooks for
[symphony-orchestration.md](../../../tasks/symphony-orchestration.md).

## Do

1. `DropScene.from(positionable)` → points, columns.
2. Roles/email **reveal** scenes: enter `revealing` on delay; complete →
   `revealed`.
3. Optional hide scenes later: enter `hiding` (reset columnsSelected).
4. Rain = grid scene always contributing ambient drops.
5. Bidirectional sets only while content scene is `revealing`/`hiding`.
6. Emit scene events; Configuration may use crude timers until Symphony.
7. Smoke: show path; no dark columns; hide path if implemented.

## Done when

- [x] Layout-backed DropScenes for card/email
- [x] Mode machine (hidden→revealing→revealed) works end-to-end
- [x] Rain↔Storm sets correct for active modes
- [x] Session note; plan progress updated

## Out of scope

Full Symphony DSL (own task); percent anchors.

## Session note

**2026-07-15 — F done:**

- Configuration: `DropScene.from(rolesGroup)` / `DropScene.from(emailGroup)`
  after `solveLayout`; Storm VRA assigned from `columns.size`
- DisplayText paints from shared scene points (`revealed` refs stay in sync)
- Reveal path: timers 3.5s / 9s → `enterMode('revealing')` → Storm + Rain
  drain → `revealed` (unchanged Rain MVP machinery; verified)
- Bidirectional spawn sets only on active modes (DropManager + DropScene)
- **Skipped:** separate hide DropScene instances — deferred to Symphony
- Smokes: `node src/js/DropScene.mjs`, `Rain.mjs`, point-share check;
  `npm run build` pass. Browser eyeball still recommended for visual reveal timing.
