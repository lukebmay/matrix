# Task — Alignment A: geometry + coordinate Grid + DomGrid rename

**Status:** Ready  
**Plan:** [alignment-anchors.md](../plans/alignment-anchors.md)  
**Depends on:** —  
**Next:** [alignment-anchors_b-env-attach-solve.md](alignment-anchors_b-env-attach-solve.md)

## Goal

Land core **Positionable** geometry and the **coordinate `Grid`** root.
Rename the DOM cell store so the name `Grid` is free for layout.

## Do

1. Add `src/js/layout/Positionable.mjs` (or equivalent):
   - origin `[row, col]`, `width`, `height`
   - `top/left/bottom/right/middle/center` (inclusive character formulas)
2. Add `src/js/layout/Grid.mjs` — root positionable for ROWS×COLS from
   config (origin `[0,0]`, size full matrix).
3. Rename `src/js/Grid.mjs` → `src/js/DomGrid.mjs` (DOM cell element
   store); update all imports (`Matrix`, DomManager, etc.).
4. Smoke: app still runs (rain + text) after rename only.
5. Unit-style checks optional: middle/center for odd/even sizes.

## Done when

- [ ] Inclusive geometry API exists and is tested or smoke-checked
- [ ] Coordinate `layout/Grid.mjs` exists
- [ ] No remaining imports of old `Grid.mjs` path for the cell store
- [ ] `npm run dev` / headless load still works
- [ ] Session note filled; task ready to move to plan `completed/` when
      accepted

## Out of scope

Attach/solve, TextLine materialize, Configuration rewire, env module.

## Session note

*(overwrite each session)*
