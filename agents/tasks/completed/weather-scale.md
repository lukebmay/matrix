# Task — Weather scale (constrained)

**Status:** Done (2026-07-20)  
**Plan:** [adaptive-performance.md](../../plans/adaptive-performance.md)  
**Priority:** P0 — medium gain after hot-path allocs  
**Depends on:** [hot-path-allocations.md](hot-path-allocations.md) (done)

## Goal

Cut concurrent painted rain cells on constrained devices by scaling weather
down: lower ambient rain peak, shorter drop tails, and no storm stack when
quality is low or the viewport is tight (same static gate as cheap glow),
with a runtime ratchet that can escalate mid-session.

## Do

1. Config `WEATHER_SCALE` (= `IS_CHEAP_GLOW` at construction):
   - Rain soft-square **peak** × ~0.65 (trough unchanged).
   - `DROP_LENGTH_MIN/MAX` × ~0.6 (floor min 2).
   - `ALLOW_STORM_STACK = false`.
2. DropManager: stack only when allow flag true (cfg + `state.allowStormStack`).
3. Mid-session ratchet (with cheap glow): set `state.weatherScale` /
   `state.allowStormStack`; thin ambient rain want; shorten new drop lengths
   when config lengths were full quality.
4. Smoke: occupied storm col does not stack under weather scale; free
   selected still spawns.
5. DESIGN + plan status.

## Out of scope

- Frame scheduler / rAF (slice 6).
- Canvas rain layer.
- Scaling content storm *rates* (coverage still honest via refund).

## Done when

- [x] Constrained config: lower rain peak, shorter tails, no storm stack
- [x] Capable config keeps full weather until ratchet
- [x] Runtime ratchet escalates weather without mutating frozen config
- [x] Storm still covers free selected columns under weather scale
- [x] `scripts/build.sh` green; DropManager / Rain smokes pass

## Session note (2026-07-20)

- Files: `Configuration.mjs`, `State.mjs`, `Drop.mjs`, `DropManager.mjs`,
  `Matrix.mjs`, `docs/DESIGN.md`, plan + project.
- Scales: `WEATHER_RAIN_PEAK_SCALE=0.65`, `WEATHER_LENGTH_SCALE=0.6`.
- Ratchet shares the cheap-glow slow-frame streak; only escalates.
- Next plan slice: frame scheduler (rAF + further adaptive quality)
  ([plan](../../plans/adaptive-performance.md) slice 6).
