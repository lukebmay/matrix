# Task — Alignment B: env, anchors, attach + layout solve

**Status:** Ready  
**Plan:** [alignment-anchors.md](../plans/alignment-anchors.md)  
**Depends on:** A  
**Next:** C can parallelize after A; D needs B+C

## Goal

Runtime **env** flags; **Anchor** resolution (number | function |
object with `.canonical`); **attach** + **solve** + cycle detection.

## Do

1. Add `src/js/env.mjs`: `MODE`, `errorOnCycles` (dev true / prod false);
   detection order per plan (override → hostname → default prod).
2. Add `layout/Anchor.mjs` (or similar):
   - `resolveComponent(comp, ctx) → number`
   - `resolvePoint(point, ctx) → [row, col]`
   - small readable helpers (`Anchors.topLeft(p)`, `.plus(n)`, etc.)
   - Anchor **objects** preferred in authoring API; bare functions OK
3. Add `layout/attach.mjs`:
   - one attachment per positionable
   - `solveLayout(roots)` roots → leaves
   - if `env.errorOnCycles`, detect directed cycles (and double-static if
     straightforward); throw with path
4. Tests: static pin; mixed `[number, Anchor]`; simple parent/child;
   cycle throws when flag on.

## Done when

- [ ] `env.errorOnCycles` behaves per mode
- [ ] Mixed point components resolve
- [ ] Attachment equality sets child origin correctly for top-left this
- [ ] Cycle check gated by env
- [ ] Session note updated

## Out of scope

TextLine, stacks, Configuration content. Rain first-pass / Storm naming
→ [rain-storm-column-coverage.md](rain-storm-column-coverage.md) (parallel).

## Session note

*(overwrite each session)*
