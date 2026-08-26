# Task — Alignment A: geometry + coordinate Grid + DomGrid rename

**Status:** Done  
**Plan:** [alignment-anchors.md](../../completed/alignment-anchors.md)  
**Depends on:** —  
**Next:** [alignment-anchors_b-env-attach-solve.md](../../../tasks/alignment-anchors_b-env-attach-solve.md)

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

- [x] Inclusive geometry API exists and is tested or smoke-checked
- [x] Coordinate `layout/Grid.mjs` exists
- [x] No remaining imports of old `Grid.mjs` path for the cell store
- [x] `npm run dev` / headless load still works
- [x] Session note filled; task ready to move to plan `completed/` when
      accepted

## Out of scope

Attach/solve, TextLine materialize, Configuration rewire, env module.

## Session note

**Shipped (2026-07-15):**

| Path | Role |
| --- | --- |
| `src/js/layout/Positionable.mjs` | origin `[row,col]`, width, height; `top/left/bottom/right/middle/center` |
| `src/js/layout/Grid.mjs` | Root positionable; `Grid({ rows, cols })` or `{ ROWS, COLS }`; origin `[0,0]`; sets `.ROWS`/`.COLS` |
| `src/js/DomGrid.mjs` | Renamed from `src/js/Grid.mjs` (DOM cell store API unchanged) |
| `src/js/Matrix.mjs` | `import DomGrid from "./DomGrid.mjs"`; `state.grid = DomGrid()` |

**API:** Inclusive: `bottom = row0+h-1`, `right = col0+w-1`, `middle = row0+⌊(h-1)/2⌋`, `center = col0+⌊(w-1)/2⌋`. Origin array is live (mutate in place for later solve). Grid returns a Positionable instance with ROWS/COLS.

**Smoke:** Node geometry checks (1×1, odd 5×3, even 4×2, mutable origin, Grid 24×80); DomGrid module import; `npm run build` OK; no stale `./Grid.mjs` imports; dist has DomGrid + layout/.

**Not wired:** Configuration does not use layout Grid yet (task E). `state.grid` still means DomGrid.

**Next (B):** env + Anchor + attach/solve; forest rooted at layout `Grid`.
