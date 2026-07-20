# Frame scheduler (rAF + adaptive interval)

**Date:** 2026-07-20  
**Kind:** performance (adaptive-performance slice 6)

## What

Rain frame loop no longer chains `setTimeout(FRAME_DELAY)` after each tick.
It is driven by `requestAnimationFrame`, throttled to ~90ms, with an adaptive
interval and a sim dt clamp.

## Why

Delay-after-work made overruns sticky: wall gap ≈ work + delay forever, with
no vsync alignment. Prefer **fewer cheaper frames** when the main thread is
busy rather than fighting for nominal FPS.

## Fix

| Piece | Change |
| --- | --- |
| Arm | `requestAnimationFrame` / `cancelAnimationFrame` |
| Throttle | Tick only when live target interval elapsed since last tick |
| Adaptive | Stretch toward `FRAME_DELAY_MAX` on heavy work; ease back when light |
| dt | Cap sim step at `FRAME_DT_MAX_MS` (~250) |
| Ratchet | Slow budgets track **live** target interval |

## Files

- `src/js/Matrix.mjs`
- `src/js/Configuration.mjs`
- `docs/DESIGN.md`
- `agents/plans/adaptive-performance.md`
