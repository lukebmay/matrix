# Task — Hot-path allocations

**Status:** Done (2026-07-20)  
**Plan:** [adaptive-performance.md](../../plans/completed/adaptive-performance.md)  
**Priority:** P0 — medium gain after dirty paint  
**Depends on:** [dirty-dom-paint.md](dirty-dom-paint.md) (done)

## Goal

Cut per-frame and per-glyph allocations on the rain hot path so GC and object
churn do not steal frame budget on slower devices (after dirty paint already
removed most DOM restyle thrash).

## Do

1. Pre-split rain glyph pools in `RainGlyphs` (no `Array.from` per tip glyph).
2. Cache code-point arrays in `randomChar`; pick from `Set` without copying.
3. Paint via `DropManager.forEachColumnDrops` (no `getDrops()` → Array each frame).
4. Reuse free-column scratch list; swap-pop on spawn (no `filter` copy).
5. Reuse DomManager `rowPaint` Map; fill body trail by length band only.
6. (Same session) Fix cheap-glow ratchet vs frozen Configuration.

## Out of scope

- Weather scale / rAF (slices 5–6).
- Canvas rain layer.

## Done when

- [x] Tip-enter glyph pick does not allocate a pool each time
- [x] Frame paint does not `Array.from` the live drop set
- [x] Free-column rebuild does not allocate a fresh array each settle
- [x] Cheap-glow runtime escalate works with frozen config
- [x] `scripts/build.sh` green; DropManager / Rain / random smoke tests pass

## Session note (2026-07-20)

- Files: `RainGlyphs.mjs`, `util/random.mjs`, `DropManager.mjs`, `DomManager.mjs`,
  `Matrix.mjs` (ratchet fix), plan + DESIGN.
- Next plan slice: weather scale when quality is low
  ([plan](../../plans/completed/adaptive-performance.md) slice 5).
