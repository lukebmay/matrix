# Task — Dirty DomManager paint

**Status:** Done (2026-07-20)  
**Plan:** [adaptive-performance.md](../../plans/adaptive-performance.md)  
**Priority:** P0 — high paint thrift on every device  
**Depends on:** [cheap-glow.md](cheap-glow.md) (done)

## Goal

Stop rewriting every live trail cell’s classes and `--drop-*` CSS vars every
frame. Restyle only when the cell’s paint role actually changes.

## Do

1. Track last trail **role** (`tip` | `body`) and **theme** per cell.
2. Apply palette / class toggles only on role or theme flip.
3. Tip enter still walks new rows (resolve + glyph); steady trail is CSS only.
4. Trail leave: clear drop chrome; re-paint settled content if revealed.
5. Column clear (last drop dies) still wipes the full column trail state.

## Out of scope

- Hot-path allocation reuse (slice 4).
- Weather scale / rAF (slices 5–6).
- Canvas rain layer.

## Done when

- [x] Steady body rows do not re-set classes or CSS vars each frame
- [x] Tip enter / trail leave / stack ownership flip still paint correctly
- [x] Theme cache invalidates when owner theme changes
- [x] `scripts/build.sh` green

## Session note (2026-07-20)

- `trailRole` + `trailTheme` WeakMaps; `applyTrailRole` skips clean cells.
- `paintFromLogical` no longer re-run for every tip/body row each frame.
- Files: `src/js/DomManager.mjs`, `docs/DESIGN.md`, plan + project status.
- Next plan slice: hot-path allocations ([plan](../../plans/adaptive-performance.md) slice 4).
