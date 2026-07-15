# Task — Alignment F: Reveal glue to layout outputs

**Status:** Ready  
**Plan:** [alignment-anchors.md](../plans/alignment-anchors.md)  
**Depends on:** E  
**Next:** plan complete (G percent anchors later if needed)

## Goal

Bind laid-out positionables into **DropScenes** (`cells()` → points).
Wire homepage **reveal** (and optional **hide**) scenes using modes from
[rain-storm-column-coverage.md](rain-storm-column-coverage.md). Prefer
**separate** reveal vs hide scene instances. Timers OK; leave hooks for
[symphony-orchestration.md](symphony-orchestration.md).

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

- [ ] Layout-backed DropScenes for card/email
- [ ] Mode machine (hidden→revealing→revealed) works end-to-end
- [ ] Rain↔Storm sets correct for active modes
- [ ] Session note; plan progress updated

## Out of scope

Full Symphony DSL (own task); percent anchors.

## Session note

*(overwrite each session)*
