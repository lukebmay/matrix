# Task — Frame scheduler (rAF + adaptive interval)

**Status:** Done (2026-07-20)  
**Plan:** [adaptive-performance.md](../../plans/completed/adaptive-performance.md)  
**Priority:** P0 — medium gain; last adaptive-performance core slice  
**Depends on:** [weather-scale.md](weather-scale.md) (done)

## Goal

Replace the sticky `setTimeout(FRAME_DELAY)` rain loop with a **vsync-aligned
scheduler** that keeps the ~90ms target cadence, recovers cleanly after
overruns, and **stretches the interval** when work spikes so cheaper frames
beat fighting for FPS. Quality ratchet (cheap glow + weather scale) stays;
thresholds track the live interval.

## Do

1. Drive the matrix loop with `requestAnimationFrame` (cancel on stop/pause).
2. Throttle to base `FRAME_DELAY` (~90ms) — do **not** step every vsync at 60fps.
3. Measure wall time with `performance.now()`; schedule from last **tick**
   (not delay-after-work), so overrun does not stack sticky wait.
4. Adaptive interval: when frame work is heavy, raise target up to a cap
   (~2× base); ease back toward base when light. Prefer fewer frames.
5. Cap sim `dt` so one hitch cannot explode advance (still large enough for
   paint-before-kill tip flush on long steps).
6. Quality ratchet: slow-work / slow-gap budgets use the **current** target
   interval; only escalate; never mutate frozen config.
7. DESIGN + plan + project status.

## Out of scope

- Canvas rain layer (slice 7 optional).
- Frame-`dt` ScenePlayer clock (separate optional).
- Changing default look on capable machines (full neon until ratchet).

## Done when

- [x] Loop uses rAF + throttle (no setTimeout frame chain)
- [x] Overrun does not add full delay-after-work stickiness
- [x] Heavy work stretches interval before/with quality ratchet
- [x] Pause / visibility stop still cancel cleanly; unpause resumes
- [x] `scripts/build.sh` green; DropManager smokes pass

## Session note (2026-07-20)

- `Matrix.mjs`: `requestAnimationFrame` arm; throttle at live `targetInterval`
  (base `FRAME_DELAY` 90ms → max `FRAME_DELAY_MAX` 180ms); tick anchor is last
  tick time; sim dt clamped via `FRAME_DT_MAX_MS` 250.
- Adaptive stretch: work ≥ ~55% of target → interval ≥ work×1.2 (capped); light
  frames ease −5ms toward base.
- Quality ratchet budgets use **live** target (not frozen base only).
- Config: `FRAME_DELAY_MAX`, `FRAME_DT_MAX_MS` on frozen Configuration.
- Docs: DESIGN frame-scheduler section; plan slice 6 complete; project next =
  quote playlist / deploy.
- Files: `Matrix.mjs`, `Configuration.mjs`, `docs/DESIGN.md`, plan + project.
- Next optional plan slice: canvas rain layer (slice 7).
